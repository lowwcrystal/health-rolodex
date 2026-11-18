"""Health Rolodex: Flask JSON API + React single-page app, using direct SQL (no ORM).

Run locally with Python 3.14: python3 server.py
Cloud Run uses the Gunicorn command in Procfile instead of Flask's dev server.
The database schema contract lives in SCHEMA.md.
"""

import logging
import os
import secrets
from functools import lru_cache
from pathlib import Path

from flask import Flask, abort, g, jsonify, request, send_from_directory
from sqlalchemy import URL, create_engine, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from werkzeug.exceptions import HTTPException

from api import api, integrity_message

SPA_DIR = Path(__file__).resolve().parent / "static" / "app"

app = Flask(__name__)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=bool(os.environ.get("K_SERVICE")),  # HTTPS-only cookies on Cloud Run
    JSON_SORT_KEYS=False,
)
app.register_blueprint(api)


@lru_cache(maxsize=1)
def get_engine():
    """Configure the connection pool without opening a connection at import."""
    database_url = URL.create(
        "postgresql+psycopg2",
        username=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        host=os.environ.get("DB_HOST", "127.0.0.1"),
        port=int(os.environ.get("DB_PORT", "5454")),
        database=os.environ.get("DB_NAME", "proj1part2"),
    )
    return create_engine(
        database_url,
        pool_size=1,
        max_overflow=0,
        pool_pre_ping=True,
        pool_timeout=5,
        connect_args={"connect_timeout": 5, "options": "-c statement_timeout=5000"},
    )


def configure_secret_key():
    """Sign session cookies with SECRET_KEY. This must run before the first request, because Flask opens the session before before_request."""
    key = os.environ.get("SECRET_KEY")
    if key:
        app.secret_key = key
    elif not app.secret_key:
        app.secret_key = secrets.token_hex(32)
        app.logger.warning("SECRET_KEY is not set; using a temporary key (logins reset on restart).")


configure_secret_key()  # Gunicorn / Cloud Run: the env var comes from Secret Manager


def wants_json():
    return request.path.startswith("/api/") or request.endpoint == "database_check"


@app.before_request
def before_request():
    """Make a connection available as g.conn for API routes and /db-check."""
    g.conn = None
    g.database_error = None
    g.database_configured = bool(os.environ.get("DB_USER") and os.environ.get("DB_PASSWORD"))
    if request.blueprint != "api" and request.endpoint != "database_check":
        return
    if not g.database_configured:
        g.database_error = "Database credentials are not configured yet. Follow the Cloud Run setup guide."
        return
    try:
        g.conn = get_engine().connect()
        schema = os.environ.get("DB_SCHEMA")
        if schema:
            # Bind the schema value and quote it as one identifier, not raw SQL.
            g.conn.execute(
                text("SELECT set_config('search_path', quote_ident(:schema), false)"),
                {"schema": schema},
            )
            g.conn.commit()
    except (SQLAlchemyError, ValueError, KeyError) as exc:
        # Driver exception messages can contain credentials or connection details.
        app.logger.warning("Database connection failed (%s)", type(exc).__name__)
        if g.conn is not None:
            g.conn.close()
            g.conn = None
        g.database_error = "The database is unavailable. Check the proxy, secrets, and application logs."


@app.teardown_request
def teardown_request(exception):
    """Return the connection to the pool, rolling back unfinished work."""
    conn = g.pop("conn", None)
    if conn is not None:
        conn.close()


def rollback():
    conn = g.get("conn")
    if conn is not None:
        conn.rollback()


@app.errorhandler(IntegrityError)
def integrity_error(error):
    """A constraint the app didn't catch first: roll back and explain, never crash (SCHEMA.md §6.5)."""
    rollback()
    app.logger.info("Integrity error (%s)", type(error.orig).__name__)
    return jsonify(error=integrity_message(error)), 400


@app.errorhandler(SQLAlchemyError)
def database_error(error):
    rollback()
    app.logger.warning("Database operation failed (%s)", type(error).__name__)
    if request.endpoint == "database_check":
        return jsonify(database="unavailable"), 503
    return jsonify(error="The database operation could not be completed. Please try again."), 503


@app.errorhandler(HTTPException)
def http_error(error):
    if request.endpoint == "database_check" and error.code == 503:
        return jsonify(database="unavailable"), 503
    if not wants_json():
        return error
    message = error.description
    if error.code == 503:
        message = g.get("database_error") or "The database is unavailable."
    return jsonify(error=message), error.code


@app.route("/")
@app.route("/login")
@app.route("/signup")
@app.route("/dashboard")
@app.route("/account")
@app.route("/documents")
@app.route("/emergency")
@app.route("/inbox")
@app.route("/doctor")
@app.route("/doctor/dashboard")
@app.route("/doctor/patients/<int:patient_id>")
def spa(**_path_args):
    """Serve the built React app. Client-side routing handles the path."""
    if not (SPA_DIR / "index.html").exists():
        return "Frontend not built yet. Run `npm install && npm run build` in frontend/.", 503
    response = send_from_directory(SPA_DIR, "index.html")
    response.headers["Cache-Control"] = "no-cache"
    return response


@app.route("/db-check")
def database_check():
    if g.get("conn") is None:
        abort(503)
    conn = g.conn
    value = conn.execute(text("SELECT :value"), {"value": 1}).scalar_one()
    schema_accessible = conn.execute(text("""
        SELECT current_schema() IS NOT NULL
            AND has_schema_privilege(current_schema(), 'USAGE')
    """)).scalar_one()
    users_table = conn.execute(text("SELECT to_regclass('users') IS NOT NULL")).scalar_one()
    return jsonify(
        database="ok",
        select_1=value,
        current_schema_accessible=bool(schema_accessible),
        users_table_exists=bool(users_table),
        revision=os.environ.get("K_REVISION", "local"),
    )


if __name__ == "__main__":
    # This is only for local development; Cloud Run runs Gunicorn via Procfile.
    logging.basicConfig(level=logging.INFO)
    from flask.cli import load_dotenv

    load_dotenv()  # read .env now so SECRET_KEY is set before the first request
    configure_secret_key()
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "8111")))

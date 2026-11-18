"""JSON API for the React frontend. Every route here gets g.conn (see server.before_request)."""

from flask import Blueprint, abort, g, session

api = Blueprint("api", __name__, url_prefix="/api")

# Readable messages for constraint violations (constraint names come from SCHEMA.md §3).
CONSTRAINT_MESSAGES = {
    "users_username_key": "That username is already taken.",
    "users_email_key": "An account with that email already exists.",
    "valid_email": "Enter a valid email address.",
    "provider_email_key": "An account with that email already exists.",
    "valid_provider_email": "Enter a valid email address.",
    "users_pcp_provider_id_fkey": "The selected primary care provider no longer exists.",
    "users_pharmacy_id_fkey": "The selected pharmacy no longer exists.",
    "valid_enrollment_dates": "Expiration date must be after the start date.",
    "enrolledin_pkey": "You're already enrolled in that plan.",
    "enrolledin_plan_id_fkey": "That insurance plan no longer exists.",
    "diagnosed_pkey": "That condition is already on your list.",
    "diagnosed_condition_id_fkey": "That condition no longer exists.",
    "relationto_pkey": "You've already added this person.",
    "no_self_relation": "You can't add yourself as a relative.",
    "guardian_must_be_parent_or_guardian": "Only a parent or guardian can be marked as your guardian.",
}


def integrity_message(error):
    diag = getattr(getattr(error, "orig", None), "diag", None)
    name = getattr(diag, "constraint_name", None)
    return CONSTRAINT_MESSAGES.get(name, "That change conflicts with existing data.")


def conn():
    """The request's DB connection; 503 if the database is unavailable."""
    if g.get("conn") is None:
        abort(503)
    return g.conn


def current_user_id():
    user_id = session.get("user_id")
    if user_id is None:
        abort(401, description="Please log in.")
    return user_id


def current_provider_id():
    provider_id = session.get("provider_id")
    if provider_id is None:
        abort(401, description="Please log in as a doctor.")
    return provider_id


def rows(result):
    """Turn a SQLAlchemy result into JSON-serializable dicts (dates become ISO strings)."""
    out = []
    for row in result.mappings():
        item = {}
        for key, value in row.items():
            item[key] = value.isoformat() if hasattr(value, "isoformat") else value
        out.append(item)
    return out


# Import the route modules so they register on the blueprint.
from api import auth, care, doctor, doctor_patients, documents, family, health, patient  # noqa: E402,F401

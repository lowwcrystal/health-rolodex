"""Patient signup; one email + password login for patients (users) and doctors (provider); logout, session lookup, and signup dropdown options."""

from flask import abort, jsonify, request, session
from sqlalchemy import text
from werkzeug.security import check_password_hash, generate_password_hash

from api import api, conn, rows
from schema_rules import parse_date, parse_int, require_email, require_password, require_str

# Compared against when the email doesn't exist, so the response time doesn't reveal whether an account exists.
_DUMMY_HASH = generate_password_hash("not-a-real-password")


def json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400, description="Expected a JSON object.")
    return data


def public_user(user_id):
    """The logged-in user's public fields. Never selects password_hash."""
    row = conn().execute(text("""
        SELECT user_id, username, email, first_name, last_name
        FROM users WHERE user_id = :uid
    """), {"uid": user_id}).mappings().first()
    return dict(row) if row else None


def public_provider(provider_id):
    """The logged-in doctor's public fields. Never selects password_hash."""
    row = conn().execute(text("""
        SELECT provider_id, provider_name, email FROM provider WHERE provider_id = :pid
    """), {"pid": provider_id}).mappings().first()
    return dict(row) if row else None


@api.post("/auth/signup")
def signup():
    """Patients only. Doctor accounts are provider rows seeded by hand (SCHEMA.md change 3)."""
    data = json_body()
    fields = {
        "username": require_str(data, "username"),
        "email": require_email(data),
        "first_name": require_str(data, "first_name"),
        "middle_name": require_str(data, "middle_name", required=False),
        "last_name": require_str(data, "last_name"),
        "gender": require_str(data, "gender", required=False),
        "dob": parse_date(data, "dob", allow_future=False),
        "pcp_provider_id": parse_int(data, "pcp_provider_id", required=False),
        "pharmacy_id": parse_int(data, "pharmacy_id", required=False),
    }
    password = require_password(data)

    db = conn()
    taken = db.execute(text("""
        SELECT
            EXISTS (SELECT 1 FROM users WHERE lower(username) = lower(:username)) AS username_taken,
            (EXISTS (SELECT 1 FROM users WHERE lower(email) = lower(:email))
             OR EXISTS (SELECT 1 FROM provider WHERE lower(email) = lower(:email))) AS email_taken
    """), {"username": fields["username"], "email": fields["email"]}).mappings().one()
    if taken["username_taken"]:
        abort(400, description="That username is already taken.")
    if taken["email_taken"]:
        abort(400, description="An account with that email already exists.")

    # No sequence on users.user_id (SCHEMA.md §6.1): generate the key in the same statement.
    user_id = db.execute(text("""
        INSERT INTO users (user_id, username, email, gender, dob, first_name, middle_name, last_name,
                           pcp_provider_id, pharmacy_id, password_hash)
        SELECT COALESCE(MAX(user_id), 0) + 1, :username, :email, :gender, :dob, :first_name, :middle_name,
               :last_name, :pcp_provider_id, :pharmacy_id, :password_hash
        FROM users
        RETURNING user_id
    """), {**fields, "password_hash": generate_password_hash(password)}).scalar_one()
    db.commit()

    session.clear()
    session["user_id"] = user_id
    return jsonify(role="patient", user=public_user(user_id)), 201


@api.post("/auth/login")
def login():
    """One form for both roles: the email is looked up in users (patient), then provider (doctor)."""
    data = json_body()
    email = require_str(data, "email")
    password = data.get("password")
    if not isinstance(password, str) or not password:
        abort(400, description="Password is required.")

    row = conn().execute(text("""
        SELECT 'patient' AS role, user_id AS id, password_hash, 0 AS ord FROM users WHERE lower(email) = lower(:email)
        UNION ALL
        SELECT 'doctor', provider_id, password_hash, 1 FROM provider WHERE lower(email) = lower(:email)
        ORDER BY ord
        LIMIT 1
    """), {"email": email}).mappings().first()
    stored = row["password_hash"] if row else None
    password_ok = check_password_hash(stored or _DUMMY_HASH, password)
    if not stored or not password_ok:
        abort(401, description="Incorrect email or password.")

    session.clear()
    if row["role"] == "doctor":
        session["provider_id"] = row["id"]
        return jsonify(role="doctor", provider=public_provider(row["id"]))
    session["user_id"] = row["id"]
    return jsonify(role="patient", user=public_user(row["id"]))


@api.post("/auth/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@api.get("/auth/me")
def me():
    if session.get("user_id") is not None:
        user = public_user(session["user_id"])
        if user:
            return jsonify(role="patient", user=user)
    if session.get("provider_id") is not None:
        provider = public_provider(session["provider_id"])
        if provider:
            return jsonify(role="doctor", provider=provider)
    session.clear()
    abort(401, description="Not logged in.")


@api.get("/options")
def options():
    db = conn()
    providers = rows(db.execute(text("""
        SELECT p.provider_id, p.provider_name, CAST(p.rating AS float) AS rating,
               COALESCE(string_agg(s.speciality_name, ', ' ORDER BY s.speciality_name), '') AS specialities
        FROM provider p
        LEFT JOIN specializesin si ON si.provider_id = p.provider_id
        LEFT JOIN speciality s ON s.speciality_id = si.speciality_id
        GROUP BY p.provider_id, p.provider_name, p.rating
        ORDER BY p.provider_name
    """)))
    pharmacies = rows(db.execute(text("""
        SELECT pharmacy_id, pharmacy_name, address FROM pharmacy ORDER BY pharmacy_name
    """)))
    plans = rows(db.execute(text("""
        SELECT plan_id, plan_name, plan_type, plan_holder FROM insuranceplan ORDER BY plan_name
    """)))
    conditions = rows(db.execute(text("""
        SELECT condition_id, condition_name, category FROM condition ORDER BY condition_name
    """)))
    facilities = rows(db.execute(text("""
        SELECT facility_id, facility_name, address FROM facility ORDER BY facility_name
    """)))
    specialities = rows(db.execute(text("""
        SELECT s.speciality_id, s.speciality_name,
               COALESCE(array_agg(si.provider_id ORDER BY si.provider_id) FILTER (WHERE si.provider_id IS NOT NULL),
                        '{}') AS provider_ids
        FROM speciality s LEFT JOIN specializesin si ON si.speciality_id = s.speciality_id
        GROUP BY s.speciality_id, s.speciality_name
        ORDER BY s.speciality_name
    """)))
    return jsonify(providers=providers, pharmacies=pharmacies, plans=plans, conditions=conditions,
                   facilities=facilities, specialities=specialities)

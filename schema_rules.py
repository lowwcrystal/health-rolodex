"""Python mirror of SCHEMA.md §5 (domain values) and §6.2 (length limits), plus input validators.

Every route validates input through these helpers so the app rejects bad data before the database does.
If SCHEMA.md changes, change this file (and frontend/src/types/schema.ts) in the same commit.
"""

from datetime import date

from flask import abort

# SCHEMA.md §5: must match the CHECK constraints exactly.
CATEGORIES = ("allergy", "chronic", "genetic")
RECORD_TYPES = ("lab_result", "imaging", "prescription", "visit_summary", "immunization", "other")
RELATION_TYPES = ("parent", "child", "sibling", "spouse", "guardian", "other")

# SCHEMA.md §6.2: varchar limits.
MAX_LEN = {
    "username": 30,
    "email": 100,
    "gender": 20,
    "first_name": 30,
    "middle_name": 30,
    "last_name": 30,
    "provider_name": 50,
    "pharmacy_name": 100,
    "facility_name": 100,
    "address": 150,
    "plan_type": 30,
    "plan_name": 50,
    "plan_holder": 50,
    "condition_name": 50,
    "category": 20,
    "speciality_name": 50,
    "record_type": 30,
    "notes": 500,
    "file_link": 255,
    "relation_type": 30,
}

# Rules for the plain password (it's stored only as a hash in users.password_hash).
PASSWORD_MIN = 8
PASSWORD_MAX = 128

LABELS = {
    "username": "Username",
    "email": "Email",
    "gender": "Gender",
    "first_name": "First name",
    "middle_name": "Middle name",
    "last_name": "Last name",
    "dob": "Date of birth",
    "password": "Password",
    "front_url": "Front link",
    "back_url": "Back link",
    "file_url": "File link",
    "notes": "Notes",
}


def _label(field):
    return LABELS.get(field, field.replace("_", " ").capitalize())


def require_str(data, field, required=True, max_len=None):
    """Return a stripped string; an empty optional field becomes None. Calls abort(400) if invalid."""
    value = data.get(field)
    if value is None:
        value = ""
    if not isinstance(value, str):
        abort(400, description=f"{_label(field)} must be text.")
    value = value.strip()
    if not value:
        if required:
            abort(400, description=f"{_label(field)} is required.")
        return None
    limit = max_len or MAX_LEN.get(field)
    if limit is not None and len(value) > limit:
        abort(400, description=f"{_label(field)} must be at most {limit} characters.")
    return value


def require_email(data, field="email"):
    value = require_str(data, field).lower()
    if "@" not in value:  # valid_email CHECK (email LIKE '%@%')
        abort(400, description="Enter a valid email address.")
    return value


def require_password(data, field="password"):
    value = data.get(field)
    if not isinstance(value, str) or not (PASSWORD_MIN <= len(value) <= PASSWORD_MAX):
        abort(400, description=f"Password must be {PASSWORD_MIN}-{PASSWORD_MAX} characters.")
    return value


def parse_date(data, field, required=True, allow_future=True):
    raw = data.get(field)
    if raw in (None, ""):
        if required:
            abort(400, description=f"{_label(field)} is required.")
        return None
    try:
        value = date.fromisoformat(str(raw))
    except ValueError:
        abort(400, description=f"{_label(field)} must be a valid date (YYYY-MM-DD).")
    if not allow_future and value > date.today():
        abort(400, description=f"{_label(field)} can't be in the future.")
    return value


def parse_int(data, field, required=True):
    raw = data.get(field)
    if raw in (None, ""):
        if required:
            abort(400, description=f"{_label(field)} is required.")
        return None
    if isinstance(raw, bool):
        abort(400, description=f"{_label(field)} must be a whole number.")
    try:
        return int(raw)
    except (TypeError, ValueError):
        abort(400, description=f"{_label(field)} must be a whole number.")


def require_choice(data, field, choices, required=True):
    value = require_str(data, field, required=required)
    if value is not None and value not in choices:
        abort(400, description=f"{_label(field)} must be one of: {', '.join(choices)}.")
    return value


# Document kinds for "My Documents" (SCHEMA.md §6.6). There's no schema change: cards and ID are stored as
# record_type 'other' with the kind at the start of notes, and a two-sided kind becomes two records rows (front, back).
# key: (label, record_type, two_sided, notes_prefix)
DOCUMENT_KINDS = {
    "lab_result": ("Lab result", "lab_result", False, None),
    "imaging": ("Imaging", "imaging", False, None),
    "prescription": ("Prescription", "prescription", False, None),
    "visit_summary": ("Visit summary", "visit_summary", False, None),
    "immunization": ("Immunization", "immunization", False, None),
    "insurance_card": ("Insurance card", "other", True, "Insurance card"),
    "photo_id": ("Photo ID", "other", True, "Photo ID"),
    "pharmacy_card": ("Pharmacy card", "other", True, "Pharmacy card"),
    "other": ("Other", "other", False, None),
}


def require_url(data, field, required=True):
    """An http(s) URL that fits records.file_link varchar(255). Other schemes (javascript:, data:, ...) are rejected."""
    from urllib.parse import urlparse

    value = require_str(data, field, required=required, max_len=MAX_LEN["file_link"])
    if value is None:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or any(ch.isspace() for ch in value):
        abort(400, description="Enter a full link starting with https://")
    return value


def compose_notes(prefix, side, notes):
    """Build records.notes for a document, e.g. 'Insurance card (front): member since 2024'. Max 500 chars."""
    if prefix is None:
        full = notes
    else:
        head = f"{prefix} ({side})" if side else prefix
        full = f"{head}: {notes}" if notes else head
    if full is not None and len(full) > MAX_LEN["notes"]:
        abort(400, description=f"Notes are too long (max {MAX_LEN['notes']} characters including the document label).")
    return full

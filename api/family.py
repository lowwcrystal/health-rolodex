"""Family and emergency contacts, with the other person accepting. Uses relationto as-is (no schema change).

relationto is one-way (SCHEMA.md §6.3): a row (A -> B, type) means "B is A's <type>".
  pending   = only (A -> B) exists: A asked, B hasn't answered
  confirmed = (A -> B) and (B -> A) both exist: B accepted and chose their own type and flags
  declined / removed = neither row
Each person only ever writes their own row (user_id = the logged-in user), except Remove/Decline, which delete the link.
"""

from flask import abort, jsonify
from sqlalchemy import text

from api import api, conn, current_user_id, rows
from api.auth import json_body
from schema_rules import RELATION_TYPES, require_choice, require_email

GUARDIAN_TYPES = ("parent", "guardian")  # guardian_must_be_parent_or_guardian


def _flag(data, field):
    value = data.get(field, False)
    if not isinstance(value, bool):
        abort(400, description=f"{field.replace('_', ' ').capitalize()} must be true or false.")
    return value


def _relation_fields(data):
    """relation_type from RELATION_TYPES (SCHEMA §5) and the two flags, with the guardian rule checked first."""
    relation_type = require_choice(data, "relation_type", RELATION_TYPES)
    is_emergency_contact = _flag(data, "is_emergency_contact")
    is_guardian = _flag(data, "is_guardian")
    if is_guardian and relation_type not in GUARDIAN_TYPES:
        abort(400, description="Only a parent or guardian can be marked as your guardian.")
    return {"relation_type": relation_type, "is_emergency_contact": is_emergency_contact, "is_guardian": is_guardian}


def _row_exists(db, user_id, relative_id):
    return db.execute(text("""
        SELECT 1 FROM relationto WHERE user_id = :a AND relative_id = :b
    """), {"a": user_id, "b": relative_id}).first() is not None


def _insert(db, user_id, relative_id, fields):
    db.execute(text("""
        INSERT INTO relationto (user_id, relative_id, relation_type, is_emergency_contact, is_guardian)
        VALUES (:uid, :rid, :relation_type, :is_emergency_contact, :is_guardian)
    """), {"uid": user_id, "rid": relative_id, **fields})


@api.post("/patient/family")
def add_relative():
    """Ask someone (found by exact email) to be my relative. If they already asked me, this accepts their request."""
    uid = current_user_id()
    data = json_body()
    email = require_email(data)
    if len(email) > 100:
        abort(400, description="Email must be at most 100 characters.")
    fields = _relation_fields(data)

    db = conn()
    found = db.execute(text("SELECT user_id FROM users WHERE lower(email) = :email"), {"email": email}).first()
    if found is None:
        abort(400, description="No Health Rolodex account uses that email.")
    rid = found[0]
    if rid == uid:  # no_self_relation
        abort(400, description="You can't add yourself as a relative.")
    if _row_exists(db, uid, rid):
        abort(400, description="You've already added this person.")

    _insert(db, uid, rid, fields)
    db.commit()
    return jsonify(relative_id=rid, confirmed=_row_exists(db, rid, uid)), 201


@api.put("/patient/family/<int:relative_id>")
def edit_relative(relative_id):
    """Change my own row: what they are to me, and whether they're my emergency contact or guardian."""
    uid = current_user_id()
    fields = _relation_fields(json_body())
    db = conn()
    updated = db.execute(text("""
        UPDATE relationto
        SET relation_type = :relation_type, is_emergency_contact = :is_emergency_contact, is_guardian = :is_guardian
        WHERE user_id = :uid AND relative_id = :rid
    """), {"uid": uid, "rid": relative_id, **fields})
    if updated.rowcount == 0:
        db.rollback()
        abort(404, description="That person isn't in your family list.")
    db.commit()
    return jsonify(ok=True)


@api.delete("/patient/family/<int:relative_id>")
def remove_relative(relative_id):
    """Unlink both ways (also cancels a request I sent). Deleting relationto rows is never blocked (§6.4)."""
    uid = current_user_id()
    db = conn()
    deleted = db.execute(text("""
        DELETE FROM relationto
        WHERE (user_id = :uid AND relative_id = :rid) OR (user_id = :rid AND relative_id = :uid)
    """), {"uid": uid, "rid": relative_id})
    if deleted.rowcount == 0:
        db.rollback()
        abort(404, description="That person isn't in your family list.")
    db.commit()
    return jsonify(ok=True)


def _pending_request(db, requester_id, uid):
    """True when requester -> me exists and I haven't answered (no me -> requester)."""
    return _row_exists(db, requester_id, uid) and not _row_exists(db, uid, requester_id)


@api.post("/patient/family/requests/<int:requester_id>/accept")
def accept_request(requester_id):
    uid = current_user_id()
    fields = _relation_fields(json_body())
    db = conn()
    if not _pending_request(db, requester_id, uid):
        abort(404, description="That request isn't pending anymore.")
    _insert(db, uid, requester_id, fields)
    db.commit()
    return jsonify(ok=True), 201


@api.delete("/patient/family/requests/<int:requester_id>")
def decline_request(requester_id):
    uid = current_user_id()
    db = conn()
    deleted = db.execute(text("""
        DELETE FROM relationto r
        WHERE r.user_id = :rid AND r.relative_id = :uid
          AND NOT EXISTS (SELECT 1 FROM relationto x WHERE x.user_id = :uid AND x.relative_id = :rid)
    """), {"uid": uid, "rid": requester_id})
    if deleted.rowcount == 0:
        db.rollback()
        abort(404, description="That request isn't pending anymore.")
    db.commit()
    return jsonify(ok=True)


@api.get("/patient/inbox")
def inbox():
    """Requests for me, requests I sent that are still pending, and my documents shared with doctors."""
    uid = current_user_id()
    db = conn()
    params = {"uid": uid}

    requests = rows(db.execute(text("""
        SELECT u.user_id, u.first_name, u.last_name, r.relation_type
        FROM relationto r JOIN users u ON u.user_id = r.user_id
        WHERE r.relative_id = :uid
          AND NOT EXISTS (SELECT 1 FROM relationto x WHERE x.user_id = :uid AND x.relative_id = r.user_id)
        ORDER BY u.last_name, u.first_name
    """), params))

    sent = rows(db.execute(text("""
        SELECT u.user_id, u.first_name, u.last_name, r.relation_type, r.is_emergency_contact, r.is_guardian
        FROM relationto r JOIN users u ON u.user_id = r.relative_id
        WHERE r.user_id = :uid
          AND NOT EXISTS (SELECT 1 FROM relationto x WHERE x.user_id = r.relative_id AND x.relative_id = :uid)
        ORDER BY u.last_name, u.first_name
    """), params))

    shares = rows(db.execute(text("""
        SELECT rec.record_no, rec.record_type, rec.notes, rec.upload_date, p.provider_id, p.provider_name
        FROM sharedwith sw
        JOIN records rec ON rec.record_no = sw.record_no AND rec.user_id = sw.user_id
        JOIN provider p ON p.provider_id = sw.provider_id
        WHERE sw.user_id = :uid
        ORDER BY rec.upload_date DESC, rec.record_no DESC, p.provider_name
    """), params))

    return jsonify(requests=requests, sent=sent, shares=shares)

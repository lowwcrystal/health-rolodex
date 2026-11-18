"""Doctor portal: my patients, a patient's profile, logging visits, creating documents, referrals, unlinking.

No schema change. "My patient" is derived from existing links for the selected provider (pid):
  users.pcp_provider_id = pid  OR  a visit with provider_id = pid  OR  a sharedwith row with provider_id = pid.
A doctor can only open or act on linked patients; anyone else is a 404.

Doctor-made documents are records rows in the patient's own records (record_no per user, SCHEMA §6.1), always
shareable and shared with the creating doctor. Notes conventions (SCHEMA §6.6):
  "From <provider_name>: <notes>"                               a document a doctor created
  "Referral from <A> to <B> (<speciality>): <reason>"           a referral (record_type 'other')
"""

from flask import abort, jsonify
from sqlalchemy import text

from api import api, conn, current_provider_id, rows
from api.auth import json_body
from api.documents import parse_provider_ids
from schema_rules import MAX_LEN, RECORD_TYPES, parse_date, parse_int, require_choice, require_str, require_url

def _provider_name(db, pid):
    name = db.execute(text("SELECT provider_name FROM provider WHERE provider_id = :pid"), {"pid": pid}).scalar()
    if name is None:
        abort(401, description="That provider no longer exists.")
    return name


def _require_linked(db, pid, uid):
    linked = db.execute(text("""
        SELECT EXISTS (SELECT 1 FROM users lu WHERE lu.user_id = :uid AND lu.pcp_provider_id = :pid)
            OR EXISTS (SELECT 1 FROM visit lv WHERE lv.user_id = :uid AND lv.provider_id = :pid)
            OR EXISTS (SELECT 1 FROM sharedwith ls WHERE ls.user_id = :uid AND ls.provider_id = :pid)
    """), {"pid": pid, "uid": uid}).scalar()
    if not linked:
        abort(404, description="That patient isn't linked to you.")


def _notes(prefix, body):
    full = f"{prefix}: {body}" if body else prefix
    if len(full) > MAX_LEN["notes"]:
        abort(400, description=f"Notes are too long (max {MAX_LEN['notes']} characters including \"{prefix}:\").")
    return full


def _insert_record(db, uid, record_type, notes, file_link):
    return db.execute(text("""
        INSERT INTO records (record_no, user_id, is_shareable, record_type, notes, file_link)
        SELECT COALESCE(MAX(record_no), 0) + 1, :uid, true, :record_type, :notes, :file_link
        FROM records WHERE user_id = :uid
        RETURNING record_no
    """), {"uid": uid, "record_type": record_type, "notes": notes, "file_link": file_link}).scalar_one()


def _share(db, record_no, uid, provider_id):
    db.execute(text("""
        INSERT INTO sharedwith (record_no, user_id, provider_id, is_shareable)
        VALUES (:record_no, :uid, :provider_id, true)
        ON CONFLICT (record_no, user_id, provider_id) DO NOTHING
    """), {"record_no": record_no, "uid": uid, "provider_id": provider_id})


@api.get("/doctor/patients")
def doctor_patients():
    pid = current_provider_id()
    patients = rows(conn().execute(text("""
        SELECT u.user_id, u.first_name, u.last_name, u.dob, u.gender,
               (u.pcp_provider_id = :pid) IS TRUE AS is_pcp,
               (SELECT count(*) FROM visit v WHERE v.user_id = u.user_id AND v.provider_id = :pid) AS visit_count,
               (SELECT max(v.visit_date) FROM visit v WHERE v.user_id = u.user_id AND v.provider_id = :pid) AS last_seen,
               (SELECT count(*) FROM sharedwith s WHERE s.user_id = u.user_id AND s.provider_id = :pid) AS shared_count
        FROM users u
        WHERE u.pcp_provider_id = :pid
           OR EXISTS (SELECT 1 FROM visit v WHERE v.user_id = u.user_id AND v.provider_id = :pid)
           OR EXISTS (SELECT 1 FROM sharedwith s WHERE s.user_id = u.user_id AND s.provider_id = :pid)
        ORDER BY u.last_name, u.first_name
    """), {"pid": pid}))
    return jsonify(patients=patients)


@api.get("/doctor/patients/<int:uid>")
def doctor_patient(uid):
    pid = current_provider_id()
    db = conn()
    _require_linked(db, pid, uid)
    params = {"pid": pid, "uid": uid}

    profile = rows(db.execute(text("""
        SELECT u.user_id, u.first_name, u.middle_name, u.last_name, u.dob, u.gender, u.email,
               (u.pcp_provider_id = :pid) IS TRUE AS is_pcp
        FROM users u WHERE u.user_id = :uid
    """), params))[0]

    conditions = rows(db.execute(text("""
        SELECT c.condition_id, c.condition_name, c.category, d.diagnosed_date,
               COALESCE(string_agg(s.speciality_name, ', ' ORDER BY s.speciality_name), '') AS recommended_specialities
        FROM diagnosed d
        JOIN condition c ON c.condition_id = d.condition_id
        LEFT JOIN recommends r ON r.condition_id = c.condition_id
        LEFT JOIN speciality s ON s.speciality_id = r.speciality_id
        WHERE d.user_id = :uid
        GROUP BY c.condition_id, c.condition_name, c.category, d.diagnosed_date
        ORDER BY d.diagnosed_date DESC
    """), params))

    visits = rows(db.execute(text("""
        SELECT v.visit_id, v.visit_date, f.facility_id, f.facility_name
        FROM visit v JOIN facility f ON f.facility_id = v.facility_id
        WHERE v.user_id = :uid AND v.provider_id = :pid
        ORDER BY v.visit_date DESC, v.visit_id DESC
    """), params))

    documents = rows(db.execute(text("""
        SELECT r.record_no, r.record_type, r.notes, r.file_link, r.upload_date
        FROM sharedwith sw
        JOIN records r ON r.record_no = sw.record_no AND r.user_id = sw.user_id
        WHERE sw.user_id = :uid AND sw.provider_id = :pid
        ORDER BY r.upload_date DESC, r.record_no DESC
    """), params))

    recommended = rows(db.execute(text("""
        SELECT DISTINCT s.speciality_id, s.speciality_name
        FROM diagnosed d
        JOIN recommends r ON r.condition_id = d.condition_id
        JOIN speciality s ON s.speciality_id = r.speciality_id
        WHERE d.user_id = :uid
        ORDER BY s.speciality_name
    """), params))

    return jsonify(profile=profile, conditions=conditions, visits=visits, documents=documents,
                   recommended_specialities=recommended)


def _visit_fields(db, data):
    visit_date = parse_date(data, "visit_date", allow_future=False)
    facility_id = parse_int(data, "facility_id")
    if db.execute(text("SELECT 1 FROM facility WHERE facility_id = :fid"), {"fid": facility_id}).first() is None:
        abort(400, description="That facility doesn't exist.")
    return visit_date, facility_id


@api.post("/doctor/patients/<int:uid>/visits")
def doctor_log_visit(uid):
    pid = current_provider_id()
    data = json_body()
    db = conn()
    _require_linked(db, pid, uid)
    visit_date, facility_id = _visit_fields(db, data)
    # visit has no sequence (SCHEMA §6.1): generate the id in the same statement.
    visit_id = db.execute(text("""
        INSERT INTO visit (visit_id, visit_date, user_id, provider_id, facility_id)
        SELECT COALESCE(MAX(visit_id), 0) + 1, :visit_date, :uid, :pid, :fid FROM visit
        RETURNING visit_id
    """), {"visit_date": visit_date, "uid": uid, "pid": pid, "fid": facility_id}).scalar_one()
    db.commit()
    return jsonify(visit_id=visit_id), 201


@api.put("/doctor/visits/<int:visit_id>")
def doctor_edit_visit(visit_id):
    pid = current_provider_id()
    data = json_body()
    db = conn()
    visit_date, facility_id = _visit_fields(db, data)
    updated = db.execute(text("""
        UPDATE visit SET visit_date = :visit_date, facility_id = :fid
        WHERE visit_id = :vid AND provider_id = :pid
    """), {"visit_date": visit_date, "fid": facility_id, "vid": visit_id, "pid": pid})
    if updated.rowcount == 0:
        db.rollback()
        abort(404, description="That visit isn't one of yours.")
    db.commit()
    return jsonify(ok=True)


@api.post("/doctor/patients/<int:uid>/documents")
def doctor_create_document(uid):
    pid = current_provider_id()
    data = json_body()
    record_type = require_choice(data, "record_type", RECORD_TYPES)
    body = require_str(data, "notes", required=False)
    file_link = require_url(data, "file_link", required=False)
    extra = [p for p in parse_provider_ids(data) if p != pid]

    db = conn()
    _require_linked(db, pid, uid)
    notes = _notes(f"From {_provider_name(db, pid)}", body)
    if extra:
        found = db.execute(text("SELECT count(*) FROM provider WHERE provider_id = ANY(:ids)"), {"ids": extra}).scalar_one()
        if found != len(extra):
            abort(400, description="One of the selected doctors doesn't exist.")

    record_no = _insert_record(db, uid, record_type, notes, file_link)
    for provider_id in [pid, *extra]:
        _share(db, record_no, uid, provider_id)
    db.commit()
    return jsonify(record_no=record_no, shared_with=[pid, *extra]), 201


@api.post("/doctor/patients/<int:uid>/referrals")
def doctor_refer(uid):
    pid = current_provider_id()
    data = json_body()
    target = parse_int(data, "provider_id")
    if target == pid:
        abort(400, description="Choose a different doctor to refer to.")
    reason = require_str(data, "reason", required=False)
    raw = data.get("share_record_nos") or []
    if not isinstance(raw, list) or any(isinstance(n, bool) or not isinstance(n, int) for n in raw) or len(raw) > 50:
        abort(400, description="share_record_nos must be a list of whole numbers.")
    share_nos = list(dict.fromkeys(raw))

    db = conn()
    _require_linked(db, pid, uid)
    me = _provider_name(db, pid)
    to = db.execute(text("""
        SELECT p.provider_name,
               (SELECT string_agg(s.speciality_name, ', ' ORDER BY s.speciality_name)
                FROM specializesin si JOIN speciality s ON s.speciality_id = si.speciality_id
                WHERE si.provider_id = p.provider_id) AS specialities
        FROM provider p WHERE p.provider_id = :target
    """), {"target": target}).mappings().first()
    if to is None:
        abort(400, description="That doctor doesn't exist.")

    if share_nos:
        # Only documents this patient already shared with me (and so are shareable) can be passed on.
        allowed = db.execute(text("""
            SELECT count(*) FROM sharedwith
            WHERE user_id = :uid AND provider_id = :pid AND record_no = ANY(:nos)
        """), {"uid": uid, "pid": pid, "nos": share_nos}).scalar_one()
        if allowed != len(share_nos):
            abort(400, description="You can only pass on documents the patient shared with you.")

    label = f"Referral from {me} to {to['provider_name']}" + (f" ({to['specialities']})" if to["specialities"] else "")
    record_no = _insert_record(db, uid, "other", _notes(label, reason), None)
    for provider_id in (pid, target):
        _share(db, record_no, uid, provider_id)
    for n in share_nos:
        _share(db, n, uid, target)
    db.commit()
    return jsonify(record_no=record_no, referred_to=target, shared_records=share_nos), 201


@api.delete("/doctor/patients/<int:uid>")
def doctor_remove_patient(uid):
    """Unlink: stop being their PCP and drop their shares to me. Visit history stays (SCHEMA §6.4: nothing cascades)."""
    pid = current_provider_id()
    db = conn()
    _require_linked(db, pid, uid)
    params = {"uid": uid, "pid": pid}
    db.execute(text("UPDATE users SET pcp_provider_id = NULL WHERE user_id = :uid AND pcp_provider_id = :pid"), params)
    db.execute(text("DELETE FROM sharedwith WHERE user_id = :uid AND provider_id = :pid"), params)
    db.commit()
    return jsonify(ok=True)

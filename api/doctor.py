"""Doctor portal: a doctor logs in with their provider email + password (api/auth.py), then sees their specialties,
the records shared with them, and their visits.
"""

from flask import abort, jsonify, request, session
from sqlalchemy import text

from api import api, conn, current_provider_id, rows
from api.auth import json_body
from schema_rules import RECORD_TYPES, require_choice


@api.get("/doctor/providers")
def doctor_providers():
    providers = rows(conn().execute(text("""
        SELECT p.provider_id, p.provider_name, CAST(p.rating AS float) AS rating,
               COALESCE(string_agg(s.speciality_name, ', ' ORDER BY s.speciality_name), '') AS specialities
        FROM provider p
        LEFT JOIN specializesin si ON si.provider_id = p.provider_id
        LEFT JOIN speciality s ON s.speciality_id = si.speciality_id
        GROUP BY p.provider_id, p.provider_name, p.rating
        ORDER BY p.provider_name
    """)))
    return jsonify(providers=providers)


@api.get("/doctor/dashboard")
def doctor_dashboard():
    pid = current_provider_id()
    record_type = require_choice(request.args, "record_type", RECORD_TYPES, required=False)
    db = conn()

    provider = rows(db.execute(text("""
        SELECT p.provider_id, p.provider_name, CAST(p.rating AS float) AS rating,
               (SELECT count(*) FROM users WHERE pcp_provider_id = p.provider_id) AS pcp_patient_count
        FROM provider p WHERE p.provider_id = :pid
    """), {"pid": pid}))
    if not provider:
        session.clear()
        abort(401, description="That provider no longer exists.")

    specialities = rows(db.execute(text("""
        SELECT s.speciality_id, s.speciality_name
        FROM specializesin si JOIN speciality s ON s.speciality_id = si.speciality_id
        WHERE si.provider_id = :pid
        ORDER BY s.speciality_name
    """), {"pid": pid}))

    shared_records = rows(db.execute(text("""
        SELECT sw.record_no, sw.user_id, u.first_name, u.last_name, u.dob,
               r.record_type, r.upload_date, r.notes, r.file_link
        FROM sharedwith sw
        JOIN records r ON r.record_no = sw.record_no AND r.user_id = sw.user_id
        JOIN users u ON u.user_id = sw.user_id
        WHERE sw.provider_id = :pid
          AND (CAST(:record_type AS varchar) IS NULL OR r.record_type = :record_type)
        ORDER BY r.upload_date DESC, u.last_name
    """), {"pid": pid, "record_type": record_type}))

    visits = rows(db.execute(text("""
        SELECT v.visit_id, v.visit_date, u.user_id, u.first_name, u.last_name,
               f.facility_id, f.facility_name
        FROM visit v
        JOIN users u ON u.user_id = v.user_id
        JOIN facility f ON f.facility_id = v.facility_id
        WHERE v.provider_id = :pid
        ORDER BY v.visit_date DESC, v.visit_id DESC
    """), {"pid": pid}))

    return jsonify(
        provider=provider[0],
        specialities=specialities,
        shared_records=shared_records,
        visits=visits,
        record_type_filter=record_type,
    )

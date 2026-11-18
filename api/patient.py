"""Patient dashboard: one user's whole 'rolodex' across every table that references users."""

from flask import abort, jsonify, session
from sqlalchemy import text

from api import api, conn, current_user_id, rows
from api.insights import build_insights


@api.get("/patient/dashboard")
def patient_dashboard():
    uid = current_user_id()
    db = conn()
    params = {"uid": uid}

    profile = rows(db.execute(text("""
        SELECT u.user_id, u.username, u.email, u.gender, u.dob,
               u.first_name, u.middle_name, u.last_name,
               u.pcp_provider_id, p.provider_name AS pcp_name, CAST(p.rating AS float) AS pcp_rating,
               (SELECT string_agg(s.speciality_name, ', ' ORDER BY s.speciality_name)
                FROM specializesin si JOIN speciality s ON s.speciality_id = si.speciality_id
                WHERE si.provider_id = u.pcp_provider_id) AS pcp_specialities,
               u.pharmacy_id, ph.pharmacy_name, ph.address AS pharmacy_address
        FROM users u
        LEFT JOIN provider p ON p.provider_id = u.pcp_provider_id
        LEFT JOIN pharmacy ph ON ph.pharmacy_id = u.pharmacy_id
        WHERE u.user_id = :uid
    """), params))
    if not profile:
        session.clear()
        abort(401, description="Your account no longer exists. Please sign up again.")

    plans = rows(db.execute(text("""
        SELECT ip.plan_id, ip.plan_name, ip.plan_type, ip.plan_holder,
               e.start_date, e.expiration_date,
               (e.expiration_date IS NULL OR e.expiration_date >= CURRENT_DATE) AS is_active
        FROM enrolledin e
        JOIN insuranceplan ip ON ip.plan_id = e.plan_id
        WHERE e.user_id = :uid
        ORDER BY is_active DESC, e.start_date DESC
    """), params))

    in_network = rows(db.execute(text("""
        SELECT f.facility_id, f.facility_name, f.address,
               string_agg(DISTINCT ip.plan_name, ', ') AS via_plans
        FROM enrolledin e
        JOIN accepts a ON a.plan_id = e.plan_id
        JOIN facility f ON f.facility_id = a.facility_id
        JOIN insuranceplan ip ON ip.plan_id = e.plan_id
        WHERE e.user_id = :uid
          AND (e.expiration_date IS NULL OR e.expiration_date >= CURRENT_DATE)
        GROUP BY f.facility_id, f.facility_name, f.address
        ORDER BY f.facility_name
    """), params))

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
        SELECT v.visit_id, v.visit_date, p.provider_id, p.provider_name,
               f.facility_id, f.facility_name, f.address AS facility_address
        FROM visit v
        JOIN provider p ON p.provider_id = v.provider_id
        JOIN facility f ON f.facility_id = v.facility_id
        WHERE v.user_id = :uid
        ORDER BY v.visit_date DESC, v.visit_id DESC
    """), params))

    records = rows(db.execute(text("""
        SELECT r.record_no, r.record_type, r.is_shareable, r.notes, r.file_link, r.upload_date,
               COALESCE(
                   json_agg(json_build_object('provider_id', p.provider_id, 'provider_name', p.provider_name)
                            ORDER BY p.provider_name) FILTER (WHERE p.provider_id IS NOT NULL),
                   '[]'::json) AS shared_with
        FROM records r
        LEFT JOIN sharedwith sw ON sw.record_no = r.record_no AND sw.user_id = r.user_id
        LEFT JOIN provider p ON p.provider_id = sw.provider_id
        WHERE r.user_id = :uid
        GROUP BY r.record_no, r.user_id
        ORDER BY r.upload_date DESC, r.record_no DESC
    """), params))

    family = rows(db.execute(text("""
        SELECT rt.relative_id, u.first_name, u.last_name, rt.relation_type,
               rt.is_emergency_contact, rt.is_guardian,
               EXISTS (SELECT 1 FROM relationto x WHERE x.user_id = rt.relative_id AND x.relative_id = :uid) AS confirmed,
               CASE WHEN EXISTS (SELECT 1 FROM relationto x WHERE x.user_id = rt.relative_id AND x.relative_id = :uid)
                    THEN u.email END AS email
        FROM relationto rt
        JOIN users u ON u.user_id = rt.relative_id
        WHERE rt.user_id = :uid
        ORDER BY confirmed DESC, rt.is_emergency_contact DESC, u.last_name, u.first_name
    """), params))

    # Family requests waiting for me: someone added me (X -> me) and I haven't answered (no me -> X).
    family_requests = rows(db.execute(text("""
        SELECT u.user_id, u.first_name, u.last_name, r.relation_type
        FROM relationto r JOIN users u ON u.user_id = r.user_id
        WHERE r.relative_id = :uid
          AND NOT EXISTS (SELECT 1 FROM relationto x WHERE x.user_id = :uid AND x.relative_id = r.user_id)
        ORDER BY u.last_name, u.first_name
    """), params))

    # Specialists for the user's diagnosed conditions: diagnosed → recommends → specializesin → provider
    recommended_doctors = rows(db.execute(text("""
        SELECT p.provider_id, p.provider_name, CAST(p.rating AS float) AS rating,
               string_agg(DISTINCT s.speciality_name, ', ') AS specialities,
               string_agg(DISTINCT c.condition_name, ', ') AS for_conditions,
               count(DISTINCT c.condition_id) AS matched_conditions,
               EXISTS (SELECT 1 FROM visit v WHERE v.user_id = :uid AND v.provider_id = p.provider_id) AS seen_before,
               (p.provider_id = (SELECT pcp_provider_id FROM users WHERE user_id = :uid)) IS TRUE AS is_pcp
        FROM diagnosed d
        JOIN condition c ON c.condition_id = d.condition_id
        JOIN recommends r ON r.condition_id = d.condition_id
        JOIN speciality s ON s.speciality_id = r.speciality_id
        JOIN specializesin si ON si.speciality_id = r.speciality_id
        JOIN provider p ON p.provider_id = si.provider_id
        WHERE d.user_id = :uid
        GROUP BY p.provider_id, p.provider_name, p.rating
        ORDER BY seen_before DESC, matched_conditions DESC, p.rating DESC NULLS LAST, p.provider_name
        LIMIT 6
    """), params))

    # Recommended specialties with no visit to any provider of that specialty
    care_gaps = rows(db.execute(text("""
        SELECT DISTINCT c.condition_name, s.speciality_name
        FROM diagnosed d
        JOIN condition c ON c.condition_id = d.condition_id
        JOIN recommends r ON r.condition_id = d.condition_id
        JOIN speciality s ON s.speciality_id = r.speciality_id
        WHERE d.user_id = :uid
          AND NOT EXISTS (
              SELECT 1 FROM visit v
              JOIN specializesin si ON si.provider_id = v.provider_id
              WHERE v.user_id = :uid AND si.speciality_id = r.speciality_id
          )
        ORDER BY c.condition_name, s.speciality_name
    """), params))

    data = {
        "profile": profile[0],
        "plans": plans,
        "in_network_facilities": in_network,
        "conditions": conditions,
        "visits": visits,
        "records": records,
        "family": family,
        "family_requests": family_requests,
        "recommended_doctors": recommended_doctors,
        "care_gaps": care_gaps,
    }
    data["insights"] = build_insights(data)
    return jsonify(data)


@api.get("/patient/emergency")
def patient_emergency():
    """Medical-ID summary shown on the Account page."""
    uid = current_user_id()
    db = conn()
    params = {"uid": uid}

    person = db.execute(text("""
        SELECT u.first_name, u.middle_name, u.last_name, u.dob, u.gender,
               p.provider_name AS pcp_name,
               ph.pharmacy_name, ph.address AS pharmacy_address
        FROM users u
        LEFT JOIN provider p ON p.provider_id = u.pcp_provider_id
        LEFT JOIN pharmacy ph ON ph.pharmacy_id = u.pharmacy_id
        WHERE u.user_id = :uid
    """), params).mappings().first()
    if person is None:
        session.clear()
        abort(401, description="Your account no longer exists.")

    conditions = rows(db.execute(text("""
        SELECT c.condition_name, c.category, d.diagnosed_date
        FROM diagnosed d JOIN condition c ON c.condition_id = d.condition_id
        WHERE d.user_id = :uid
        ORDER BY (c.category = 'allergy') DESC, c.condition_name
    """), params))

    contacts = rows(db.execute(text("""
        SELECT u.first_name, u.last_name, u.email, rt.relation_type, rt.is_emergency_contact, rt.is_guardian
        FROM relationto rt JOIN users u ON u.user_id = rt.relative_id
        WHERE rt.user_id = :uid AND (rt.is_emergency_contact OR rt.is_guardian)
          AND EXISTS (SELECT 1 FROM relationto x WHERE x.user_id = rt.relative_id AND x.relative_id = :uid)
        ORDER BY rt.is_emergency_contact DESC, u.last_name
    """), params))

    insurance = rows(db.execute(text("""
        SELECT ip.plan_name, ip.plan_type, ip.plan_holder, e.expiration_date
        FROM enrolledin e JOIN insuranceplan ip ON ip.plan_id = e.plan_id
        WHERE e.user_id = :uid AND (e.expiration_date IS NULL OR e.expiration_date >= CURRENT_DATE)
        ORDER BY ip.plan_name
    """), params))

    return jsonify(
        person={k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in person.items()},
        allergies=[c for c in conditions if c["category"] == "allergy"],
        conditions=[c for c in conditions if c["category"] != "allergy"],
        contacts=contacts,
        insurance=insurance,
    )

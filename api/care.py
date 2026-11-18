"""Care finder and care team: nearby facilities with insurance data, the user's PCP/pharmacy, and the map token.

Schema (SCHEMA.md): facility, accepts, insuranceplan, enrolledin, visit (read-only here) and
users.pcp_provider_id / users.pharmacy_id (nullable FKs, written by PUT /patient/care-team).
"""

import os

from flask import abort, current_app, jsonify
from sqlalchemy import text

from api import api, conn, current_user_id, rows
from api.auth import json_body
from schema_rules import parse_int


@api.get("/config/map")
def map_config():
    """The Mapbox *public* token (MAPBOX_TOKEN in .env). A secret sk. token is never sent to the browser."""
    current_user_id()
    token = (os.environ.get("MAPBOX_TOKEN") or "").strip()
    if token and not token.startswith("pk."):
        current_app.logger.warning("MAPBOX_TOKEN is not a public (pk.) token; the map stays off.")
        token = ""
    return jsonify(mapbox_token=token or None)


@api.get("/patient/care-sites")
def care_sites():
    """Every facility with the plans it accepts, whether it takes one of the user's active plans, and past visits."""
    uid = current_user_id()
    db = conn()
    params = {"uid": uid}

    facilities = rows(db.execute(text("""
        SELECT f.facility_id, f.facility_name, f.address,
               COALESCE(json_agg(json_build_object('plan_id', ip.plan_id, 'plan_name', ip.plan_name,
                                                   'plan_type', ip.plan_type, 'plan_holder', ip.plan_holder)
                                 ORDER BY ip.plan_name) FILTER (WHERE ip.plan_id IS NOT NULL), '[]') AS accepted_plans,
               EXISTS (
                   SELECT 1 FROM accepts a2
                   JOIN enrolledin e ON e.plan_id = a2.plan_id
                   WHERE a2.facility_id = f.facility_id AND e.user_id = :uid
                     AND (e.expiration_date IS NULL OR e.expiration_date >= CURRENT_DATE)
               ) AS in_network,
               (SELECT count(*) FROM visit v WHERE v.facility_id = f.facility_id AND v.user_id = :uid) AS my_visits,
               (SELECT max(v.visit_date) FROM visit v WHERE v.facility_id = f.facility_id AND v.user_id = :uid) AS last_visit
        FROM facility f
        LEFT JOIN accepts a ON a.facility_id = f.facility_id
        LEFT JOIN insuranceplan ip ON ip.plan_id = a.plan_id
        GROUP BY f.facility_id, f.facility_name, f.address
        ORDER BY f.facility_name
    """), params))

    plans = rows(db.execute(text("""
        SELECT ip.plan_id, ip.plan_name, ip.plan_type, ip.plan_holder,
               EXISTS (SELECT 1 FROM enrolledin e WHERE e.plan_id = ip.plan_id AND e.user_id = :uid) AS is_mine,
               EXISTS (SELECT 1 FROM enrolledin e WHERE e.plan_id = ip.plan_id AND e.user_id = :uid
                         AND (e.expiration_date IS NULL OR e.expiration_date >= CURRENT_DATE)) AS is_mine_active
        FROM insuranceplan ip
        ORDER BY is_mine_active DESC, is_mine DESC, ip.plan_name
    """), params))

    return jsonify(facilities=facilities, plans=plans)


def _care_team(db, uid):
    found = rows(db.execute(text("""
        SELECT u.pcp_provider_id, p.provider_name AS pcp_name, CAST(p.rating AS float) AS pcp_rating,
               (SELECT string_agg(s.speciality_name, ', ' ORDER BY s.speciality_name)
                FROM specializesin si JOIN speciality s ON s.speciality_id = si.speciality_id
                WHERE si.provider_id = u.pcp_provider_id) AS pcp_specialities,
               u.pharmacy_id, ph.pharmacy_name, ph.address AS pharmacy_address
        FROM users u
        LEFT JOIN provider p ON p.provider_id = u.pcp_provider_id
        LEFT JOIN pharmacy ph ON ph.pharmacy_id = u.pharmacy_id
        WHERE u.user_id = :uid
    """), {"uid": uid}))
    if not found:
        abort(401, description="Your account no longer exists.")
    return found[0]


@api.put("/patient/care-team")
def update_care_team():
    """Set or clear the user's PCP and/or pharmacy. Keys left out of the body stay unchanged."""
    uid = current_user_id()
    data = json_body()
    set_pcp = "pcp_provider_id" in data
    set_ph = "pharmacy_id" in data
    if not (set_pcp or set_ph):
        abort(400, description="Choose a primary care provider or a pharmacy.")
    pcp = parse_int(data, "pcp_provider_id", required=False) if set_pcp else None
    ph = parse_int(data, "pharmacy_id", required=False) if set_ph else None

    db = conn()
    # SCHEMA §6.3: check FK ids before the database does, for a readable message.
    if pcp is not None and db.execute(text("SELECT 1 FROM provider WHERE provider_id = :pid"), {"pid": pcp}).first() is None:
        abort(400, description="That provider doesn't exist.")
    if ph is not None and db.execute(text("SELECT 1 FROM pharmacy WHERE pharmacy_id = :phid"), {"phid": ph}).first() is None:
        abort(400, description="That pharmacy doesn't exist.")

    db.execute(text("""
        UPDATE users
        SET pcp_provider_id = CASE WHEN :set_pcp THEN CAST(:pcp AS integer) ELSE pcp_provider_id END,
            pharmacy_id     = CASE WHEN :set_ph  THEN CAST(:ph AS integer)  ELSE pharmacy_id END
        WHERE user_id = :uid
    """), {"set_pcp": set_pcp, "pcp": pcp, "set_ph": set_ph, "ph": ph, "uid": uid})
    db.commit()
    return jsonify(_care_team(db, uid))

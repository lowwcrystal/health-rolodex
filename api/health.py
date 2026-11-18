"""The user's insurance enrollments (enrolledin) and diagnoses (diagnosed): add, edit dates, remove.

SCHEMA.md: enrolledin PK (user_id, plan_id), CHECK valid_enrollment_dates (expiration NULL or > start), plan FK no cascade;
diagnosed PK (user_id, condition_id), condition FK no cascade. Deleting these relationship rows is never blocked (§6.4).
"""

from flask import abort, jsonify
from sqlalchemy import text

from api import api, conn, current_user_id
from api.auth import json_body
from schema_rules import parse_date, parse_int


def _enrollment_dates(data):
    start = parse_date(data, "start_date")
    expiration = parse_date(data, "expiration_date", required=False)
    if expiration is not None and expiration <= start:  # valid_enrollment_dates
        abort(400, description="Expiration date must be after the start date.")
    return start, expiration


def _exists(db, sql, params):
    return db.execute(text(sql), params).first() is not None


@api.post("/patient/plans")
def add_plan():
    uid = current_user_id()
    data = json_body()
    plan_id = parse_int(data, "plan_id")
    start, expiration = _enrollment_dates(data)
    db = conn()
    if not _exists(db, "SELECT 1 FROM insuranceplan WHERE plan_id = :pid", {"pid": plan_id}):
        abort(400, description="That insurance plan doesn't exist.")
    if _exists(db, "SELECT 1 FROM enrolledin WHERE user_id = :uid AND plan_id = :pid", {"uid": uid, "pid": plan_id}):
        abort(400, description="You're already enrolled in that plan. Edit its dates instead.")
    db.execute(text("""
        INSERT INTO enrolledin (user_id, plan_id, start_date, expiration_date)
        VALUES (:uid, :pid, :start, :expiration)
    """), {"uid": uid, "pid": plan_id, "start": start, "expiration": expiration})
    db.commit()
    return jsonify(ok=True), 201


@api.put("/patient/plans/<int:plan_id>")
def edit_plan(plan_id):
    uid = current_user_id()
    start, expiration = _enrollment_dates(json_body())
    db = conn()
    updated = db.execute(text("""
        UPDATE enrolledin SET start_date = :start, expiration_date = :expiration
        WHERE user_id = :uid AND plan_id = :pid
    """), {"start": start, "expiration": expiration, "uid": uid, "pid": plan_id})
    if updated.rowcount == 0:
        db.rollback()
        abort(404, description="You're not enrolled in that plan.")
    db.commit()
    return jsonify(ok=True)


@api.delete("/patient/plans/<int:plan_id>")
def remove_plan(plan_id):
    uid = current_user_id()
    db = conn()
    deleted = db.execute(text("DELETE FROM enrolledin WHERE user_id = :uid AND plan_id = :pid"), {"uid": uid, "pid": plan_id})
    if deleted.rowcount == 0:
        db.rollback()
        abort(404, description="You're not enrolled in that plan.")
    db.commit()
    return jsonify(ok=True)


@api.post("/patient/conditions")
def add_condition():
    uid = current_user_id()
    data = json_body()
    condition_id = parse_int(data, "condition_id")
    diagnosed = parse_date(data, "diagnosed_date", allow_future=False)
    db = conn()
    if not _exists(db, "SELECT 1 FROM condition WHERE condition_id = :cid", {"cid": condition_id}):
        abort(400, description="That condition doesn't exist.")
    if _exists(db, "SELECT 1 FROM diagnosed WHERE user_id = :uid AND condition_id = :cid", {"uid": uid, "cid": condition_id}):
        abort(400, description="That condition is already on your list. Edit its date instead.")
    db.execute(text("""
        INSERT INTO diagnosed (user_id, condition_id, diagnosed_date) VALUES (:uid, :cid, :diagnosed)
    """), {"uid": uid, "cid": condition_id, "diagnosed": diagnosed})
    db.commit()
    return jsonify(ok=True), 201


@api.put("/patient/conditions/<int:condition_id>")
def edit_condition(condition_id):
    uid = current_user_id()
    diagnosed = parse_date(json_body(), "diagnosed_date", allow_future=False)
    db = conn()
    updated = db.execute(text("""
        UPDATE diagnosed SET diagnosed_date = :diagnosed WHERE user_id = :uid AND condition_id = :cid
    """), {"diagnosed": diagnosed, "uid": uid, "cid": condition_id})
    if updated.rowcount == 0:
        db.rollback()
        abort(404, description="That condition isn't on your list.")
    db.commit()
    return jsonify(ok=True)


@api.delete("/patient/conditions/<int:condition_id>")
def remove_condition(condition_id):
    uid = current_user_id()
    db = conn()
    deleted = db.execute(text("DELETE FROM diagnosed WHERE user_id = :uid AND condition_id = :cid"), {"uid": uid, "cid": condition_id})
    if deleted.rowcount == 0:
        db.rollback()
        abort(404, description="That condition isn't on your list.")
    db.commit()
    return jsonify(ok=True)

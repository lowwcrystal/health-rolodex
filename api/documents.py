"""My Documents: a patient adds a document by kind. Files are stored as URLs in records.file_link (no schema change).

Two-sided kinds (cards, ID) become two records rows, front then back, with consecutive record_no values.
Sharing follows SCHEMA.md §6.3: only shareable records get sharedwith rows.
"""

from flask import abort, jsonify
from sqlalchemy import text

from api import api, conn, current_user_id
from api.auth import json_body
from schema_rules import DOCUMENT_KINDS, compose_notes, require_str, require_url

MAX_SHARED_PROVIDERS = 50


def parse_provider_ids(data):
    raw = data.get("provider_ids") or []
    if not isinstance(raw, list) or len(raw) > MAX_SHARED_PROVIDERS:
        abort(400, description="provider_ids must be a list.")
    ids = []
    for value in raw:
        if isinstance(value, bool) or not isinstance(value, int):
            abort(400, description="provider_ids must contain whole numbers.")
        if value not in ids:
            ids.append(value)
    return ids


@api.post("/patient/documents")
def create_document():
    uid = current_user_id()
    data = json_body()

    kind = data.get("kind")
    if kind not in DOCUMENT_KINDS:
        abort(400, description="Choose a document type.")
    _label, record_type, two_sided, prefix = DOCUMENT_KINDS[kind]

    notes = require_str(data, "notes", required=False)
    is_shareable = data.get("is_shareable", False)
    if not isinstance(is_shareable, bool):
        abort(400, description="is_shareable must be true or false.")
    provider_ids = parse_provider_ids(data) if is_shareable else []

    if two_sided:
        sides = [
            ("front", require_url(data, "front_url")),
            ("back", require_url(data, "back_url")),
        ]
    else:
        sides = [(None, require_url(data, "file_url", required=False))]
    # Check every notes value before writing anything.
    planned = [(link, compose_notes(prefix, side, notes)) for side, link in sides]

    db = conn()
    if provider_ids:
        found = db.execute(
            text("SELECT count(*) FROM provider WHERE provider_id = ANY(:ids)"), {"ids": provider_ids}
        ).scalar_one()
        if found != len(provider_ids):
            abort(400, description="One of the selected providers doesn't exist.")

    record_nos = []
    for link, full_notes in planned:
        # records.record_no is numbered per user and there's no sequence (SCHEMA.md §6.1).
        record_no = db.execute(text("""
            INSERT INTO records (record_no, user_id, is_shareable, record_type, notes, file_link)
            SELECT COALESCE(MAX(record_no), 0) + 1, :uid, :is_shareable, :record_type, :notes, :file_link
            FROM records WHERE user_id = :uid
            RETURNING record_no
        """), {
            "uid": uid,
            "is_shareable": is_shareable,
            "record_type": record_type,
            "notes": full_notes,
            "file_link": link,
        }).scalar_one()
        record_nos.append(record_no)
        for provider_id in provider_ids:
            db.execute(text("""
                INSERT INTO sharedwith (record_no, user_id, provider_id, is_shareable)
                VALUES (:record_no, :uid, :provider_id, true)
            """), {"record_no": record_no, "uid": uid, "provider_id": provider_id})
    db.commit()

    return jsonify(kind=kind, record_nos=record_nos, shared_with=provider_ids), 201

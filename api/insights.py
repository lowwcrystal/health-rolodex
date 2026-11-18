"""Rule-based "current health patterns" built from the rows the patient dashboard already loads.

A pure function with no DB access, so it can be unit-tested directly. Dates come in as ISO strings (see api.rows).
"""

from collections import Counter
from datetime import date, timedelta

LOOKBACK_DAYS = 365
EXPIRING_SOON_DAYS = 60
CATEGORY_NAMES = {"allergy": ("allergy", "allergies"), "chronic": ("chronic condition", "chronic conditions"),
                  "genetic": ("genetic condition", "genetic conditions")}


def _d(value):
    return date.fromisoformat(value[:10]) if isinstance(value, str) else value


def _plural(n, one, many):
    return f"{n} {one if n == 1 else many}"


def build_insights(data, today=None):
    today = today or date.today()
    since = today - timedelta(days=LOOKBACK_DAYS)
    insights = []

    def add(level, title, detail):
        insights.append({"level": level, "title": title, "detail": detail})

    profile = data["profile"]
    conditions = data.get("conditions", [])
    visits = data.get("visits", [])
    plans = data.get("plans", [])
    family = data.get("family", [])

    # 1. Condition mix
    if conditions:
        counts = Counter(c["category"] for c in conditions)
        parts = [_plural(counts[k], *CATEGORY_NAMES[k]) for k in ("chronic", "allergy", "genetic") if counts[k]]
        names = ", ".join(c["condition_name"] for c in conditions[:4])
        add("info", f"You're managing {', '.join(parts)}", names + ("…" if len(conditions) > 4 else ""))

    # 2. Recent diagnoses
    recent = [c for c in conditions if _d(c["diagnosed_date"]) >= since]
    if recent:
        add("info", f"{_plural(len(recent), 'new diagnosis', 'new diagnoses')} in the past year",
            ", ".join(f"{c['condition_name']} ({c['diagnosed_date'][:10]})" for c in recent))

    # 3. Visit pattern
    recent_visits = [v for v in visits if _d(v["visit_date"]) >= since]
    if recent_visits:
        provider, n = Counter(v["provider_name"] for v in recent_visits).most_common(1)[0]
        facility, _ = Counter(v["facility_name"] for v in recent_visits).most_common(1)[0]
        add("info", f"{_plural(len(recent_visits), 'visit', 'visits')} in the past year",
            f"Most often with {provider} ({_plural(n, 'visit', 'visits')}), usually at {facility}.")
    elif visits:
        add("attention", "No visits in the past year",
            f"Your last visit was {visits[0]['visit_date'][:10]}. Consider booking a check-up.")
    else:
        add("attention", "No visits on record", "Schedule a check-up with your primary care provider.")

    # 4. Care gaps: a recommended specialty the user hasn't seen
    gaps = {}
    for g in data.get("care_gaps", []):
        gaps.setdefault(g["condition_name"], []).append(g["speciality_name"])
    for condition_name, specialities in gaps.items():
        add("attention", f"{condition_name}: you haven't seen {' or '.join(sorted(specialities))} yet",
            "This specialty is recommended for your condition. See Recommended doctors below.")

    # 5. Coverage
    active = [p for p in plans if p["is_active"]]
    if not active:
        add("attention", "No active insurance plan", "Add your current plan so you can see in-network facilities.")
    for p in active:
        if p.get("expiration_date"):
            days_left = (_d(p["expiration_date"]) - today).days
            if days_left <= EXPIRING_SOON_DAYS:
                add("attention", f"{p['plan_name']} expires in {_plural(days_left, 'day', 'days')}",
                    f"Coverage ends {p['expiration_date'][:10]}. Renew or add a new plan.")

    # 6. Care team
    if not profile.get("pcp_provider_id"):
        add("attention", "No primary care provider", "Choose a PCP so your care has a home base.")
    if not profile.get("pharmacy_id"):
        add("attention", "No pharmacy on file", "Add a pharmacy for prescriptions.")

    # 7. Safety
    has_allergy = any(c["category"] == "allergy" for c in conditions)
    # Only confirmed contacts count (both relationto rows exist); a pending request isn't a contact yet.
    has_contact = any(r["is_emergency_contact"] and r.get("confirmed", True) for r in family)
    if has_allergy and not has_contact:
        add("attention", "Allergies but no emergency contact", "Add an emergency contact so someone can speak for you.")

    # Show the items that need attention first, then keep each group in rule order.
    return sorted(insights, key=lambda i: i["level"] != "attention")

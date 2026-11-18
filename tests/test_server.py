import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from flask.cli import load_dotenv
from sqlalchemy.exc import IntegrityError, OperationalError
from werkzeug.security import generate_password_hash

import server


def result(one=None, first=None, scalar=None, rows=None):
    """A fake SQLAlchemy result supporting the access patterns the API uses."""
    res = MagicMock()
    res.mappings.return_value.one.return_value = one
    res.mappings.return_value.first.return_value = first
    res.mappings.return_value.__iter__.side_effect = lambda: iter(rows or [])
    res.scalar_one.return_value = scalar
    return res


VALID_SIGNUP = {
    "username": "jdoe",
    "email": "jdoe@example.com",
    "password": "correct-horse",
    "first_name": "Jane",
    "middle_name": "",
    "last_name": "Doe",
    "dob": "1990-04-01",
    "gender": "Female",
    "pcp_provider_id": 3,
    "pharmacy_id": None,
}
PUBLIC_USER = {"user_id": 27, "username": "jdoe", "email": "jdoe@example.com", "first_name": "Jane", "last_name": "Doe"}


class BaseTest(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {}, clear=True)
        self.environment.start()
        server.app.secret_key = "test-only-secret"
        self.client = server.app.test_client()
        server.get_engine.cache_clear()

    def tearDown(self):
        server.get_engine.cache_clear()
        self.environment.stop()

    def database(self, results=()):
        os.environ.update(DB_USER="test_user", DB_PASSWORD="test-only:@/?")
        engine = MagicMock()
        conn = engine.connect.return_value
        conn.execute.return_value.scalar_one.side_effect = list(results)
        return engine, conn

    def login_as(self, user_id=27):
        with self.client.session_transaction() as s:
            s["user_id"] = user_id

    def statements(self, conn):
        return [str(call.args[0]) for call in conn.execute.call_args_list]


class StarterTests(BaseTest):
    def test_local_settings_load_into_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            settings = Path(directory) / "local-settings.txt"
            settings.write_text("DB_USER=test_user\nDB_PASSWORD='test-only:#@/?'\n")
            self.assertTrue(load_dotenv(path=settings, load_defaults=False))
        self.assertEqual(os.environ["DB_USER"], "test_user")
        self.assertEqual(os.environ["DB_PASSWORD"], "test-only:#@/?")
        with patch("server.create_engine") as create_engine:
            server.get_engine()
        self.assertEqual(create_engine.call_args.args[0].password, "test-only:#@/?")

    def test_existing_environment_takes_precedence_over_local_settings(self):
        os.environ["DB_PASSWORD"] = "injected-test-only-value"
        with tempfile.TemporaryDirectory() as directory:
            settings = Path(directory) / "local-settings.txt"
            settings.write_text("DB_PASSWORD=file-test-only-value\n")
            load_dotenv(path=settings, load_defaults=False)
        self.assertEqual(os.environ["DB_PASSWORD"], "injected-test-only-value")

    def test_development_server_requests_dotenv_loading(self):
        with patch("flask.cli.load_dotenv") as loader:
            with patch("flask.cli.show_server_banner"):
                with patch("werkzeug.serving.run_simple") as run_simple:
                    server.app.run(host="127.0.0.1", port=8111)
        loader.assert_called_once()
        run_simple.assert_called_once()

    def test_missing_configuration_database_check_is_503(self):
        response = self.client.get("/db-check")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json, {"database": "unavailable"})

    def test_database_check_uses_bound_parameter_and_effective_schema(self):
        engine, conn = self.database([1, True, True])
        with patch("server.get_engine", return_value=engine):
            response = self.client.get("/db-check")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["select_1"], 1)
        self.assertTrue(response.json["current_schema_accessible"])
        self.assertTrue(response.json["users_table_exists"])
        query, params = conn.execute.call_args_list[0].args
        self.assertEqual(str(query), "SELECT :value")
        self.assertEqual(params, {"value": 1})
        conn.close.assert_called_once()

    def test_schema_is_bound_and_quoted(self):
        engine, conn = self.database([1, True, True])
        os.environ["DB_SCHEMA"] = 'assigned"schema'
        with patch("server.get_engine", return_value=engine):
            response = self.client.get("/db-check")
        self.assertEqual(response.status_code, 200)
        query, params = conn.execute.call_args_list[0].args
        self.assertIn("quote_ident(:schema)", str(query))
        self.assertEqual(params, {"schema": 'assigned"schema'})
        conn.commit.assert_called_once()

    def test_connection_failure_is_safe(self):
        engine, conn = self.database()
        engine.connect.side_effect = OperationalError("SELECT 1", {}, Exception("private-test-only-detail"))
        with patch("server.get_engine", return_value=engine):
            with self.assertLogs(server.app.logger, level="WARNING") as logs:
                response = self.client.get("/db-check")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json, {"database": "unavailable"})
        self.assertNotIn("private-test-only-detail", "\n".join(logs.output))

    def test_query_failure_rolls_back_and_closes(self):
        engine, conn = self.database()
        conn.execute.side_effect = OperationalError("SELECT 1", {}, Exception("private-test-only-detail"))
        with patch("server.get_engine", return_value=engine):
            with self.assertLogs(server.app.logger, level="WARNING") as logs:
                response = self.client.get("/db-check")
        self.assertEqual(response.status_code, 503)
        conn.rollback.assert_called_once()
        conn.close.assert_called_once()
        self.assertNotIn("private-test-only-detail", "\n".join(logs.output))

    def test_url_and_pool_configuration(self):
        self.database()
        with patch("server.create_engine") as create_engine:
            server.get_engine()
            server.get_engine()
        create_engine.assert_called_once()
        args, options = create_engine.call_args
        self.assertEqual(args[0].password, "test-only:@/?")
        self.assertEqual(args[0].host, "127.0.0.1")
        self.assertEqual(args[0].port, 5454)
        self.assertEqual(options["pool_size"], 1)
        self.assertEqual(options["max_overflow"], 0)
        self.assertTrue(options["pool_pre_ping"])


class SpaTests(BaseTest):
    @unittest.skipUnless((server.SPA_DIR / "index.html").exists(), "frontend not built")
    def test_spa_routes_serve_index_without_connecting(self):
        with patch("server.get_engine") as get_engine:
            for path in ("/", "/login", "/signup", "/dashboard", "/doctor", "/doctor/dashboard"):
                with self.subTest(path=path):
                    response = self.client.get(path)
                    self.assertEqual(response.status_code, 200)
                    self.assertIn(b'<div id="root">', response.data)
                    response.close()
        get_engine.assert_not_called()

    def test_unknown_api_route_is_json_404(self):
        response = self.client.get("/api/nope")
        self.assertEqual(response.status_code, 404)
        self.assertIn("error", response.json)

    def test_api_without_database_is_json_503(self):
        response = self.client.get("/api/options")
        self.assertEqual(response.status_code, 503)
        self.assertIn("not configured", response.json["error"])


class SignupTests(BaseTest):
    def post_signup(self, conn_results, payload=None):
        engine, conn = self.database()
        conn.execute.side_effect = conn_results
        with patch("server.get_engine", return_value=engine):
            response = self.client.post("/api/auth/signup", json=payload or VALID_SIGNUP)
        return response, conn

    def test_signup_inserts_with_bound_params_hashed_password_and_generated_id(self):
        response, conn = self.post_signup([
            result(one={"username_taken": False, "email_taken": False}),
            result(scalar=27),
            result(first=PUBLIC_USER),
        ])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json["role"], "patient")
        insert_sql, params = conn.execute.call_args_list[1].args
        self.assertIn("COALESCE(MAX(user_id), 0) + 1", str(insert_sql))
        self.assertEqual(params["username"], "jdoe")
        self.assertIsNone(params["middle_name"])  # empty optional → NULL
        self.assertIsNone(params["pharmacy_id"])
        self.assertEqual(params["pcp_provider_id"], 3)
        self.assertNotEqual(params["password_hash"], VALID_SIGNUP["password"])
        self.assertTrue(params["password_hash"].startswith(("scrypt:", "pbkdf2:")))
        conn.commit.assert_called_once()
        self.assertNotIn("password_hash", response.json["user"])
        with self.client.session_transaction() as s:
            self.assertEqual(s["user_id"], 27)

    def test_signup_rejects_invalid_input_before_touching_db(self):
        cases = {
            "missing first name": {**VALID_SIGNUP, "first_name": "  "},
            "username too long": {**VALID_SIGNUP, "username": "u" * 31},
            "email too long": {**VALID_SIGNUP, "email": "a" * 95 + "@x.com"},
            "email without @": {**VALID_SIGNUP, "email": "not-an-email"},
            "bad date": {**VALID_SIGNUP, "dob": "1990-13-40"},
            "future dob": {**VALID_SIGNUP, "dob": "2999-01-01"},
            "short password": {**VALID_SIGNUP, "password": "short"},
            "gender too long": {**VALID_SIGNUP, "gender": "g" * 21},
            "non-int pcp": {**VALID_SIGNUP, "pcp_provider_id": "abc"},
        }
        for name, payload in cases.items():
            with self.subTest(name):
                response, conn = self.post_signup([], payload)
                self.assertEqual(response.status_code, 400)
                self.assertIn("error", response.json)
                conn.execute.assert_not_called()

    def test_signup_rejects_non_json(self):
        engine, _ = self.database()
        with patch("server.get_engine", return_value=engine):
            response = self.client.post("/api/auth/signup", data="x")
        self.assertEqual(response.status_code, 400)

    def test_duplicate_email_is_friendly_400(self):
        response, conn = self.post_signup([result(one={"username_taken": False, "email_taken": True})])
        self.assertEqual(response.status_code, 400)
        self.assertIn("email already exists", response.json["error"])
        conn.commit.assert_not_called()

    def test_integrity_error_on_insert_rolls_back_and_is_400(self):
        orig = Exception("private-test-only-detail")
        response, conn = self.post_signup([
            result(one={"username_taken": False, "email_taken": False}),
            IntegrityError("INSERT", {}, orig),
        ])
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("private-test-only-detail", response.get_data(as_text=True))
        conn.rollback.assert_called_once()
        conn.commit.assert_not_called()


    def test_patient_signup_checks_provider_emails_too(self):
        engine, conn = self.database()
        conn.execute.side_effect = [result(one={"username_taken": False, "email_taken": True})]
        with patch("server.get_engine", return_value=engine):
            response = self.client.post("/api/auth/signup", json=VALID_SIGNUP)
        self.assertEqual(response.status_code, 400)
        self.assertIn("FROM provider", str(conn.execute.call_args_list[0].args[0]))


class LoginTests(BaseTest):
    def post_login(self, row, password):
        engine, conn = self.database()
        conn.execute.side_effect = [result(first=row), result(first=PUBLIC_USER)]
        with patch("server.get_engine", return_value=engine):
            response = self.client.post("/api/auth/login", json={"email": "JDoe@example.com", "password": password})
        return response, conn

    def test_correct_password_logs_in(self):
        response, conn = self.post_login(
            {"role": "patient", "id": 27, "password_hash": generate_password_hash("correct-horse")}, "correct-horse")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["role"], "patient")
        _, params = conn.execute.call_args_list[0].args
        self.assertEqual(params, {"email": "JDoe@example.com"})
        with self.client.session_transaction() as s:
            self.assertEqual(s["user_id"], 27)

    def test_wrong_password_unknown_email_and_null_hash_are_401(self):
        for row in (
            {"role": "patient", "id": 27, "password_hash": generate_password_hash("correct-horse")},
            {"role": "doctor", "id": 4, "password_hash": generate_password_hash("correct-horse")},
            None,
            {"role": "doctor", "id": 4, "password_hash": None},
        ):
            with self.subTest(row=row):
                response, _ = self.post_login(row, "wrong-password")
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json["error"], "Incorrect email or password.")

    def test_doctor_email_logs_in_as_doctor(self):
        engine, conn = self.database()
        doctor = {"provider_id": 4, "provider_name": "Dr. Alexandra Warren", "email": "alexandra.warren@doctor.demo"}
        conn.execute.side_effect = [
            result(first={"role": "doctor", "id": 4, "password_hash": generate_password_hash("demo1234")}),
            result(first=doctor),
        ]
        with patch("server.get_engine", return_value=engine):
            response = self.client.post("/api/auth/login", json={"email": doctor["email"], "password": "demo1234"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["role"], "doctor")
        self.assertEqual(response.json["provider"]["provider_id"], 4)
        lookup_sql = str(conn.execute.call_args_list[0].args[0])
        self.assertIn("FROM users", lookup_sql)
        self.assertIn("FROM provider", lookup_sql)
        self.assertNotIn("password_hash", str(conn.execute.call_args_list[1].args[0]))
        self.assertNotIn("password_hash", response.get_data(as_text=True))
        with self.client.session_transaction() as s:
            self.assertEqual(s["provider_id"], 4)
            self.assertNotIn("user_id", s)

    def test_logout_clears_session(self):
        self.login_as()
        engine, _ = self.database()
        with patch("server.get_engine", return_value=engine):
            self.client.post("/api/auth/logout")
        with self.client.session_transaction() as s:
            self.assertNotIn("user_id", s)


class DashboardTests(BaseTest):
    def test_patient_dashboard_requires_login(self):
        engine, conn = self.database()
        with patch("server.get_engine", return_value=engine):
            response = self.client.get("/api/patient/dashboard")
        self.assertEqual(response.status_code, 401)
        conn.execute.assert_not_called()

    def test_patient_dashboard_binds_user_and_hides_password_hash(self):
        self.login_as(27)
        engine, conn = self.database()
        profile = {"user_id": 27, "first_name": "Jane", "dob": __import__("datetime").date(1990, 4, 1)}
        conn.execute.side_effect = [result(rows=[profile])] + [result(rows=[]) for _ in range(9)]
        with patch("server.get_engine", return_value=engine):
            response = self.client.get("/api/patient/dashboard")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["profile"]["dob"], "1990-04-01")
        self.assertEqual(conn.execute.call_count, 10)
        for key in ("insights", "recommended_doctors", "care_gaps", "family_requests"):
            self.assertIn(key, response.json)
        self.assertNotIn("password_hash", response.get_data(as_text=True))
        for call in conn.execute.call_args_list:
            self.assertEqual(call.args[1], {"uid": 27})
            self.assertNotIn("password_hash", str(call.args[0]))
        conn.commit.assert_not_called()

    def test_doctor_dashboard_requires_selected_provider(self):
        engine, _ = self.database()
        with patch("server.get_engine", return_value=engine):
            response = self.client.get("/api/doctor/dashboard")
        self.assertEqual(response.status_code, 401)

    def test_doctor_dashboard_rejects_unknown_record_type(self):
        with self.client.session_transaction() as s:
            s["provider_id"] = 5
        engine, conn = self.database()
        with patch("server.get_engine", return_value=engine):
            response = self.client.get("/api/doctor/dashboard?record_type=x-ray")
        self.assertEqual(response.status_code, 400)
        conn.execute.assert_not_called()

    def test_demo_doctor_picker_route_is_gone(self):
        engine, conn = self.database()
        with patch("server.get_engine", return_value=engine):
            response = self.client.post("/api/doctor/session", json={"provider_id": 4})
        self.assertIn(response.status_code, (404, 405))
        conn.execute.assert_not_called()
        with self.client.session_transaction() as s:
            self.assertNotIn("provider_id", s)



class DocumentTests(BaseTest):
    CARD = {
        "kind": "insurance_card",
        "notes": "Member ID ends 4821",
        "front_url": "https://bucket.example.com/u27/front.jpg",
        "back_url": "https://bucket.example.com/u27/back.jpg",
        "is_shareable": False,
        "provider_ids": [],
    }

    def post_doc(self, payload, conn_results=()):
        self.login_as(27)
        engine, conn = self.database()
        conn.execute.side_effect = list(conn_results)
        with patch("server.get_engine", return_value=engine):
            response = self.client.post("/api/patient/documents", json=payload)
        return response, conn

    def test_requires_login(self):
        engine, conn = self.database()
        with patch("server.get_engine", return_value=engine):
            response = self.client.post("/api/patient/documents", json=self.CARD)
        self.assertEqual(response.status_code, 401)
        conn.execute.assert_not_called()

    def test_invalid_documents_are_400_before_db(self):
        cases = {
            "unknown kind": {**self.CARD, "kind": "passport_scan"},
            "card missing back": {**self.CARD, "back_url": ""},
            "javascript url": {**self.CARD, "front_url": "javascript:alert(1)"},
            "url too long": {**self.CARD, "front_url": "https://x.com/" + "a" * 250},
            "not shareable flag": {**self.CARD, "is_shareable": "yes"},
            "notes too long with prefix": {**self.CARD, "notes": "n" * 490},
            "bad provider ids": {**self.CARD, "is_shareable": True, "provider_ids": ["1"]},
        }
        for name, payload in cases.items():
            with self.subTest(name):
                response, conn = self.post_doc(payload)
                self.assertEqual(response.status_code, 400, response.json)
                conn.execute.assert_not_called()

    def test_card_creates_front_and_back_records_without_sharing(self):
        response, conn = self.post_doc(self.CARD, [result(scalar=60), result(scalar=61)])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json["record_nos"], [60, 61])
        statements = self.statements(conn)
        self.assertEqual(len(statements), 2)
        self.assertFalse(any("sharedwith" in s for s in statements))
        front, back = (call.args[1] for call in conn.execute.call_args_list)
        self.assertIn("COALESCE(MAX(record_no), 0) + 1", statements[0])
        self.assertEqual(front["record_type"], "other")
        self.assertEqual(front["notes"], "Insurance card (front): Member ID ends 4821")
        self.assertEqual(back["notes"], "Insurance card (back): Member ID ends 4821")
        self.assertEqual(front["file_link"], self.CARD["front_url"])
        self.assertEqual(back["file_link"], self.CARD["back_url"])
        self.assertEqual(front["uid"], 27)
        conn.commit.assert_called_once()

    def test_shareable_lab_result_shares_with_each_provider(self):
        payload = {"kind": "lab_result", "notes": "", "file_url": "https://bucket.example.com/lab.pdf",
                   "is_shareable": True, "provider_ids": [3, 7, 3]}
        response, conn = self.post_doc(payload, [result(scalar=2), result(scalar=5), result(), result()])
        self.assertEqual(response.status_code, 201)
        statements = self.statements(conn)
        self.assertIn("FROM provider", statements[0])
        self.assertEqual(conn.execute.call_args_list[0].args[1], {"ids": [3, 7]})
        insert_params = conn.execute.call_args_list[1].args[1]
        self.assertEqual(insert_params["record_type"], "lab_result")
        self.assertIsNone(insert_params["notes"])
        self.assertTrue(insert_params["is_shareable"])
        shares = [c.args[1] for c in conn.execute.call_args_list[2:]]
        self.assertEqual(shares, [{"record_no": 5, "uid": 27, "provider_id": 3}, {"record_no": 5, "uid": 27, "provider_id": 7}])
        conn.commit.assert_called_once()

    def test_unknown_provider_is_400_without_writes(self):
        payload = {"kind": "imaging", "file_url": "https://x.com/a.png", "is_shareable": True, "provider_ids": [999]}
        response, conn = self.post_doc(payload, [result(scalar=0)])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(conn.execute.call_count, 1)
        conn.commit.assert_not_called()



class InsightTests(unittest.TestCase):
    TODAY = __import__("datetime").date(2026, 11, 15)

    def base(self, **overrides):
        data = {
            "profile": {"pcp_provider_id": 1, "pharmacy_id": 1},
            "conditions": [], "visits": [], "plans": [{"plan_name": "PPO", "is_active": True, "expiration_date": None}],
            "family": [], "care_gaps": [],
        }
        data.update(overrides)
        return data

    def titles(self, data):
        from api.insights import build_insights
        return [i["title"] for i in build_insights(data, today=self.TODAY)]

    def test_condition_mix_and_recent_diagnosis(self):
        titles = self.titles(self.base(conditions=[
            {"condition_name": "Asthma", "category": "chronic", "diagnosed_date": "2021-01-01"},
            {"condition_name": "Peanut", "category": "allergy", "diagnosed_date": "2026-03-01"},
        ], family=[{"is_emergency_contact": True}]))
        self.assertIn("You're managing 1 chronic condition, 1 allergy", titles)
        self.assertIn("1 new diagnosis in the past year", titles)

    def test_visit_pattern_counts_last_year_only(self):
        from api.insights import build_insights
        visits = [
            {"visit_date": "2026-10-01", "provider_name": "Dr. A", "facility_name": "F1"},
            {"visit_date": "2026-06-01", "provider_name": "Dr. A", "facility_name": "F1"},
            {"visit_date": "2024-01-01", "provider_name": "Dr. B", "facility_name": "F2"},
        ]
        found = [i for i in build_insights(self.base(visits=visits), today=self.TODAY) if i["title"] == "2 visits in the past year"]
        self.assertEqual(len(found), 1)
        self.assertIn("Dr. A (2 visits)", found[0]["detail"])

    def test_attention_rules(self):
        titles = self.titles(self.base(
            profile={"pcp_provider_id": None, "pharmacy_id": None},
            conditions=[{"condition_name": "Peanut", "category": "allergy", "diagnosed_date": "2020-01-01"}],
            plans=[{"plan_name": "PPO", "is_active": True, "expiration_date": "2026-12-15"}],
            care_gaps=[{"condition_name": "Asthma", "speciality_name": "Pulmonology"}],
        ))
        for expected in ("No visits on record", "Asthma: you haven't seen Pulmonology yet", "PPO expires in 30 days",
                         "No primary care provider", "No pharmacy on file", "Allergies but no emergency contact"):
            self.assertIn(expected, titles)

    def test_no_active_plan_and_attention_first(self):
        from api.insights import build_insights
        out = build_insights(self.base(plans=[], conditions=[
            {"condition_name": "Asthma", "category": "chronic", "diagnosed_date": "2020-01-01"}]), today=self.TODAY)
        self.assertIn("No active insurance plan", [i["title"] for i in out])
        levels = [i["level"] for i in out]
        self.assertEqual(levels, sorted(levels, key=lambda l: l != "attention"))


class EmergencyTests(BaseTest):
    def test_requires_login(self):
        engine, _ = self.database()
        with patch("server.get_engine", return_value=engine):
            self.assertEqual(self.client.get("/api/patient/emergency").status_code, 401)

    def test_returns_medical_id_without_password_hash(self):
        self.login_as(27)
        engine, conn = self.database()
        person = {"first_name": "Jane", "middle_name": None, "last_name": "Doe",
                  "dob": __import__("datetime").date(1990, 4, 1), "gender": None,
                  "pcp_name": None, "pharmacy_name": None, "pharmacy_address": None}
        conditions = [{"condition_name": "Peanut", "category": "allergy", "diagnosed_date": "2020-01-01"},
                      {"condition_name": "Asthma", "category": "chronic", "diagnosed_date": "2021-01-01"}]
        conn.execute.side_effect = [result(first=person), result(rows=conditions), result(rows=[]), result(rows=[])]
        with patch("server.get_engine", return_value=engine):
            response = self.client.get("/api/patient/emergency")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["person"]["dob"], "1990-04-01")
        self.assertEqual([a["condition_name"] for a in response.json["allergies"]], ["Peanut"])
        self.assertEqual([c["condition_name"] for c in response.json["conditions"]], ["Asthma"])
        self.assertNotIn("password_hash", response.get_data(as_text=True))
        for call in conn.execute.call_args_list:
            self.assertEqual(call.args[1], {"uid": 27})


class RatingTests(BaseTest):
    """provider.rating (numeric(2,1), CHECK valid_rating) is read-only and reaches the client as a JSON number."""

    def test_options_and_doctor_list_include_rating_as_number(self):
        doctor = {"provider_id": 3, "provider_name": "Dr. Lee", "rating": 4.6, "specialities": "Cardiology"}
        for url in ("/api/options", "/api/doctor/providers"):
            engine, conn = self.database()
            conn.execute.side_effect = [result(rows=[doctor])] + [result(rows=[]) for _ in range(5)]
            with patch("server.get_engine", return_value=engine):
                response = self.client.get(url)
            self.assertEqual(response.status_code, 200, url)
            self.assertEqual(response.json["providers"][0]["rating"], 4.6)
            sql = str(conn.execute.call_args_list[0].args[0])
            self.assertIn("CAST(p.rating AS float) AS rating", sql)
            conn.commit.assert_not_called()

    def test_dashboard_selects_pcp_and_recommended_ratings(self):
        self.login_as(27)
        engine, conn = self.database()
        profile = {"user_id": 27, "first_name": "Jane", "pcp_rating": 4.2}
        doctor = {"provider_id": 3, "provider_name": "Dr. Lee", "rating": 5.0, "specialities": "Cardiology",
                  "for_conditions": "Asthma", "matched_conditions": 1, "seen_before": False, "is_pcp": False}
        side = [result(rows=[profile])] + [result(rows=[]) for _ in range(9)]
        sqls = []
        def execute(stmt, params=None):
            sqls.append(str(stmt))
            return result(rows=[doctor]) if "AS for_conditions" in str(stmt) else side.pop(0)
        conn.execute.side_effect = execute
        with patch("server.get_engine", return_value=engine):
            response = self.client.get("/api/patient/dashboard")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["profile"]["pcp_rating"], 4.2)
        self.assertEqual(response.json["recommended_doctors"][0]["rating"], 5.0)
        self.assertTrue(any("AS pcp_rating" in q for q in sqls))
        self.assertTrue(any("p.rating DESC NULLS LAST" in q for q in sqls))
        conn.commit.assert_not_called()


class MapConfigTests(BaseTest):
    def test_requires_login(self):
        engine, _ = self.database()
        with patch("server.get_engine", return_value=engine):
            self.assertEqual(self.client.get("/api/config/map").status_code, 401)

    def test_only_public_tokens_reach_the_browser(self):
        self.login_as(27)
        for token, expected in (("pk.test123", "pk.test123"), ("sk.secret", None), ("", None)):
            engine, _ = self.database()
            os.environ["MAPBOX_TOKEN"] = token
            with patch("server.get_engine", return_value=engine):
                response = self.client.get("/api/config/map")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json["mapbox_token"], expected, token)
            self.assertNotIn("sk.secret", response.get_data(as_text=True))


class CareSiteTests(BaseTest):
    def test_requires_login(self):
        engine, conn = self.database()
        with patch("server.get_engine", return_value=engine):
            self.assertEqual(self.client.get("/api/patient/care-sites").status_code, 401)
        conn.execute.assert_not_called()

    def test_returns_facilities_and_plans_read_only(self):
        self.login_as(27)
        engine, conn = self.database()
        facility = {"facility_id": 1, "facility_name": "Columbia", "address": "622 W 168th St",
                    "accepted_plans": [{"plan_id": 3, "plan_name": "Empire Blue Cross PPO"}],
                    "in_network": True, "my_visits": 2, "last_visit": __import__("datetime").date(2026, 1, 5)}
        plan = {"plan_id": 3, "plan_name": "Empire Blue Cross PPO", "is_mine": True, "is_mine_active": True}
        conn.execute.side_effect = [result(rows=[facility]), result(rows=[plan])]
        with patch("server.get_engine", return_value=engine):
            response = self.client.get("/api/patient/care-sites")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["facilities"][0]["last_visit"], "2026-01-05")
        self.assertTrue(response.json["facilities"][0]["in_network"])
        self.assertEqual(response.json["plans"][0]["plan_id"], 3)
        for call in conn.execute.call_args_list:
            self.assertEqual(call.args[1], {"uid": 27})
            self.assertNotIn("password_hash", str(call.args[0]))
        conn.commit.assert_not_called()


class CareTeamTests(BaseTest):
    def put(self, body, side_effect=None):
        engine, conn = self.database()
        if side_effect is not None:
            conn.execute.side_effect = side_effect
        with patch("server.get_engine", return_value=engine):
            response = self.client.put("/api/patient/care-team", json=body)
        return response, conn

    def test_requires_login(self):
        response, conn = self.put({"pcp_provider_id": 3})
        self.assertEqual(response.status_code, 401)
        conn.execute.assert_not_called()

    def test_bad_input_is_400_without_writes(self):
        self.login_as(27)
        for body in ({}, {"pcp_provider_id": "abc"}, {"pharmacy_id": True}, {"unrelated": 1}):
            response, conn = self.put(body)
            self.assertEqual(response.status_code, 400, body)
            conn.commit.assert_not_called()
            self.assertFalse(any("UPDATE" in q for q in self.statements(conn)), body)

    def test_unknown_provider_is_400_without_update(self):
        self.login_as(27)
        missing = result()
        missing.first.return_value = None
        response, conn = self.put({"pcp_provider_id": 999}, side_effect=[missing])
        self.assertEqual(response.status_code, 400)
        self.assertIn("provider doesn't exist", response.json["error"] if "error" in response.json else str(response.json))
        conn.commit.assert_not_called()

    def test_sets_pcp_with_bound_params_and_commits_once(self):
        self.login_as(27)
        team = {"pcp_provider_id": 3, "pcp_name": "Dr. Lee", "pcp_rating": 4.6, "pcp_specialities": None,
                "pharmacy_id": None, "pharmacy_name": None, "pharmacy_address": None}
        response, conn = self.put({"pcp_provider_id": 3}, side_effect=[result(), result(), result(rows=[team])])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["pcp_name"], "Dr. Lee")
        update = conn.execute.call_args_list[1]
        self.assertIn("UPDATE users", str(update.args[0]))
        self.assertEqual(update.args[1], {"set_pcp": True, "pcp": 3, "set_ph": False, "ph": None, "uid": 27})
        conn.commit.assert_called_once()

    def test_null_clears_pharmacy_without_lookup(self):
        self.login_as(27)
        response, conn = self.put({"pharmacy_id": None}, side_effect=[result(), result(rows=[{"pharmacy_id": None}])])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(conn.execute.call_args_list[0].args[1],
                         {"set_pcp": False, "pcp": None, "set_ph": True, "ph": None, "uid": 27})
        conn.commit.assert_called_once()

    def test_integrity_error_rolls_back_and_is_400(self):
        self.login_as(27)
        error = IntegrityError("UPDATE users", {}, Exception("fk violation detail"))
        response, conn = self.put({"pcp_provider_id": 3}, side_effect=[result(), error])
        self.assertEqual(response.status_code, 400)
        conn.rollback.assert_called()
        conn.commit.assert_not_called()
        self.assertNotIn("fk violation detail", response.get_data(as_text=True))


class HealthEditTests(BaseTest):
    """enrolledin and diagnosed: add / edit dates / remove, validated before the DB (SCHEMA §6.3)."""

    def call(self, method, url, body=None, side_effect=None):
        engine, conn = self.database()
        if side_effect is not None:
            conn.execute.side_effect = side_effect
        with patch("server.get_engine", return_value=engine):
            response = getattr(self.client, method)(url, json=body)
        return response, conn

    @staticmethod
    def found(yes):
        res = result()
        res.first.return_value = (1,) if yes else None
        return res

    def test_requires_login(self):
        for method, url in (("post", "/api/patient/plans"), ("put", "/api/patient/plans/3"), ("delete", "/api/patient/plans/3"),
                            ("post", "/api/patient/conditions"), ("put", "/api/patient/conditions/2"),
                            ("delete", "/api/patient/conditions/2")):
            response, conn = self.call(method, url, {})
            self.assertEqual(response.status_code, 401, url)
            conn.execute.assert_not_called()

    def test_plan_bad_input_is_400_before_db(self):
        self.login_as(27)
        for body in ({"plan_id": "x", "start_date": "2026-01-01"},
                     {"plan_id": 3},
                     {"plan_id": 3, "start_date": "not-a-date"},
                     {"plan_id": 3, "start_date": "2026-05-01", "expiration_date": "2026-05-01"},
                     {"plan_id": 3, "start_date": "2026-05-01", "expiration_date": "2026-01-01"}):
            response, conn = self.call("post", "/api/patient/plans", body)
            self.assertEqual(response.status_code, 400, body)
            conn.execute.assert_not_called()

    def test_add_plan_binds_params_and_commits_once(self):
        self.login_as(27)
        body = {"plan_id": 3, "start_date": "2026-01-01", "expiration_date": ""}
        response, conn = self.call("post", "/api/patient/plans", body, [self.found(True), self.found(False), result()])
        self.assertEqual(response.status_code, 201)
        insert = conn.execute.call_args_list[2]
        self.assertIn("INSERT INTO enrolledin", str(insert.args[0]))
        self.assertEqual(insert.args[1], {"uid": 27, "pid": 3, "start": __import__("datetime").date(2026, 1, 1), "expiration": None})
        conn.commit.assert_called_once()

    def test_duplicate_plan_is_400_without_insert(self):
        self.login_as(27)
        body = {"plan_id": 3, "start_date": "2026-01-01"}
        response, conn = self.call("post", "/api/patient/plans", body, [self.found(True), self.found(True)])
        self.assertEqual(response.status_code, 400)
        self.assertFalse(any("INSERT" in q for q in self.statements(conn)))
        conn.commit.assert_not_called()

    def test_edit_and_remove_plan(self):
        self.login_as(27)
        ok = result(); ok.rowcount = 1
        response, conn = self.call("put", "/api/patient/plans/3", {"start_date": "2025-01-01", "expiration_date": "2026-01-01"}, [ok])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(conn.execute.call_args.args[1]["pid"], 3)
        conn.commit.assert_called_once()
        response, conn = self.call("delete", "/api/patient/plans/3", None, [ok])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(conn.execute.call_args.args[1], {"uid": 27, "pid": 3})
        conn.commit.assert_called_once()
        missing = result(); missing.rowcount = 0
        response, conn = self.call("delete", "/api/patient/plans/9", None, [missing])
        self.assertEqual(response.status_code, 404)
        conn.commit.assert_not_called()

    def test_condition_rules(self):
        self.login_as(27)
        future = (__import__("datetime").date.today() + __import__("datetime").timedelta(days=2)).isoformat()
        for body in ({"condition_id": 2}, {"condition_id": "a", "diagnosed_date": "2024-01-01"},
                     {"condition_id": 2, "diagnosed_date": future}):
            response, conn = self.call("post", "/api/patient/conditions", body)
            self.assertEqual(response.status_code, 400, body)
            conn.execute.assert_not_called()
        response, conn = self.call("post", "/api/patient/conditions", {"condition_id": 2, "diagnosed_date": "2024-01-01"},
                                   [self.found(True), self.found(False), result()])
        self.assertEqual(response.status_code, 201)
        self.assertIn("INSERT INTO diagnosed", str(conn.execute.call_args.args[0]))
        conn.commit.assert_called_once()
        response, conn = self.call("post", "/api/patient/conditions", {"condition_id": 99, "diagnosed_date": "2024-01-01"},
                                   [self.found(False)])
        self.assertEqual(response.status_code, 400)
        conn.commit.assert_not_called()

    def test_integrity_error_rolls_back(self):
        self.login_as(27)
        error = IntegrityError("INSERT", {}, Exception("driver detail"))
        response, conn = self.call("post", "/api/patient/conditions", {"condition_id": 2, "diagnosed_date": "2024-01-01"},
                                   [self.found(True), self.found(False), error])
        self.assertEqual(response.status_code, 400)
        conn.rollback.assert_called()
        self.assertNotIn("driver detail", response.get_data(as_text=True))


class FamilyTests(BaseTest):
    """relationto requests: (A -> B) alone is pending; both directions = confirmed (SCHEMA §6.3). No schema change."""

    VALID = {"email": "Donna@Example.com", "relation_type": "sibling", "is_emergency_contact": True, "is_guardian": False}

    def call(self, method, url, body=None, side_effect=None):
        engine, conn = self.database()
        if side_effect is not None:
            conn.execute.side_effect = side_effect
        with patch("server.get_engine", return_value=engine):
            response = getattr(self.client, method)(url, json=body)
        return response, conn

    @staticmethod
    def first(value):
        res = result()
        res.first.return_value = value
        return res

    @staticmethod
    def changed(n):
        res = result()
        res.rowcount = n
        return res

    def test_requires_login(self):
        for method, url in (("post", "/api/patient/family"), ("put", "/api/patient/family/5"),
                            ("delete", "/api/patient/family/5"), ("post", "/api/patient/family/requests/5/accept"),
                            ("delete", "/api/patient/family/requests/5"), ("get", "/api/patient/inbox")):
            response, conn = self.call(method, url, {} if method != "get" else None)
            self.assertEqual(response.status_code, 401, url)
            conn.execute.assert_not_called()

    def test_bad_input_is_400_before_db(self):
        self.login_as(27)
        bad = [
            {**self.VALID, "email": "not-an-email"},
            {**self.VALID, "email": "a" * 95 + "@x.com"},
            {**self.VALID, "relation_type": "cousin"},
            {**self.VALID, "relation_type": "sibling", "is_guardian": True},
            {**self.VALID, "is_emergency_contact": "yes"},
            {k: v for k, v in self.VALID.items() if k != "relation_type"},
        ]
        for body in bad:
            response, conn = self.call("post", "/api/patient/family", body)
            self.assertEqual(response.status_code, 400, body)
            conn.execute.assert_not_called()

    def test_unknown_email_self_and_duplicate_are_400_without_insert(self):
        self.login_as(27)
        for side, message in (([self.first(None)], "No Health Rolodex account"),
                              ([self.first((27,))], "can't add yourself"),
                              ([self.first((5,)), self.first((1,))], "already added")):
            response, conn = self.call("post", "/api/patient/family", self.VALID, side)
            self.assertEqual(response.status_code, 400)
            self.assertIn(message, response.get_data(as_text=True))
            self.assertFalse(any("INSERT" in q for q in self.statements(conn)))
            conn.commit.assert_not_called()

    def test_add_inserts_my_row_with_bound_params(self):
        self.login_as(27)
        side = [self.first((5,)), self.first(None), result(), self.first(None)]
        response, conn = self.call("post", "/api/patient/family", self.VALID, side)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json, {"relative_id": 5, "confirmed": False})
        self.assertEqual(conn.execute.call_args_list[0].args[1], {"email": "donna@example.com"})
        insert = conn.execute.call_args_list[2]
        self.assertIn("INSERT INTO relationto", str(insert.args[0]))
        self.assertEqual(insert.args[1], {"uid": 27, "rid": 5, "relation_type": "sibling",
                                          "is_emergency_contact": True, "is_guardian": False})
        conn.commit.assert_called_once()

    def test_add_when_they_already_asked_is_confirmed(self):
        self.login_as(27)
        side = [self.first((5,)), self.first(None), result(), self.first((1,))]
        response, _ = self.call("post", "/api/patient/family", self.VALID, side)
        self.assertTrue(response.json["confirmed"])

    def test_accept_requires_pending_request(self):
        self.login_as(27)
        body = {"relation_type": "sibling", "is_emergency_contact": False, "is_guardian": False}
        response, conn = self.call("post", "/api/patient/family/requests/5/accept", body, [self.first(None)])
        self.assertEqual(response.status_code, 404)
        conn.commit.assert_not_called()
        response, conn = self.call("post", "/api/patient/family/requests/5/accept", body,
                                   [self.first((1,)), self.first(None), result()])
        self.assertEqual(response.status_code, 201)
        insert = conn.execute.call_args_list[2]
        self.assertIn("INSERT INTO relationto", str(insert.args[0]))
        self.assertEqual((insert.args[1]["uid"], insert.args[1]["rid"]), (27, 5))
        conn.commit.assert_called_once()

    def test_edit_decline_and_remove(self):
        self.login_as(27)
        body = {"relation_type": "parent", "is_emergency_contact": True, "is_guardian": True}
        response, conn = self.call("put", "/api/patient/family/5", body, [self.changed(1)])
        self.assertEqual(response.status_code, 200)
        self.assertIn("WHERE user_id = :uid AND relative_id = :rid", str(conn.execute.call_args.args[0]))
        conn.commit.assert_called_once()

        response, conn = self.call("delete", "/api/patient/family/requests/5", None, [self.changed(1)])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(conn.execute.call_args.args[1], {"uid": 27, "rid": 5})
        conn.commit.assert_called_once()

        response, conn = self.call("delete", "/api/patient/family/5", None, [self.changed(2)])
        self.assertEqual(response.status_code, 200)
        sql = str(conn.execute.call_args.args[0])
        self.assertIn("(user_id = :uid AND relative_id = :rid) OR (user_id = :rid AND relative_id = :uid)", sql)
        conn.commit.assert_called_once()

        response, conn = self.call("delete", "/api/patient/family/9", None, [self.changed(0)])
        self.assertEqual(response.status_code, 404)
        conn.commit.assert_not_called()

    def test_integrity_error_rolls_back(self):
        self.login_as(27)
        error = IntegrityError("INSERT", {}, Exception("driver detail"))
        response, conn = self.call("post", "/api/patient/family", self.VALID,
                                   [self.first((5,)), self.first(None), error])
        self.assertEqual(response.status_code, 400)
        conn.rollback.assert_called()
        self.assertNotIn("driver detail", response.get_data(as_text=True))

    def test_inbox_is_read_only(self):
        self.login_as(27)
        req = {"user_id": 5, "first_name": "Donna", "last_name": "Mejia", "relation_type": "sibling"}
        share = {"record_no": 1, "record_type": "other", "notes": "Insurance card (front): x",
                 "upload_date": __import__("datetime").date(2026, 1, 5), "provider_id": 3, "provider_name": "Dr. Lee"}
        response, conn = self.call("get", "/api/patient/inbox", None, [result(rows=[req]), result(rows=[]), result(rows=[share])])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["requests"][0]["first_name"], "Donna")
        self.assertEqual(response.json["shares"][0]["upload_date"], "2026-01-05")
        for call in conn.execute.call_args_list:
            self.assertEqual(call.args[1], {"uid": 27})
        conn.commit.assert_not_called()


class DoctorPatientTests(BaseTest):
    """Doctor portal: linked patients only; visits, documents, referrals, unlink (no schema change)."""

    def call(self, method, url, body=None, side_effect=None, as_doctor=True):
        if as_doctor:
            with self.client.session_transaction() as s:
                s["provider_id"] = 4
        engine, conn = self.database()
        if side_effect is not None:
            conn.execute.side_effect = side_effect
        with patch("server.get_engine", return_value=engine):
            response = getattr(self.client, method)(url, json=body)
        return response, conn

    @staticmethod
    def scalar(value):
        res = result()
        res.scalar.return_value = value
        res.scalar_one.return_value = value
        return res

    @staticmethod
    def first(value):
        res = result()
        res.first.return_value = value
        return res

    def test_requires_selected_provider(self):
        for method, url in (("get", "/api/doctor/patients"), ("get", "/api/doctor/patients/7"),
                            ("post", "/api/doctor/patients/7/visits"), ("put", "/api/doctor/visits/3"),
                            ("post", "/api/doctor/patients/7/documents"), ("post", "/api/doctor/patients/7/referrals"),
                            ("delete", "/api/doctor/patients/7")):
            response, conn = self.call(method, url, {} if method in ("post", "put") else None, as_doctor=False)
            self.assertEqual(response.status_code, 401, url)
            conn.execute.assert_not_called()

    def test_list_is_read_only_and_binds_provider(self):
        patient = {"user_id": 7, "first_name": "Jane", "last_name": "Doe", "dob": __import__("datetime").date(1990, 1, 1),
                   "gender": None, "is_pcp": True, "visit_count": 2, "last_seen": None, "shared_count": 1}
        response, conn = self.call("get", "/api/doctor/patients", side_effect=[result(rows=[patient])])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["patients"][0]["dob"], "1990-01-01")
        self.assertEqual(conn.execute.call_args.args[1], {"pid": 4})
        self.assertNotIn("password_hash", str(conn.execute.call_args.args[0]))
        conn.commit.assert_not_called()

    def test_unlinked_patient_is_404_everywhere(self):
        for method, url, body in (("get", "/api/doctor/patients/7", None),
                                  ("post", "/api/doctor/patients/7/visits", {"visit_date": "2026-01-01", "facility_id": 1}),
                                  ("post", "/api/doctor/patients/7/documents", {"record_type": "lab_result"}),
                                  ("post", "/api/doctor/patients/7/referrals", {"provider_id": 9}),
                                  ("delete", "/api/doctor/patients/7", None)):
            response, conn = self.call(method, url, body, side_effect=[self.scalar(False)])
            self.assertEqual(response.status_code, 404, url)
            conn.commit.assert_not_called()

    def test_detail_hides_password_hash(self):
        profile = {"user_id": 7, "first_name": "Jane", "middle_name": None, "last_name": "Doe",
                   "dob": __import__("datetime").date(1990, 1, 1), "gender": None, "email": "j@x.com", "is_pcp": False}
        response, conn = self.call("get", "/api/doctor/patients/7", side_effect=[self.scalar(True), result(rows=[profile])]
                                   + [result(rows=[]) for _ in range(4)])
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("password_hash", response.get_data(as_text=True))
        for call in conn.execute.call_args_list:
            self.assertEqual(call.args[1], {"pid": 4, "uid": 7})
        conn.commit.assert_not_called()

    def test_log_visit_generates_id_and_commits(self):
        bad = [{"visit_date": "2999-01-01", "facility_id": 1}, {"visit_date": "nope", "facility_id": 1},
               {"visit_date": "2026-01-01", "facility_id": "x"}]
        for body in bad:
            response, conn = self.call("post", "/api/doctor/patients/7/visits", body, side_effect=[self.scalar(True)])
            self.assertEqual(response.status_code, 400, body)
            conn.commit.assert_not_called()
        response, conn = self.call("post", "/api/doctor/patients/7/visits", {"visit_date": "2026-01-01", "facility_id": 99},
                                   side_effect=[self.scalar(True), self.first(None)])
        self.assertEqual(response.status_code, 400)
        response, conn = self.call("post", "/api/doctor/patients/7/visits", {"visit_date": "2026-01-01", "facility_id": 1},
                                   side_effect=[self.scalar(True), self.first((1,)), self.scalar(60)])
        self.assertEqual(response.status_code, 201)
        insert = conn.execute.call_args_list[2]
        self.assertIn("COALESCE(MAX(visit_id), 0) + 1", str(insert.args[0]))
        self.assertEqual(insert.args[1]["pid"], 4)
        conn.commit.assert_called_once()

    def test_edit_visit_only_my_own(self):
        missing = result(); missing.rowcount = 0
        response, conn = self.call("put", "/api/doctor/visits/3", {"visit_date": "2026-01-01", "facility_id": 1},
                                   side_effect=[self.first((1,)), missing])
        self.assertEqual(response.status_code, 404)
        self.assertIn("provider_id = :pid", str(conn.execute.call_args.args[0]))
        conn.commit.assert_not_called()

    def test_create_document_validation_and_sharing(self):
        for body in ({"record_type": "x-ray"}, {"record_type": "lab_result", "file_link": "javascript:alert(1)"},
                     {"record_type": "lab_result", "provider_ids": ["a"]}):
            response, conn = self.call("post", "/api/doctor/patients/7/documents", body)
            self.assertEqual(response.status_code, 400, body)
            conn.execute.assert_not_called()
        too_long = {"record_type": "lab_result", "notes": "x" * 495}
        response, conn = self.call("post", "/api/doctor/patients/7/documents", too_long,
                                   side_effect=[self.scalar(True), self.scalar("Dr. Warren")])
        self.assertEqual(response.status_code, 400)
        conn.commit.assert_not_called()

        body = {"record_type": "lab_result", "notes": "A1C 5.4", "file_link": "https://x.test/a.pdf", "provider_ids": [9]}
        response, conn = self.call("post", "/api/doctor/patients/7/documents", body,
                                   side_effect=[self.scalar(True), self.scalar("Dr. Warren"), self.scalar(1),
                                                self.scalar(12), result(), result()])
        self.assertEqual(response.status_code, 201)
        insert = conn.execute.call_args_list[3]
        self.assertIn("COALESCE(MAX(record_no), 0) + 1", str(insert.args[0]))
        self.assertEqual(insert.args[1]["notes"], "From Dr. Warren: A1C 5.4")
        shares = [c.args[1]["provider_id"] for c in conn.execute.call_args_list[4:]]
        self.assertEqual(shares, [4, 9])
        conn.commit.assert_called_once()

    def test_referral_rules(self):
        response, conn = self.call("post", "/api/doctor/patients/7/referrals", {"provider_id": 4})
        self.assertEqual(response.status_code, 400)
        conn.execute.assert_not_called()
        unknown = result(); unknown.mappings.return_value.first.return_value = None
        response, conn = self.call("post", "/api/doctor/patients/7/referrals", {"provider_id": 9},
                                   side_effect=[self.scalar(True), self.scalar("Dr. Warren"), unknown])
        self.assertEqual(response.status_code, 400)
        target = result(); target.mappings.return_value.first.return_value = {"provider_name": "Dr. Lee", "specialities": "Cardiology"}
        response, conn = self.call("post", "/api/doctor/patients/7/referrals", {"provider_id": 9, "share_record_nos": [3, 5]},
                                   side_effect=[self.scalar(True), self.scalar("Dr. Warren"), target, self.scalar(1)])
        self.assertEqual(response.status_code, 400)
        self.assertIn("shared with you", response.get_data(as_text=True))
        conn.commit.assert_not_called()

        target = result(); target.mappings.return_value.first.return_value = {"provider_name": "Dr. Lee", "specialities": "Cardiology"}
        response, conn = self.call("post", "/api/doctor/patients/7/referrals",
                                   {"provider_id": 9, "reason": "Chest pain", "share_record_nos": [3]},
                                   side_effect=[self.scalar(True), self.scalar("Dr. Warren"), target, self.scalar(1),
                                                self.scalar(13), result(), result(), result()])
        self.assertEqual(response.status_code, 201)
        insert = conn.execute.call_args_list[4]
        self.assertEqual(insert.args[1]["notes"], "Referral from Dr. Warren to Dr. Lee (Cardiology): Chest pain")
        self.assertEqual(insert.args[1]["record_type"], "other")
        shares = [(c.args[1]["record_no"], c.args[1]["provider_id"]) for c in conn.execute.call_args_list[5:]]
        self.assertEqual(shares, [(13, 4), (13, 9), (3, 9)])
        conn.commit.assert_called_once()

    def test_remove_unlinks_but_keeps_visits(self):
        response, conn = self.call("delete", "/api/doctor/patients/7", side_effect=[self.scalar(True), result(), result()])
        self.assertEqual(response.status_code, 200)
        sqls = self.statements(conn)
        self.assertIn("pcp_provider_id = :pid", sqls[1])
        self.assertIn("DELETE FROM sharedwith WHERE user_id = :uid AND provider_id = :pid", sqls[2])
        self.assertFalse(any("DELETE FROM visit" in q for q in sqls))
        conn.commit.assert_called_once()

    def test_integrity_error_rolls_back(self):
        error = IntegrityError("INSERT", {}, Exception("driver detail"))
        response, conn = self.call("post", "/api/doctor/patients/7/documents", {"record_type": "lab_result"},
                                   side_effect=[self.scalar(True), self.scalar("Dr. Warren"), error])
        self.assertEqual(response.status_code, 400)
        conn.rollback.assert_called()
        self.assertNotIn("driver detail", response.get_data(as_text=True))


if __name__ == "__main__":
    unittest.main()

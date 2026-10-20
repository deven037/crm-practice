from __future__ import annotations

import json
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import server


class BridgeIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.root = Path(self.temp_dir.name)
        self.config_path = self.root / "bridge-config.json"
        self.original_config_path = server.CONFIG_PATH
        self.original_port = server.PORT
        self.original_origins = server.ALLOWED_ORIGINS
        server.CONFIG_PATH = self.config_path
        server.ALLOWED_ORIGINS = {"http://localhost:5173"}
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.BridgeHandler)
        server.PORT = self.httpd.server_address[1]
        self.addCleanup(self._restore_server_globals)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self._stop_server)
        self.base_url = f"http://127.0.0.1:{server.PORT}"

    def _restore_server_globals(self) -> None:
        server.CONFIG_PATH = self.original_config_path
        server.PORT = self.original_port
        server.ALLOWED_ORIGINS = self.original_origins

    def _stop_server(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=2)

    def request_json(self, path: str, body: dict[str, object] | None = None, origin: str = "http://localhost:5173") -> tuple[int, dict[str, object]]:
        data = json.dumps(body).encode("utf-8") if body is not None else None
        request = Request(self.base_url + path, data=data, method="POST" if body is not None else "GET")
        request.add_header("Origin", origin)
        if body is not None:
            request.add_header("Content-Type", "application/json")
        try:
            with urlopen(request, timeout=5) as response:
                return response.status, json.loads(response.read())
        except HTTPError as error:
            return error.code, json.loads(error.read())

    def configure_project(self, analysis_script: str = "analysis.py") -> dict[str, object]:
        status, body = self.request_json("/api/config", {
            "project_dir": str(self.root),
            "analysis_script": analysis_script,
            "python_executable": sys.executable,
            "output_dir": "outputs",
        })
        self.assertEqual(status, 200, body)
        return body

    def test_origin_is_restricted(self) -> None:
        status, body = self.request_json("/api/health", origin="https://untrusted.example")
        self.assertEqual(status, 403)
        self.assertIn("not allowed", str(body["error"]))

    def test_config_rejects_analysis_script_outside_project(self) -> None:
        status, body = self.request_json("/api/config", {
            "project_dir": str(self.root),
            "analysis_script": "../outside.py",
            "python_executable": sys.executable,
            "output_dir": "outputs",
        })
        self.assertEqual(status, 400)
        self.assertIn("inside the project", str(body["error"]))

    def test_dataset_save_starter_and_analysis_round_trip(self) -> None:
        self.configure_project()
        status, body = self.request_json("/api/template", {})
        self.assertEqual(status, 201, body)
        self.assertTrue((self.root / "analysis.py").is_file())

        status, body = self.request_json("/api/dataset", {
            "dataset": "leads",
            "fields": ["status", "value"],
            "rows": [["Qualified", "250"], ["New", "100"], ["Qualified", "50"]],
        })
        self.assertEqual(status, 201, body)
        dataset_path = str(body["dataset_path"])
        self.assertTrue((self.root / dataset_path).is_file())

        status, library = self.request_json("/api/datasets")
        self.assertEqual(status, 200, library)
        self.assertEqual(len(library["datasets"]), 1)
        self.assertEqual(library["datasets"][0]["dataset_path"], dataset_path)
        self.assertEqual(library["datasets"][0]["rows"], 3)

        status, body = self.request_json("/api/analyze", {"dataset_path": dataset_path})
        self.assertEqual(status, 200, body)
        report = body["report"]
        self.assertEqual(report["summary"][0]["value"], 3)
        self.assertEqual(report["charts"][0]["labels"], ["Qualified", "New"])
        self.assertEqual(report["charts"][0]["values"], [2, 1])
        self.assertIn("logs", report)
        cleaned_path = str(report["processed_dataset"])
        self.assertTrue((self.root / cleaned_path).is_file())
        self.assertEqual(report["processed_dataset_info"]["rows"], 3)

        status, library_after_first = self.request_json("/api/datasets")
        self.assertEqual(status, 200, library_after_first)
        self.assertEqual(len(library_after_first["datasets"]), 2)
        cleaned_entry = next(item for item in library_after_first["datasets"] if item["kind"] == "processed")
        self.assertEqual(cleaned_entry["dataset_path"], cleaned_path)

        status, second_report = self.request_json("/api/analyze", {"dataset_path": cleaned_entry["dataset_path"]})
        self.assertEqual(status, 200, second_report)
        self.assertEqual(second_report["report"]["summary"][0]["value"], 3)
        self.assertRegex(str(second_report["report"]["processed_dataset"]), r"^outputs/processed/leads-cleaned-\d{8}-\d{6}-\d{6}\.csv$")
        status, library_after = self.request_json("/api/datasets")
        self.assertEqual(status, 200, library_after)
        self.assertEqual(len(library_after["datasets"]), 3)

    def test_dataset_name_is_kept_with_timestamp(self) -> None:
        self.configure_project()
        status, body = self.request_json("/api/dataset", {
            "dataset": "qualified-leads-october",
            "fields": ["status"],
            "rows": [["Qualified"]],
        })
        self.assertEqual(status, 201, body)
        self.assertRegex(str(body["dataset_path"]), r"^data/raw/qualified-leads-october-\d{8}-\d{6}-\d{6}\.csv$")

    def test_existing_analysis_script_is_not_overwritten(self) -> None:
        script = self.root / "analysis.py"
        script.write_text("# user code\n", encoding="utf-8")
        self.configure_project()
        status, body = self.request_json("/api/template", {})
        self.assertEqual(status, 400)
        self.assertIn("not overwritten", str(body["error"]))
        self.assertEqual(script.read_text(encoding="utf-8"), "# user code\n")

    def test_analysis_rejects_csv_outside_saved_dataset_library(self) -> None:
        self.configure_project()
        script = self.root / "analysis.py"
        script.write_text("print('{}')\n", encoding="utf-8")
        outsider = self.root / "outside.csv"
        outsider.write_text("value\n1\n", encoding="utf-8")
        status, body = self.request_json("/api/analyze", {"dataset_path": "outside.csv"})
        self.assertEqual(status, 400)
        self.assertIn("dataset library", str(body["error"]))


if __name__ == "__main__":
    unittest.main()

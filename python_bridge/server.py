from __future__ import annotations

import csv
import json
import mimetypes
import os
import re
import subprocess
import sys
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HOST = "127.0.0.1"
PORT = 8765
MAX_REQUEST_BYTES = 20 * 1024 * 1024
MAX_DATASET_ROWS = 50000
MAX_RESULT_BYTES = 2 * 1024 * 1024
ANALYSIS_TIMEOUT_SECONDS = 120
ALLOWED_ORIGINS = {
    value.strip().rstrip("/")
    for value in os.environ.get(
        "CRM_WEB_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if value.strip()
}
CONFIG_PATH = Path.home() / ".practice-crm-data-bridge" / "config.json"
CONFIG_LOCK = threading.Lock()
SAFE_NAME = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$")


def load_config() -> dict[str, str]:
    try:
        value = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        return {
            "project_dir": str(value.get("project_dir", "")),
            "analysis_script": str(value.get("analysis_script", "analysis.py")),
            "python_executable": str(value.get("python_executable", sys.executable)),
            "output_dir": str(value.get("output_dir", "outputs")),
        }
    except (OSError, ValueError, TypeError):
        return {
            "project_dir": "",
            "analysis_script": "analysis.py",
            "python_executable": sys.executable,
            "output_dir": "outputs",
        }


def inside(root: Path, candidate: Path) -> bool:
    try:
        candidate.resolve().relative_to(root.resolve())
        return True
    except (OSError, ValueError):
        return False


def project_paths(config: dict[str, str]) -> tuple[Path, Path, Path]:
    project_dir = Path(config["project_dir"]).expanduser().resolve()
    script = (project_dir / config["analysis_script"]).resolve()
    output_dir = (project_dir / config["output_dir"]).resolve()
    if not inside(project_dir, script) or not inside(project_dir, output_dir):
        raise ValueError("Script and output folders must stay inside the project folder.")
    return project_dir, script, output_dir


class BridgeHandler(BaseHTTPRequestHandler):
    server_version = "PracticeCRMDataBridge/1.0"

    def log_message(self, _format: str, *_args: object) -> None:
        return

    def _request_allowed(self) -> bool:
        origin = self.headers.get("Origin", "").rstrip("/")
        host = self.headers.get("Host", "")
        if host not in {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}:
            self._send_json(403, {"error": "Local bridge accepts loopback hosts only."})
            return False
        if origin not in ALLOWED_ORIGINS:
            self._send_json(403, {"error": "Web origin is not allowed. Configure CRM_WEB_ORIGINS to include this CRM URL."})
            return False
        return True

    def _send_json(self, status: int, body: dict[str, object]) -> None:
        encoded = json.dumps(body, ensure_ascii=True).encode("utf-8")
        self.send_response(status)
        origin = self.headers.get("Origin", "").rstrip("/")
        host = self.headers.get("Host", "")
        if origin in ALLOWED_ORIGINS and host in {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def _read_json(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_REQUEST_BYTES:
            raise ValueError("Request body is empty or exceeds the 20 MB limit.")
        value = json.loads(self.rfile.read(length))
        if not isinstance(value, dict):
            raise ValueError("Expected a JSON object.")
        return value

    def do_OPTIONS(self) -> None:
        if not self._request_allowed():
            return
        self.send_response(204)
        origin = self.headers.get("Origin", "").rstrip("/")
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        if not self._request_allowed():
            return
        route = urlparse(self.path)
        if route.path == "/api/health":
            config = load_config()
            project_dir = Path(config["project_dir"]).expanduser() if config["project_dir"] else None
            ready = bool(project_dir and project_dir.is_dir())
            self._send_json(200, {"ok": True, "ready": ready, "config": config})
            return
        if route.path == "/api/artifact":
            self._serve_artifact(parse_qs(route.query).get("path", [""])[0])
            return
        if route.path == "/api/datasets":
            try:
                self._list_datasets(parse_qs(route.query).get("name", [""])[0])
            except (ValueError, OSError) as error:
                self._send_json(400, {"error": str(error)})
            return
        self._send_json(404, {"error": "Endpoint not found."})

    def do_POST(self) -> None:
        if not self._request_allowed():
            return
        try:
            body = self._read_json()
            if self.path == "/api/config":
                self._save_config(body)
            elif self.path == "/api/template":
                self._write_template()
            elif self.path == "/api/dataset":
                self._save_dataset(body)
            elif self.path == "/api/analyze":
                self._run_analysis(body)
            else:
                self._send_json(404, {"error": "Endpoint not found."})
        except (ValueError, OSError, json.JSONDecodeError) as error:
            self._send_json(400, {"error": str(error)})

    def _save_config(self, body: dict[str, object]) -> None:
        project_dir = Path(str(body.get("project_dir", ""))).expanduser().resolve()
        analysis_script = str(body.get("analysis_script", "analysis.py")).strip()
        python_executable = str(body.get("python_executable", sys.executable)).strip()
        output_dir = str(body.get("output_dir", "outputs")).strip() or "outputs"
        if not project_dir.is_dir():
            raise ValueError("Choose an existing PyCharm project folder.")
        if not analysis_script or Path(analysis_script).is_absolute():
            raise ValueError("Analysis script must be a relative path inside the project, such as analysis.py.")
        if not python_executable or not Path(python_executable).expanduser().exists():
            raise ValueError("Python executable was not found. Enter the interpreter path selected in PyCharm.")
        config = {
            "project_dir": str(project_dir),
            "analysis_script": analysis_script.replace("\\", "/"),
            "python_executable": str(Path(python_executable).expanduser().resolve()),
            "output_dir": output_dir.replace("\\", "/"),
        }
        _root, script, _output = project_paths(config)
        if script.exists() and not script.is_file():
            raise ValueError("The configured analysis script path is not a file.")
        with CONFIG_LOCK:
            CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
            CONFIG_PATH.write_text(json.dumps(config, indent=2), encoding="utf-8")
        self._send_json(200, {"ok": True, "config": config, "script_exists": script.is_file()})

    def _write_template(self) -> None:
        config = load_config()
        root, script, _output = project_paths(config)
        if not root.is_dir():
            raise ValueError("Configure an existing project folder first.")
        if script.exists():
            raise ValueError("The configured analysis script already exists; it was not overwritten.")
        template = Path(__file__).with_name("analysis_template.py").read_text(encoding="utf-8")
        script.parent.mkdir(parents=True, exist_ok=True)
        script.write_text(template, encoding="utf-8")
        self._send_json(201, {"ok": True, "script": str(script)})

    def _save_dataset(self, body: dict[str, object]) -> None:
        config = load_config()
        root, _script, _output = project_paths(config)
        dataset = str(body.get("dataset", ""))
        if not SAFE_NAME.fullmatch(dataset):
            raise ValueError("Dataset name must contain only letters, numbers, underscores, or hyphens.")
        fields = body.get("fields")
        rows = body.get("rows")
        if not isinstance(fields, list) or not fields or not all(isinstance(field, str) for field in fields):
            raise ValueError("Select at least one dataset field.")
        if not isinstance(rows, list) or len(rows) > MAX_DATASET_ROWS:
            raise ValueError(f"Dataset must contain at most {MAX_DATASET_ROWS} rows.")
        if not all(isinstance(row, list) and len(row) == len(fields) for row in rows):
            raise ValueError("Dataset rows do not match the selected field list.")
        if not root.is_dir():
            raise ValueError("Configure an existing project folder first.")
        data_dir = (root / "data" / "raw").resolve()
        if not inside(root, data_dir):
            raise ValueError("Dataset folder must stay inside the project folder.")
        data_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        destination = (data_dir / f"{dataset}-{stamp}.csv").resolve()
        if not inside(root, destination):
            raise ValueError("Dataset path must stay inside the project folder.")
        with destination.open("x", newline="", encoding="utf-8-sig") as output:
            writer = csv.writer(output)
            writer.writerow(fields)
            writer.writerows(rows)
        self._send_json(201, {"ok": True, "dataset_path": destination.relative_to(root).as_posix(), "rows": len(rows), "fields": len(fields)})

    def _list_datasets(self, name_filter: str = "") -> None:
        config = load_config()
        root, _script, output_dir = project_paths(config)
        dataset_dirs = [
            ("raw", (root / "data" / "raw").resolve()),
            ("processed", (output_dir / "processed").resolve()),
        ]
        datasets: list[dict[str, object]] = []
        for dataset_kind, data_dir in dataset_dirs:
            if not inside(root, data_dir) or not data_dir.is_dir():
                continue
            for path in data_dir.glob("*.csv"):
                if not inside(data_dir, path) or path.stat().st_size > MAX_REQUEST_BYTES:
                    continue
                if dataset_kind == "raw":
                    match = re.match(r"^(?P<name>.+)-(?P<stamp>\d{8}-\d{6}(?:-\d{6})?)\.csv$", path.name)
                    dataset_name = match.group("name") if match else path.stem
                else:
                    match = re.match(r"^(?P<name>.+)-cleaned-\d{8}-\d{6}(?:-\d{6})?$", path.stem, flags=re.IGNORECASE)
                    dataset_name = match.group("name") if match else re.sub(r"-cleaned$", "", path.stem, flags=re.IGNORECASE)
                if name_filter and dataset_name.casefold() != name_filter.casefold():
                    continue
                try:
                    with path.open("r", newline="", encoding="utf-8-sig") as source:
                        reader = csv.reader(source)
                        fields = next(reader, [])
                        row_count = sum(1 for _ in reader)
                except (OSError, UnicodeError, csv.Error):
                    continue
                datasets.append({
                    "name": dataset_name,
                    "kind": dataset_kind,
                    "file_name": path.name,
                    "dataset_path": path.relative_to(root).as_posix(),
                    "rows": row_count,
                    "fields": fields,
                    "created_at": datetime.fromtimestamp(path.stat().st_mtime).astimezone().isoformat(timespec="seconds"),
                    "size_bytes": path.stat().st_size,
                })
        datasets.sort(key=lambda item: str(item["created_at"]), reverse=True)
        datasets = datasets[:100]
        self._send_json(200, {"datasets": datasets})

    def _run_analysis(self, body: dict[str, object]) -> None:
        config = load_config()
        root, script, output_dir = project_paths(config)
        dataset_relative = str(body.get("dataset_path", ""))
        dataset_path = (root / dataset_relative).resolve()
        raw_dir = (root / "data" / "raw").resolve()
        processed_dir = (output_dir / "processed").resolve()
        in_saved_library = inside(raw_dir, dataset_path) or inside(processed_dir, dataset_path)
        if not in_saved_library or dataset_path.suffix.lower() != ".csv" or not dataset_path.is_file():
            raise ValueError("Choose a saved raw or processed CSV from the project dataset library.")
        if not script.is_file():
            raise ValueError("Configured analysis script was not found. Create the starter or update the script path in Settings.")
        output_dir.mkdir(parents=True, exist_ok=True)
        command = [config["python_executable"], str(script), "--dataset", str(dataset_path), "--output-dir", str(output_dir)]
        try:
            result = subprocess.run(
                command,
                cwd=root,
                capture_output=True,
                text=True,
                timeout=ANALYSIS_TIMEOUT_SECONDS,
                check=False,
            )
        except subprocess.TimeoutExpired as error:
            raise ValueError(f"Analysis exceeded the {ANALYSIS_TIMEOUT_SECONDS}-second time limit.") from error
        if len(result.stdout.encode("utf-8", errors="replace")) > MAX_RESULT_BYTES:
            raise ValueError("Analysis JSON output exceeded the 2 MB response limit.")
        try:
            report = json.loads(result.stdout)
        except json.JSONDecodeError as error:
            raise ValueError("Analysis script must print one JSON report to stdout. Put regular logs on stderr or in report.logs.") from error
        if not isinstance(report, dict):
            raise ValueError("Analysis script must return a JSON object.")
        if result.returncode != 0:
            self._send_json(422, {"error": f"Analysis exited with status {result.returncode}.", "report": report, "stderr": result.stderr[-12000:]})
            return
        processed_relative = report.get("processed_dataset")
        if processed_relative:
            processed_path = (output_dir / str(processed_relative)).resolve()
            processed_dir = (output_dir / "processed").resolve()
            if not inside(processed_dir, processed_path) or processed_path.suffix.lower() != ".csv" or not processed_path.is_file():
                raise ValueError("Report processed_dataset must point to an existing CSV under the configured output/processed folder.")
            if processed_path.stat().st_size > MAX_REQUEST_BYTES:
                raise ValueError("Processed CSV exceeds the 20 MB dataset limit.")
            with processed_path.open("r", newline="", encoding="utf-8-sig") as source:
                reader = csv.reader(source)
                processed_fields = next(reader, [])
                processed_rows = sum(1 for _ in reader)
            report["processed_dataset"] = processed_path.relative_to(root).as_posix()
            report["processed_dataset_info"] = {
                "name": re.sub(r"-cleaned-\d{8}-\d{6}(?:-\d{6})?$", "", processed_path.stem, flags=re.IGNORECASE),
                "rows": processed_rows,
                "fields": processed_fields,
                "size_bytes": processed_path.stat().st_size,
            }
        report["logs"] = (report.get("logs", []) if isinstance(report.get("logs", []), list) else []) + ([result.stderr[-12000:]] if result.stderr.strip() else [])
        report["artifacts"] = self._list_artifacts(output_dir)
        self._send_json(200, {"ok": True, "report": report, "dataset_path": dataset_relative})

    def _list_artifacts(self, output_dir: Path) -> list[dict[str, str]]:
        artifacts: list[dict[str, str]] = []
        if not output_dir.is_dir():
            return artifacts
        for path in sorted(output_dir.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
                continue
            if not inside(output_dir, path) or path.stat().st_size > 5 * 1024 * 1024:
                continue
            artifacts.append({"name": path.name, "path": path.relative_to(output_dir).as_posix()})
            if len(artifacts) >= 20:
                break
        return artifacts

    def _serve_artifact(self, relative: str) -> None:
        config = load_config()
        _root, _script, output_dir = project_paths(config)
        candidate = (output_dir / relative).resolve()
        if not inside(output_dir, candidate) or candidate.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            self._send_json(404, {"error": "Image artifact not found."})
            return
        try:
            content = candidate.read_bytes()
        except OSError:
            self._send_json(404, {"error": "Image artifact not found."})
            return
        if len(content) > 5 * 1024 * 1024:
            self._send_json(413, {"error": "Image artifact exceeds the 5 MB limit."})
            return
        mime = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        self.send_response(200)
        origin = self.headers.get("Origin", "").rstrip("/")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)


if __name__ == "__main__":
    print(f"Practice CRM Python bridge listening on http://{HOST}:{PORT}")
    print("Keep this process running while using Data Studio. Press Ctrl+C to stop.")
    ThreadingHTTPServer((HOST, PORT), BridgeHandler).serve_forever()
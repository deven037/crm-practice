# Practice CRM Python Bridge

This local companion lets the web Data Studio write selected CRM datasets into a PyCharm project and run one analysis script from that project. It uses only Python's standard library and listens on `127.0.0.1:8765`.

## Start it

From the repository root, use the Python interpreter you intend to use for your project:

```powershell
py -3 python_bridge/server.py
```

Keep the process running while you use the CRM. In **Settings → Python project bridge**, set the absolute project folder, script path relative to that folder (default `analysis.py`), interpreter path, and output folder. The bridge stores this configuration under your home directory in `.practice-crm-data-bridge/config.json`; it does not modify your CRM account or commit the path to this repository.

Use **Create starter script** to add the provided template to your chosen project. Existing scripts are never overwritten. Edit that script in PyCharm, or set the relative path to your own script. In Data Studio, name an extract and choose **Save dataset**; the timestamped CSV remains in `data/raw/` and appears in the Saved datasets selector. **Get Analysis** reruns the selected saved CSV without creating another raw copy. The starter demonstrates trimming text, dropping blank rows, and removing duplicate rows, then writes a separately timestamped CSV to `outputs/processed/`. The results screen lists its cleaning counts and provides **Use cleaned dataset**, which returns to Data Studio with that file selected for another analysis. The script receives `--dataset` and `--output-dir` arguments and must print one JSON object to stdout. Set `processed_dataset` in that report to a CSV path relative to `--output-dir` to register your own cleaned output. See `analysis_template.py` for the report shape. Save PNG/JPEG/WebP charts beneath the configured output directory to have them appear in the CRM.

## Safety and limits

The bridge listens only on loopback and accepts browser requests only from the
configured CRM origins (`CRM_WEB_ORIGINS`). By default these are the local Vite
development origins. Keep the bridge running only while you need it, and only
configure scripts you trust: the selected Python script is executed on your
computer. Requests are limited to 20 MB and 50,000 rows; script execution is
limited to 120 seconds and its JSON report to 2 MB. Dataset and output paths
must remain inside the configured project folder.

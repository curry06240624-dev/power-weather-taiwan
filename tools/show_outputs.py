"""Prints the text outputs of power_weather.ipynb, cell by cell (for checking numbers without opening Jupyter)."""
import sys, nbformat
sys.stdout.reconfigure(encoding="utf-8")
nb = nbformat.read("power_weather.ipynb", as_version=4)
for i, c in enumerate(nb.cells):
    if c.cell_type != "code":
        continue
    for o in c.get("outputs", []):
        if o.output_type == "stream":
            print(f"[{i}] " + o.text.rstrip())
        elif o.output_type in ("execute_result", "display_data"):
            t = o.get("data", {}).get("text/plain")
            if t:
                print(f"[{i}] " + t.rstrip())
        elif o.output_type == "error":
            print(f"[{i}] ERROR {o.ename}: {o.evalue}")

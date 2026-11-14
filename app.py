"""Serves the demo website (the docs/ folder) on your computer and opens it in your browser.

Usage:  python app.py      then visit http://127.0.0.1:8000
"""
import functools, http.server, pathlib, webbrowser

DOCS = pathlib.Path(__file__).resolve().parent / "docs"
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(DOCS))
server = http.server.ThreadingHTTPServer(("127.0.0.1", 8000), handler)
print("Power Weather Taiwan: http://127.0.0.1:8000  (Ctrl+C to stop)")
webbrowser.open("http://127.0.0.1:8000")
server.serve_forever()

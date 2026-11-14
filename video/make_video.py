"""Makes the demo video (under 2 minutes): AI narration (edge-tts), a real screen recording of the web demo, cards, captions.

Run from the project folder:  python video/make_video.py
Output: video/power_weather_demo.mp4
"""
import asyncio, functools, http.server, json, os, subprocess, sys, threading, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_video_lines import LINES, VOICE

WORK = os.path.join("video", "work")
os.makedirs(WORK, exist_ok=True)
W, H = 1280, 720            # final video size
RW, RH = 1360, 765          # browser size while recording (scaled down to W x H)
SHOW = {k: (show or say) for k, say, show in LINES}
M = json.load(open(os.path.join("docs", "model.json"), encoding="utf-8"))


def run(cmd):
    subprocess.run(cmd, check=True, capture_output=True)


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path],
                         check=True, capture_output=True, text=True).stdout
    return float(json.loads(out)["format"]["duration"])


# ---------- 1. narration ----------
async def make_audio():
    import edge_tts
    for k, say, _ in LINES:
        path = os.path.join(WORK, f"{k}.mp3")
        for attempt in range(8):
            if os.path.exists(path) and os.path.getsize(path) > 1000:
                break
            try:
                await edge_tts.Communicate(say, VOICE, rate="+6%").save(path)
            except Exception as e:          # the free voice service sometimes drops a request; just try again
                print("retry", k, type(e).__name__)
                if os.path.exists(path):
                    os.remove(path)
                await asyncio.sleep(3)

asyncio.run(make_audio())
DUR = {k: duration(os.path.join(WORK, f"{k}.mp3")) for k, _, _ in LINES}
print("narration seconds:", {k: round(v, 1) for k, v in DUR.items()}, "total", round(sum(DUR.values()), 1))

# ---------- 2. cards (HTML -> PNG), styled like the web demo ----------
CSS = """
body{margin:0;width:1280px;height:720px;background:#f4f5f7;color:#14181f;font-family:Inter,'Noto Sans TC','Segoe UI',sans-serif;
display:flex;flex-direction:column;justify-content:center;padding:0 100px;box-sizing:border-box}
h1{font-size:54px;margin:0 0 14px;display:flex;align-items:center;gap:18px;letter-spacing:-1px}
h2{font-size:38px;margin:0 0 28px;letter-spacing:-.5px} p{font-size:25px;line-height:1.45;margin:8px 0;color:#3b4552}
.card{background:#fff;border:1px solid #e4e7eb;border-radius:16px;padding:26px 32px}
.small{font-size:19px;color:#7a8594;margin-top:26px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
.two .card h3{margin:0 0 8px;font-size:26px} .two .card p{font-size:22px;margin:0}
.bar{display:flex;align-items:center;margin:16px 0;font-size:25px} .bar .n{flex:0 0 380px} .bar .b{height:24px;border-radius:6px;margin-right:16px}
.li{display:flex;gap:16px;align-items:baseline;margin:14px 0;font-size:25px} .li b{flex:0 0 210px}
.typo{display:grid;grid-template-columns:200px 1fr 1fr;gap:6px 18px;font-size:22px;margin-top:6px}
.typo span{color:#7a8594;font-size:18px} .red{color:#c93a2f;font-weight:700} .ok{color:#1f9d63;font-weight:700}
.dot{display:inline-block;width:18px;height:18px;border-radius:50%;margin-right:10px;vertical-align:-2px}
.big,.two .card p.big{font-size:64px;font-weight:700;letter-spacing:-1.5px;margin:6px 0 0;color:#14181f}
"""
LOGO = ("<svg width='54' height='54' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='#14181f'/>"
        "<path d='M18 4 8 18h7l-2 10 11-15h-7z' fill='#ffd23f'/></svg>")


def card_html(body):
    return ("<html><head><meta charset='utf-8'><link href='https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700"
            "&family=Noto+Sans+TC:wght@400;700&display=swap' rel='stylesheet'><style>" + CSS + "</style></head><body>"
            + body + "</body></html>")


sc = M["scores"]
Y, C = M["yellow_2026"], M["yellow_cause"]
bars = [("Same weekday last week", sc["Same weekday last week"], "#c3c9d1"),
        ("Same as today", sc["Persistence: same as today"], "#c3c9d1"),
        ("Tree model (gradient boosting)", sc["Gradient boosting (trees)"], "#9aa6b5"),
        ("<b>Our model (ridge regression)</b>", sc["Ridge + heat-on-workdays (final model)"], "#1f6feb")]
CARDS = {
    "title": card_html(f"""<h1>{LOGO}Power Weather Taiwan</h1>
        <p style='font-size:30px'>Forecasting tomorrow's electricity demand, and testing what public data can't predict</p>
        <p class='small'>Veritas AI International High School Hackathon 2026 · Climate track</p>"""),
    "problem": card_html("""<h2>Every evening: how much backup power for tomorrow?</h2>
        <div class='two'>
          <div class='card'><h3><span class='dot' style='background:#e2b100'></span>Too little</h3>
            <p>Spare power at the peak drops under 10%: Taipower's yellow light, and a risk of blackouts (as in 2021 and 2022).</p></div>
          <div class='card'><h3><span class='dot' style='background:#9aa6b5'></span>Too much</h3>
            <p>Extra fossil-fuel plants run on standby for nothing.</p></div>
        </div>
        <p style='font-size:30px;color:#14181f'>Both depend on one number: <b>tomorrow's peak demand.</b></p>"""),
    "data": card_html(f"""<h2>Data: all public</h2>
        <div class='li'><b>Taipower</b><span>1,413 days of peak demand and spare power, Jan 2023 to Nov 2026</span></div>
        <div class='li'><b>Holidays</b><span>The government office calendar (DGPA)</span></div>
        <div class='li'><b>Weather</b><span>Open-Meteo, 7 cities weighted by population: real weather to train,<br>the forecast made the day before to test</span></div>
        <div class='card' style='margin-top:18px'><div class='typo'>
          <span>16 typos found, e.g.</span><span>Taipower's rate column</span><span>reserve ÷ peak</span>
          <div>29 Mar 2025</div><div class='red'>202.0%</div><div class='ok'>20.02%</div></div></div>"""),
    "results": card_html("""<h2>Average miss on 317 days of 2026</h2>
        <p style='margin:-18px 0 14px;font-size:21px;color:#7a8594'>A year the model never saw, fed the weather forecast from the day before. Lower is better.</p>"""
        + "".join(f"<div class='bar'><span class='n'>{n}</span><span class='b' style='width:{int(v * 120)}px;background:{c}'></span>{v:.2f}%</div>"
                  for n, v, c in bars)
        + "<p class='small'>Trees can't forecast above the records they saw in training; on the 98 hottest days they were 676 MW too low on average.</p>"),
    "yellow": card_html(f"""<h2>Can public data warn about yellow-light days? No.</h2>
        <div class='two'>
          <div class='card'><p>On yellow days, demand vs normal for the month</p><p class='big'>{C['demand_pct']:+.1f}%</p></div>
          <div class='card'><p>On yellow days, supply vs normal for the month</p><p class='big' style='color:#c93a2f'>{C['supply_pct']:+.1f}%</p></div>
        </div>
        <p>Yellow days come from power plants that are down, which the weather can't show.</p>
        <p class='small'>A warning model caught {Y['caught']} of {Y['days']} yellow days in 2026 only by warning on {Y['warned']} of {Y['test_days']} days: {Y['false_alarm_pct']}% false alarms.</p>"""),
    "end": card_html("""<h2>Next: typhoon days off and Taipower's maintenance plans</h2>
        <p>Demo: curry06240624-dev.github.io/power-weather-taiwan</p>
        <p>Code: github.com/curry06240624-dev/power-weather-taiwan</p>
        <p class='small'>Power Weather Taiwan · Veritas AI International High School Hackathon 2026 · a prototype, not an official Taipower forecast<br>
        AI tools used: Claude Code (suggested the idea, wrote most of the code, the write-up and this script) · Microsoft Edge text-to-speech (this voice)</p>"""),
}

# ---------- 3. screen recording of the real web demo ----------
from playwright.sync_api import sync_playwright

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory="docs")
server = http.server.ThreadingHTTPServer(("127.0.0.1", 7864), lambda *a: handler(*a))
server.RequestHandlerClass.log_message = lambda *a, **k: None
threading.Thread(target=server.serve_forever, daemon=True).start()

HL_CSS = ".pw-hl{box-shadow:0 0 0 4px #ffd23f !important;border-radius:10px;transition:box-shadow .3s}"
marks = {}
with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    page = browser.new_page(viewport={"width": W, "height": H})
    for name, html in CARDS.items():
        page.set_content(html)
        page.wait_for_timeout(900)
        page.screenshot(path=os.path.join(WORK, f"card_{name}.png"))
    page.close()
    ctx = browser.new_context(viewport={"width": RW, "height": RH}, record_video_dir=WORK,
                              record_video_size={"width": RW, "height": RH})
    page = ctx.new_page()
    t0 = time.monotonic()
    page.goto("http://127.0.0.1:7864/")
    page.wait_for_selector("#chips button", timeout=30000)
    page.add_style_tag(content=HL_CSS)
    page.wait_for_timeout(1500)

    def hl(selector, on=True):
        page.evaluate("([s, on]) => document.querySelectorAll(s).forEach(e => e.classList.toggle('pw-hl', on))", [selector, on])

    def smooth_to(selector, offset=20):
        page.evaluate("([s, o]) => window.scrollTo({top: document.querySelector(s).getBoundingClientRect().top + scrollY - o, behavior: 'instant'})",
                      [selector, offset])
        page.wait_for_timeout(500)

    def step(key, actions):
        start = time.monotonic() - t0
        actions()
        left = DUR[key] + 0.8 - (time.monotonic() - t0 - start)
        page.wait_for_timeout(max(left, 1.0) * 1000)
        marks[key] = (start, time.monotonic() - t0)

    def b1():
        page.wait_for_timeout(int(DUR["B1"] * 450))
        hl(".big", True); page.wait_for_timeout(2500); hl(".big", False)
        hl("#cmp div:nth-child(2)", True)

    def b2():
        hl("#cmp div:nth-child(2)", False)
        smooth_to(".chart-card", 12)
        page.wait_for_timeout(600)
        hl(".stat:nth-child(1)", True); hl(".stat:nth-child(2)", True)

    def b3():
        hl(".stat", False)
        smooth_to("main", 80)
        page.click("text=Typhoon Champi")
        page.wait_for_timeout(1200)
        hl("#note", True); hl("#real", True)

    def b4():
        hl("#note", False); hl("#real", False)
        smooth_to(".whatif", 16)
        page.click("#dtype button[data-t=work]")
        page.wait_for_timeout(500)
        v = float(page.eval_on_selector("#temp", "e => e.value"))
        while v < 35:
            v = min(35, v + 0.5)
            page.eval_on_selector("#temp", "(e, v) => { e.value = v; e.dispatchEvent(new Event('input')); }", v)
            page.wait_for_timeout(110)
        hl(".whatif .small-big", True)

    step("B1", b1)
    step("B2", b2)
    step("B3", b3)
    step("B4", b4)
    video_path = page.video.path()
    ctx.close()
    browser.close()
server.shutdown()
REC = os.path.join(WORK, "recording.mp4")
run(["ffmpeg", "-y", "-i", video_path, "-r", "30", "-vf", f"scale={W}:{H}:flags=lanczos", "-c:v", "libx264",
     "-crf", "16", "-pix_fmt", "yuv420p", REC])
print("recording marks:", {k: (round(a, 1), round(b, 1)) for k, (a, b) in marks.items()})

# ---------- 4. timeline ----------
segments = []   # (kind, source, start_in_source, length)
cues = []       # (line id, start in final video)
t = 0.0
def add_card(name, length):
    global t
    segments.append(("card", os.path.join(WORK, f"card_{name}.png"), 0, length)); t += length
def add_rec(a, b):
    global t
    segments.append(("rec", REC, a, b - a)); t += b - a

add_card("title", 2.5)
cues.append(("A", t + 0.3)); add_card("problem", DUR["A"] + 0.8)
b_start = max(marks["B1"][0] - 0.3, 0)
for key in ["B1", "B2", "B3", "B4"]:
    cues.append((key, t + (marks[key][0] - b_start) + 0.2))
add_rec(b_start, marks["B4"][1])
cues.append(("C1", t + 0.2)); add_card("data", DUR["C1"] + 0.7)
cues.append(("C2", t + 0.2)); add_card("results", DUR["C2"] + 0.8)
cues.append(("D1", t + 0.2)); add_card("yellow", DUR["D1"] + 0.7)
cues.append(("D2", t + 0.2)); add_card("end", DUR["D2"] + 1.8)
TOTAL = t
print(f"total length: {TOTAL:.1f} s")
assert TOTAL <= 120, "video is over 2 minutes"

# ---------- 5. render pieces, then join ----------
parts = []
for i, (kind, src, a, length) in enumerate(segments):
    out = os.path.join(WORK, f"part_{i}.mp4")
    if kind == "card":
        run(["ffmpeg", "-y", "-loop", "1", "-t", f"{length:.3f}", "-i", src, "-r", "30", "-vf", f"scale={W}:{H},format=yuv420p",
             "-c:v", "libx264", "-crf", "16", out])
    else:
        run(["ffmpeg", "-y", "-ss", f"{a:.3f}", "-t", f"{length:.3f}", "-i", src, "-r", "30",
             "-vf", f"scale={W}:{H},format=yuv420p", "-c:v", "libx264", "-crf", "16", out])
    parts.append(out)
with open(os.path.join(WORK, "parts.txt"), "w") as f:
    f.writelines(f"file '{os.path.basename(p)}'\n" for p in parts)
run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", os.path.join(WORK, "parts.txt"), "-c", "copy",
     os.path.join(WORK, "silent.mp4")])

inputs, filters = [], []
for n, (key, start) in enumerate(cues):
    inputs += ["-i", os.path.join(WORK, f"{key}.mp3")]
    ms = int(start * 1000)
    filters.append(f"[{n}:a]adelay={ms}|{ms}[a{n}]")
mix = "".join(f"[a{n}]" for n in range(len(cues)))
filters.append(f"{mix}amix=inputs={len(cues)}:normalize=0,apad,atrim=0:{TOTAL:.3f}[out]")
run(["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(filters), "-map", "[out]", "-c:a", "aac", "-b:a", "160k",
     os.path.join(WORK, "narration.m4a")])

def fmt(s):
    h, rem = divmod(s, 3600); m, sec = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{sec:05.2f}"
events = []
for key, start in cues:
    words = SHOW[key].split()
    chunks = [" ".join(words[i:i + 12]) for i in range(0, len(words), 12)]
    total_chars = sum(len(c) for c in chunks)
    s = start
    for c in chunks:
        d = DUR[key] * len(c) / total_chars
        events.append(f"Dialogue: 0,{fmt(s)},{fmt(s + d)},Default,,0,0,0,,{c}")
        s += d
ass = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Segoe UI,30,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,1,0,0,0,100,100,0,0,3,1,0,2,60,60,26,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(events) + "\n"
with open(os.path.join(WORK, "captions.ass"), "w", encoding="utf-8") as f:
    f.write(ass)

final = os.path.abspath(os.path.join("video", "power_weather_demo.mp4"))
subprocess.run(["ffmpeg", "-y", "-i", "silent.mp4", "-i", "narration.m4a", "-vf", "subtitles=captions.ass",
                "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-c:a", "copy", "-shortest", "-movflags", "+faststart",
                final], check=True, capture_output=True, cwd=WORK)
print(f"wrote {final}  ({duration(final):.1f} s, {os.path.getsize(final) / 1e6:.1f} MB)")

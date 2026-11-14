// Power Weather Taiwan: page logic. Weights and the 2026 replay come from model.json (written by the notebook);
// the Taiwan outline comes from taiwan.json (Natural Earth, public domain).
(async function () {
  const [M, TW] = await Promise.all([fetch("model.json").then((r) => r.json()), fetch("taiwan.json").then((r) => r.json())]);
  const days = M.days;
  const latest = Object.assign({ note: "", actual: null, reserve_rate: null }, M.latest);
  const all = days.concat([latest]);          // the 2026 replay + the newest forecast (no real value yet)
  const $ = (id) => document.getElementById(id);
  const GW = (mw) => (mw / 1000).toFixed(1);
  const signed = (mw) => (mw >= 0 ? "+" : "−") + Math.abs(mw / 1000).toFixed(1);
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmt = (s, o) => parse(s).toLocaleDateString("en-GB", o || { weekday: "short", day: "numeric", month: "short", year: "numeric" }).replace(",", "");
  const idxOf = (date) => all.findIndex((d) => d.date === date);
  const pct = (a, b) => (a - b) / b * 100;
  let sel = idxOf("2026-08-03") >= 0 ? idxOf("2026-08-03") : all.length - 1;

  // ---------------- tabs ----------------
  function showTab() {
    const tab = (location.hash || "#forecast").slice(1);
    const name = ["forecast", "history", "methodology", "about"].includes(tab) ? tab : "forecast";
    document.querySelectorAll("main").forEach((m) => { m.hidden = m.id !== "view-" + name; });
    document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === name));
    if (name === "forecast") { renderMap(); renderMini(); }
    if (name === "history") renderChart();
  }
  window.addEventListener("hashchange", showTab);

  // ---------------- side panel ----------------
  const JUMPS = [["Record peak", M.record_2026.date], ["Hot Monday", "2026-08-03"], ["Typhoon Bavi", "2026-07-11"],
                 ["Typhoon Champi", "2026-10-23"], ["Lunar New Year", "2026-02-17"], ["Newest forecast", latest.date]]
    .filter(([, d]) => idxOf(d) >= 0);
  $("jump").innerHTML = `<option value="">Choose a day…</option>` +
    JUMPS.map(([t, d]) => `<option value="${d}">${t} · ${fmt(d, { day: "numeric", month: "short" })}</option>`).join("");
  $("jump").addEventListener("change", (e) => { if (e.target.value) select(idxOf(e.target.value)); });

  const SCALE = Math.max(...all.flatMap((d) => Object.values(d.contrib).map(Math.abs)));
  function renderPanel() {
    const d = all[sel];
    $("dayname").textContent = fmt(d.date);
    $("pred").textContent = GW(d.pred);
    if (d.actual == null) {
      $("real").innerHTML = `<small>not published yet</small>`;
      $("same").innerHTML = `${GW(d.load_today)} GW`;
    } else {
      $("real").textContent = `${GW(d.actual)} GW`;
      const e = pct(d.load_today, d.actual);
      $("same").innerHTML = `${GW(d.load_today)} GW, <small>${e >= 0 ? "+" : "−"}${Math.abs(e).toFixed(1)}%</small>`;
    }
    const miss = d.actual == null ? "" : ` Our miss: ${pct(d.pred, d.actual) >= 0 ? "+" : "−"}${Math.abs(pct(d.pred, d.actual)).toFixed(1)}%.`;
    $("note").hidden = !d.note;
    $("note").textContent = d.note ? `${d.note[0].toUpperCase()}${d.note.slice(1)}.${miss}` : "";
    const parts = [["Weather", d.contrib.weather], ["Day type", d.contrib["day type"]],
                   ["Recent demand", d.contrib["recent demand"]], ["Growth trend", d.contrib["growth trend"]]];
    $("why").innerHTML = parts.map(([n, v]) =>
      `<div class="why-row"><span class="lab">${n}</span><span class="track"><span class="fill${v < 0 ? " neg" : ""}" style="width:${(Math.min(Math.abs(v) / SCALE, 1) * 100).toFixed(1)}%"></span></span><span class="val">${signed(v)} GW</span></div>`).join("") +
      `<div class="why-base"><span>Compared with an average 2023–25 day (${GW(M.typical_load)} GW)</span></div>`;
    $("prev").disabled = sel === 0;
    $("next").disabled = sel === all.length - 1;
    $("jump").value = JUMPS.some(([, dt]) => dt === d.date) ? d.date : "";
  }

  // scores (panel and history page)
  const S = M.scores;
  const scoreHTML = [[S["Ridge + heat-on-workdays (final model)"], "Ours"], [S["Persistence: same as today"], "Same as today"],
                     [S["Same weekday last week"], "Same weekday last week"]]
    .map(([v, t]) => `<div><b>${v.toFixed(2)}%</b><span>${t}</span></div>`).join("");
  $("scores").innerHTML = scoreHTML;
  $("scores2").innerHTML = scoreHTML.replace("<span>Ours</span>", "<span>Ours: average miss</span>");

  // mini chart: the 8 days up to the selected one
  function renderMini() {
    const box = $("mini");
    if (!box.clientWidth) return;
    const W = box.clientWidth, H = box.clientHeight, L = 28, R = 6, T = 16, B = 18;
    const end = Math.min(sel, days.length - 1), start = Math.max(0, end - 7);
    const span = all.slice(start, Math.min(sel, all.length - 1) + 1);
    const vals = span.flatMap((d) => [d.pred, d.actual]).filter((v) => v != null);
    let lo = Math.floor(Math.min(...vals) / 2000) * 2000, hi = Math.ceil(Math.max(...vals) / 2000) * 2000;
    if (hi - lo < 4000) hi = lo + 4000;
    const X = (i) => L + (span.length < 2 ? 0 : i / (span.length - 1)) * (W - L - R);
    const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    let g = "";
    for (let v = lo; v <= hi; v += 2000) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#eef0f1"/><text x="${L - 5}" y="${Y(v) + 3}" text-anchor="end">${v / 1000}</text>`;
    g += `<text x="2" y="8">GW</text>`;
    span.forEach((d, i) => { if (i % 2 === (span.length - 1) % 2) g += `<text x="${X(i)}" y="${H - 4}" text-anchor="${i === span.length - 1 ? "end" : "middle"}">${fmt(d.date, { day: "numeric", month: "short" })}</text>`; });
    const line = (key, color) => {
      const pts = span.map((d, i) => (d[key] == null ? null : [X(i), Y(d[key])])).filter(Boolean);
      return `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${color}" stroke-width="1.8"/>` +
        pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${color}"/>`).join("");
    };
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${g}${line("actual", "#111417")}${line("pred", "#0f8f7e")}</svg>`;
  }

  // ---------------- map ----------------
  const K = Math.cos(23.7 * Math.PI / 180);
  const ring = TW.main_island;
  const lons = ring.map((p) => p[0]), lats = ring.map((p) => p[1]);
  const box0 = { x0: Math.min(...lons) * K, x1: Math.max(...lons) * K, y0: -Math.max(...lats), y1: -Math.min(...lats) };
  // label placement [dx, dy of the name line, anchor]; the north-west cities sit close together, so their labels go out over the sea
  const LABEL = { Taoyuan: [-9, -22, "end"], Hsinchu: [-9, 5, "end"] };
  const SHOWN = new Set(["Taipei", "Taoyuan", "Hsinchu", "Taichung", "Tainan", "Kaohsiung"]);   // New Taipei sits on top of Taipei
  function renderMap() {
    const svg = $("map");
    const W = svg.clientWidth, H = svg.clientHeight;
    if (!W || !H) return;
    const pad = 46, top = W < 500 ? 88 : 64;
    const s = Math.min((W - 2 * pad) / (box0.x1 - box0.x0), (H - top - 16) / (box0.y1 - box0.y0));
    const ox = (W - s * (box0.x1 - box0.x0)) / 2, oy = top;
    const P = (lon, lat) => [ox + (lon * K - box0.x0) * s, oy + (-lat - box0.y0) * s];
    const path = "M" + ring.map(([lon, lat]) => P(lon, lat).map((v) => v.toFixed(1)).join(",")).join("L") + "Z";
    const d = all[sel];
    const cities = M.cities.map((c, i) => {
      if (!SHOWN.has(c.name)) return "";
      const [x, y] = P(c.lon, c.lat);
      const t = d.city_tmax[i];
      const [dx, dy, anchor] = LABEL[c.name] || [9, -3, "start"];
      return `<circle class="dot" cx="${x}" cy="${y}" r="3.6"/>` +
        `<text class="cname" x="${x + dx}" y="${y + dy}" text-anchor="${anchor}">${c.name}</text>` +
        `<text class="ctemp" x="${x + dx}" y="${y + dy + 17}" text-anchor="${anchor}">${t == null ? "–" : Math.round(t) + "°"}</text>`;
    }).join("");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = `<path class="land" d="${path}"/>${cities}`;
    $("mapcap").textContent = `Forecast max temperature · ${fmt(d.date, { weekday: "short", day: "numeric", month: "short" })}`;
    $("mapsub").textContent = `Made the day before. The model uses the average of seven cities (New Taipei too), weighted by population: ${d.tmax_fc.toFixed(1)} °C.`;
  }

  // month strip of Taipower's real light
  let month = parse(all[sel].date).getMonth();
  function renderStrip() {
    const y = 2026, n = new Date(y, month + 1, 0).getDate();
    $("month").textContent = new Date(y, month, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
    let html = "";
    for (let dd = 1; dd <= n; dd++) {
      const date = `${y}-${String(month + 1).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      const i = idxOf(date), d = all[i];
      const cls = !d || d.reserve_rate == null ? "" : d.reserve_rate < 10 ? "y" : "g";
      const title = !d ? "no forecast" : d.reserve_rate == null ? "no real value yet" : `${d.reserve_rate.toFixed(1)}% spare`;
      html += `<button data-i="${i}" class="${i === sel ? "sel" : ""}" ${i < 0 ? "disabled" : ""} title="${fmt(date, { day: "numeric", month: "short" })}: ${title}"><i class="${cls}"></i>${dd}</button>`;
    }
    $("strip").innerHTML = html;
    $("mprev").disabled = month === 0;
    $("mnext").disabled = month >= parse(latest.date).getMonth();
  }
  $("strip").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && +b.dataset.i >= 0) select(+b.dataset.i); });
  $("mprev").addEventListener("click", () => { month = Math.max(0, month - 1); renderStrip(); });
  $("mnext").addEventListener("click", () => { month = Math.min(parse(latest.date).getMonth(), month + 1); renderStrip(); });

  // ---------------- what if (starts from the newest forecast's inputs) ----------------
  const wi = { t: latest.tmax_fc, type: latest.off ? (latest.dow === 5 || latest.dow === 6 ? "sat" : "hol") : "work" };
  $("temp").value = wi.t;
  function renderWhatIf() {
    const d = Object.assign({}, latest);
    const gap = latest.tmax_fc - latest.tmean_fc;
    d.tmax_fc = wi.t; d.tmean_fc = wi.t - gap;
    d.off = wi.type === "work" ? 0 : 1;
    d.dow = wi.type === "sat" ? 5 : 2;
    const p = PW.predict(M, d);
    $("tempVal").textContent = `${wi.t.toFixed(1)} °C`;
    $("wiPred").textContent = `${GW(p)} GW`;
    const c = (n) => M.coef[M.features.indexOf(n)];
    const perC = c("heat_above_24C") + (wi.t > 29 ? c("heat_above_29C") + (d.off ? 0 : c("heat_above_29C_on_workday")) : 0);
    $("wiNote").textContent = wi.t > 24
      ? `Each extra degree adds about ${Math.round(perC)} MW here. The 2026 record was ${GW(M.record_2026.mw)} GW (${fmt(M.record_2026.date, { day: "numeric", month: "short" })}).`
      : "Below 24 °C, heat adds nothing; below a 17 °C daily mean, heaters add a little.";
    document.querySelectorAll("#dtype button").forEach((b) => { b.classList.toggle("on", b.dataset.t === wi.type); b.setAttribute("aria-checked", b.dataset.t === wi.type); });
  }
  $("temp").addEventListener("input", (e) => { wi.t = +e.target.value; renderWhatIf(); });
  document.querySelectorAll("#dtype button").forEach((b) => b.addEventListener("click", () => { wi.type = b.dataset.t; renderWhatIf(); }));

  // ---------------- history page ----------------
  const showPersist = $("showPersist");
  function renderChart() {
    const box = $("chart");
    if (!box.clientWidth) return;
    const W = box.clientWidth, H = box.clientHeight, L = 40, R = 8, T = 10, B = 24;
    const vals = days.flatMap((d) => [d.actual, d.pred]);
    const lo = Math.floor(Math.min(...vals) / 5000) * 5000, hi = Math.ceil(Math.max(...vals) / 5000) * 5000;
    const n = days.length;
    const X = (i) => L + (i / (n - 1)) * (W - L - R);
    const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const path = (key) => days.map((d, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(d[key]).toFixed(1)}`).join("");
    let g = "";
    for (let v = lo; v <= hi; v += 5000) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#eef0f1"/><text x="${L - 6}" y="${Y(v) + 3}" text-anchor="end">${v / 1000} GW</text>`;
    for (let m = 0; m < 11; m++) {
      const i = days.findIndex((d) => parse(d.date).getMonth() === m && parse(d.date).getDate() === 1);
      if (i >= 0) g += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${parse(days[i].date).toLocaleDateString("en-US", { month: "short" })}</text>`;
    }
    const persist = showPersist.checked ? `<path d="${path("persistence")}" fill="none" stroke="#b9c0c6" stroke-width="1.2"/>` : "";
    const k = Math.min(sel, n - 1);
    const mark = `<line x1="${X(k)}" x2="${X(k)}" y1="${T}" y2="${H - B}" stroke="#111417" stroke-opacity=".25"/>`;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${g}${persist}<path d="${path("actual")}" fill="none" stroke="#111417" stroke-width="1.4"/>` +
      `<path d="${path("pred")}" fill="none" stroke="#0f8f7e" stroke-width="1.3"/>${mark}</svg>`;
    box.onclick = (e) => {
      const r = box.getBoundingClientRect();
      const i = Math.round(((e.clientX - r.left) - L) / (W - L - R) * (n - 1));
      select(Math.max(0, Math.min(n - 1, i))); location.hash = "#forecast";
    };
    $("lights").innerHTML = days.map((d, i) => `<i class="${d.reserve_rate < 10 ? "y" : ""}" data-i="${i}"></i>`).join("");
  }
  $("lights").addEventListener("click", (e) => { if (e.target.dataset.i) { select(+e.target.dataset.i); location.hash = "#forecast"; } });
  showPersist.addEventListener("change", renderChart);

  const worst = days.map((d, i) => ({ d, i, e: pct(d.pred, d.actual) })).sort((a, b) => Math.abs(b.e) - Math.abs(a.e)).slice(0, 8);
  $("misses").innerHTML = worst.map(({ d, i, e }) =>
    `<tr data-i="${i}"><td>${fmt(d.date)}</td><td>${e >= 0 ? "+" : "−"}${Math.abs(e).toFixed(1)}%</td><td>${d.note ? d.note[0].toUpperCase() + d.note.slice(1) : "–"}</td></tr>`).join("");
  $("misses").addEventListener("click", (e) => { const tr = e.target.closest("tr"); if (tr) { select(+tr.dataset.i); location.hash = "#forecast"; } });

  const Yw = M.yellow_2026, C = M.yellow_cause, G = M.growth;
  $("limYellow").textContent = `2026 had ${Yw.days} yellow days. A warning model caught ${Yw.caught} of them only by warning on ${Yw.warned} of ${Yw.test_days} days: ${Yw.false_alarm_pct}% false alarms. On yellow days demand was ${Math.abs(C.demand_pct)}% below normal for the month, but supply was ${Math.abs(C.supply_pct)}% below: power plants were down, which the weather can't show.`;
  $("limGrowth").textContent = `At the same weather, 2026 peaks were ${GW(G["2026"])} GW higher than 2023 (${(G["2026"] / M.maanshan_mw).toFixed(1)} times one Maanshan nuclear unit), yet Taipower's total daily energy use barely changed from 2025 to 2026. Public data can't tell why.`;

  // ---------------- methodology page: the weights ----------------
  const PLAIN = {
    heat_above_24C: "Each °C of max temperature above 24 °C", heat_above_29C: "Extra per °C above 29 °C (any day)",
    heat_above_29C_on_workday: "Extra per °C above 29 °C on a workday", cold_below_17C: "Each °C of daily mean below 17 °C",
    humidity: "Each % of humidity", sunshine: "Each MJ/m² of sunshine", rain_log: "Each step of log(1 + rain in mm)",
    saturday_off: "Saturday off", sunday_off: "Sunday off", weekday_holiday: "Holiday on a weekday",
    makeup_workday: "Make-up workday on a weekend", lunar_new_year: "Lunar New Year break", monday: "Monday",
    load_today: "Each MW of today's peak", load_same_day_last_week: "Each MW of last week's peak",
    today_was_off: "Today was a day off", years_since_2023: "Each year (growth trend)",
  };
  $("weights").innerHTML = M.features.map((f, i) => {
    const v = M.coef[i];
    const txt = Math.abs(v) < 10 ? v.toFixed(2) : Math.round(v).toLocaleString("en-US");
    return `<tr><td>${PLAIN[f] || f}</td><td>${v >= 0 ? "+" : "−"}${txt.replace("-", "")} MW</td></tr>`;
  }).join("") + `<tr><td>Starting value (intercept)</td><td>${Math.round(M.intercept).toLocaleString("en-US")} MW</td></tr>`;

  // ---------------- navigation ----------------
  $("prev").addEventListener("click", () => select(sel - 1));
  $("next").addEventListener("click", () => select(sel + 1));
  document.addEventListener("keydown", (e) => {
    if (["INPUT", "SELECT"].includes(e.target.tagName)) return;
    if (e.key === "ArrowLeft") select(sel - 1);
    if (e.key === "ArrowRight") select(sel + 1);
  });
  window.addEventListener("resize", () => { renderMap(); renderMini(); renderChart(); });

  function select(i) {
    if (i < 0 || i >= all.length) return;
    sel = i;
    month = parse(all[sel].date).getMonth();
    renderPanel(); renderStrip(); renderMap(); renderMini();
  }
  select(sel);
  renderWhatIf();
  showTab();
})();

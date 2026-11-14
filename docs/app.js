// Power Weather Taiwan: page logic. Data and weights come from model.json (written by the notebook).
(async function () {
  const M = await (await fetch("model.json")).json();
  const days = M.days;
  const latest = Object.assign({ latest: true, note: "", actual: null, reserve_rate: null }, M.latest);
  const all = days.concat([latest]);                      // 2026 replay + the newest forecast (no real value yet)
  const $ = (id) => document.getElementById(id);
  const GW = (mw) => (mw / 1000).toFixed(1);
  const sign = (mw) => (mw >= 0 ? "+" : "−") + Math.abs(mw / 1000).toFixed(1);
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmt = (s, opts) => parse(s).toLocaleDateString("en-GB", opts || { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const DAYNAME = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // ---- notable days for the chips
  const idxOf = (date) => all.findIndex((d) => d.date === date);
  const CHIPS = [
    ["Record peak", M.record_2026.date],
    ["Hot Monday", "2026-08-03"],
    ["Typhoon Bavi", "2026-07-11"],
    ["Typhoon Champi", "2026-10-23"],
    ["Lunar New Year", "2026-02-17"],
    ["Newest forecast", latest.date],
  ].filter(([, d]) => idxOf(d) >= 0);

  let sel = idxOf("2026-08-03") >= 0 ? idxOf("2026-08-03") : all.length - 1;
  const SCALE = Math.max(...all.flatMap((d) => Object.values(d.contrib).map(Math.abs)));   // largest part on any day

  // ---- hero card
  function renderHero() {
    const d = all[sel];
    $("dayname").textContent = fmt(d.date);
    $("picker").value = d.date;
    $("pred").textContent = GW(d.pred);
    if (d.actual == null) {
      $("real").innerHTML = `Real peak <b>not published yet</b> <span class="off">· made with data up to ${fmt(all[sel - 1].date, { day: "numeric", month: "short" })}</span>`;
    } else {
      const err = (d.pred - d.actual) / d.actual * 100;
      const word = Math.abs(err) < 0.05 ? "spot on" : `forecast ${Math.abs(err).toFixed(1)}% ${err > 0 ? "too high" : "too low"}`;
      $("real").innerHTML = `Real peak <b>${GW(d.actual)} GW</b> <span class="off">· ${word}</span>`;
    }
    const type = d.off ? (d.lny ? "Lunar New Year break" : d.holiday ? `Holiday (${d.holiday})` : `${DAYNAME[d.dow]} off`) : "Workday";
    const facts = [
      `Forecast max ${d.tmax_fc.toFixed(1)} °C`,
      type,
      `Rain forecast ${Math.round(d.rain_fc)} mm`,
    ];
    if (d.reserve_rate != null) {
      const y = d.reserve_rate < 10;
      facts.push(`<span class="dot ${y ? "yellow" : "green"}"></span>Real light: ${y ? "yellow" : "green"} (${d.reserve_rate.toFixed(1)}% spare)`);
    }
    $("facts").innerHTML = facts.map((f) => `<li>${f}</li>`).join("");
    $("note").hidden = !d.note;
    $("note").textContent = d.note || "";
    document.querySelectorAll("#chips button").forEach((b) => b.classList.toggle("on", b.dataset.date === d.date));
    $("prev").disabled = sel === 0;
    $("next").disabled = sel === all.length - 1;
  }

  // ---- waterfall
  function renderWhy() {
    const d = all[sel];
    const parts = [["Weather", d.contrib.weather], ["Day type", d.contrib["day type"]],
                   ["Recent demand", d.contrib["recent demand"]], ["Growth trend", d.contrib["growth trend"]]];
    // bars grow left (less power) or right (more power) from the centre line; one fixed scale for every day
    const half = (v) => (Math.min(Math.abs(v) / SCALE, 1) * 50).toFixed(2) + "%";
    let html = `<div class="wf-line"><span>An average 2023–25 day</span><b>${GW(M.typical_load)} GW</b></div>`;
    parts.forEach(([name, v]) => {
      const pos = v >= 0 ? `left:50%;width:${half(v)}` : `right:50%;width:${half(v)}`;
      html += `<div class="wf-row"><span class="name">${name}</span><div class="wf-track"><div class="wf-bar ${v >= 0 ? "up" : "down"}" style="${pos}"></div></div><span class="val">${sign(v)}</span></div>`;
    });
    html += `<div class="wf-line total"><span>Forecast</span><b>${GW(d.pred)} GW</b></div>`;
    $("waterfall").innerHTML = html;
    const miss = (p) => (d.actual == null ? "" : `<em>${p >= d.actual ? "+" : "−"}${Math.abs((p - d.actual) / d.actual * 100).toFixed(1)}%</em>`);
    $("cmp").innerHTML =
      `<div class="ours"><span>Our forecast</span><b>${GW(d.pred)} GW</b>${miss(d.pred)}</div>` +
      `<div><span>“Same as today”</span><b>${GW(d.load_today)} GW</b>${miss(d.load_today)}</div>` +
      `<div><span>Real peak</span><b>${d.actual == null ? "not yet" : GW(d.actual) + " GW"}</b></div>`;
  }

  // ---- chart
  const showPersist = $("showPersist");
  function renderChart() {
    const box = $("chart");
    const W = box.clientWidth, H = box.clientHeight;
    const L = 44, R = 8, T = 10, B = 24;
    const vals = days.flatMap((d) => [d.actual, d.pred]).concat([latest.pred]);
    const ymin = Math.floor(Math.min(...vals) / 2500) * 2500, ymax = Math.ceil(Math.max(...vals) / 2500) * 2500;
    const firstLabel = Math.ceil(ymin / 5000) * 5000;
    const n = all.length;
    const X = (i) => L + (i / (n - 1)) * (W - L - R);
    const Y = (mw) => T + (1 - (mw - ymin) / (ymax - ymin)) * (H - T - B);
    const path = (key, list) => list.map((d, i) => (d[key] == null ? null : `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(d[key]).toFixed(1)}`)).filter(Boolean).join("");
    let g = '<g class="grid">';
    for (let v = ymin; v <= ymax; v += 2500) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/>`;
    g += "</g><g class=\"axis\">";
    for (let v = firstLabel; v <= ymax; v += 5000) g += `<text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${v / 1000} GW</text>`;
    for (let m = 0; m < 11; m++) {
      const i = all.findIndex((d) => parse(d.date).getMonth() === m && parse(d.date).getDate() === 1);
      if (i >= 0) g += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${parse(all[i].date).toLocaleDateString("en-US", { month: "short" })}</text>`;
    }
    g += "</g>";
    const persist = showPersist.checked ? `<path d="${path("persistence", days)}" fill="none" stroke="var(--persist)" stroke-width="1.3"/>` : "";
    const d = all[sel];
    const marker = `<line x1="${X(sel)}" x2="${X(sel)}" y1="${T}" y2="${H - B}" stroke="var(--ink)" stroke-opacity=".25"/>` +
      (d.actual != null ? `<circle cx="${X(sel)}" cy="${Y(d.actual)}" r="4.5" fill="var(--ink)"/>` : "") +
      `<circle cx="${X(sel)}" cy="${Y(d.pred)}" r="4.5" fill="var(--ours)" stroke="#fff" stroke-width="1.5"/>`;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${g}${persist}` +
      `<path d="${path("actual", days)}" fill="none" stroke="var(--ink)" stroke-width="1.5"/>` +
      `<path d="${path("pred", all)}" fill="none" stroke="var(--ours)" stroke-width="1.4"/>${marker}</svg>`;
    box.onclick = (e) => {
      const r = box.getBoundingClientRect();
      const i = Math.round(((e.clientX - r.left) - L) / (W - L - R) * (n - 1));
      select(Math.max(0, Math.min(n - 1, i)));
    };
    $("lights").innerHTML = all.map((d, i) => `<i class="${i === sel ? "sel" : d.reserve_rate == null ? "" : d.reserve_rate < 10 ? "y" : "g"}" data-i="${i}"></i>`).join("");
  }
  $("lights").addEventListener("click", (e) => { if (e.target.dataset.i) select(+e.target.dataset.i); });
  showPersist.addEventListener("change", renderChart);
  window.addEventListener("resize", renderChart);

  // ---- score tiles
  const s = M.scores;
  $("stats").innerHTML = [
    ["ours", s["Ridge + heat-on-workdays (final model)"], "our average miss"],
    ["", s["Persistence: same as today"], "if you guess “same as today”"],
    ["", s["Same weekday last week"], "if you guess “same as last week”"],
  ].map(([c, v, t]) => `<div class="stat ${c}"><b>${v.toFixed(2)}%</b><span>${t}</span></div>`).join("");

  // ---- what-if (starts from the newest forecast's inputs)
  const wi = { t: latest.tmax_fc, type: latest.off ? (latest.dow === 5 ? "sat" : latest.dow === 6 ? "sun" : "hol") : "work" };
  $("whatifBase").textContent = `Starting from the newest forecast (${fmt(latest.date)}), with demand known up to ${fmt(days[days.length - 1].date, { day: "numeric", month: "short" })}. Change the weather and the day type:`;
  $("temp").value = wi.t;
  const record = M.record_2026.mw;
  function renderWhatIf() {
    const d = Object.assign({}, latest);
    const gap = latest.tmax_fc - latest.tmean_fc;              // keep the forecast's gap between max and mean
    d.tmax_fc = wi.t; d.tmean_fc = wi.t - gap;
    d.off = wi.type === "work" ? 0 : 1;
    d.dow = wi.type === "sat" ? 5 : wi.type === "sun" ? 6 : wi.type === "hol" ? 2 : 2;
    const p = PW.predict(M, d);
    $("tempVal").textContent = `${wi.t.toFixed(1)} °C`;
    $("wiPred").textContent = GW(p);
    const top = Math.max(record, p) * 1.04;
    $("wiBar").style.width = (p / top * 100).toFixed(1) + "%";
    const rec = $("wiRecord");
    rec.style.left = (record / top * 100).toFixed(1) + "%";
    rec.dataset.label = `2026 record ${GW(record)} GW (${fmt(M.record_2026.date, { day: "numeric", month: "short" })})`;
    const perC = M.coef[M.features.indexOf("heat_above_24C")] + (wi.t > 29 ? M.coef[M.features.indexOf("heat_above_29C")] + (d.off ? 0 : M.coef[M.features.indexOf("heat_above_29C_on_workday")]) : 0);
    $("wiNote").textContent = wi.t > 24
      ? `At this temperature, each extra degree adds about ${Math.round(perC)} MW${wi.t > 29 && !d.off ? " (heat costs more on workdays: offices, schools and factories all cool at once)" : ""}.`
      : "Below 24 °C, heat adds nothing; below a 17 °C daily mean, heaters add a little.";
    document.querySelectorAll("#dtype button").forEach((b) => { b.classList.toggle("on", b.dataset.t === wi.type); b.setAttribute("aria-checked", b.dataset.t === wi.type); });
  }
  $("temp").addEventListener("input", (e) => { wi.t = +e.target.value; renderWhatIf(); });
  document.querySelectorAll("#dtype button").forEach((b) => b.addEventListener("click", () => { wi.type = b.dataset.t; renderWhatIf(); }));

  // ---- limits text from the notebook's numbers
  const Y = M.yellow_2026, C = M.yellow_cause;
  $("limYellow").textContent = `2026 had ${Y.days} yellow days. A warning model caught ${Y.caught} of them only by warning on ${Y.warned} of ${Y.test_days} days, so ${Y.false_alarm_pct}% of its warnings were false alarms. On yellow days demand was ${Math.abs(C.demand_pct)}% below normal for the month, but supply was ${Math.abs(C.supply_pct)}% below: power plants were down, which the weather can't tell you.`;
  const g = M.growth;
  $("limGrowth").textContent = `At the same weather, 2026 peaks were ${GW(g["2026"])} GW higher than 2023 (${(g["2026"] / M.maanshan_mw).toFixed(1)} times one Maanshan nuclear unit), yet Taipower's total daily energy use barely changed from 2025 to 2026. More use at peak hours, or a change in how the peak is counted? Public data can't tell.`;

  // ---- navigation
  $("chips").innerHTML = CHIPS.map(([t, dt]) => `<button data-date="${dt}">${t}</button>`).join("");
  $("chips").addEventListener("click", (e) => { if (e.target.dataset.date) select(idxOf(e.target.dataset.date)); });
  $("prev").addEventListener("click", () => select(sel - 1));
  $("next").addEventListener("click", () => select(sel + 1));
  $("picker").min = all[0].date; $("picker").max = latest.date;
  $("picker").addEventListener("change", (e) => { const i = idxOf(e.target.value); if (i >= 0) select(i); });
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "ArrowLeft") select(sel - 1);
    if (e.key === "ArrowRight") select(sel + 1);
  });

  function select(i) {
    if (i < 0 || i >= all.length) return;
    sel = i;
    renderHero(); renderWhy(); renderChart();
  }
  select(sel);
  renderWhatIf();
})();

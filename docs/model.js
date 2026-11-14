// Power Weather Taiwan: the same ridge model as the notebook, in plain JavaScript.
// It works in the browser (window.PW) and in Node (module.exports) so we can check it against Python.
(function (root) {
  // Build the 17 inputs in the notebook's order from one day's record.
  // A record has: tmax_fc, tmean_fc, humidity_fc, sunshine_fc, rain_fc, dow (0 = Monday), off (1 = day off),
  // lny (Lunar New Year break), load_today, load_last_week, today_off, years.
  function features(d) {
    const t = d.tmax_fc;
    const workday = d.off ? 0 : 1;
    return {
      heat_above_24C: Math.max(t - 24, 0),
      heat_above_29C: Math.max(t - 29, 0),
      cold_below_17C: Math.max(17 - d.tmean_fc, 0),
      humidity: d.humidity_fc,
      sunshine: d.sunshine_fc,
      rain_log: Math.log1p(d.rain_fc),
      saturday_off: d.dow === 5 && d.off ? 1 : 0,
      sunday_off: d.dow === 6 && d.off ? 1 : 0,
      weekday_holiday: d.dow < 5 && d.off ? 1 : 0,
      makeup_workday: d.dow >= 5 && !d.off ? 1 : 0,
      lunar_new_year: d.lny ? 1 : 0,
      monday: d.dow === 0 && !d.off ? 1 : 0,
      load_today: d.load_today,
      load_same_day_last_week: d.load_last_week,
      today_was_off: d.today_off,
      years_since_2023: d.years,
      heat_above_29C_on_workday: Math.max(t - 29, 0) * workday,
    };
  }

  function predict(model, d) {
    const f = features(d);
    let y = model.intercept;
    model.features.forEach((name, i) => { y += model.coef[i] * f[name]; });
    return y;
  }

  // How far each group of inputs moves the forecast away from an average 2023-25 day.
  function contributions(model, d) {
    const f = features(d);
    const out = {};
    for (const [group, names] of Object.entries(model.groups)) {
      out[group] = names.reduce((s, n) => s + model.coef[model.features.indexOf(n)] * (f[n] - model.typical[n]), 0);
    }
    return out;
  }

  const api = { features, predict, contributions };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PW = api;
})(this);

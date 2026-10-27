/* PSD Forecast Calendar LAB v2.4 — read-only browser adapter.
   The private Kaggle file never leaves the user's browser.
   A future public GitHub feed is strictly sanitized and nonproduction. */
(() => {
  "use strict";
  const panel = document.getElementById("psd-kaggle-feed-panel");
  if (!panel) return;
  const input = document.getElementById("psd-kaggle-feed-file");
  const clear = document.getElementById("psd-kaggle-feed-clear");
  const status = document.getElementById("psd-kaggle-feed-status");
  const results = document.getElementById("psd-kaggle-feed-results");
  const counts = document.getElementById("psd-kaggle-feed-counts");
  const table = document.getElementById("psd-kaggle-feed-rows");
  const viewWeek = document.getElementById("psd-kaggle-view-week");
  const FEED_URL = "https://raw.githubusercontent.com/Ha-Lion/Market-Sentiment/main/psd-forecast-lab-feed.json";
  const MAX_BYTES = 3 * 1024 * 1024;
  let manualMode = false;
  let fingerprint = "";
  let activeWeek = null;
  let autoSequence = 0;

  function isoDay(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const t = new Date(value + "T00:00:00Z");
    return Number.isFinite(t.getTime()) && t.toISOString().slice(0, 10) === value ? t : null;
  }
  function validate(payload, publicFeed = false) {
    if (!payload || payload.schema !== "psd-calendar-lab-research/1" ||
        !/^V\d+\.\d+(?:\.\d+)?$/.test(String(payload.version)) ||
        payload.production !== false ||
        payload.certified_28_day_accuracy !== false ||
        (publicFeed && payload.lab_isolated !== true) ||
        typeof payload.forecast_week !== "object" || !payload.forecast_week ||
        !Array.isArray(payload.events) ||
        payload.events.length < 1 || payload.events.length > 1500) {
      throw new Error("Not a valid research-only PSD Calendar Lab feed.");
    }
    const mon = payload.forecast_week.monday, sun = payload.forecast_week.sunday;
    const d1 = isoDay(mon), d2 = isoDay(sun);
    if (!d1 || !d2 || d1.getUTCDay() !== 1 ||
        d2.getTime() - d1.getTime() !== 6 * 86400000) {
      throw new Error("Invalid Monday-to-Sunday forecast week.");
    }
    const seen = new Set();
    let forecasted = 0;
    const rows = payload.events.map(e => {
      if (!e || typeof e.event_id !== "string" ||
          !e.event_id.trim() || e.event_id.length > 130 || seen.has(e.event_id) ||
          !["US", "UK", "CA", "AU", "JP"].includes(e.country) ||
          typeof e.indicator !== "string" || !e.indicator.trim() ||
          e.indicator.length > 250 ||
          typeof e.release_at_utc !== "string" ||
          !/(?:Z|[+-]\d{2}:\d{2})$/i.test(e.release_at_utc) ||
          !Number.isFinite(Date.parse(e.release_at_utc)) ||
          !["RESEARCH_ONLY", "WITHHELD"].includes(e.status)) {
        throw new Error("Invalid or duplicate research event.");
      }
      seen.add(e.event_id);
      const utcDay = new Date(e.release_at_utc).toISOString().slice(0, 10);
      if (utcDay < mon || utcDay > sun) throw new Error("Release outside forecast week.");
      const f = e.psd_forecast;
      if (e.status === "RESEARCH_ONLY") {
        if (!f || f.status !== "EXPERIMENTAL" ||
            typeof f.value !== "number" || !Number.isFinite(f.value) ||
            typeof f.unit !== "string" || !f.unit.trim() || f.unit.length > 90 ||
            typeof f.method !== "string" || !f.method.trim() || f.method.length > 100) {
          throw new Error("Invalid experimental PSD forecast.");
        }
        forecasted++;
      } else if (f != null) {
        throw new Error("Withheld event unexpectedly contains a forecast.");
      }
      return e;
    });
    return {rows, forecasted, held:rows.length - forecasted,
      week:{monday:mon, sunday:sun}, version:payload.version};
  }
  function display(preview, source) {
    const serialized = JSON.stringify(preview.rows);
    if (fingerprint !== serialized) {
      fingerprint = serialized;
      window.dispatchEvent(new CustomEvent("psd-lab-forecast-updated", {detail:preview.rows}));
    }
    activeWeek = preview.week;
    if (viewWeek) viewWeek.disabled = false;
    // Keep only one data table visible: the actual calendar, not a duplicate.
    results.hidden = true;
    table.replaceChildren();
    counts.textContent = preview.forecasted + " experimental · " + preview.held +
      " withheld · " + preview.rows.length + " events";
    status.textContent = (source === "github" ? "GitHub research feed connected" :
      "Private Kaggle file opened locally") + " · " + preview.version +
      " · " + preview.week.monday + " to " + preview.week.sunday +
      " · NOT 28-day validated; event times unverified.";
    clear.disabled = false;
  }
  async function loadAuto() {
    if (manualMode) return;
    const serial = ++autoSequence;
    try {
      const response = await fetch(FEED_URL + "?ts=" + Date.now(),
        {cache:"no-store",credentials:"omit",redirect:"error"});
      if (manualMode || serial !== autoSequence) return;
      if (response.status === 404) {
        if (!fingerprint) status.textContent =
          "Automatic GitHub research feed not published. Select your private Kaggle JSON to preview.";
        return;
      }
      if (!response.ok) throw new Error("HTTP " + response.status);
      const body = await response.text();
      if (manualMode || serial !== autoSequence) return;
      if (body.length > MAX_BYTES) throw new Error("Research feed exceeds 3 MB.");
      display(validate(JSON.parse(body), true), "github");
    } catch (error) {
      if (!manualMode && serial === autoSequence && !fingerprint) {
        status.textContent = "Auto-feed unavailable (" + (error.message || "network error") +
          "). Private local import is still available.";
      }
    }
  }
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      if (file.size > MAX_BYTES || file.size < 50 || !/\.json$/i.test(file.name)) {
        throw new Error("Choose a PSD research .json file (maximum 3 MB).");
      }
      const preview = validate(JSON.parse(await file.text()));
      manualMode = true;
      ++autoSequence;
      display(preview, "local");
    } catch (error) {
      status.textContent = "Import rejected: " + (error.message || "invalid file");
    }
  });
  if (viewWeek) viewWeek.addEventListener("click", () => {
    if (!activeWeek) return;
    const from = document.getElementById("custom-from");
    const to = document.getElementById("custom-to");
    const go = document.getElementById("custom-go");
    if (!from || !to || !go) {
      status.textContent = "Calendar date controls unavailable.";
      return;
    }
    from.value = activeWeek.monday;
    to.value = activeWeek.sunday;
    const upcoming = document.getElementById("upcoming-only");
    if (upcoming && upcoming.checked) {
      upcoming.checked = false;
      upcoming.dispatchEvent(new Event("change", {bubbles:true}));
    }
    go.click(); // Use the calendar's existing date range navigation.
  });
  clear.addEventListener("click", () => {
    manualMode = false;
    ++autoSequence;
    input.value = "";
    table.replaceChildren();
    results.hidden = true;
    fingerprint = "";
    activeWeek = null;
    if (viewWeek) viewWeek.disabled = true;
    window.dispatchEvent(new CustomEvent("psd-lab-forecast-updated", {detail:[]}));
    status.textContent = "Local preview cleared. Checking the GitHub Lab feed…";
    clear.disabled = true;
    loadAuto();
  });
  loadAuto();
  setInterval(() => { if (!document.hidden && !manualMode) loadAuto(); }, 5 * 60 * 1000);
})();

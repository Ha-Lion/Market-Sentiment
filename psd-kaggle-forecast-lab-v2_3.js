/* PSD Calendar Lab: import private Kaggle JSON locally or auto-load a
   sanitized lab research feed synchronized by GitHub Actions.
   No client-side Kaggle credentials, Supabase, or production writes. */
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
  const URL_PATH = "https://raw.githubusercontent.com/Ha-Lion/Market-Sentiment/main/psd-forecast-lab-feed.json";
  const maxBytes = 3 * 1024 * 1024;
  let manualMode = false;
  let fingerprint = "";

  function validate(payload) {
    if (!payload || payload.schema !== "psd-calendar-lab-research/1" ||
        !/^V[0-9]+\.[0-9]+(?:\.[0-9]+)?$/.test(String(payload.version)) ||
        payload.production !== false ||
        payload.certified_28_day_accuracy !== false ||
        !payload.forecast_week ||
        !/^\d{4}-\d{2}-\d{2}$/.test(payload.forecast_week.monday || "") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(payload.forecast_week.sunday || "") ||
        !Array.isArray(payload.events) ||
        payload.events.length < 1 || payload.events.length > 1500) {
      throw new Error("Invalid research-only PSD Calendar Lab feed.");
    }
    const unique = new Set();
    let forecasted = 0;
    const rows = payload.events.map(event => {
      if (!event || typeof event.event_id !== "string" ||
          !event.event_id || unique.has(event.event_id) ||
          !["US", "UK", "CA", "AU", "JP"].includes(event.country) ||
          typeof event.indicator !== "string" || !event.indicator.trim() ||
          event.indicator.length > 250 ||
          typeof event.release_at_utc !== "string" ||
          !Number.isFinite(Date.parse(event.release_at_utc)) ||
          !["RESEARCH_ONLY", "WITHHELD"].includes(event.status)) {
        throw new Error("Invalid or duplicate research event.");
      }
      unique.add(event.event_id);
      const f = event.psd_forecast;
      if (event.status === "RESEARCH_ONLY") {
        if (!f || f.status !== "EXPERIMENTAL" ||
            typeof f.value !== "number" || !Number.isFinite(f.value) ||
            typeof f.unit !== "string" || !f.unit.trim() || f.unit.length > 90 ||
            typeof f.method !== "string" || !f.method.trim() || f.method.length > 100) {
          throw new Error("Invalid experimental research forecast.");
        }
        forecasted++;
      } else if (f !== null) {
        throw new Error("Withheld research event unexpectedly has a forecast.");
      }
      const iso = new Date(event.release_at_utc).toISOString().slice(0, 10);
      if (iso < payload.forecast_week.monday || iso > payload.forecast_week.sunday) {
        throw new Error("Release timestamp outside the declared forecast week.");
      }
      return event;
    });
    return {rows, forecasted, held: rows.length - forecasted,
      week: payload.forecast_week, version: payload.version};
  }

  function cell(tr, value) {
    const td = document.createElement("td");
    td.textContent = String(value);
    td.style.padding = "6px 9px";
    td.style.borderBottom = "1px solid var(--ec-border, #d6dde6)";
    td.style.verticalAlign = "top";
    tr.appendChild(td);
  }

  function display(preview, source) {
    const updated = JSON.stringify(preview.rows);
    if (fingerprint !== updated) {
      fingerprint = updated;
      window.dispatchEvent(new CustomEvent("psd-lab-forecast-updated", {detail: preview.rows}));
    }
    table.replaceChildren();
    for (const event of preview.rows) {
      const tr = document.createElement("tr");
      const f = event.psd_forecast;
      cell(tr, event.country);
      cell(tr, event.release_at_utc.slice(0, 16).replace("T", " ") + " UTC");
      cell(tr, event.indicator);
      cell(tr, f ? f.value.toLocaleString("en-US", {
        minimumFractionDigits:3,maximumFractionDigits:3}) : "—");
      cell(tr, f ? f.unit : "—");
      cell(tr, f ? f.method : "—");
      cell(tr, event.status === "RESEARCH_ONLY" ? "EXPERIMENTAL · NOT VALIDATED" : "WITHHELD");
      table.appendChild(tr);
    }
    counts.textContent = preview.forecasted + " research forecasts · " +
      preview.held + " withheld · " + preview.rows.length + " events · " +
      preview.week.monday + " to " + preview.week.sunday;
    status.textContent = (source === "github" ? "GitHub Lab research feed connected" :
      "Private Kaggle file loaded locally") + " · " + preview.version +
      " · select Nov 16–22 or the feed's forecast week to see calendar rows. Dates unverified.";
    results.hidden = true; // The actual calendar is the single display; no duplicate table.
    clear.disabled = false;
  }

  async function loadAuto() {
    if (manualMode) return;
    try {
      const response = await fetch(URL_PATH + "?ts=" + Date.now(), {
        cache:"no-store", credentials:"omit", redirect:"error"
      });
      if (response.status === 404) {
        if (!fingerprint) status.textContent =
          "Awaiting GitHub/Kaggle sync · select private Kaggle JSON below to preview now.";
        return;
      }
      if (!response.ok) throw new Error("HTTP " + response.status);
      const text = await response.text();
      if (text.length > maxBytes) throw new Error("Forecast Lab feed is too large");
      display(validate(JSON.parse(text)), "github");
    } catch (error) {
      if (!fingerprint) status.textContent =
        "Auto-sync pending (" + (error.message || "unavailable") +
        "). Select your saved Kaggle JSON to preview locally.";
    }
  }

  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      if (file.size > maxBytes || file.size < 50 ||
          !file.name.toLowerCase().endsWith(".json")) {
        throw new Error("Choose the saved PSD forecast JSON (maximum 3 MB).");
      }
      const preview = validate(JSON.parse(await file.text()));
      manualMode = true;
      display(preview, "local");
    } catch (error) {
      status.textContent = "Import blocked: " +
        (error && error.message ? error.message : "Invalid file");
    }
  });

  clear.addEventListener("click", () => {
    manualMode = false;
    input.value = "";
    table.replaceChildren();
    results.hidden = true;
    fingerprint = "";
    window.dispatchEvent(new CustomEvent("psd-lab-forecast-updated", {detail: []}));
    status.textContent = "Preview cleared. Checking the GitHub Lab feed…";
    clear.disabled = true;
    loadAuto();
  });

  loadAuto();
  setInterval(() => { if (!document.hidden) loadAuto(); }, 5 * 60 * 1000);
})();
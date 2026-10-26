/* PSD Calendar Lab / Kaggle V2.3 - private browser-only research preview.
   No network fetch, no persistence, no Supabase or production writes.
   The private Kaggle feed is read from a file selected by the operator. */
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
  const maxBytes = 1024 * 1024;

  function validate(payload) {
    if (!payload || payload.schema !== "psd-calendar-lab-research/1" ||
        payload.version !== "V2.3" || payload.production !== false ||
        payload.certified_28_day_accuracy !== false) {
      throw new Error("This is not an approved V2.3 research-only forecast feed.");
    }
    if (!payload.forecast_week ||
        !/^\d{4}-\d{2}-\d{2}$/.test(payload.forecast_week.monday || "") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(payload.forecast_week.sunday || "") ||
        !Array.isArray(payload.events) || payload.events.length !== 24) {
      throw new Error("Expected one forecast week and exactly 24 events.");
    }
    const unique = new Set();
    let forecasted = 0;
    const rows = payload.events.map((event) => {
      if (!event || typeof event.event_id !== "string" ||
          !event.event_id || unique.has(event.event_id) ||
          !["US", "UK", "CA", "AU", "JP"].includes(event.country) ||
          typeof event.indicator !== "string" || !event.indicator.trim() ||
          event.indicator.length > 250 ||
          typeof event.release_at_utc !== "string" ||
          !Number.isFinite(Date.parse(event.release_at_utc)) ||
          !["RESEARCH_ONLY", "WITHHELD"].includes(event.status)) {
        throw new Error("The feed contains an invalid or duplicate event.");
      }
      unique.add(event.event_id);
      const f = event.psd_forecast;
      if (event.status === "RESEARCH_ONLY") {
        if (!f || f.status !== "EXPERIMENTAL" ||
            typeof f.value !== "number" || !Number.isFinite(f.value) ||
            typeof f.unit !== "string" || !f.unit.trim() || f.unit.length > 90 ||
            typeof f.method !== "string" || !f.method.trim() ||
            f.method.length > 100) {
          throw new Error("The feed contains an invalid experimental forecast.");
        }
        forecasted++;
      } else if (f !== null) {
        throw new Error("Withheld events must not contain a forecast value.");
      }
      if (event.release_at_utc.slice(0, 10) < payload.forecast_week.monday ||
          event.release_at_utc.slice(0, 10) > payload.forecast_week.sunday) {
        throw new Error("An event falls outside the forecast week.");
      }
      return event;
    });
    return { rows, forecasted, held: rows.length - forecasted, week: payload.forecast_week };
  }

  function cell(tr, value) {
    const td = document.createElement("td");
    td.textContent = String(value);
    td.style.padding = "6px 9px";
    td.style.borderBottom = "1px solid var(--ec-border, #d6dde6)";
    td.style.verticalAlign = "top";
    tr.appendChild(td);
  }

  function display(preview) {
    table.replaceChildren();
    for (const event of preview.rows) {
      const tr = document.createElement("tr");
      const f = event.psd_forecast;
      cell(tr, event.country);
      cell(tr, event.release_at_utc.slice(0, 16).replace("T", " ") + " UTC");
      cell(tr, event.indicator);
      cell(tr, f ? f.value.toLocaleString("en-US", {minimumFractionDigits: 3, maximumFractionDigits: 3}) : "—");
      cell(tr, f ? f.unit : "—");
      cell(tr, f ? f.method : "—");
      cell(tr, event.status === "RESEARCH_ONLY" ? "EXPERIMENTAL · NOT VALIDATED" : "WITHHELD");
      table.appendChild(tr);
    }
    counts.textContent = preview.forecasted + " experimental forecasts · " +
      preview.held + " withheld · 24 target events · " +
      preview.week.monday + " to " + preview.week.sunday;
    status.textContent = "Private Kaggle V2.3 feed loaded in this browser only. No upload or publication.";
    results.hidden = false;
    clear.disabled = false;
  }

  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    results.hidden = true;
    clear.disabled = false;
    status.textContent = "Reading selected research JSON locally…";
    try {
      if (file.size > maxBytes || file.size < 50 || !file.name.toLowerCase().endsWith(".json")) {
        throw new Error("Select the V2.3 JSON file (maximum 1 MB).");
      }
      display(validate(JSON.parse(await file.text())));
    } catch (error) {
      table.replaceChildren();
      status.textContent = "Import blocked: " + (error && error.message ? error.message : "Invalid file");
    }
  });

  clear.addEventListener("click", () => {
    input.value = "";
    table.replaceChildren();
    results.hidden = true;
    clear.disabled = true;
    status.textContent = "No Kaggle feed loaded. Existing Beeks Lab data is unaffected.";
  });
})();
/* PSD Calendar Lab: import private Kaggle JSON locally or auto-load a
   sanitized Lab research batches held in Supabase.
   No client-side Kaggle credentials, Supabase, or production writes. */
(() => {
  "use strict";
  const panel = document.getElementById("psd-kaggle-feed-panel");
  if (!panel) return;
  const input = document.getElementById("psd-kaggle-feed-file");
  const clear = document.getElementById("psd-kaggle-feed-clear");
  const viewWeek = document.getElementById("psd-kaggle-view-week");
  const status = document.getElementById("psd-kaggle-feed-status");
  const results = document.getElementById("psd-kaggle-feed-results");
  const counts = document.getElementById("psd-kaggle-feed-counts");
  const table = document.getElementById("psd-kaggle-feed-rows");
  const API_BASE = "https://fupexuonvzakoguucglk.supabase.co";
  const PUBLIC_KEY = "sb_publishable_70UGBdI_7955Ej6tK01awQ_DljLC6sv";
  const maxBytes = 3 * 1024 * 1024;
  let manualMode = false;
  let fingerprint = "";
  let activeWeek = null;

  function validate(payload) {
    if (!payload || payload.schema !== "psd-calendar-lab-research/1" ||
        (typeof payload.version !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(payload.version)) ||
        payload.production !== false ||
        payload.certified_28_day_accuracy !== false ||
        !payload.forecast_week ||
        !/^\d{4}-\d{2}-\d{2}$/.test(payload.forecast_week.monday || "") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(payload.forecast_week.sunday || "") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(payload.forecast_week.monday) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(payload.forecast_week.sunday) ||
        !Array.isArray(payload.events) ||
        payload.events.length < 1 || payload.events.length > 1500) {
      throw new Error("Invalid research-only PSD Calendar Lab feed.");
    }
    const mondayUtc=new Date(payload.forecast_week.monday+"T00:00:00Z");
    const sundayUtc=new Date(payload.forecast_week.sunday+"T00:00:00Z");
    if (!Number.isFinite(mondayUtc.getTime()) ||
        mondayUtc.toISOString().slice(0,10)!==payload.forecast_week.monday ||
        mondayUtc.getUTCDay()!==1 ||
        sundayUtc.getTime()-mondayUtc.getTime()!==6*86400000) {
      throw new Error("Forecast week must be a valid Monday through Sunday.");
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
          !/(?:Z|[+-]\d{2}:\d{2})$/i.test(event.release_at_utc) ||
          !Number.isFinite(Date.parse(event.release_at_utc)) ||
          !["RESEARCH_ONLY", "WITHHELD"].includes(event.status)) {
        throw new Error("Invalid or duplicate research event.");
      }
      unique.add(event.event_id);
      // New batches must retain UUIDs from Supabase econ_events.id, never generated locally.
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.event_id)) {
        throw new Error("Forecast is missing its original Supabase event UUID.");
      }
      // V2.3 historical research batches predate canonical metadata.
      // New batches must identify the exact series AND reference period.
      // Never quietly attach a new research prediction to an ambiguous release.
      if (payload.version !== "V2.3" &&
          (typeof event.indicator_id !== "string" ||
           !/^[a-z]{2}_[a-z0-9_]+$/i.test(event.indicator_id) ||
           typeof event.period !== "string" ||
           !event.period.trim() || event.period.length > 80)) {
        throw new Error("Forecast release is missing canonical series or reference period.");
      }
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
    activeWeek = preview.week;
    if (viewWeek) viewWeek.disabled = false;
    counts.textContent = preview.forecasted + " research forecasts · " +
      preview.held + " withheld · " + preview.rows.length + " events · " +
      preview.week.monday + " to " + preview.week.sunday;
    status.textContent = (source === "supabase" ? "Supabase Lab forecast feed connected" :
      "Private Kaggle file loaded locally") + " · " + preview.version +
      " · " + preview.week.monday + " to " + preview.week.sunday +
      " · NOT validated 28 days ahead · Release dates unverified.";
    results.hidden = true; // The actual calendar is the single display; no duplicate table.
    clear.disabled = false;
  }

  // V3: use one current research value per canonical event; no batch/version selection.
  // Never alter production calendar data; the existing event-UUID reconcile handles display.
  let autoSeq=0;
  async function loadAuto(){
    if(manualMode)return;
    const seq=++autoSeq;
    try{
      const url=API_BASE+"/rest/v1/psd_calendar_lab_forecast_current?select=event_id,indicator_id,source_id,country,period,release_at_utc,status,forecast_value,forecast_unit,forecast_model,withheld_reason,research_only&order=release_at_utc.desc&limit=1500";
      const response=await fetch(url,{cache:"no-store",credentials:"omit",headers:{"apikey":PUBLIC_KEY,"accept":"application/json"}});
      if(seq!==autoSeq||manualMode)return;
      if(!response.ok)throw Error("Supabase Lab HTTP "+response.status);
      const rows=await response.json();
      if(seq!==autoSeq||manualMode)return;
      if(!Array.isArray(rows))throw Error("Invalid current forecast rows");
      if(rows.length===0){
        fingerprint="";
        activeWeek=null;
        if(viewWeek)viewWeek.disabled=true;
        window.dispatchEvent(new CustomEvent("psd-lab-forecast-updated",{detail:[]}));
        status.textContent="Supabase Lab current forecasts connected · waiting for Kaggle's first verified push.";
        return;
      }
      // Keep one forecast per event UUID; read all visible weeks without choosing a batch.
      const events=rows.filter(r=>r.research_only===true).map(r=>({
        event_id:r.event_id,indicator_id:r.indicator_id,source_id:r.source_id,
        country:r.country,period:r.period,indicator:r.indicator_id,
        release_at_utc:r.release_at_utc,status:r.status,
        psd_forecast:r.status==="RESEARCH_ONLY"?{
          status:"EXPERIMENTAL",value:r.forecast_value,unit:r.forecast_unit,method:r.forecast_model
        }:null,review_reason:r.withheld_reason
      }));
      const sorted=events.map(e=>new Date(e.release_at_utc).getTime()).filter(Number.isFinite);
      if(!sorted.length)throw Error("Invalid release dates");
      const latest=new Date(Math.max(...sorted));
      const day=latest.getUTCDay(),monday=new Date(Date.UTC(latest.getUTCFullYear(),latest.getUTCMonth(),latest.getUTCDate()-(day+6)%7));
      const sunday=new Date(monday.getTime()+6*86400000);
      const payload={schema:"psd-calendar-lab-research/1",version:"CURRENT",production:false,certified_28_day_accuracy:false,forecast_week:{monday:monday.toISOString().slice(0,10),sunday:sunday.toISOString().slice(0,10)},events};
      // validate() expects a single week. Current table may span many weeks:
      // validate per week and display all rows through existing UUID matching.
      const validated=new Map();
      for(const e of events){
        const d=new Date(e.release_at_utc),w=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-(d.getUTCDay()+6)%7));
        const k=w.toISOString().slice(0,10);
        if(!validated.has(k))validated.set(k,[]);
        validated.get(k).push(e);
      }
      let all=[];
      for(const [m,group] of validated){
        const endDate=new Date(Date.parse(m+"T00:00:00Z")+6*86400000).toISOString().slice(0,10);
        const validatedWeek=validate({...payload,forecast_week:{monday:m,sunday:endDate},events:group});
        all.push(...validatedWeek.rows);
      }
      const summary={rows:all,forecasted:all.filter(e=>e.status==="RESEARCH_ONLY").length,
        held:all.filter(e=>e.status==="WITHHELD").length,week:payload.forecast_week,version:"CURRENT"};
      display(summary,"supabase");
    }catch(error){
      if(seq===autoSeq&&!manualMode)status.textContent="Supabase Lab current forecasts unavailable ("+String(error?.message||"error").slice(0,90)+").";
    }
  }

  if (viewWeek) viewWeek.addEventListener("click", () => {
    if (!activeWeek) return;
    const from=document.getElementById("custom-from");
    const to=document.getElementById("custom-to");
    const go=document.getElementById("custom-go");
    if (!from || !to || !go) return;
    // LAB-only navigation: do not rely on the production member-gated Go control.
    // A dedicated Lab listener changes the local view without any database write.
    window.dispatchEvent(new CustomEvent("psd-lab-forecast-select-week",
      {detail:{monday:activeWeek.monday,sunday:activeWeek.sunday}}));
    document.querySelector(".ec-table-wrap")?.scrollIntoView({behavior:"smooth",block:"start"});
  });

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
      ++autoSeq; // Prevent a slower in-flight HTTP response from overwriting local file.
      display(preview, "local");
    } catch (error) {
      status.textContent = "Import blocked: " +
        (error && error.message ? error.message : "Invalid file");
    }
  });

  clear.addEventListener("click", () => {
    manualMode = false;
    ++autoSeq;
    input.value = "";
    table.replaceChildren();
    results.hidden = true;
    fingerprint = "";
    activeWeek = null;
    if (viewWeek) viewWeek.disabled = true;
    window.dispatchEvent(new CustomEvent("psd-lab-forecast-updated", {detail: []}));
    status.textContent = "Preview cleared. Checking the Supabase Lab feed…";
    clear.disabled = true;
    loadAuto();
  });

  loadAuto();
  // Research batches update weekly; avoid 288 unnecessary reads per day per tab.
  setInterval(() => { if (!document.hidden && !manualMode) loadAuto(); }, 60 * 60 * 1000);
})();
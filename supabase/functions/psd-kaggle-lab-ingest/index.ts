// PSD Calendar Lab V2.5 — append-only ingestion from one GitHub Actions workflow.
// This is NOT a public data-writing endpoint. A short-lived GitHub OIDC JWT
// must verify against GitHub's signed JWKS and match the exact authorized workflow.
// Does not change source indicators, history tables, Beeks, or production calendar.
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "psd-economic-calendar-lab-ingest-v1";
const REPO = "Ha-Lion/Market-Sentiment";
const WORKFLOW = REPO + "/.github/workflows/psd-kaggle-forecast-weekly.yml@refs/heads/main";
const JWKS = createRemoteJWKSet(new URL(ISSUER + "/.well-known/jwks"));
const MAX_BYTES = 250_000;
const COUNTRIES = new Set(["US", "UK", "AU", "CA", "JP"]);
const DAY = 86400000;

function response(status: number, info: Record<string, unknown>): Response {
  return Response.json(info, { status, headers: { "cache-control": "no-store" } });
}
function calendarDay(s: unknown): number {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("invalid date");
  const ms = Date.parse(s + "T00:00:00Z");
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== s) throw new Error("invalid date");
  return ms;
}
function validFeed(raw: unknown) {
  if (!raw || typeof raw !== "object") throw new Error("feed missing");
  const p = raw as Record<string, unknown>;
  if (p.schema !== "psd-calendar-lab-research/1" ||
      !/^V\d+\.\d+(?:\.\d+)?$/.test(String(p.version)) ||
      p.production !== false || p.certified_28_day_accuracy !== false ||
      p.lab_isolated !== true || !p.forecast_week ||
      !Array.isArray(p.events) || p.events.length < 1 || p.events.length > 1500)
    throw new Error("invalid research-only schema");
  const week = p.forecast_week as Record<string, unknown>;
  const mon = calendarDay(week.monday), sun = calendarDay(week.sunday);
  if (new Date(mon).getUTCDay() !== 1 || sun - mon !== 6 * DAY)
    throw new Error("invalid forecast week");
  // Strict future-only guard. Research data is never backfilled over production.
  const now = Date.now();
  if (mon < now + 6 * DAY || mon > now + 90 * DAY)
    throw new Error("research week outside future publication window");
  const used = new Set<string>();
  const events = (p.events as unknown[]).map((item) => {
    if (!item || typeof item !== "object") throw new Error("bad event");
    const e = item as Record<string, unknown>;
    if (typeof e.event_id !== "string" || !e.event_id.trim() ||
        e.event_id.length > 130 || used.has(e.event_id) ||
        !COUNTRIES.has(String(e.country)) || typeof e.indicator !== "string" ||
        !e.indicator.trim() || e.indicator.length > 250 ||
        typeof e.release_at_utc !== "string" ||
        !/(?:Z|[+-]\d{2}:\d{2})$/i.test(e.release_at_utc) ||
        !["RESEARCH_ONLY", "WITHHELD"].includes(String(e.status)))
      throw new Error("bad event identity/status");
    used.add(e.event_id);
    const release = Date.parse(e.release_at_utc);
    if (!Number.isFinite(release) || release < mon || release >= mon + 7 * DAY)
      throw new Error("event outside UTC research week");
    let forecast: Record<string, unknown> | null = null;
    if (e.status === "RESEARCH_ONLY") {
      const f = e.psd_forecast as Record<string, unknown> | null;
      if (!f || typeof f !== "object" || f.status !== "EXPERIMENTAL" ||
          typeof f.value !== "number" || !Number.isFinite(f.value) ||
          typeof f.unit !== "string" || !f.unit.trim() || f.unit.length > 90 ||
          typeof f.method !== "string" || !f.method.trim() || f.method.length > 100)
        throw new Error("unverified experimental number");
      forecast = { status:"EXPERIMENTAL", value:f.value, unit:f.unit, method:f.method };
    } else if (e.psd_forecast !== null) {
      throw new Error("withheld forecast cannot contain a number");
    }
    return {
      event_id:e.event_id, country:e.country, indicator:e.indicator.trim(),
      release_at_utc:new Date(release).toISOString(),
      status:e.status, psd_forecast:forecast,
      review_reason:e.status==="WITHHELD" ? String(e.review_reason || "").slice(0,120) : ""
    };
  }).sort((a,b)=>String(a.event_id).localeCompare(String(b.event_id)));
  return {
    week_start:week.monday as string, week_end:week.sunday as string,
    feed_version:p.version as string, event_count:events.length,
    forecast_count:events.filter(e=>e.psd_forecast!==null).length,
    withheld_count:events.filter(e=>e.psd_forecast===null).length, events
  };
}
async function hexDigest(s: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2,"0")).join("");
}
async function verifyGithub(req: Request): Promise<boolean> {
  const match = /^Bearer\s+([A-Za-z0-9._-]+)$/.exec(req.headers.get("authorization") || "");
  if (!match) return false;
  const { payload } = await jwtVerify(match[1], JWKS, {
    issuer:ISSUER, audience:AUDIENCE, algorithms:["RS256"]
  });
  return payload.repository === REPO &&
    payload.ref === "refs/heads/main" &&
    payload.workflow_ref === WORKFLOW &&
    ["schedule", "workflow_dispatch"].includes(String(payload.event_name)) &&
    payload.runner_environment === "github-hosted";
}
async function databaseRequest(base: string, key: string, query: string, init?: RequestInit) {
  const res = await fetch(base + "/rest/v1/psd_calendar_lab_forecast_batches" + query, {
    ...init,
    headers: {
      "apikey":key, "authorization":"Bearer " + key,
      "accept":"application/json", ...(init?.headers || {})
    }
  });
  return res;
}
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response(405,{error:"POST required"});
  // Do not use Supabase's API-key authorization for this public URL:
  // cryptographically validate the GitHub workflow ID token instead.
  try { if (!(await verifyGithub(req))) return response(401,{error:"unauthorized"}); }
  catch { return response(401,{error:"unauthorized"}); }
  if (Number(req.headers.get("content-length") || 0) > MAX_BYTES)
    return response(413,{error:"research feed too large"});
  let feed;
  try {
    const body = await req.text();
    if (body.length > MAX_BYTES) return response(413,{error:"research feed too large"});
    feed = validFeed(JSON.parse(body));
  } catch { return response(400,{error:"invalid isolated research feed"}); }

  const base = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !secret) return response(503,{error:"ingestion backend unavailable"});

  const batch_hash = await hexDigest(JSON.stringify({
    version:feed.feed_version, week:feed.week_start, events:feed.events
  }));
  const query = "?select=batch_hash&batch_hash=eq." + batch_hash + "&limit=1";
  try {
    const existing=await databaseRequest(base,secret,query);
    if (!existing.ok) return response(502,{error:"Lab read failed"});
    const rows=await existing.json();
    if (Array.isArray(rows) && rows.length)
      return response(200,{ok:true,duplicate:true,batch_hash,
        event_count:feed.event_count,forecast_count:feed.forecast_count,withheld_count:feed.withheld_count});
    const record={...feed,batch_hash,research_only:true};
    const published=await databaseRequest(base,secret,"",{
      method:"POST",
      headers:{"content-type":"application/json","prefer":"return=minimal"},
      body:JSON.stringify(record)
    });
    if (published.status===409) {
      const check=await databaseRequest(base,secret,query);
      if(check.ok && (await check.json()).length)
        return response(200,{ok:true,duplicate:true,batch_hash});
    }
    if (!published.ok) return response(502,{error:"Lab insert rejected"});
    return response(201,{ok:true,duplicate:false,batch_hash,
      event_count:feed.event_count,forecast_count:feed.forecast_count,withheld_count:feed.withheld_count});
  } catch {
    return response(502,{error:"Lab backend unavailable"});
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const sql=postgres(Deno.env.get("SUPABASE_DB_URL"),{prepare:false,max:1});
const ORIGINS=new Set(["https://publicsentimentdash.com","https://www.publicsentimentdash.com"]);
const cache=new Map();

function cors(origin){
  const ok=origin&&(ORIGINS.has(origin)||origin.startsWith("http://localhost:")||origin.startsWith("http://127.0.0.1:"));
  return {"access-control-allow-origin":ok?origin:"https://publicsentimentdash.com","access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"content-type, authorization, apikey","vary":"origin"};
}
function respond(data,status=200,origin=null){
  return new Response(JSON.stringify(data),{status,headers:{...cors(origin),"content-type":"application/json; charset=utf-8","cache-control":"public,max-age=60"}});
}
function validDate(v){return typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v);}
function span(a,b){return Math.round((Date.parse(b+"T00:00:00Z")-Date.parse(a+"T00:00:00Z"))/86400000);}
function addUtcDays(ymd,n){const d=new Date(ymd+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function impactNumber(v){const s=String(v??"").toLowerCase();if(s==="high"||s==="3")return 3;if(s==="medium"||s==="med"||s==="2")return 2;return 1;}
function normalizeText(v){return String(v??"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function dedupeKey(e){const d=new Date(e.date);const stamp=Number.isNaN(d.getTime())?String(e.date||""):d.toISOString().slice(0,16);return [stamp,e.country_code||"",normalizeText(e.event),normalizeText(e.jurisdiction||"")].join("|");}
const COUNTRY_NAME_CODE={
  "united states":"US","united states of america":"US","usa":"US","u.s.":"US","us":"US",
  "euro area":"EU","eurozone":"EU","european union":"EU","eu":"EU",
  "united kingdom":"GB","great britain":"GB","uk":"GB","gb":"GB",
  "japan":"JP","canada":"CA","china":"CN","australia":"AU","new zealand":"NZ",
  "switzerland":"CH","germany":"DE","france":"FR","italy":"IT","spain":"ES",
  "india":"IN","brazil":"BR","mexico":"MX","south korea":"KR","korea":"KR",
  "singapore":"SG","norway":"NO","sweden":"SE","hong kong":"HK","taiwan":"TW",
  "russia":"RU","turkey":"TR","south africa":"ZA","indonesia":"ID","malaysia":"MY",
  "thailand":"TH","philippines":"PH","vietnam":"VN","israel":"IL","saudi arabia":"SA",
  "united arab emirates":"AE","poland":"PL","czech republic":"CZ","czechia":"CZ",
  "hungary":"HU","romania":"RO","denmark":"DK","finland":"FI","belgium":"BE",
  "netherlands":"NL","portugal":"PT","greece":"GR","ireland":"IE","austria":"AT"
};
const CURRENCY_COUNTRY={
  USD:["US","United States"],EUR:["EU","Euro Area"],GBP:["GB","United Kingdom"],JPY:["JP","Japan"],
  CAD:["CA","Canada"],CNY:["CN","China"],RMB:["CN","China"],AUD:["AU","Australia"],NZD:["NZ","New Zealand"],
  CHF:["CH","Switzerland"],INR:["IN","India"],BRL:["BR","Brazil"],MXN:["MX","Mexico"],
  KRW:["KR","South Korea"],SGD:["SG","Singapore"],NOK:["NO","Norway"],SEK:["SE","Sweden"],
  HKD:["HK","Hong Kong"],TWD:["TW","Taiwan"],ZAR:["ZA","South Africa"],TRY:["TR","Türkiye"]
};
function cleanCountryCode(v){
  let code=String(v??"").toUpperCase().trim();
  if(code==="UK")code="GB"; if(code==="EA"||code==="EMU")code="EU";
  return /^[A-Z]{2}$/.test(code)?code:"";
}
function inferFinanceCountry(row){
  const rawCountry=String(row.country_name??row.countryName??row.country??"").trim();
  const directCode=cleanCountryCode(rawCountry);
  if(directCode)return {code:directCode,name:rawCountry};
  const nameCode=COUNTRY_NAME_CODE[rawCountry.toLowerCase()];
  if(nameCode)return {code:nameCode,name:rawCountry};

  const currency=String(row.currency??"").toUpperCase().trim();
  if(CURRENCY_COUNTRY[currency]){
    const [code,name]=CURRENCY_COUNTRY[currency];
    return {code,name};
  }

  const s=[rawCountry,row.name,row.title,row.series,row.category,row.description,row.slug,row.url].filter(Boolean).join(" ");
  const rules=[
    [/(?:financecalendar\.com\/event\/us-|\b(fomc|federal reserve|fed|united states|u\.s\.|us gdp|pce inflation|jobless claims|initial claims|continuing claims|nonfarm payroll|non-farm payroll|nfp|us jobs report|ism manufacturing|ism services|conference board consumer confidence|consumer confidence|new home sales|michigan sentiment)\b)/i,"US","United States"],
    [/\b(ecb|eurozone|euro area|european central bank)\b/i,"EU","Euro Area"],
    [/\b(boe|bank of england|united kingdom|uk)\b/i,"GB","United Kingdom"],
    [/(?:financecalendar\.com\/event\/(?:japan-|tse-|jpx-)|\b(boj|bank of japan|japan|tse\/jpx|jpx)\b)/i,"JP","Japan"],
    [/\b(boc|bank of canada|canada)\b/i,"CA","Canada"],
    [/\b(pboc|china)\b/i,"CN","China"],
    [/\b(rba|australia)\b/i,"AU","Australia"],
    [/\b(rbnz|new zealand)\b/i,"NZ","New Zealand"],
    [/\b(snb|switzerland)\b/i,"CH","Switzerland"],
    [/\b(germany|bundesbank|ifo)\b/i,"DE","Germany"],
    [/\b(riksbank|sweden)\b/i,"SE","Sweden"],
    [/\b(norges bank|norway)\b/i,"NO","Norway"],
    [/\b(hkex|hong kong)\b/i,"HK","Hong Kong"],
    [/\b(nse india|india)\b/i,"IN","India"],
    [/\b(france)\b/i,"FR","France"],[/\b(italy)\b/i,"IT","Italy"],[/\b(spain)\b/i,"ES","Spain"]
  ];
  for(const [re,code,name] of rules)if(re.test(s))return {code,name};
  return {code:"",name:rawCountry};
}
function normalizeFinance(row){
  const inferred=inferFinanceCountry(row);
  let code=cleanCountryCode(row.country_code??row.countryCode??"");
  if(!code)code=inferred.code;
  const rawCountry=String(row.country_name??row.countryName??row.country??"").trim();
  const name=rawCountry||inferred.name||code;
  return {
    id:"fc:"+String(row.id??row.slug??row.url??((row.time_utc||row.datetime||row.date||"")+"-"+(row.name||row.title||"event"))),
    series_id:"fc:"+String(row.series??row.slug??row.id??("auto:"+code+":"+String(row.name??row.title??"Economic event").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""))),
    date:row.time_utc??row.datetime??row.date??null,country:name,country_code:code,category:row.category??"",
    event:row.name??row.title??row.series??"Economic event",reference:row.reference??row.period??"",
    source:"FinanceCalendar",source_url:row.url??"https://www.financecalendar.com/",actual:row.actual??"",
    previous:row.prior??row.previous??"",forecast:row.consensus??row.forecast??"",te_forecast:"",
    revised:row.revised??row.revised_previous??"",importance:impactNumber(row.impact),last_update:row.updated_at??row.updated??"",
    currency:row.currency??"",unit:row.unit??"",ticker:"",symbol:"",multiplier:"",time_mode:row.all_day?"all_day":"exact"
  };
}
function eventDateKey(e){const d=new Date(e?.date||"");return Number.isNaN(d.getTime())?"":d.toISOString().slice(0,10);}
async function readPrioritySnapshot(start,end,requested){
  try{
    const rows=await sql.unsafe("select start_date,end_date,countries,fetched_at,source,provider_error,events from public.economic_calendar_snapshots where snapshot_key=$1 limit 1",["priority_21d"]);
    const row=rows[0]; if(!row)return null;
    const age=Date.now()-new Date(row.fetched_at).getTime(); if(age>10*60*1000)return null;
    if(String(row.start_date)>start||String(row.end_date)<end)return null;
    const allowed=new Set(Array.isArray(row.countries)?row.countries.map(String):[]);
    if(requested.length&&requested.some(c=>!allowed.has(c)))return null;
    let stored=row.events; if(typeof stored==="string"){try{stored=JSON.parse(stored);}catch{stored=[];}}
    const wanted=new Set(requested);
    const events=(Array.isArray(stored)?stored:[]).filter(e=>{const d=eventDateKey(e);if(!d||d<start||d>end)return false;return !requested.length||wanted.has(String(e.country_code||"").toUpperCase());});
    return {start,end,countries:requested,source:"FinanceCalendar snapshot",mode:"snapshot",fetched_at:new Date(row.fetched_at).toISOString(),provider_error:row.provider_error||null,events};
  }catch(err){console.warn("Snapshot read failed",err);return null;}
}
async function fetchFinanceChunk(start,end,errors,diag){
  try{
    const url="https://www.financecalendar.com/wp-json/fc/v1/calendar?from="+encodeURIComponent(start)+"&to="+encodeURIComponent(end)+"&limit=500";
    const r=await fetch(url,{headers:{accept:"application/json"}});
    if(!r.ok){errors.push("FinanceCalendar HTTP "+r.status+" for "+start+".."+end);return [];}
    const p=await r.json();
    const rows=Array.isArray(p)?p:(Array.isArray(p.events)?p.events:(Array.isArray(p.data)?p.data:[]));
    diag.raw_provider_rows+=rows.length;
    const normalized=rows.map(normalizeFinance).filter(x=>x.date&&x.event);
    diag.normalized_rows+=normalized.length;
    const unresolved=normalized.filter(x=>!x.country_code);
    diag.unresolved_country_rows+=unresolved.length;
    if(diag.unresolved_samples.length<8){
      diag.unresolved_samples.push(...unresolved.slice(0,8-diag.unresolved_samples.length).map(x=>({event:x.event,country:x.country,currency:x.currency,date:x.date})));
    }
    return normalized;
  }catch(err){errors.push("FinanceCalendar "+start+".."+end+": "+String(err));return [];}
}
async function fetchFinanceRange(start,end,requested,errors,diag){
  const chunks=[];let cursor=start;
  while(cursor<=end){let chunkEnd=addUtcDays(cursor,89);if(chunkEnd>end)chunkEnd=end;chunks.push([cursor,chunkEnd]);cursor=addUtcDays(chunkEnd,1);}
  const allowed=new Set(requested);const out=[];
  for(const [a,b] of chunks){
    const rows=await fetchFinanceChunk(a,b,errors,diag);
    if(requested.length){
      for(const x of rows){
        if(x.country_code&&allowed.has(x.country_code))out.push(x);
        else diag.filtered_country_rows++;
      }
    }else out.push(...rows);
  }
  return out;
}


function officialImpactNumber(v){
  const s=String(v??"").toLowerCase();
  if(s==="high"||s==="3")return 3;
  if(s==="medium"||s==="med"||s==="2")return 2;
  return 1;
}
function parseJsonObject(v){
  if(v&&typeof v==="object")return v;
  if(typeof v==="string"){try{return JSON.parse(v);}catch{}}
  return {};
}
function officialAliases(row){
  const cfg=parseJsonObject(row.source_config);
  const configured=Array.isArray(cfg.calendar_aliases)?cfg.calendar_aliases:[];
  return [...new Set([row.indicator_name,row.title,...configured].filter(Boolean).map(normalizeText).filter(Boolean))];
}
function countryCodeFromOfficial(v){
  const s=String(v??"").toUpperCase().trim();
  return s==="UK"?"GB":s;
}
function ruleArray(v){
  if(Array.isArray(v))return v.map(normalizeText).filter(Boolean);
  if(typeof v==="string"){try{const x=JSON.parse(v);return Array.isArray(x)?x.map(normalizeText).filter(Boolean):[];}catch{}}
  return [];
}
function officialProviderMatch(provider,official){
  const pc=String(provider.country_code||"").toUpperCase();
  const oc=String(official.country_code||"").toUpperCase();
  if(pc!==oc)return false;
  if(String(official.official_indicator_id)==="us_industrial_production_yoy" && !/yoy|year over year|year-on-year/i.test(String(provider.event||"")))return false;

  const pt=Date.parse(provider.date||"");
  const ot=Date.parse(official.date||"");
  const p=normalizeText(provider.event||provider.category||"");
  if(!p)return false;
  const reviewed={
    "us_adp_national_employment_report":["adp employment report"],
    "us_university_of_michigan_consumer_sentiment":["michigan sentiment"],
    "us_gdp_qoq":["us gdp","gdp third estimate"],
    "us_ism_manufacturing_pmi":["ism manufacturing pmi"]
  };
  if((reviewed[String(official.official_indicator_id)]||[]).includes(p))return Number.isFinite(pt)&&Number.isFinite(ot)&&Math.abs(pt-ot)<=4*60*60*1000;

  if(official.match_rule?.enabled===true){
    const maxMinutes=Number(official.match_rule?.max_time_delta_minutes||180);
    if(!Number.isFinite(pt)||!Number.isFinite(ot)||Math.abs(pt-ot)>maxMinutes*60*1000)return false;

    const exactAliases=ruleArray(official.match_rule?.exact_aliases);
    if(exactAliases.includes(p))return true;

    const mode=String(official.match_rule?.match_mode||"exact_or_tokens");
    if(mode==="exact_only")return false;

    const required=ruleArray(official.match_rule?.required_tokens);
    const forbidden=ruleArray(official.match_rule?.forbidden_tokens);
    if(mode==="tokens_only"||mode==="exact_or_tokens"){
      if(!required.length)return false;
      if(required.some(t=>!p.includes(t)))return false;
      if(forbidden.some(t=>p.includes(t)))return false;
      return true;
    }
    return false;
  }

  if(!Number.isFinite(pt)||!Number.isFinite(ot)||Math.abs(pt-ot)>18*60*60*1000)return false;
  return official.aliases.some(a=>a&&(p===a||p.includes(a)||a.includes(p)));
}
async function readOfficialEvents(start,end,requested){
  try{
    const requestedCodes=(requested||[]).map(String).filter(Boolean);
    const q="select e.id::text as event_id,e.indicator_id,e.country,e.title,e.importance,e.scheduled_at,e.period,e.status,e.source_key,e.source_url,i.name as indicator_name,i.agency_id,i.source_config,mr.enabled as match_rule_enabled,mr.exact_aliases,mr.required_tokens,mr.forbidden_tokens,mr.max_time_delta_minutes,mr.match_mode,mr.measure_variant,mr.period_variant,f.value::text as first_value,f.previous_value::text as first_previous,f.unit as first_unit,f.captured_at as first_captured_at,l.value::text as latest_value,l.previous_value::text as latest_previous,l.vintage as latest_vintage,l.captured_at as latest_captured_at,v.actual::text as staged_actual,v.previous::text as staged_previous,v.unit as staged_unit,v.actual_status as staged_actual_status,v.previous_status as staged_previous_status,v.verified_at as staged_verified_at,rh.value::text as reconstructed_actual,ph.value::text as reconstructed_previous,rh.unit as reconstructed_unit,vpub.numeric_actual::text as publisher_actual,vpub.numeric_previous::text as publisher_previous,vpub.unit as publisher_unit from public.econ_events e join public.econ_indicators i on i.id=e.indicator_id left join public.econ_calendar_match_rules mr on mr.indicator_id=i.id left join public.econ_us_oct2026_release_values_private v on v.event_id=e.id left join lateral (select o.value,o.previous_value,o.unit,o.captured_at from public.econ_observations o where o.event_id=e.id and o.is_first_release=true order by o.vintage asc limit 1) f on true left join lateral (select o.value,o.previous_value,o.vintage,o.captured_at from public.econ_observations o where o.event_id=e.id order by o.vintage desc limit 1) l on true left join lateral (select h.value,h.unit from public.econ_history_points h where h.indicator_id=e.indicator_id and h.period=e.period and h.value is not null and e.source_key in ('BOE_MONEY_CREDIT_HISTORIC_VERIFIED','BOE_MPC_HISTORIC_VERIFIED','LLOYDS_HPI_HISTORIC_OFFICIAL_DATE','UK_PUBLISHER_DATE_ONLY_VERIFIED','UK_QUARTERLY_OFFICIAL_DATE_ONLY','ONS_OFFICIAL_RELEASE_EXACT','BOE_M3_INDICATIVE_DATE_ONLY','UK_EXTERNAL_PUBLISHER_EXACT') order by h.fetched_at desc limit 1) rh on true left join lateral (select h.value from public.econ_history_points h where h.indicator_id=e.indicator_id and h.period<e.period and h.period ~ '^20[0-9]{2}-(Q[1-4]|[0-9]{2}(-[0-9]{2})?)$' and h.value is not null and e.source_key in ('BOE_MONEY_CREDIT_HISTORIC_VERIFIED','BOE_MPC_HISTORIC_VERIFIED','LLOYDS_HPI_HISTORIC_OFFICIAL_DATE','UK_PUBLISHER_DATE_ONLY_VERIFIED','UK_QUARTERLY_OFFICIAL_DATE_ONLY','ONS_OFFICIAL_RELEASE_EXACT','BOE_M3_INDICATIVE_DATE_ONLY','UK_EXTERNAL_PUBLISHER_EXACT') order by h.period desc,h.fetched_at desc limit 1) ph on true left join lateral (select p.numeric_actual,p.numeric_previous,p.unit from public.econ_uk_publisher_release_archive p where p.indicator_id=e.indicator_id and p.reference_period=e.period and p.published_on=(e.scheduled_at AT TIME ZONE 'UTC')::date and p.verification_state='official_publisher_primary_page_verified' and e.source_key in ('UK_PUBLISHER_DATE_ONLY_VERIFIED','UK_QUARTERLY_OFFICIAL_DATE_ONLY','ONS_OFFICIAL_RELEASE_EXACT','CBI_PUBLISHER_VERIFIED_SCHEDULE') limit 1) vpub on true where ((i.active=true and i.mapping_status='verified' and coalesce(i.source_config->>'calendar_overlay_enabled','false')='true') or ((e.country='US' and e.scheduled_at >= '2026-10-01'::date and e.scheduled_at < '2026-11-01'::date) or e.source_key='verified_september_release_backfill_20261014' or e.source_key in ('BOE_OFFICIAL_MPC_DATES','BOE_MONEY_CREDIT_OFFICIAL','BOE_EFFECTIVE_RATES_OFFICIAL','BOE_OFFICIAL_FSR_DATES','BOE_MONEY_CREDIT_HISTORIC_VERIFIED','BOE_MPC_HISTORIC_VERIFIED','UK_PUBLISHER_DATE_ONLY_VERIFIED','UK_QUARTERLY_OFFICIAL_DATE_ONLY','ONS_OFFICIAL_RELEASE_EXACT','BOE_M3_INDICATIVE_DATE_ONLY','UK_EXTERNAL_PUBLISHER_EXACT','CBI_PUBLISHER_VERIFIED_SCHEDULE','LLOYDS_OFFICIAL_HPI_DATES','LLOYDS_HPI_HISTORIC_OFFICIAL_DATE'))) and e.scheduled_at >= $1::date and e.scheduled_at < ($2::date + interval '1 day') and (cardinality($3::text[])=0 or upper(case when e.country='UK' then 'GB' else e.country end)=any($3::text[])) order by e.scheduled_at asc";
    const rows=await sql.unsafe(q,[start,end,requestedCodes]);
    return rows.map(row=>{
      const reportPublished=['us_iea_monthly_oil_market_report','us_beige_book','us_wasde_report','us_opec_monthly_report','us_eia_short_term_energy_outlook','us_fomc_minutes'].includes(String(row.indicator_id))&&row.status==='completed'; const futureOnsScheduled=row.source_key==='ONS_OFFICIAL_RELEASE_EXACT' && new Date(row.scheduled_at).getTime()>Date.now() && row.status!=='released' && row.status!=='completed'; const first=futureOnsScheduled?(row.first_value??''):(row.first_value??row.staged_actual??row.reconstructed_actual??row.publisher_actual??(reportPublished?'Published':''));
      const latestVintage=Number(row.latest_vintage||0);
      const revised=latestVintage>1&&row.latest_value!==row.first_value?(row.latest_value??""):"";
      const countryCode=countryCodeFromOfficial(row.country);
      const out={
        id:"official:"+row.event_id,
        series_id:"official:"+row.indicator_id,
        date:new Date(row.scheduled_at).toISOString(),
        country:countryCode==="US"?"United States":String(row.country||countryCode),
        country_code:countryCode,
        category:"",
        event:row.indicator_name||row.title||row.indicator_id,
        reference:row.period||"",
        source:row.source_key==="BOE_M3_INDICATIVE_DATE_ONLY"?"BoE indicative publication schedule":(row.source_key==="UK_EXTERNAL_PUBLISHER_EXACT"||row.source_key==="UK_PUBLISHER_DATE_ONLY_VERIFIED")?"Verified primary publisher":"Official government",
        source_url:row.source_url||"",
        actual:first,
        previous:row.first_previous??row.latest_previous??row.staged_previous??row.reconstructed_previous??row.publisher_previous??(reportPublished?'Previous edition':''), 
        forecast:"",
        te_forecast:"",
        revised:revised,
        importance:officialImpactNumber(row.importance),
        last_update:row.latest_captured_at||row.first_captured_at||row.staged_verified_at||"", 
        currency:"",
        unit:row.first_unit||row.staged_unit||row.reconstructed_unit||row.publisher_unit||"",   
        ticker:"",
        symbol:"",
        multiplier:"",
        time_mode:['official_release_date_only_202610','UK_PUBLISHER_DATE_ONLY_VERIFIED','UK_QUARTERLY_OFFICIAL_DATE_ONLY','BOE_M3_INDICATIVE_DATE_ONLY'].includes(row.source_key)?'date_only':'exact',
        actual_provenance:row.first_value!=null?'first_release_capture':row.staged_actual_status||(row.reconstructed_actual!=null?'latest_revised_historical_series_not_first_release':row.publisher_actual!=null?'publisher_verified_page_not_timed_first_capture':'not_collected'),
        previous_provenance:row.first_previous!=null?'first_release_snapshot':row.latest_previous!=null?'observation_vintage':row.staged_previous_status||(row.reconstructed_previous!=null?'previous_period_latest_revised_series':row.publisher_previous!=null?'publisher_reported_previous':'not_collected'),
        official:true,
        official_indicator_id:row.indicator_id,
        official_agency_id:row.agency_id||null,
        official_event_id:row.event_id,
        official_status:row.status,
        official_first_captured_at:row.first_captured_at||null,
        official_latest_captured_at:row.latest_captured_at||null,
        official_vintage:latestVintage||0
      };
      out.aliases=officialAliases(row);
      out.match_rule={
        enabled:row.match_rule_enabled===true,
        exact_aliases:row.exact_aliases??[],
        required_tokens:row.required_tokens??[],
        forbidden_tokens:row.forbidden_tokens??[],
        max_time_delta_minutes:Number(row.max_time_delta_minutes||180),
        match_mode:row.match_mode||"exact_or_tokens",
        measure_variant:row.measure_variant||null,
        period_variant:row.period_variant||null
      };
      return out;
    });
  }catch(err){
    console.warn("Official calendar overlay read failed",err);
    return [];
  }
}
function mergeOfficialEvents(providerEvents,officialEvents){
  const out=(providerEvents||[]).map(e=>({...e}));
  const now=Date.now();
  let liveWindow=false;
  let matched=0;
  for(const o of officialEvents||[]){
    const t=Date.parse(o.date||"");
    const hasOfficialActual=o.actual!==null&&o.actual!==undefined&&String(o.actual)!=="";
    if(Number.isFinite(t)&&now>=t-10*60*1000&&now<=t+15*60*1000&&!hasOfficialActual)liveWindow=true;
    let best=-1,bestDelta=Infinity;
    for(let i=0;i<out.length;i++){
      // Never merge one canonical official indicator into another.
      if(out[i].official===true)continue;
      if(!officialProviderMatch(out[i],o))continue;
      const delta=Math.abs(Date.parse(out[i].date||"")-t);
      if(delta<bestDelta){best=i;bestDelta=delta;}
    }
    const cleanOfficial={...o}; delete cleanOfficial.aliases; delete cleanOfficial.match_rule;
    if(best>=0){
      const p=out[best];
      out[best]={
        ...p,
        date:o.date,
        actual:hasOfficialActual?o.actual:(p.actual??""),
        forecast:p.forecast??o.forecast??"",
        te_forecast:p.te_forecast??o.te_forecast??"",
        previous:(o.previous!==null&&o.previous!==undefined&&String(o.previous).trim()!==""?o.previous:p.previous??""),
        revised:o.revised||"",
        source:hasOfficialActual?"Official government + "+String(p.source||"calendar provider"):"Official schedule + "+String(p.source||"calendar provider"),
        source_url:o.source_url||p.source_url||"",
        official:true,
        official_indicator_id:o.official_indicator_id,
        official_agency_id:o.official_agency_id||null,
        official_event_id:o.official_event_id,
        official_status:o.official_status,
        official_first_captured_at:o.official_first_captured_at,
        official_latest_captured_at:o.official_latest_captured_at,
        official_vintage:o.official_vintage
      };
      matched++;
    }else out.push(cleanOfficial);
  }
  const seen=new Set();
  const verifiedOnsIds=new Set(['uk_ons_b4_09','uk_ons_b4_10','uk_ons_b4_11','uk_ons_b4_12']);
  const officialOns=new Map();
  for(const e of out){
    const k=String(e.official_indicator_id||'')+'|'+String(e.date||'').slice(0,10);
    if(verifiedOnsIds.has(String(e.official_indicator_id||''))&&String(e.id||'').startsWith('official:')&&String(e.reference||'').trim())officialOns.set(k,e);
  }
  const events=out.filter(e=>{
    if(!e||!e.date||!e.event)return false;
    const k=String(e.official_indicator_id||'')+'|'+String(e.date||'').slice(0,10);
    return !officialOns.has(k)||officialOns.get(k)===e;
  }).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).filter(e=>{const k=dedupeKey(e);if(seen.has(k))return false;seen.add(k);return true;});
  return {events,liveWindow,matched};
}

function archiveNumeric(v){
  if(typeof v==="number")return Number.isFinite(v)?v:null;
  const s=String(v??"").trim();
  if(!/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*%?$/.test(s))return null;
  const n=Number(s.replace(/,/g,"").replace(/%/g,"").trim());
  return Number.isFinite(n)?n:null;
}
async function archiveAndRestoreReleases(events,start,end){
  const list=Array.isArray(events)?events:[];
  const candidates=list.filter(e=>e&&e.date&&e.event&&e.series_id&&
    ["actual","forecast","previous"].some(k=>archiveNumeric(e[k])!==null)&&
    String(e.source||"").toLowerCase().includes("financecalendar")).slice(0,250);
  try{
    // Persist observed provider values without replacing an already archived first value.
    // The original presentation, percentage sign and provenance live in raw_payload.
    if(candidates.length){
      const payload=candidates.map(e=>({
        series_id:String(e.series_id),event_name:String(e.event),
        country_code:String(e.country_code||""),scheduled_at:String(e.date),
        reference_period:String(e.reference||""),
        actual:archiveNumeric(e.actual),forecast:archiveNumeric(e.forecast),
        previous:archiveNumeric(e.previous),revised:archiveNumeric(e.revised),
        unit:String(e.unit||""),importance:Number(e.importance)||1,
        source:String(e.source||""),source_url:String(e.source_url||""),
        raw_payload:{actual:e.actual??"",forecast:e.forecast??"",previous:e.previous??"",
          revised:e.revised??"",captured_source:e.source||"",captured_at:new Date().toISOString()}
      }));
      await sql.unsafe(
        "insert into public.economic_calendar_release_archive (series_id,event_name,country_code,scheduled_at,reference_period,actual,forecast,previous,revised,unit,importance,source,source_url,raw_payload) select x.series_id,x.event_name,x.country_code,x.scheduled_at,x.reference_period,x.actual,x.forecast,x.previous,x.revised,x.unit,x.importance,x.source,x.source_url,x.raw_payload from jsonb_to_recordset($1::jsonb) as x(series_id text,event_name text,country_code text,scheduled_at timestamptz,reference_period text,actual numeric,forecast numeric,previous numeric,revised numeric,unit text,importance integer,source text,source_url text,raw_payload jsonb) on conflict (series_id,scheduled_at) do update set actual=coalesce(public.economic_calendar_release_archive.actual,excluded.actual),forecast=coalesce(public.economic_calendar_release_archive.forecast,excluded.forecast),previous=coalesce(public.economic_calendar_release_archive.previous,excluded.previous),revised=coalesce(public.economic_calendar_release_archive.revised,excluded.revised),raw_payload=case when public.economic_calendar_release_archive.actual is null and excluded.actual is not null then excluded.raw_payload else public.economic_calendar_release_archive.raw_payload end",
        [JSON.stringify(payload)]
      );
    }
  }catch(err){console.warn("Release archive write unavailable",String(err));}
  try{
    const rows=await sql.unsafe(
      "select series_id,scheduled_at,actual::text as actual,forecast::text as forecast,previous::text as previous,revised::text as revised,raw_payload from public.economic_calendar_release_archive where scheduled_at >= $1::date and scheduled_at < ($2::date + interval '1 day') limit 500",
      [start,end]);
    const byId=new Map(rows.map(r=>[String(r.series_id)+"|"+new Date(r.scheduled_at).toISOString(),r]));
    let restored=0;
    for(const e of list){
      const time=Date.parse(e.date||"");if(!Number.isFinite(time))continue;
      const r=byId.get(String(e.series_id||"")+"|"+new Date(time).toISOString());if(!r)continue;
      const saved=r.raw_payload&&typeof r.raw_payload==="object"?r.raw_payload:{};
      for(const field of ["actual","forecast","previous","revised"]){
        if(archiveNumeric(e[field])!==null)continue;
        if(r[field]===null||r[field]===undefined)continue;
        const original=saved[field];
        const restoredText=archiveNumeric(original)!==null?String(original):String(r[field]);
        e[field]=restoredText;
        e[field+"_provenance"]="previously_archived_provider_release";
        restored++;
      }
    }
    return restored;
  }catch(err){console.warn("Release archive read unavailable",String(err));return 0;}
}

async function attachRetrospectiveOfficialActuals(events){
  try{
    const rows=await sql.unsafe("select event_name,scheduled_at,reference_period,actual::text as actual,unit,source,source_url,raw_payload from public.economic_calendar_release_archive where country_code='US' and actual is not null and raw_payload->>'provenance'='retrospective_official_data_recovery' and scheduled_at>=now()-interval '90 days' limit 100");
    let attached=0;
    for(const e of events){
      if(String(e.country_code||"").toUpperCase()!=="US"||archiveNumeric(e.actual)!==null)continue;
      const t=Date.parse(e.date||"");if(!Number.isFinite(t))continue;
      const v=rows.find(x=>String(x.event_name).toLowerCase()===String(e.event||"").toLowerCase()&&Math.abs(Date.parse(x.scheduled_at)-t)<60000&&(!e.reference||String(e.reference)===String(x.reference_period)));
      if(!v)continue;
      e.actual=String(v.actual);
      e.actual_provenance="retrospective_official_data_recovery_not_first_release_capture";
      e.actual_source=String(v.source||"");
      e.actual_source_url=String(v.source_url||"");
      e.actual_reference_period=String(v.reference_period||"");
      e.actual_unit=String(v.unit||"");
      attached++;
    }
    return attached;
  }catch(err){console.warn("Official archive recovery unavailable",String(err));return 0;}
}
async function addVerifiedHistoryPreviousCandidates(events){
  try {
    const candidates=await sql.unsafe("select event_name,release_reference_period,scheduled_at,previous_historical_value,previous_observation_date,source_provider,source_url,unit from public.economic_us_upcoming_previous_candidates_v1 where value_status='ELIGIBLE_HISTORICAL_PREVIOUS_NOT_RELEASE_VERIFIED' and previous_historical_value is not null");
    let attached=0;
    for(const e of events){
      if(String(e.country_code||"").toUpperCase()!=="US" || archiveNumeric(e.previous)!==null)continue;
      const eventTime=Date.parse(e.date||"");if(!Number.isFinite(eventTime))continue;
      const v=candidates.find(x=>String(x.event_name).toLowerCase()===String(e.event||"").toLowerCase()&&Math.abs(Date.parse(x.scheduled_at)-eventTime)<60000&&(!e.reference||String(x.release_reference_period)===String(e.reference)));
      if(!v)continue;
      e.previous=String(String(v.unit||"").toLowerCase()==="percent"?Math.round(Number(v.previous_historical_value)*10)/10:v.previous_historical_value);
      e.previous_provenance="official_historical_previous_candidate_not_first_release_verified";
      e.previous_source=String(v.source_provider||"");
      e.previous_source_url=String(v.source_url||"");
      e.previous_reference_date=v.previous_observation_date?new Date(v.previous_observation_date).toISOString().slice(0,10):"";
      e.previous_unit=String(v.unit||"");
      attached++;
    }
    return attached;
  }catch(err){console.warn("Official historical previous candidates unavailable",String(err));return 0;}
}
async function carryPriorActualToNextRelease(events){
 try{
  const rows=await sql.unsafe("select e.title,e.scheduled_at,e.period,a.actual::text as actual,a.revised::text as revised,a.reference_period as prior_period,a.unit,a.source_url from public.econ_events e join lateral (select a.* from public.economic_calendar_release_archive a where a.country_code='US' and lower(a.event_name)=lower(e.title) and a.scheduled_at<e.scheduled_at and a.actual is not null order by a.scheduled_at desc limit 1) a on true where e.country='US' and e.scheduled_at>=now()-interval '14 days' and e.scheduled_at<now()+interval '120 days' and e.status='scheduled'");
  let carried=0;
  for(const e of events){
   if(String(e.country_code||"").toUpperCase()!=="US"||archiveNumeric(e.previous)!==null)continue;
   const t=Date.parse(e.date||"");if(!Number.isFinite(t))continue;
   const prior=rows.find(x=>String(x.title).toLowerCase()===String(e.event||"").toLowerCase()&&Math.abs(Date.parse(x.scheduled_at)-t)<60000);
   if(!prior)continue;
   // Carry only consecutive weekly reference periods. Unknown cadences are deliberately left unchanged.
   const currentRef=String(prior.period||""), previousRef=String(prior.prior_period||"");
   if(!/^\d{4}-\d{2}-\d{2}$/.test(currentRef)||!/^\d{4}-\d{2}-\d{2}$/.test(previousRef))continue;
   if((Date.parse(currentRef+"T00:00:00Z")-Date.parse(previousRef+"T00:00:00Z"))!==7*86400000)continue;
   e.previous=String(prior.revised??prior.actual);
   e.previous_provenance=prior.revised!==null?"corrected_previous_official_archive":"prior_verified_actual_official_archive";
   e.previous_source_url=String(prior.source_url||"");
   e.previous_unit=String(prior.unit||"");
   e.previous_reference_date=previousRef;
   carried++;
  }
  return carried;
 }catch(err){console.warn("Previous actual carry unavailable",String(err));return 0;}
}
async function attachExactPeriodHistoricalObservations(events){
  try{
    const eligible=events.filter(e=>String(e.country_code||"").toUpperCase()==="US"&&/^\d{4}-\d{2}(-\d{2})?$/.test(String(e.reference||""))&&Date.parse(e.date||"")<=Date.now()+86400000);
    if(!eligible.length)return 0;
    const obs=await sql.unsafe("select s.canonical_event_name,s.aliases,s.unit,s.source_provider,s.source_url,o.observation_date::text as period,o.value::text as actual,lag(o.value) over(partition by s.id order by o.observation_date)::text as prior_value,lag(o.observation_date) over(partition by s.id order by o.observation_date)::text as prior_period from public.economic_history_series s join public.economic_history_observations o on o.series_id=s.id where s.country_code='US' and s.is_active and o.value is not null and o.observation_date<=current_date");
    let enriched=0;
    const normalize=v=>String(v||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    for(const e of eligible){
      if(archiveNumeric(e.actual)!==null)continue;
      const ref=String(e.reference);
      const matches=obs.filter(x=>{
        const aliases=Array.isArray(x.aliases)?x.aliases:(()=>{try{return JSON.parse(x.aliases||"[]")}catch{return []}})();
        if(![x.canonical_event_name,...aliases].some(a=>normalize(a)===normalize(e.event)))return false;
        const p=String(x.period||"").slice(0,10);
        return ref.length===7?p.slice(0,7)===ref:p===ref;
      });
      if(matches.length!==1)continue;
      const v=matches[0];
      e.actual=String(v.actual);
      e.actual_provenance="official_historical_observation_not_first_release_verified";
      e.actual_source=String(v.source_provider||"");
      e.actual_source_url=String(v.source_url||"");
      e.actual_reference_period=String(v.period||"");
      e.actual_unit=String(v.unit||"");
      const validPrior=String(v.prior_period||"");
      if(archiveNumeric(e.previous)===null && validPrior && (
        (ref.length===7 && (new Date(v.period+"T00:00:00Z").getUTCFullYear()*12+new Date(v.period+"T00:00:00Z").getUTCMonth())-(new Date(validPrior+"T00:00:00Z").getUTCFullYear()*12+new Date(validPrior+"T00:00:00Z").getUTCMonth())===1)
        || (ref.length===10 && Date.parse(v.period+"T00:00:00Z")-Date.parse(validPrior+"T00:00:00Z")===7*86400000)
      )){
        e.previous=String(v.prior_value);
        e.previous_provenance="official_historical_prior_observation_not_original_release_verified";
        e.previous_source_url=String(v.source_url||"");
        e.previous_reference_date=validPrior;
        e.previous_unit=String(v.unit||"");
      }
      enriched++;
    }
    return enriched;
  }catch(err){console.warn("Exact historical enrichment unavailable",String(err));return 0;}
}
async function attachVerifiedOfficialBulletins(events,start,end){
  try{
    const rows=await sql.unsafe("select event_name,scheduled_at,reference_period,actual::text actual,previous::text previous,revised::text revised,unit,source,source_url,raw_payload from public.economic_calendar_release_archive where country_code='US' and raw_payload->>'original_release_verified'='true' and scheduled_at >= $1::date and scheduled_at < ($2::date+interval '1 day') limit 150",[start,end]);
    let matched=0;
    for(const e of events){
      if(String(e.country_code||"").toUpperCase()!=="US")continue;
      const when=Date.parse(e.date||"");if(!Number.isFinite(when))continue;
      const v=rows.find(r=>String(r.event_name).toLowerCase()===String(e.event||"").toLowerCase()&&Math.abs(Date.parse(r.scheduled_at)-when)<60000&&(!e.reference||String(e.reference)===String(r.reference_period)));
      if(!v)continue;
      for(const field of ["actual","previous","revised"]){
        if(v[field]===null||v[field]===undefined)continue;
        e[field]=String(v[field]);
        e[field+"_provenance"]="verified_original_official_release_bulletin";
        e[field+"_source"]=String(v.source||"");
        e[field+"_source_url"]=String(v.source_url||"");
      }
      e.reference=String(v.reference_period||e.reference||"");
      e.actual_unit=String(v.unit||"");
      e.revised_semantics=String(v.raw_payload?.revised_field_semantics||"");
      if(String(v.raw_payload?.metric||'')==='pce_mom'){e.original_event=e.event;e.event='PCE Price Index m/m';}
      matched++;
    }
    return matched;
  }catch(err){console.warn("Official bulletin overlay unavailable",String(err));return 0;}
}

let claimsDashboardCache={at:0,record:null};
async function attachOfficialDOLClaimsDashboard(events){
  try{
    if(!events.some(e=>String(e.country_code).toUpperCase()==="US"&&/^(jobless claims|initial jobless claims)$/i.test(String(e.event))))return 0;
    let reading=claimsDashboardCache.record;
    if(Date.now()-claimsDashboardCache.at>12*60*1000||!reading){
      const url="https://oui.doleta.gov/unemploy/DataDashboard.asp";
      const response=await fetch(url,{headers:{"accept":"text/html"},signal:AbortSignal.timeout(9000)});
      if(!response.ok)throw new Error("DOL OUI dashboard HTTP "+response.status);
      const html=await response.text();
      const hit=html.match(/Seasonally\s+Adjusted\s+Initial\s+Claims[\s\S]{0,240}?\((\d{2}\/\d{2}\/\d{4})\)[\s\S]{0,220}?<td[^>]*>[\s\S]{0,170}?>([\d,]+)<\/a>/i);
      if(!hit)throw new Error("DOL OUI official week/value not found");
      const [month,day,year]=hit[1].split("/").map(Number);
      const reportWeek=new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10);
      const actual=Number(hit[2].replaceAll(",",""));
      if(!(actual>=50000&&actual<=2000000))throw new Error("DOL OUI figure out of range");
      reading={reportWeek,actual,url};
      claimsDashboardCache={at:Date.now(),record:reading};
    }
    let attached=0;
    for(const e of events){
      if(String(e.country_code||"").toUpperCase()!=="US"||!/^(jobless claims|initial jobless claims)$/i.test(String(e.event||"")))continue;
      const releaseTime=Date.parse(e.date||"");if(!Number.isFinite(releaseTime)||releaseTime>Date.now()+60000)continue;
      const fiveDays=Date.parse(reading.reportWeek+"T00:00:00Z")+5*86400000;
      if(new Date(releaseTime).toISOString().slice(0,10)!==new Date(fiveDays).toISOString().slice(0,10))continue;
      if(e.reference&&String(e.reference)!==reading.reportWeek)continue;
      if(e.actual_provenance==="verified_original_official_release_bulletin")continue;
      // The live official dashboard reflects the latest published value, not an archived vintage.
      e.actual=String(reading.actual);
      e.actual_provenance="official_dol_dashboard_latest_not_original_vintage";
      e.actual_source="U.S. Department of Labor — Office of Unemployment Insurance";
      e.actual_source_url=reading.url;
      e.actual_reference_period=reading.reportWeek;
      e.actual_unit="claims";
      e.reference=reading.reportWeek;
      attached++;
      try{
        await sql.unsafe("insert into public.economic_calendar_release_archive(series_id,event_name,country_code,scheduled_at,reference_period,actual,unit,importance,source,source_url,raw_payload) values($1,'Jobless claims','US',$2::timestamptz,$3,$4,'claims',3,'U.S. Department of Labor — Office of Unemployment Insurance',$5,$6::jsonb) on conflict(series_id,scheduled_at) do update set actual=coalesce(public.economic_calendar_release_archive.actual,excluded.actual),source_url=excluded.source_url",["dol-dashboard:"+reading.reportWeek,new Date(releaseTime).toISOString(),reading.reportWeek,reading.actual,reading.url,JSON.stringify({provenance:"official_dol_dashboard_latest_not_first_release_capture",report_week:reading.reportWeek,captured_at:new Date().toISOString(),original_release_verified:false})]);
      }catch(error){console.warn("DOL dashboard archive write unavailable",String(error));}
    }
    return attached;
  }catch(error){console.warn("Official DOL Dashboard unavailable",String(error));return 0;}
}

async function carryDOLPrevious(events){
  try{
    const rows=await sql.unsafe("select scheduled_at, actual::text as actual, reference_period, source_url from public.economic_calendar_release_archive where country_code='US' and lower(event_name)='jobless claims' and actual is not null order by scheduled_at desc limit 70");
    let n=0;
    for(const e of events){
      if(String(e.country_code||"")!=="US" || String(e.event||"").toLowerCase()!=="jobless claims" || archiveNumeric(e.previous)!==null)continue;
      const t=Date.parse(e.date||"");
      if(!Number.isFinite(t))continue;
      const v=rows.find(x=>t-Date.parse(x.scheduled_at)===7*86400000);
      if(!v)continue;
      e.previous=String(v.actual);
      e.previous_provenance="preceding_week_official_actual";
      e.previous_source_url=String(v.source_url||"");
      e.previous_reference_date=String(v.reference_period||"");
      n++;
    }
    return n;
  }catch(err){console.warn("DOL previous unavailable",String(err));return 0;}
}
let eiaOfficialCache={at:0,gas:null,crude:null};
async function attachOfficialEIALatest(events,start,end){
  try{
    const candidates=await sql.unsafe("select title,scheduled_at,period from public.econ_events where country='US' and title in ('Natural Gas Storage','Crude Oil Inventories') and scheduled_at >= $1::date and scheduled_at < ($2::date+interval '1 day') and scheduled_at<=now() and period is not null",[start,end]);
    if(!candidates.length)return 0;
    let attached=0;
    for(const item of candidates){
      const event=events.find(x=>String(x.country_code||"").toUpperCase()==="US"&&String(x.event||"").toLowerCase()===String(item.title).toLowerCase()&&Math.abs(Date.parse(x.date||"")-Date.parse(item.scheduled_at))<60000);
      if(!event||event.actual_provenance==="retrospective_official_data_recovery_not_first_release_capture")continue;
      const isGas=item.title==="Natural Gas Storage";
      const url=isGas?"https://ir.eia.gov/ngs/wngsr.json":"https://ir.eia.gov/wpsr/psw00.json";
      const cacheKey=isGas?"gas":"crude";
      let data=eiaOfficialCache[cacheKey];
      if(!data||Date.now()-eiaOfficialCache.at>180000){
        const response=await fetch(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw new Error("EIA source HTTP "+response.status+" "+url);
        const raw=(await response.text()).replace(/^\uFEFF/,"");
        data=JSON.parse(raw);
        eiaOfficialCache[cacheKey]=data;
        eiaOfficialCache.at=Date.now();
      }
      let reportingWeek="",actual=null,releaseDay="";
      if(isGas){
        reportingWeek=String(data.current_week||"");
        releaseDay=String(data.release_date||"").slice(0,11);
        const series=(Array.isArray(data.series)?data.series:[]).find(x=>String(x.series_id||x.id||"").toLowerCase().includes("r48_bcf"));
        const n=Number(series?.calculated?.net_change);
        const observations=series?.data;
        const first=Array.isArray(observations)?Number(observations[0]?.[1]):NaN;
        const second=Array.isArray(observations)?Number(observations[1]?.[1]):NaN;
        if(Number.isFinite(n)&&Number.isFinite(first)&&Number.isFinite(second)&&Math.abs((first-second)-n)<0.001)actual=n;
      }else{
        reportingWeek=String(data?.metadata?.time_period?.end_date||"");
        releaseDay=String(data?.metadata?.release_date||"");
        const arr=data?.data?.["U.S."]?.time_series;
        if(Array.isArray(arr)&&arr.length>=2&&String(arr[arr.length-1]?.date)===reportingWeek){
          const current=Number(arr[arr.length-1].value),prior=Number(arr[arr.length-2].value);
          if(Number.isFinite(current)&&Number.isFinite(prior))actual=current-prior;
        }
      }
      if(reportingWeek!==String(item.period)||actual===null)continue;
      const scheduledDay=new Date(item.scheduled_at).toISOString().slice(0,10);
      const parsedRelease=isGas?new Date(releaseDay).toISOString().slice(0,10):releaseDay;
      if(parsedRelease!==scheduledDay)continue;
      const timely=(Date.now()-Date.parse(item.scheduled_at))<=3*3600000;
      const provenance=timely?"official_eia_timely_source_capture":"official_eia_late_source_recovery";
      const seriesId="eia:"+(isGas?"us_natural_gas_storage":"us_crude_oil_inventories");
      const unit=isGas?"bcf":"thousand barrels";
      const rawPayload={provenance,source_week:reportingWeek,official_release_day:parsedRelease,captured_at:new Date().toISOString(),is_first_release_capture:false,timely_source_capture:timely,original_release_verified:false};
      await sql.unsafe("insert into public.economic_calendar_release_archive(series_id,event_name,country_code,scheduled_at,reference_period,actual,unit,importance,source,source_url,raw_payload) values($1,$2,'US',$3::timestamptz,$4,$5,$6,3,'U.S. Energy Information Administration',$7,$8::jsonb) on conflict(series_id,scheduled_at) do nothing",[seriesId,item.title,new Date(item.scheduled_at).toISOString(),reportingWeek,actual,unit,url,JSON.stringify(rawPayload)]);
      if(archiveNumeric(event.actual)===null){
        event.actual=String(actual);
        event.actual_provenance=provenance;
        event.actual_source="U.S. Energy Information Administration";
        event.actual_source_url=url;
        event.actual_reference_period=reportingWeek;
        event.actual_unit=unit;
        attached++;
      }
    }
    return attached;
  }catch(err){console.warn("EIA official release polling unavailable",String(err));return 0;}
}


let retailLatestCache={at:0,reading:null};
async function attachCensusRetailLatest(events){
 try{
   const eligible=events.filter(e=>String(e.country_code||"")==="US"&&String(e.event||"").toLowerCase()==="retail sales"&&Date.parse(e.date||"")<=Date.now()+60000);
   if(!eligible.length)return 0;
   let data=retailLatestCache.reading;
   if(!data||Date.now()-retailLatestCache.at>15*60000){
     const url="https://www.census.gov/retail/sales.html";
     const response=await fetch(url,{headers:{accept:"text/html"},signal:AbortSignal.timeout(10000)});
     if(!response.ok)throw new Error("Census Retail HTTP "+response.status);
     const html=await response.text();
     const plain=html.replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/\s+/g," ");
     const dateMatch=plain.match(/FOR IMMEDIATE RELEASE:\s*(?:[A-Za-z]+,\s*)?([A-Za-z]+ \d{1,2}, \d{4})/i);
     const actualMatch=plain.match(/Advance estimates of U\.S\. retail and food services sales for ([A-Za-z]+) (\d{4})[\s\S]{0,550}?,\s*(up|down)\s+(\d+(?:\.\d+)?) percent/i);
     if(!dateMatch||!actualMatch)throw new Error("Census Retail validated release fields not found");
     const published=new Date(dateMatch[1]+" 12:00:00 GMT").toISOString().slice(0,10);
     const month=new Date(actualMatch[1]+" 1, "+actualMatch[2]+" 00:00:00 GMT").toISOString().slice(0,7);
     const actual=(actualMatch[3].toLowerCase()==="down"?-1:1)*Number(actualMatch[4]);
     const revision=plain.match(/percent change was revised from\s+(up|down)\s+(\d+(?:\.\d+)?) percent[\s\S]{0,170}?\s+to\s+(up|down)\s+(\d+(?:\.\d+)?) percent/i);
     const prev=revision?(revision[1].toLowerCase()==="down"?-1:1)*Number(revision[2]):null;
     const revised=revision?(revision[3].toLowerCase()==="down"?-1:1)*Number(revision[4]):null;
     data={month,published,actual,previous:prev,revised,url};
     retailLatestCache={at:Date.now(),reading:data};
   }
   let n=0;
   for(const e of eligible){
     const when=Date.parse(e.date||"");
     if(new Date(when).toISOString().slice(0,10)!==data.published)continue;
     if(e.reference&&String(e.reference)!==data.month)continue;
     if(e.actual_provenance==="verified_original_official_release_bulletin")continue;
     e.actual=String(data.actual);
     e.actual_provenance="official_census_latest_release_not_original_vintage";
     e.actual_source="U.S. Census Bureau";
     e.actual_source_url=data.url;
     e.actual_unit="percent";
     e.reference=data.month;
     if(archiveNumeric(e.previous)===null&&data.previous!==null){
       e.previous=String(data.previous);
       e.previous_provenance="official_census_previous_original_at_current_release";
     }
     if(archiveNumeric(e.revised)===null&&data.revised!==null){
       e.revised=String(data.revised);
       e.revised_provenance="official_census_prior_month_revised_at_current_release";
       e.revised_semantics="prior_month_change_revised_at_this_release";
     }
     n++;
     try{
       const r={provenance:"official_census_latest_release_not_first_release_capture",original_release_verified:false,captured_at:new Date().toISOString(),revision_semantics:"previous_period_revised",reference_period:data.month};
       await sql.unsafe("insert into public.economic_calendar_release_archive(series_id,event_name,country_code,scheduled_at,reference_period,actual,previous,revised,unit,importance,source,source_url,raw_payload) values($1,'Retail Sales','US',$2::timestamptz,$3,$4,$5,$6,'percent',3,'U.S. Census Bureau',$7,$8::jsonb) on conflict(series_id,scheduled_at) do nothing",["census:retail_sales_mom:"+data.month,new Date(when).toISOString(),data.month,data.actual,data.previous,data.revised,data.url,JSON.stringify(r)]);
     }catch(err){console.warn("Census archive write failed",String(err));}
   }
   return n;
 }catch(err){console.warn("Census Retail latest unavailable",String(err));return 0;}
}

async function carryOfficialMonthlyPrevious(events){
 try{
  const rows=await sql.unsafe("select event_name,scheduled_at,reference_period,actual::text as actual,source_url from public.economic_calendar_release_archive where country_code='US' and event_name in ('US CPI','Retail Sales','US jobs report (NFP)','PCE inflation','PCE Price Index m/m') and actual is not null and source in ('U.S. Bureau of Labor Statistics','U.S. Census Bureau','U.S. Bureau of Economic Analysis') order by scheduled_at desc limit 120");
  let n=0;
  for(const e of events){
   if(String(e.country_code||"").toUpperCase()!=="US"||archiveNumeric(e.previous)!==null)continue;
   if(!['US CPI','CPI m/m','Retail Sales','US jobs report (NFP)','PCE inflation','PCE Price Index m/m'].includes(String(e.event||"")))continue;
   const when=Date.parse(e.date||"");if(!Number.isFinite(when))continue;
   const matched=rows.filter(x=>(String(x.event_name)===String(e.event)||((String(x.event_name)==='PCE inflation'||String(x.event_name)==='PCE Price Index m/m')&&(String(e.event)==='PCE inflation'||String(e.event)==='PCE Price Index m/m'))||(String(x.event_name)==='US CPI'&&String(e.event)==='CPI m/m')) && (when-Date.parse(x.scheduled_at))>=23*86400000&&(when-Date.parse(x.scheduled_at))<=45*86400000);
   if(matched.length!==1)continue;
   const v=matched[0];
   if(e.reference && String(e.reference).length===7){
     const expected=new Date(Date.parse(String(v.reference_period)+"-01T00:00:00Z"));
     expected.setUTCMonth(expected.getUTCMonth()+1);
     if(expected.toISOString().slice(0,7)!==String(e.reference))continue;
   }
   e.previous=String(v.actual);
   e.previous_provenance="preceding_month_official_original_actual";
   e.previous_source_url=String(v.source_url||"");
   e.previous_reference_date=String(v.reference_period||"");
   if(e.event==="PCE inflation"){e.original_event=e.event;e.event="PCE Price Index m/m";}
   n++;
  }
  return n;
 }catch(err){console.warn("Monthly actual carry unavailable",String(err));return 0;}
}
async function restoreRecordedOfficialActuals(events,start,end){
 try{
   const rows=await sql.unsafe("select event_name,scheduled_at,reference_period,actual::text as actual,previous::text as previous,revised::text as revised,source,source_url,unit,raw_payload from public.economic_calendar_release_archive where country_code='US' and actual is not null and scheduled_at >= $1::date and scheduled_at < ($2::date+interval '1 day') and (series_id like 'eia:%' or series_id like 'dol-dashboard:%' or series_id like 'census:retail_sales_mom:%' or series_id like 'bls:%' or series_id like 'bea:%') limit 400",[start,end]);
   let n=0;
   for(const e of events){
     if(String(e.country_code||"").toUpperCase()!=="US")continue;
     const when=Date.parse(e.date||"");if(!Number.isFinite(when))continue;
     const v=rows.find(x=>(String(x.event_name||"").toLowerCase()===String(e.event||"").toLowerCase()||(String(x.event_name)==="PCE Price Index m/m"&&String(e.event)==="PCE inflation"))&&Math.abs(Date.parse(x.scheduled_at)-when)<60000&&(!e.reference||String(e.reference)===String(x.reference_period)));
     if(!v||e.actual_provenance==="verified_original_official_release_bulletin")continue;
     e.actual=String(v.actual);
     e.actual_provenance=String(v.raw_payload?.provenance||"official_archived_observation");
     e.actual_source=String(v.source||"");
     e.actual_source_url=String(v.source_url||"");
     e.actual_reference_period=String(v.reference_period||"");
     e.actual_unit=String(v.unit||"");
     if(String(v.event_name)==="PCE Price Index m/m"&&String(e.event)==="PCE inflation"){e.original_event=e.event;e.event="PCE Price Index m/m";}
     if(String(v.raw_payload?.source_series_id)==="CUSR0000SA0"&&String(e.event)==="US CPI"){e.original_event=e.event;e.event="CPI m/m";}
     if(archiveNumeric(e.previous)===null&&v.previous!==null){
       e.previous=String(v.previous);
       e.previous_provenance="official_archived_previous";
     }
     if(archiveNumeric(e.revised)===null&&v.revised!==null){
       e.revised=String(v.revised);
       e.revised_provenance="official_archived_prior_period_revision";
     }
     n++;
   }
   return n;
 }catch(err){console.warn("Official retention unavailable",String(err));return 0;}
}

let beaLatestCache={at:0,release:null};
async function attachBEAPCELatest(events){
 try{
  const eligible=events.filter(e=>String(e.country_code||"").toUpperCase()==="US"&&/^PCE inflation$/i.test(String(e.event||""))&&Date.parse(e.date||"")<=Date.now()+60000);
  if(!eligible.length)return 0;
  let latest=beaLatestCache.release;
  if(!latest||Date.now()-beaLatestCache.at>20*60000){
    const listing=await fetch("https://www.bea.gov/news/glance",{signal:AbortSignal.timeout(9000)});
    if(!listing.ok)throw new Error("BEA release listing HTTP "+listing.status);
    const listingHtml=await listing.text();
    const href=listingHtml.match(/\/news\/20\d{2}\/personal-income-and-outlays-[a-z]+-20\d{2}/i)?.[0];
    if(!href)throw new Error("BEA latest Personal Income and Outlays link missing");
    const url="https://www.bea.gov"+href;
    const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error("BEA PCE bulletin HTTP "+response.status);
    const plain=(await response.text()).replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/\s+/g," ");
    const published=plain.match(/EMBARGOED UNTIL RELEASE AT[^,]{0,80},\s*(?:[A-Za-z]+,\s*)?([A-Za-z]+ \d{1,2}, \d{4})/i);
    const actual=plain.match(/From the preceding month,\s*the PCE price index for\s+([A-Za-z]+)\s+(increased|decreased)\s+([\d.]+)\s+percent/i);
    if(!published||!actual)throw new Error("BEA PCE bulletin date/value missing");
    const date=new Date(published[1]+" 00:00:00 GMT").toISOString().slice(0,10);
    const month=new Date(actual[1]+" 1, "+date.slice(0,4)+" 00:00:00 GMT").toISOString().slice(0,7);
    const value=(actual[2].toLowerCase()==="decreased"?-1:1)*Number(actual[3]);
    if(!Number.isFinite(value)||Math.abs(value)>10)throw new Error("BEA PCE value invalid");
    latest={date,month,value,url};
    beaLatestCache={at:Date.now(),release:latest};
  }
  let n=0;
  for(const e of eligible){
    const time=Date.parse(e.date||"");
    if(new Date(time).toISOString().slice(0,10)!==latest.date)continue;
    if(e.reference&&String(e.reference)!==latest.month)continue;
    if(e.actual_provenance==="verified_original_official_release_bulletin")continue;
    // Explicitly label m/m to distinguish it from annual PCE inflation.
    e.original_event=e.event;
    e.event="PCE Price Index m/m";
    e.actual=String(latest.value);
    e.actual_provenance="official_bea_latest_release_not_original_vintage";
    e.actual_source="U.S. Bureau of Economic Analysis";
    e.actual_source_url=latest.url;
    e.actual_reference_period=latest.month;
    e.actual_unit="percent";
    e.reference=latest.month;
    n++;
    try{
      const raw={provenance:"official_bea_latest_release_not_first_release_capture",original_release_verified:false,metric:"PCE_price_index_month_over_month",captured_at:new Date().toISOString()};
      await sql.unsafe("insert into public.economic_calendar_release_archive(series_id,event_name,country_code,scheduled_at,reference_period,actual,unit,importance,source,source_url,raw_payload) values($1,'PCE Price Index m/m','US',$2::timestamptz,$3,$4,'percent',3,'U.S. Bureau of Economic Analysis',$5,$6::jsonb) on conflict(series_id,scheduled_at) do nothing",["bea:pce_mom:"+latest.month,new Date(time).toISOString(),latest.month,latest.value,latest.url,JSON.stringify(raw)]);
    }catch(err){console.warn("BEA PCE archive write failed",String(err));}
  }
  return n;
 }catch(err){console.warn("BEA PCE latest unavailable",String(err));return 0;}
}


async function readOfficialBLSBatch(){
 try{
   const saved=await sql.unsafe("select fetched_at,events from public.economic_calendar_snapshots where snapshot_key='us_bls_api_current_v1' limit 1");
   if(saved[0]&&Date.now()-Date.parse(saved[0].fetched_at)<90*60000){
     const v=typeof saved[0].events==="string"?JSON.parse(saved[0].events):saved[0].events;
     if(Array.isArray(v)&&v.length===2)return v;
   }
   const response=await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({seriesid:["CUSR0000SA0","CES0000000001"]}),signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw new Error("Official BLS API HTTP "+response.status);
   const result=await response.json();
   const series=result?.Results?.series;
   if(result?.status!=="REQUEST_SUCCEEDED"||!Array.isArray(series)||series.length!==2)throw new Error("Official BLS series unavailable");
   await sql.unsafe("insert into public.economic_calendar_snapshots(snapshot_key,start_date,end_date,countries,fetched_at,source,provider_error,events) values('us_bls_api_current_v1',current_date,current_date,array['US'],now(),'BLS Public API v2',null,$1::jsonb) on conflict(snapshot_key) do update set fetched_at=excluded.fetched_at,events=excluded.events,source=excluded.source",[JSON.stringify(series)]);
   return series;
 }catch(err){console.warn("BLS API snapshot unavailable",String(err));return [];}
}
async function attachOfficialBLSLatest(events){
 try{
  const eligible=events.filter(e=>String(e.country_code||"").toUpperCase()==="US"&&['US CPI','US jobs report (NFP)'].includes(String(e.event||""))&&Date.parse(e.date||"")<=Date.now()+60000&&e.actual_provenance!=="verified_original_official_release_bulletin");
  if(!eligible.length)return 0;
  const batch=await readOfficialBLSBatch();
  let attached=0;
  for(const e of eligible){
   const payroll=e.event==="US jobs report (NFP)";
   const series=batch.find(x=>x.seriesID===(payroll?"CES0000000001":"CUSR0000SA0"));
   if(!Array.isArray(series?.data))continue;
   const data=series.data.filter(x=>/^M(0[1-9]|1[0-2])$/.test(x.period||"")).slice(0,3);
   if(data.length!==3||!data.every(x=>Number.isFinite(Number(x.value))))continue;
   const reportMonth=String(data[0].year)+"-"+String(data[0].period).slice(1);
   const time=Date.parse(e.date||"");
   const releaseMonth=new Date(time).toISOString().slice(0,7);
   const expected=new Date(reportMonth+"-01T00:00:00Z");expected.setUTCMonth(expected.getUTCMonth()+1);
   if(expected.toISOString().slice(0,7)!==releaseMonth)continue;
   if(e.reference&&String(e.reference)!==reportMonth)continue;
   const current=Number(data[0].value),prior=Number(data[1].value),older=Number(data[2].value);
   const actual=payroll?Math.round((current-prior)*1000):Math.round(((current/prior)-1)*1000)/10;
   const priorCorrected=payroll?Math.round((prior-older)*1000):Math.round(((prior/older)-1)*1000)/10;
   if(!Number.isFinite(actual)||!Number.isFinite(priorCorrected))continue;
   const originalTitle=e.event;
   e.actual=String(actual);
   e.actual_provenance="official_bls_api_latest_revision_sensitive_not_original_vintage";
   e.actual_source="U.S. Bureau of Labor Statistics Public Data API";
   e.actual_source_url="https://api.bls.gov/publicAPI/v2/timeseries/data/"+series.seriesID;
   e.actual_reference_period=reportMonth;
   e.actual_unit=payroll?"jobs":"percent";
   e.reference=reportMonth;
   if(!payroll){e.original_event=e.event;e.event="CPI m/m";}
   try{
     const v=await sql.unsafe("select actual::text as actual from public.economic_calendar_release_archive where country_code='US' and event_name=$1 and raw_payload->>'original_release_verified'='true' and reference_period=$2 order by scheduled_at desc limit 1",[originalTitle,(()=>{const d=new Date(reportMonth+"-01T00:00:00Z");d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7)})()]);
     const old=Number(v[0]?.actual);
     if(v.length&&Number.isFinite(old)&&old!==priorCorrected){
       if(archiveNumeric(e.previous)===null){e.previous=String(old);e.previous_provenance="prior_month_original_verified_release";}
       if(archiveNumeric(e.revised)===null){e.revised=String(priorCorrected);e.revised_provenance="prior_month_adjusted_in_current_official_bls_series";e.revised_semantics="prior_month_value_revised";}
     }
   }catch(err){console.warn("BLS prior original comparison unavailable",String(err));}
   attached++;
   try{
     const source="https://api.bls.gov/publicAPI/v2/timeseries/data/"+series.seriesID;
     const raw={provenance:"official_bls_api_latest_not_first_release_capture",original_release_verified:false,source_series_id:series.seriesID,captured_at:new Date().toISOString(),reference_period:reportMonth,underlying_series_current:current,underlying_series_prior:prior};
     await sql.unsafe("insert into public.economic_calendar_release_archive(series_id,event_name,country_code,scheduled_at,reference_period,actual,previous,revised,unit,importance,source,source_url,raw_payload) values($1,$2,'US',$3::timestamptz,$4,$5,$6,$7,$8,3,'U.S. Bureau of Labor Statistics', $9,$10::jsonb) on conflict(series_id,scheduled_at) do nothing",[(payroll?"bls:nfp:":"bls:cpi_mom:")+reportMonth,originalTitle,new Date(time).toISOString(),reportMonth,actual,e.previous_provenance==='prior_month_original_verified_release'?archiveNumeric(e.previous):null,e.revised_provenance==='prior_month_adjusted_in_current_official_bls_series'?archiveNumeric(e.revised):null,payroll?"jobs":"percent",source,JSON.stringify(raw)]);
   }catch(err){console.warn("BLS archive insert unavailable",String(err));}
  }
  return attached;
 }catch(err){console.warn("BLS latest overlay unavailable",String(err));return 0;}
}

async function attachExpandedOfficialHistoricalPrevious(events){
 try{
  const rows=await sql.unsafe("select title,scheduled_at,period,previous_value::text as previous_value,previous_observation_date,canonical_key,unit,source_provider,source_url from public.economic_us_exact_previous_backfill_v1");
  let count=0;
  const aliases={"Advance Monthly Retail Sales":["Retail Sales"],"Consumer Price Index":["US CPI","CPI m/m"],"Core Consumer Price Index":["Core CPI","Core CPI m/m"],"Nonfarm Payrolls":["US jobs report (NFP)"],"Initial Jobless Claims":["Jobless claims"],"Average Hourly Earnings":["Average Hourly Earnings m/m"],"Labor Force Participation Rate":["Participation Rate"]};
  for(const e of events){
   if(String(e.country_code||"").toUpperCase()!=="US"||archiveNumeric(e.previous)!==null)continue;
   const time=Date.parse(e.date||"");if(!Number.isFinite(time))continue;
   const matches=rows.filter(r=>(String(r.title)===String(e.event)||(aliases[String(r.title)]||[]).includes(String(e.event)))&&Math.abs(Date.parse(r.scheduled_at)-time)<60000&&(!e.reference||String(e.reference)===String(r.period)));
   if(matches.length!==1)continue;
   const v=matches[0];
   e.previous=String(v.previous_value);
   e.previous_provenance="official_historical_prior_observation_not_original_release_vintage";
   e.previous_source=String(v.source_provider||"");
   e.previous_source_url=String(v.source_url||"");
   e.previous_reference_date=String(v.previous_observation_date||"").slice(0,10);
   e.previous_unit=String(v.unit||"");
   count++;
  }
  return count;
 }catch(err){console.warn("Expanded historical previous unavailable",String(err));return 0;}
}

async function prioritizeOfficialPublishedPrevious(events){
 try{
 const rows=await sql.unsafe("select event_name,scheduled_at,reference_period,actual::text as actual,source_url,source from public.economic_calendar_release_archive where country_code='US' and actual is not null and raw_payload->>'original_release_verified'='true' and event_name in ('US CPI','Core Consumer Price Index','Retail Sales','US jobs report (NFP)','PCE inflation','Jobless claims','PPI','Housing starts','Building Permits','Unemployment Rate','Participation Rate','JOLTS Job Openings','Average Hourly Earnings m/m','Industrial Production') order by scheduled_at desc limit 300");
 const aliases={"US CPI":["US CPI","Consumer Price Index","CPI m/m"],"Retail Sales":["Retail Sales","Advance Monthly Retail Sales"],"US jobs report (NFP)":["US jobs report (NFP)","Nonfarm Payrolls"],"PCE inflation":["PCE inflation","PCE Price Index m/m","Personal Income and Outlays"],"Jobless claims":["Jobless claims","Initial Jobless Claims"],"Core Consumer Price Index":["Core Consumer Price Index","Core CPI"],"PPI":["PPI","Producer Price Index - Final Demand"],"Housing starts":["Housing starts","New Residential Construction"],"Building Permits":["Building Permits"],"Unemployment Rate":["Unemployment Rate"],"Participation Rate":["Participation Rate","Labor Force Participation Rate"],"JOLTS Job Openings":["JOLTS Job Openings"],"Average Hourly Earnings m/m":["Average Hourly Earnings","Average Hourly Earnings m/m"],"Industrial Production":["Industrial Production"]};
 let corrected=0;
 for(const e of events){
  if(String(e.country_code||"").toUpperCase()!=="US")continue;
  const t=Date.parse(e.date||"");if(!Number.isFinite(t))continue;
  const matched=rows.filter(r=>(aliases[String(r.event_name)]||[]).includes(String(e.event))&&t-Date.parse(r.scheduled_at)>=5*86400000&&t-Date.parse(r.scheduled_at)<=45*86400000);
  if(matched.length!==1)continue;
  const r=matched[0];
  const currentRef=String(e.reference||"");
  if(/^\d{4}-\d{2}$/.test(currentRef)){
    const expected=new Date(String(r.reference_period)+"-01T00:00:00Z");
    if(Number.isNaN(expected.getTime()))continue;
    expected.setUTCMonth(expected.getUTCMonth()+1);
    if(expected.toISOString().slice(0,7)!==currentRef)continue;
  } else if(/^\d{4}-\d{2}-\d{2}$/.test(currentRef)){
    if(Date.parse(currentRef+"T00:00:00Z")-Date.parse(String(r.reference_period)+"T00:00:00Z")!==7*86400000)continue;
  }
  if(e.previous_provenance==="verified_original_official_release_bulletin")continue;
  e.previous=String(r.actual);
  e.previous_provenance="preceding_period_original_official_release_actual";
  e.previous_source=String(r.source||"");
  e.previous_source_url=String(r.source_url||"");
  e.previous_reference_date=String(r.reference_period||"");
  corrected++;
 }
 return corrected;
 }catch(err){console.warn("Original published previous priority unavailable",String(err));return 0;}
}


let blsExtendedCache={at:0,series:null};
async function attachExtendedBLSOfficial(events){
 try{
  const rules={
   "Core Consumer Price Index":{id:"CUSR0000SA0L1E",kind:"mom",unit:"percent"},
   "PPI":{id:"WPSFD4",kind:"mom",unit:"percent"},
   "U.S. Import Price Index":{id:"EIUIR",kind:"mom",unit:"percent"},
   "U.S. Export Price Index":{id:"EIUIQ",kind:"mom",unit:"percent"},
   "JOLTS Job Openings":{id:"JTS000000000000000JOL",kind:"level",unit:"thousand"},
   "Unemployment Rate":{id:"LNS14000000",kind:"level",unit:"percent"},
   "Average Hourly Earnings":{id:"CES0500000003",kind:"mom",unit:"percent"}
  };
  const eligible=events.filter(e=>String(e.country_code||"")==="US"&&rules[String(e.event||"")]&&Date.parse(e.date||"")<=Date.now()+60000&&archiveNumeric(e.actual)===null);
  if(!eligible.length)return 0;
  let batch=blsExtendedCache.series;
  if(!batch||Date.now()-blsExtendedCache.at>90*60000){
   const response=await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({seriesid:[...new Set(Object.values(rules).map(x=>x.id))]}),signal:AbortSignal.timeout(14000)});
   if(!response.ok)throw new Error("BLS extended HTTP "+response.status);
   const data=await response.json();
   if(data.status!=="REQUEST_SUCCEEDED"||!Array.isArray(data?.Results?.series))throw new Error("BLS extended series failure");
   batch=data.Results.series;blsExtendedCache={at:Date.now(),series:batch};
  }
  let n=0;
  for(const e of eligible){
   const rule=rules[String(e.event||"")];
   const vals=batch.find(x=>x.seriesID===rule.id)?.data?.filter(x=>/^M(0[1-9]|1[0-2])$/.test(String(x.period||""))).slice(0,2);
   if(!Array.isArray(vals)||vals.length!==2)continue;
   const month=String(vals[0].year)+"-"+String(vals[0].period).slice(1);
   const releaseMonth=new Date(Date.parse(e.date)).toISOString().slice(0,7);
   const expected=new Date(month+"-01T00:00:00Z");expected.setUTCMonth(expected.getUTCMonth()+1);
   if(expected.toISOString().slice(0,7)!==releaseMonth)continue;
   if(e.reference && String(e.reference)!==month)continue;
   const cur=Number(vals[0].value),prev=Number(vals[1].value);
   if(!Number.isFinite(cur)||!Number.isFinite(prev)||prev===0)continue;
   const actual=rule.kind==="mom"?Math.round(((cur/prev)-1)*1000)/10:cur;
   if(!Number.isFinite(actual))continue;
   e.actual=String(actual);
   e.actual_provenance="official_bls_api_latest_not_original_vintage";
   e.actual_source="U.S. Bureau of Labor Statistics";
   e.actual_source_url="https://api.bls.gov/publicAPI/v2/timeseries/data/"+rule.id;
   e.actual_reference_period=month;
   e.actual_unit=rule.unit;
   e.reference=month;
   n++;
   try{
    const payload={provenance:"official_bls_api_latest_not_first_release_capture",original_release_verified:false,source_series_id:rule.id,captured_at:new Date().toISOString(),calculation:rule.kind,underlying_current:cur,underlying_previous:prev};
    await sql.unsafe("insert into public.economic_calendar_release_archive(series_id,event_name,country_code,scheduled_at,reference_period,actual,unit,importance,source,source_url,raw_payload) values($1,$2,'US',$3::timestamptz,$4,$5,$6,3,'U.S. Bureau of Labor Statistics',$7,$8::jsonb) on conflict(series_id,scheduled_at) do nothing",["bls:extended:"+rule.id+":"+month,e.event,new Date(Date.parse(e.date)).toISOString(),month,actual,rule.unit,e.actual_source_url,JSON.stringify(payload)]);
   }catch(err){console.warn("Extended BLS archive failed",String(err));}
  }
  return n;
 }catch(err){console.warn("BLS extended poll unavailable",String(err));return 0;}
}


async function attachBLSPreviousFromOfficialSeries(events){
 try{
 const rules={
  "PPI":{id:"WPSFD4",kind:"mom",unit:"percent"},
  "Core Consumer Price Index":{id:"CUSR0000SA0L1E",kind:"mom",unit:"percent"},
  "U.S. Import Price Index":{id:"EIUIR",kind:"mom",unit:"percent"},
  "U.S. Export Price Index":{id:"EIUIQ",kind:"mom",unit:"percent"},
  "JOLTS Job Openings":{id:"JTS000000000000000JOL",kind:"level",unit:"thousand"},
  "Unemployment Rate":{id:"LNS14000000",kind:"level",unit:"percent"},
  "Average Hourly Earnings":{id:"CES0500000003",kind:"mom",unit:"percent"}
 };
 const periodRows=await sql.unsafe("select title,scheduled_at,period from public.econ_events where country='US' and title='Producer Price Index - Final Demand' and scheduled_at between now()-interval '20 days' and now()+interval '80 days'");
 for(const e of events){
  if(e.country_code!=="US"||e.event!=="PPI"||/^20\d{2}-\d{2}$/.test(String(e.reference||"")))continue;
  const t=Date.parse(e.date||"");const v=periodRows.find(r=>Math.abs(Date.parse(r.scheduled_at)-t)<60000);
  if(v&&/^20\d{2}-\d{2}$/.test(String(v.period||"")))e.reference=String(v.period);
 }
 const targets=events.filter(e=>String(e.country_code||"")==="US"&&rules[String(e.event||"")]&&archiveNumeric(e.previous)===null&&/^20\d{2}-\d{2}$/.test(String(e.reference||"")));
 if(!targets.length)return 0;
 let batch=blsExtendedCache.series;
 if(!batch||Date.now()-blsExtendedCache.at>90*60000){
  const response=await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({seriesid:[...new Set(Object.values(rules).map(x=>x.id))]}),signal:AbortSignal.timeout(13000)});
  if(!response.ok)throw new Error("BLS prior series HTTP "+response.status);
  const data=await response.json();if(data.status!=="REQUEST_SUCCEEDED"||!Array.isArray(data?.Results?.series))throw new Error("BLS prior series missing");
  batch=data.Results.series;blsExtendedCache={at:Date.now(),series:batch};
 }
 let count=0;
 for(const e of targets){
  const rule=rules[String(e.event)];
  const obs=batch.find(s=>s.seriesID===rule.id)?.data?.filter(d=>/^M(0[1-9]|1[0-2])$/.test(String(d.period||"")));
  if(!Array.isArray(obs)||obs.length<2)continue;
  const priorMonth=String(e.reference).replace(/-\d{2}$/,m=>m);
  const expected=new Date(priorMonth+"-01T00:00:00Z");expected.setUTCMonth(expected.getUTCMonth()-1);
  const priorPeriod=expected.toISOString().slice(0,7);
  const index=obs.findIndex(d=>String(d.year)+"-"+String(d.period).slice(1)===priorPeriod);
  if(index<0||index+1>=obs.length)continue;
  const v=Number(obs[index].value),vBefore=Number(obs[index+1].value);
  if(!Number.isFinite(v)||!Number.isFinite(vBefore)||vBefore===0)continue;
  const previous=rule.kind==="mom"?Math.round((v/vBefore-1)*1000)/10:v;
  e.previous=String(previous);
  e.previous_provenance="official_bls_latest_historical_month_not_original_release_vintage";
  e.previous_source="U.S. Bureau of Labor Statistics";
  e.previous_source_url="https://api.bls.gov/publicAPI/v2/timeseries/data/"+rule.id;
  e.previous_reference_date=priorPeriod;
  e.previous_unit=rule.unit;
  count++;
 }
 return count;
 }catch(err){console.warn("BLS Previous API unavailable",String(err));return 0;}
}

async function housingPreviousForEvents(events) {
  try {
    const rows=await sql.unsafe("select e.scheduled_at,e.period,o.value::text as prior_value,o.observation_date::text as prior_date,s.unit,s.source_url from public.econ_events e join public.economic_history_series s on s.canonical_event_name='Housing Starts' and s.country_code='US' join public.economic_history_observations o on o.series_id=s.id and o.observation_date=(to_date(e.period || '-01','YYYY-MM-DD') - interval '1 month')::date where e.country='US' and e.title='New Residential Construction'");
    let count=0;
    for (const event of events) {
      if (String(event.country_code)!=='US'||String(event.event).toLowerCase()!=='housing starts'||archiveNumeric(event.previous)!==null) continue;
      const r=rows.find(x=>Math.abs(Date.parse(x.scheduled_at)-Date.parse(event.date))<60000);
      if (!r) continue;
      event.previous=String(r.prior_value);
      event.previous_provenance='official_historical_housing_prior_not_first_release_verified';
      event.previous_source_url=String(r.source_url||'');
      event.previous_reference_date=String(r.prior_date||'');
      event.previous_unit=String(r.unit||'');
      count++;
    }
    return count;
  } catch (err) { console.warn('Housing Previous unavailable',String(err)); return 0; }
}

async function carryContinuingClaimsPrevious(events){
 try{
  const rows=await sql.unsafe("select scheduled_at,reference_period,actual::text as actual,source_url from public.economic_calendar_release_archive where country_code='US' and event_name='Continuing Jobless Claims' and actual is not null order by scheduled_at desc limit 100");
  let count=0;
  for(const e of events){
   if(String(e.country_code||"")!=="US"||String(e.event||"")!=="Continuing Jobless Claims"||archiveNumeric(e.previous)!==null)continue;
   const time=Date.parse(e.date||"");if(!Number.isFinite(time))continue;
   const row=rows.find(r=>time-Date.parse(r.scheduled_at)===7*86400000&&(!e.reference||Date.parse(String(e.reference)+"T00:00:00Z")-Date.parse(String(r.reference_period)+"T00:00:00Z")===7*86400000));
   if(!row)continue;
   e.previous=String(row.actual);
   e.previous_provenance="previous_week_official_insured_unemployment_released_value";
   e.previous_source_url=String(row.source_url||"");
   e.previous_reference_date=String(row.reference_period||"");
   e.previous_unit="claims";
   count++;
  }
  return count;
 }catch(err){console.warn("Continuing claims previous unavailable",String(err));return 0;}
}

function normalizeExplicitIndustrialPrevious(events){
 let n=0;
 for(const e of events){
  if(String(e.country_code||"")!=="US"||String(e.event||"")!=="Industrial Production")continue;
  const prior=String(e.previous||"").trim();
  const match=prior.match(/^([+-]?\d+(?:\.\d+)?)%\s*m\/m$/i);
  if(!match)continue;
  e.previous_original_text=prior;
  e.previous=String(Number(match[1]));
  e.previous_provenance=e.previous_provenance||"provider_explicit_mom_percent_parsed";
  e.previous_unit="percent";
  n++;
 }
 return n;
}

async function appendVerifiedHistoricalArchiveEvents(events,start,end,requested){
 try{
  if(Array.isArray(requested)&&requested.length&&!requested.includes('US'))return 0;
  const rows=await sql.unsafe("select series_id,event_name,scheduled_at,reference_period,actual::text actual,previous::text previous,revised::text revised,unit,importance,source,source_url,raw_payload from public.economic_calendar_release_archive where country_code='US' and actual is not null and scheduled_at >= $1::date and scheduled_at < ($2::date+interval '1 day') and raw_payload->>'original_release_verified'='true' order by scheduled_at limit 300",[start,end]);
  let added=0;
  for(const r of rows){
    const t=Date.parse(r.scheduled_at);if(!Number.isFinite(t))continue;
    if(events.some(x=>String(x.country_code||'').toUpperCase()==='US'&&String(x.event||'').toLowerCase()===String(r.event_name||'').toLowerCase()&&Math.abs(Date.parse(x.date||'')-t)<60000))continue;
    events.push({
      id:'archive:'+String(r.series_id)+':'+new Date(t).toISOString(),
      series_id:'archive:'+String(r.series_id),
      date:new Date(t).toISOString(),country:'United States',country_code:'US',
      category:'Official government release',event:String(r.event_name),
      reference:String(r.reference_period||''),source:String(r.source||''),
      source_url:String(r.source_url||''),actual:String(r.actual),
      previous:r.previous===null?'':String(r.previous),
      revised:r.revised===null?'':String(r.revised),
      forecast:'',te_forecast:'',importance:Number(r.importance)||3,
      unit:String(r.unit||''),time_mode:'exact',
      actual_provenance:'verified_original_official_release_bulletin',
      previous_provenance:r.previous===null?'':'verified_original_official_release_bulletin',
      revised_provenance:r.revised===null?'':'verified_original_official_release_bulletin',
      revised_semantics:String(r.raw_payload?.revised_field_semantics||'')
    });
    added++;
  }
  events.sort((a,b)=>Date.parse(a.date||'')-Date.parse(b.date||''));
  return added;
 }catch(err){console.warn('Historical official event injection unavailable',String(err));return 0;}
}


async function attachCalendarHistoryAndPrevious(events){
 try {
  const normalize=s=>String(s??"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const catalog=await sql.unsafe("select indicator_id,indicator_name from public.econ_calendar_master_catalog");
  const byName=new Map();
  for(const r of catalog){const k=normalize(r.indicator_name);if(!byName.has(k))byName.set(k,[]);byName.get(k).push(r.indicator_id)}
  const explicit=new Map([
   ["adp employment report","us_adp_national_employment_report"],
   ["michigan sentiment","us_university_of_michigan_consumer_sentiment"],
   ["us gdp","us_gdp_qoq"],
   ["gdp third estimate","us_gdp_qoq"],
   ["trade balance","us_goods_trade_balance"],
   ["ppi","us_ppi_mom"],
   ["industrial production","us_industrial_production_mom"]
  ]);
  for(const e of events){
   if(String(e.country_code||"").toUpperCase()!=="US"||e.official_indicator_id)continue;
   const key=normalize(e.event);
   const ids=byName.get(key)||[];
   const id=ids.length===1?ids[0]:explicit.get(key);
   if(id){e.official_indicator_id=id;e.history_link_match_method=ids.length===1?"unique_exact_normalized_name":"reviewed_source_alias"}
  }
  const ids=[...new Set(events.filter(e=>e.country_code==="US"&&e.official_indicator_id).map(e=>String(e.official_indicator_id)))];
  if(!ids.length)return 0;
  const rows=await sql.unsafe("select indicator_id,observation_date::text as d,observed_value::text as v,source_url,provenance from public.econ_us_calendar_history_verified_private_v2 where indicator_id=any($1::text[]) order by indicator_id,observation_date",[ids]);
  const groups=new Map();
  for(const r of rows){if(!groups.has(r.indicator_id))groups.set(r.indicator_id,[]);groups.get(r.indicator_id).push({date:String(r.d).slice(0,10),value:Number(r.v),source_url:r.source_url,provenance:r.provenance})}
  let enriched=0;
  for(const e of events){
   const h=groups.get(String(e.official_indicator_id));if(!h)continue;
   e.history_12m=h.map(x=>({date:x.date,value:x.value}));
   e.history_12m_count=h.length;
   e.history_12m_months=[...new Set(h.map(x=>x.date.slice(0,7)))].length;
   const ref=String(e.reference||"");
   const isMonth=/^\d{4}-\d{2}$/.test(ref),isDay=/^\d{4}-\d{2}-\d{2}$/.test(ref),isQuarter=/^\d{4}-Q[1-4]$/.test(ref);
   let expected="";
   if(isMonth){const [y,m]=ref.split("-").map(Number);expected=new Date(Date.UTC(y,m-2,1)).toISOString().slice(0,7)}
   else if(isDay){const d=new Date(ref+"T00:00:00Z");d.setUTCDate(d.getUTCDate()-7);expected=d.toISOString().slice(0,10)}
   else if(isQuarter){const y=Number(ref.slice(0,4)),q=Number(ref.slice(-1));expected=new Date(Date.UTC(y,(q-2)*3,1)).toISOString().slice(0,7)}
   if(!expected)continue;
   if(e.previous!==null&&e.previous!==undefined&&String(e.previous).trim()!=="")continue;
   const matches=h.filter(r=>isDay?r.date===expected:r.date.slice(0,7)===expected);
   if(!matches.length)continue;
   const picked=matches.at(-1);
   e.previous=String(picked.value);
   e.previous_provenance="exact_prior_reporting_period_"+picked.provenance;
   e.previous_reference_date=picked.date;
   e.previous_source_url=picked.source_url;
   enriched++;
  }
  return enriched;
 }catch(error){console.warn("calendar historical bridge",String(error));return 0}
}


const ukOfficialReleaseCache=new Map();
async function readUKOfficialPublications(start,end,requested){
  const countries=(requested||[]).map(x=>String(x).toUpperCase());
  if(countries.length && !countries.some(x=>x==="GB"||x==="UK"||x==="UNITED KINGDOM"))return [];
  const key=start+"|"+end;
  const entry=ukOfficialReleaseCache.get(key);
  if(entry&&Date.now()-entry.at<300000)return entry.events;
  const list=[];
  const onsMatch=/(?:consumer price inflation|producer price inflation|retail sales|labour market|employment|average weekly earnings|gross domestic product|gdp monthly estimate|gdp first quarterly estimate|gdp quarterly national accounts|index of production|index of services|construction output|uk trade|public sector finances|business investment|balance of payments|trade in goods|house price index|house price inflation|index of private housing rental prices|job vacancies|claimant count|productivity|monthly business survey)/i;
  try{
    const url="https://api.beta.ons.gov.uk/v1/search/releases?limit=1000&fromDate="+encodeURIComponent(start)+"&toDate="+encodeURIComponent(end);
    const controller=AbortSignal.timeout(13000);
    const resp=await fetch(url,{signal:controller});
    if(!resp.ok)throw Error("ONS releases API HTTP "+resp.status);
    const data=await resp.json();
    for(const item of (Array.isArray(data.releases)?data.releases:[])){
      const desc=item.description||{};
      const title=String(desc.title||"").trim();
      const release=String(desc.release_date||"");
      const path=String(item.uri||"");
      if(!onsMatch.test(title)||!/^\d{4}-\d{2}-\d{2}T/.test(release)||desc.cancelled===true)continue;
      if(/time.?series|dataset|correction notice|methodology|quality update|transformation|advisors in|by business characteristics/i.test(title))continue;
      if(!path.startsWith("/releases/"))continue;
      const date=release.slice(0,10);
      if(date<start||date>end)continue;
      list.push({id:"uk-ons-release:"+path,series_id:"uk-ons-release:"+path,date:new Date(release).toISOString(),
        country:"United Kingdom",country_code:"GB",category:"Official economic release",
        event:title,reference:"",source:"Office for National Statistics release calendar",
        source_url:"https://www.ons.gov.uk"+path,actual:"",previous:"",forecast:"",te_forecast:"",
        revised:"",importance:2,time_mode:"exact",official:true,
        verified_release_schedule:true,official_status:desc.published===true?"completed":"scheduled"});
    }
  }catch(err){console.warn("UK ONS release schedule unavailable",String(err))}
  try{
    const docs=await sql.unsafe("select d.indicator_id,i.name as indicator_name,d.published_on::text as published_on,d.source_url,d.document_title,d.covered_period,d.document_type from public.econ_uk_boe_12m_document_archive_20261015 d join public.econ_indicators i on i.id=d.indicator_id and i.country='UK' and i.active=true and i.mapping_status='verified' where d.published_on >= $1::date and d.published_on <= $2::date and d.verified_status is not null and d.source_url like 'https://%' order by d.published_on,d.indicator_id",[start,end]);
    for(const d of docs){
      if(d.document_type==='monthly_economic_release')continue;
      const date=String(d.published_on).slice(0,10);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
      list.push({id:"uk-boe-document:"+d.indicator_id+":"+date,series_id:"official:"+d.indicator_id,
        date:date+"T12:00:00Z",country:"United Kingdom",country_code:"GB",
        category:"Central bank publication",event:d.indicator_name||d.document_title,
        reference:"",source:"Bank of England verified publication archive",source_url:d.source_url,
        actual:"Published",previous:"",forecast:"",te_forecast:"",revised:"",importance:2,
        time_mode:"all_day",official:true,official_indicator_id:d.indicator_id,official_status:"completed",date_precision:"day"});
    }
    const creditDocs=docs.filter(d=>d.document_type==='monthly_economic_release'&&d.covered_period&&/^20[0-9]{2}-[0-9]{2}$/.test(String(d.covered_period)));
    if(creditDocs.length){
      const ids=['uk_boe_b2_boe_consumer_credit','uk_boe_b2_mortgage_approvals','uk_boe_b2_mortgage_approvals_for_remortgaging','uk_boe_b2_mortgage_lending','uk_boe_b2_net_lending_to_individuals','uk_boe_b2_m4_money_supply_mom_','uk_boe_b2_m4_money_supply_yoy_','uk_boe_b2_m4_lending_to_private_sector_mom_'];
      const points=await sql.unsafe("select i.id,i.name,h.period,h.value::text value,h.unit from public.econ_history_points h join public.econ_indicators i on i.id=h.indicator_id and i.country='UK' and i.active=true and i.mapping_status='verified' where h.indicator_id=any($1::text[]) and h.period>='2024-01' and h.period<'2027-01' and h.value is not null order by h.indicator_id,h.period",[ids]);
      const lookup=new Map(points.map(x=>[x.id+'|'+String(x.period).slice(0,7),x]));
      for(const doc of creditDocs){
        const month=String(doc.covered_period),day=String(doc.published_on).slice(0,10);
        const t=new Date(month+'-01T00:00:00Z');
        if(!Number.isFinite(t.valueOf()))continue;
        t.setUTCMonth(t.getUTCMonth()-1);
        const prior=t.toISOString().slice(0,7);
        let items=0;
        for(const id of ids){
          const current=lookup.get(id+'|'+month),previous=lookup.get(id+'|'+prior);
          if(!current||!previous)continue;
          items++;
          list.push({id:'uk-boe-money-credit:'+id+':'+day,series_id:id,date:day+'T12:00:00Z',
            country:'United Kingdom',country_code:'GB',category:'Bank of England money and credit',
            event:current.name,source:'Bank of England official Money and Credit release',source_url:doc.source_url,
            actual:current.value,previous:previous.value,unit:current.unit||'',forecast:'',te_forecast:'',revised:'',
            importance:2,time_mode:'all_day',date_precision:'day',official:true,verified_release_schedule:true,
            official_indicator_id:id,official_status:'completed',actual_reference_period:month,
            previous_reference_period:prior,actual_provenance:'BoE latest stored history, possibly revised'});
        }
        if(!items)list.push({id:'uk-boe-money-credit-document:'+day,series_id:'official:'+doc.indicator_id,
          date:day+'T12:00:00Z',country:'United Kingdom',country_code:'GB',event:'BoE Money and Credit',
          source:'Bank of England official Money and Credit release',source_url:doc.source_url,
          actual:'Published',previous:'Not applicable',importance:2,time_mode:'all_day',
          numeric_comparison_available:false,official:true,official_status:'completed'});
      }
    }
  }catch(err){console.warn("UK Bank of England calendar archive unavailable",String(err))}
  try {
    const auctions=await sql.unsafe("with x as (select indicator_id,period,value::text val,source_url,lag(value) over(partition by indicator_id order by period) prev from public.econ_history_points where indicator_id in ('uk_dmo_tbill_1m_yield','uk_b5_18','uk_dmo_tbill_6m_yield') and period>='2025-09-01' and period<'2027-01-01' and history_kind='official_latest_vintage') select distinct on (x.indicator_id,x.period) x.indicator_id,x.period,x.val,x.prev::text prev,i.name,x.source_url from x join public.econ_indicators i on i.id=x.indicator_id where x.period>=$1 and x.period<=$2 order by x.indicator_id,x.period",[start,end]);
    for(const row of auctions) {
      list.push({id:'uk-dmo-'+row.indicator_id+'-'+row.period,series_id:'official:'+row.indicator_id,date:row.period+'T12:00:00Z',country:'United Kingdom',country_code:'GB',event:row.name,source:'UK Debt Management Office',source_url:row.source_url,actual:row.val+'%',previous:row.prev==null?'':row.prev+'%',importance:1,time_mode:'all_day',official:true,official_indicator_id:row.indicator_id});
    }
  } catch(error) {console.warn('UK tender entries unavailable',String(error))}
  try{
    const dates=await sql.unsafe("select distinct h.indicator_id,h.event_date::text event_date,h.event_title,h.source_url,h.jurisdiction,i.name from public.econ_uk_batch3_event_history_20261015 h join public.econ_indicators i on i.id=h.indicator_id and i.country='UK' and i.active=true and i.mapping_status='verified' where h.event_date>=$1 and h.event_date<=$2 and h.source_url like 'https://www.gov.uk/%' order by event_date,h.indicator_id,h.event_title,h.source_url,h.jurisdiction,i.name",[start,end]);
    for(const h of dates){
      list.push({id:'uk-official-holiday:'+h.indicator_id+':'+h.event_date+':'+h.jurisdiction,date:h.event_date+'T12:00:00Z',
        country:'United Kingdom',country_code:'GB',event:h.name,category:'Public holiday',
        source:'GOV.UK official bank holiday calendar',source_url:h.source_url,
        actual:'Holiday',previous:'Not applicable',forecast:'',te_forecast:'',revised:'',
        importance:1,time_mode:'all_day',date_precision:'day',official:true,
        official_indicator_id:h.indicator_id,official_status:'completed',event_kind:'publication_or_decision',
        numeric_comparison_available:false,jurisdiction:h.jurisdiction});
    }
  }catch(err){console.warn('UK statutory holidays not available',String(err))}
  try{
    const releases=await sql.unsafe("select a.indicator_id,i.name,a.published_on::text release_day,a.reference_period,a.source_url,a.unit,a.numeric_actual::text actual,a.numeric_previous::text previous,a.source_kind from public.econ_uk_publisher_release_archive a join public.econ_indicators i on i.id=a.indicator_id and i.country='UK' and i.active=true and i.mapping_status='verified' where a.published_on>=$1::date and a.published_on<=$2::date and a.verification_state like 'official_%_verified' order by a.published_on,a.indicator_id",[start,end]);
    for(const x of releases){
      list.push({id:'uk-publisher:'+x.indicator_id+':'+x.release_day,series_id:x.indicator_id,date:x.release_day+'T12:00:00Z',country:'United Kingdom',country_code:'GB',event:x.name,category:'Publisher economic indicator',source:'Official publisher release archive',source_url:x.source_url,actual:x.actual||'',previous:x.previous||'',unit:x.unit||'',forecast:'',te_forecast:'',revised:'',importance:2,time_mode:'all_day',date_precision:'day',official:true,verified_release_schedule:true,official_status:'completed',official_indicator_id:x.indicator_id,actual_reference_period:x.reference_period,actual_provenance:'Official release page current and previous values'});
    }
  }catch(err){console.warn('UK publisher calendar archive unavailable',String(err))}
  const unique=[...new Map(list.map(x=>[x.id,x])).values()];
  ukOfficialReleaseCache.set(key,{at:Date.now(),events:unique});
  if(ukOfficialReleaseCache.size>40)ukOfficialReleaseCache.delete(ukOfficialReleaseCache.keys().next().value);
  return unique;
}







async function attachVerifiedCFTCGBPWeeklyActual(events){
  const stats={cftc_publisher_actual_attached:0,cftc_duplicate_display_hidden:0};
  let source;
  try{
    const found=await sql.unsafe("select indicator_id,reference_period,published_on::text published_on,numeric_actual::text actual,numeric_previous::text previous,unit,source_url from public.econ_uk_publisher_release_archive where indicator_id='uk_b5_15' and reference_period='2026-10-13' and published_on='2026-10-16'::date and source_kind='cftc_legacy_noncommercial_futures_gbp_20261013' and verification_state='official_publisher_primary_page_verified' and numeric_actual is not null and numeric_previous is not null limit 1");
    source=found[0];
  }catch(err){console.warn("UK CFTC publisher actual unavailable",String(err));return stats;}
  if(!source)return stats;
  const group=(events||[]).filter(e=>e.country_code==="GB"&&e.official_indicator_id==="uk_b5_15"
    &&String(e.reference||e.actual_reference_period||"")===source.reference_period
    &&String(e.date||"").slice(0,10)===source.published_on
    &&!["scheduled"].includes(String(e.official_status||"")));
  if(!group.length)return stats;
  const archive=e=>({id:e.id,official_event_id:e.official_event_id||null,date:e.date,
    official_indicator_id:e.official_indicator_id,reference:e.reference||"",event:e.event,
    source:e.source||"",source_url:e.source_url||"",actual:e.actual??"",previous:e.previous??""});
  const available=[];
  for(const e of group){
    if(new Date(e.date).getTime()>Date.now())continue;
    const existing=String(e.actual??"").trim();
    if(existing!=="" && Number(existing.replace(/,/g,""))!==Number(source.actual))continue;
    if(existing===""){
      e.actual=source.actual;
      e.actual_provenance="CFTC original weekly futures report non-commercial long minus short; official publisher verified";
      e.actual_source_url=source.source_url;
      e.verified_publisher_reference_period=source.reference_period;
      stats.cftc_publisher_actual_attached++;
    }
    if(!String(e.previous??"").trim()){
      e.previous=source.previous;
      e.previous_reference_period="2026-10-06";
      e.previous_provenance="CFTC previous weekly non-commercial net positioning (official publisher)";
    }
    if(!String(e.unit||"").trim())e.unit="contracts";
    available.push(e);
  }
  if(available.length>1){
    // The originally scheduled CFTC release is retained at 19:30Z; archive-derived date-only placeholder is display-only redundant.
    const main=available.find(e=>String(e.date||"").startsWith("2026-10-16T19:30:00"))||available[0];
    if(available.every(e=>Number(e.actual)===Number(main.actual)&&Number(e.previous)===Number(main.previous))){
      const rest=available.filter(e=>e!==main);
      main.merged_source_records=[...(main.merged_source_records||[archive(main)]),...rest.map(archive)];
      main.actual_source_url=source.source_url;
      main.additional_verified_source_labels=[...new Set([...(main.additional_verified_source_labels||[]),"CFTC Futures Only original report"])];
      events.splice(0,events.length,...events.filter(e=>!rest.includes(e)));
      stats.cftc_duplicate_display_hidden+=rest.length;
    }
  }
  return stats;
}

async function labelVerifiedUKReportsAndCFTCWeek(events){
  // Only identified, already-published official report cards, never numeric substitutes.
  const stats={narrative_published_cards_verified:0,prior_cftc_week_attached:0};
  const verifiedReports=new Map([
    ["uk_b3_hmrc_overseas_trade_in_goods_statistics|2026-08-12",
      "https://www.gov.uk/government/statistics/uk-overseas-trade-in-goods-statistics-june-2026"],
    ["uk_b3_hmrc_overseas_trade_in_goods_statistics|2026-09-10",
      "https://www.gov.uk/government/statistics/uk-overseas-trade-in-goods-statistics-july-2026"],
    ["uk_b3_hmrc_overseas_trade_in_goods_statistics|2026-10-14",
      "https://www.gov.uk/government/statistics/uk-overseas-trade-in-goods-statistics-august-2026"],
    ["uk_labour_market|2026-09-15",
      "https://www.ons.gov.uk/releases/uklabourmarketseptember2026"],
    ["uk_labour_market|2026-10-20",
      "https://www.ons.gov.uk/releases/uklabourmarketoctober2026"]
  ]);
  const blank=v=>v===null||v===undefined||String(v).trim()==="";
  for(const e of events||[]){
    if(e.country_code!=="GB"||!e.official_indicator_id||!String(e.id||"").startsWith("official:"))continue;
    const k=String(e.official_indicator_id)+"|"+String(e.date||"").slice(0,10);
    const publishedUrl=verifiedReports.get(k);
    if(!publishedUrl||!blank(e.actual)||new Date(e.date).getTime()>Date.now())continue;
    if(!["released","completed","failed"].includes(String(e.official_status||"")))continue;
    e.source_calendar_url=e.source_url||"";
    e.source_url=publishedUrl;
    e.actual="Published";
    e.previous="Not applicable";
    e.numeric_comparison_available=false;
    e.event_kind="publication_or_decision";
    e.actual_provenance="official_publisher_report_publication_verified_no_single_numeric_metric";
    e.previous_provenance="not_applicable_to_narrative_report";
    e.verified_official_publication_url=publishedUrl;
    stats.narrative_published_cards_verified++;
  }
  const weekly=(events||[]).filter(e=>e.country_code==="GB"&&e.official_indicator_id==="uk_b5_15"&&
       String(e.reference)==="2026-10-13"&&String(e.date||"").slice(0,10)==="2026-10-16"&&blank(e.previous));
  if(weekly.length){
    try{
      const history=await sql.unsafe("select h.value::text as value,h.unit,h.source_url from public.econ_history_points h where h.indicator_id='uk_b5_15' and h.period='2026-10-06' and h.value is not null and h.history_kind like 'official_%' and h.source_url like 'https://%' order by h.fetched_at desc limit 1");
      const prior=history[0];
      if(prior)for(const e of weekly){
        e.previous=prior.value;
        e.previous_reference_period="2026-10-06";
        e.previous_source_url=prior.source_url;
        e.previous_provenance="prior_reporting_week_latest_stored_observation_not_first_release";
        if(blank(e.unit)&&prior.unit)e.unit=prior.unit;
        stats.prior_cftc_week_attached++;
      }
    }catch(err){console.warn("UK CFTC prior-week reading unavailable",String(err));}
  }
  return stats;
}

async function attachExactVerifiedUKPublisherReleases(events){
  // Additive display-only reconciliation of publisher-verified Oct 2026 actuals.
  // Database source events, observation vintages and historical rows are never modified.
  const result={verified_publisher_actuals_attached:0,verified_publisher_display_duplicates_hidden:0,source_links_preserved:0};
  let source=[];
  try{
    source=await sql.unsafe("select indicator_id,published_on::text published_on,reference_period,numeric_actual::text actual,numeric_previous::text previous,unit,source_kind,source_url from public.econ_uk_publisher_release_archive where published_on='2026-10-20'::date and verification_state='official_publisher_primary_page_verified' and source_kind in ('ons_oct2026_employment_uk','ons_hmrc_paye_oct2026') and numeric_actual is not null order by indicator_id");
  }catch(err){console.warn("UK verified publisher display reconciliation unavailable",String(err));return result;}
  const refs=new Map(source.map(r=>[String(r.indicator_id)+"|"+r.published_on+"|"+String(r.reference_period),r]));
  const byGroup=new Map();
  const archived=e=>({id:e.id,official_indicator_id:e.official_indicator_id||null,official_event_id:e.official_event_id||null,
    date:e.date,reference:e.reference||"",actual_reference_period:e.actual_reference_period||"",
    event:e.event,source:e.source,source_url:e.source_url,actual:e.actual??"",previous:e.previous??"",unit:e.unit??""});
  const erased=new Set();
  for(const e of events){
    if(String(e.country_code)!=="GB"||!e.official_indicator_id)continue;
    if(String(e.official_status)==="scheduled")continue;
    const day=String(e.date||"").slice(0,10);
    const period=String(e.reference||e.actual_reference_period||"");
    const key=String(e.official_indicator_id)+"|"+day+"|"+period;
    const source=refs.get(key);
    if(!source||new Date(e.date).valueOf()>Date.now())continue;
    if(e.actual!=null&&String(e.actual).trim()!=""&&Number(String(e.actual).replace(/,/g,""))!==Number(source.actual))continue;
    if(e.actual==null||String(e.actual).trim()===""){
      e.actual=source.actual;
      e.actual_provenance="ONS official publisher bulletin verified (not timed first-release capture)";
      e.actual_source_url=source.source_url;
      e.verified_publisher_reference_period=source.reference_period;
      if(!String(e.unit||"").trim())e.unit=source.unit||"";
      result.verified_publisher_actuals_attached++;
    }
    if(!byGroup.has(key))byGroup.set(key,[]);
    byGroup.get(key).push(e);
  }
  for(const [key,rows] of byGroup){
    if(rows.length<2)continue;
    const expected=refs.get(key);
    if(!expected)continue;
    // Same metric, published date, reference period, and Actual.
    // Never collapse differing numeric Previous, Forecast, Revised or unit values.
    const compatible=rows.every(e=>Number(e.actual)===Number(expected.actual));
    if(!compatible)continue;
    const numericOrBlank=v=>String(v??"").trim().replace(/,/g,"");
    const distinct=(f)=>[...new Set(rows.map(e=>numericOrBlank(e[f])).filter(x=>x!==""))];
    if(["previous","forecast","revised"].some(f=>distinct(f).length>1))continue;
    if(distinct("unit").length>1)continue;
    const sorted=rows.slice().sort((a,b)=>{
      const key=e=>(String(e.id||"").startsWith("official:")?0:1)*1e10 + new Date(e.date).valueOf();
      return key(a)-key(b);
    });
    const primary=sorted[0];
    primary.merged_source_records=[...(primary.merged_source_records||[archived(primary)]),
      ...sorted.slice(1).map(archived)];
    primary.additional_verified_source_labels=[...new Set([
      ...(primary.additional_verified_source_labels||[]),"ONS publisher bulletin"])];
    primary.actual_source_url=expected.source_url;
    primary.verified_publisher_reference_period=expected.reference_period;
    if(!String(primary.previous||"").trim()){
      const prior=sorted.find(e=>String(e.previous||"").trim());
      if(prior){primary.previous=prior.previous;primary.previous_provenance=prior.previous_provenance;}
    }
    for(const e of sorted.slice(1))erased.add(e);
    result.verified_publisher_display_duplicates_hidden+=rows.length-1;
    result.source_links_preserved+=rows.length;
  }
  events.splice(0,events.length,...events.filter(e=>!erased.has(e)));
  return result;
}

async function fillUKPreviousFromExactStoredHistory(events){
  // Read only: fill a missing Previous, never Actual, Revised, or Forecast.
  // An upcoming release stays without Actual until a verified collector supplies it.
  const stats={previous_from_stored_matching_period:0,boe_previous_meeting_values:0,unknown_previous_retained:0};
  const isBlank=v=>v===null||v===undefined||String(v).trim()==="";
  const selected=(events||[]).filter(e=>String(e.country_code)==="GB"&&
    String(e.id||"").startsWith("official:")&&e.official_indicator_id&&
    isBlank(e.previous)&&
    ["scheduled","released","completed","failed"].includes(String(e.official_status||""))&&
    (/^20\d{2}-\d{2}$/.test(String(e.reference||""))||
     /^20\d{2}-Q[1-4]$/.test(String(e.reference||""))||
     ["uk_boe_rate_decision","uk_boe_vote_cut","uk_boe_vote_hike","uk_boe_vote_unchanged"].includes(String(e.official_indicator_id))));
  if(!selected.length)return stats;
  const ids=[...new Set(selected.map(e=>String(e.official_indicator_id)))];
  try{
    const rows=await sql.unsafe("select i.id, i.frequency, h.period, h.value::text as value,h.unit,h.history_kind,h.source_url,h.fetched_at from public.econ_indicators i join public.econ_history_points h on h.indicator_id=i.id where i.country='UK' and i.active=true and i.mapping_status='verified' and i.id=any($1::text[]) and h.period>='2024-01' and h.value is not null and h.history_kind like 'official_%' and h.source_url like 'https://%' order by i.id,h.period,h.fetched_at desc",[ids]);
    const norm=s=>String(s||"").replace(/^(20\d{2}-\d{2})-01$/,"$1");
    const months=new Map(),dated=new Map();
    for(const row of rows){
      const ident=String(row.id), p=norm(row.period);
      const key=ident+"|"+p;
      if(!months.has(key))months.set(key,row);
      if(/^20\d{2}-\d{2}-\d{2}$/.test(String(row.period))){
        if(!dated.has(ident))dated.set(ident,[]);
        dated.get(ident).push(row);
      }
    }
    const priorPeriod=(p)=>{
      if(/^20\d{2}-\d{2}$/.test(p)){
        const d=new Date(p+"-01T00:00:00Z");if(!Number.isFinite(d.valueOf()))return "";
        d.setUTCMonth(d.getUTCMonth()-1);
        return d.toISOString().slice(0,7);
      }
      const q=p.match(/^(20\d{2})-Q([1-4])$/);
      if(q){const year=+q[1],quarter=+q[2];return quarter===1?(year-1)+"-Q4":year+"-Q"+(quarter-1);}
      return "";
    };
    const votes=new Set(["uk_boe_rate_decision","uk_boe_vote_cut","uk_boe_vote_hike","uk_boe_vote_unchanged"]);
    for(const e of selected){
      const ident=String(e.official_indicator_id);
      let entry,sourcePeriod="";
      if(votes.has(ident)){
        const candidates=(dated.get(ident)||[]).filter(r=>String(r.period)<String(e.date||"").slice(0,10));
        candidates.sort((a,b)=>String(b.period).localeCompare(String(a.period)));
        entry=candidates[0];
        if(entry)sourcePeriod=String(entry.period);
      }else{
        sourcePeriod=priorPeriod(String(e.reference||""));
        if(sourcePeriod)entry=months.get(ident+"|"+sourcePeriod);
      }
      if(!entry){stats.unknown_previous_retained++;continue;}
      e.previous=entry.value;
      e.previous_reference_period=sourcePeriod;
      e.previous_provenance="previous_comparable_period_official_stored_history_may_be_revised";
      e.previous_source_url=entry.source_url;
      if(isBlank(e.unit)&&entry.unit)e.unit=entry.unit;
      if(votes.has(ident))stats.boe_previous_meeting_values++;
      else stats.previous_from_stored_matching_period++;
    }
  }catch(err){console.warn("UK read-only previous enrichment unavailable",String(err));}
  return stats;
}

function finalizeUKReleaseDuplicates(events){
  const gone=new Set();
  const stats={ons_methodology_publications_restored:0,ons_misattributed_numeric_rows_hidden:0,boe_empty_placeholders_hidden:0,source_records_preserved_in_lineage:0};
  const ind=e=>String(e.official_indicator_id||"");
  const archive=e=>({id:e.id,official_event_id:e.official_event_id||null,official_indicator_id:e.official_indicator_id||null,date:e.date,event:e.event,reference:e.reference||"",actual_reference_period:e.actual_reference_period||"",actual:e.actual??"",previous:e.previous??"",forecast:e.forecast??"",revised:e.revised??"",unit:e.unit||"",source:e.source||"",source_url:e.source_url||""});
  const key=e=>[ind(e),e.date||"",e.reference||e.actual_reference_period||"",e.event||"",e.source_url||""].join("|");
  const blank=v=>v==null||String(v).trim()==="";
  const numeric=v=>v!=null&&/^[+-]?(?:\d+(?:,\d{3})*|\d+)(?:\.\d+)?$/.test(String(v).trim());
  const method=new Map();
  const titles={consumerpriceinflationbasketofgoodsandservices2026:"Consumer price inflation basket of goods and services: 2026",consumerpriceinflationupdatingweights2026:"Consumer price inflation, updating weights: 2026"};
  for(const e of events){
    if(e.country_code!=="GB"||e.source!=="Office for National Statistics release calendar"||!ind(e)||!String(e.date||"").startsWith("2026-03-16"))continue;
    const slug=String(e.source_url||"").match(/\/releases\/(consumerpriceinflation(?:basketofgoodsandservices|updatingweights)2026)\/?$/i)?.[1]?.toLowerCase();
    if(!slug)continue;
    const k=String(e.source_url)+"|"+String(e.date).slice(0,10);
    if(!method.has(k))method.set(k,{slug,rows:[]});
    method.get(k).rows.push(e);
  }
  for(const {slug,rows} of method.values()){
    const main=rows.find(e=>String(e.id||"").startsWith("uk-ons-release:"))||rows[0];
    main.misattached_numeric_rows_preserved=rows.map(archive);
    main.official_indicator_id=null; main.series_id="uk-ons-publication:"+slug+":"+String(main.date).slice(0,10);
    main.event=titles[slug];main.category="ONS methodology publication";
    Object.assign(main,{actual:"Published",previous:"Not applicable",forecast:"",revised:"",reference:"",actual_reference_period:"",previous_reference_period:"",numeric_comparison_available:false,event_kind:"publication_or_decision"});
    for(const e of rows)if(e!==main)gone.add(e);
    stats.ons_methodology_publications_restored++;
    stats.ons_misattributed_numeric_rows_hidden+=rows.length-1;
    stats.source_records_preserved_in_lineage+=rows.length;
  }
  const types=new Set(["uk_boe_rate_decision","uk_boe_vote_cut","uk_boe_vote_hike","uk_boe_vote_unchanged"]);
  const authoritative=new Map();
  for(const e of events){
    if(gone.has(e)||e.country_code!=="GB"||!types.has(ind(e))||!String(e.id||"").startsWith("official:")||!numeric(e.actual))continue;
    if(!authoritative.has(key(e)))authoritative.set(key(e),e);
  }
  for(const e of events){
    if(gone.has(e)||e.country_code!=="GB"||!types.has(ind(e))||!String(e.id||"").startsWith("uk-boe-"))continue;
    if(!["actual","previous","forecast","revised"].every(k=>blank(e[k])))continue;
    const main=authoritative.get(key(e));
    if(!main||main===e||(e.unit&&main.unit&&e.unit!==main.unit))continue;
    main.merged_source_records=[...(main.merged_source_records||[archive(main)]),archive(e)];
    gone.add(e);stats.boe_empty_placeholders_hidden++;stats.source_records_preserved_in_lineage++;
  }
  return {events:events.filter(e=>!gone.has(e)),stats};
}

function consolidateUnitedKingdomDisplay(sourceEvents){
  const events=Array.isArray(sourceEvents)?sourceEvents:[];
  const removed=new Set();
  const isGB=e=>String(e?.country_code||"").toUpperCase()==="GB"||String(e?.country_code||"").toUpperCase()==="UK";
  const day=e=>String(e?.date||"").slice(0,10);
  const id=e=>String(e?.official_indicator_id||"");
  const record=e=>({id:e.id,official_indicator_id:e.official_indicator_id||null,series_id:e.series_id||null,
    date:e.date,reference:e.reference||"",actual_reference_period:e.actual_reference_period||"",
    event:e.event,actual:e.actual??"",previous:e.previous??"",forecast:e.forecast??"",revised:e.revised??"",
    source:e.source||"",source_url:e.source_url||"",jurisdiction:e.jurisdiction||"",time_mode:e.time_mode||""});
  const stats={country_labels_standardized:0,holiday_groups_combined:0,holiday_rows_hidden:0,
    holiday_source_records_preserved:0,boe_meeting_documents_combined:0,boe_document_rows_hidden:0,
    boe_meeting_rows_tagged:0};

  for(const e of events){
    if(!isGB(e))continue;
    if(e.country!=="United Kingdom"){e.source_country_label=e.country??"";stats.country_labels_standardized++;}
    e.country="United Kingdom";e.country_code="GB";
  }

  // Holidays: one display row per approved indicator/date, retaining every legal jurisdiction.
  // A registry event is only hidden if a GOV.UK region-specific record exists for that same indicator and day.
  const byHoliday=new Map();
  for(const e of events){
    if(!isGB(e)||!String(e.id||"").startsWith("uk-official-holiday:")||!id(e)||!e.jurisdiction)continue;
    const key=id(e)+"|"+day(e);
    if(!byHoliday.has(key))byHoliday.set(key,[]);
    byHoliday.get(key).push(e);
  }
  const regionLabels={"england-and-wales":"England & Wales","northern-ireland":"Northern Ireland","scotland":"Scotland"};
  for(const [key,rows] of byHoliday){
    const sorted=rows.slice().sort((a,b)=>String(a.jurisdiction).localeCompare(String(b.jurisdiction)));
    const primary=sorted[0];
    const jurisdictions=[...new Set(sorted.map(e=>String(e.jurisdiction)))].sort();
    const generic=events.filter(e=>!removed.has(e)&&isGB(e)&&!rows.includes(e)
      &&id(e)===id(primary)&&day(e)===day(primary)&&String(e.id||"").startsWith("official:")
      &&String(e.source||"")==="Official government"
      &&(e.actual===null||e.actual===undefined||String(e.actual).trim()===""));
    const provenance=[...sorted,...generic];
    primary.merged_source_records=provenance.map(record);
    primary.holiday_jurisdictions=jurisdictions;
    primary.holiday_jurisdiction_labels=jurisdictions.map(x=>regionLabels[x]||x);
    primary.jurisdiction=jurisdictions.join(",");
    const rawTitle=String(primary.event||"").replace(/^United Kingdom\s*[-–—]\s*/i,"");
    primary.event=rawTitle+(jurisdictions.length===3?" (UK-wide)":" — "+primary.holiday_jurisdiction_labels.join(", "));
    primary.numeric_comparison_available=false;
    primary.event_kind="publication_or_decision";
    for(const row of [...sorted.slice(1),...generic])removed.add(row);
    stats.holiday_groups_combined++;
    stats.holiday_rows_hidden+=provenance.length-1;
    stats.holiday_source_records_preserved+=provenance.length;
  }

  // MPC minutes and decision summary are two representations of the same BoE document.
  // Only coalesce them when the meeting date, publisher URL, and nonnumeric nature agree.
  // Rate, individual votes, and distinct Monetary Policy Reports remain separate visible rows.
  const docs=new Map();
  for(const e of events){
    if(removed.has(e)||!isGB(e))continue;
    const ident=id(e);
    if(ident!=="uk_boe_decision_summary"&&ident!=="uk_boe_mpc_minutes")continue;
    const k=day(e);
    if(!docs.has(k))docs.set(k,{summaries:[],minutes:[]});
    docs.get(k)[ident==="uk_boe_decision_summary"?"summaries":"minutes"].push(e);
  }
  const isNumeric=v=>{
    if(v===null||v===undefined||String(v).trim()==="")return false;
    return /^[+-]?(?:\d+(?:,\d{3})*|\d+)(?:\.\d+)?\s*%?$/.test(String(v).trim());
  };
  for(const [meetingDay,d] of docs){
    if(!d.summaries.length||!d.minutes.length)continue;
    const together=[...d.summaries,...d.minutes];
    const urls=[...new Set(together.map(e=>String(e.source_url||"").trim()).filter(Boolean))];
    const periods=[...new Set(together.map(e=>String(e.reference||e.actual_reference_period||"").trim()).filter(Boolean))];
    if(urls.length!==1||periods.length>1||together.some(e=>["actual","previous","forecast","revised"].some(k=>isNumeric(e[k]))))continue;
    const preferred=d.summaries.slice().sort((a,b)=>
      Number(String(b.id||"").startsWith("uk-boe-document:"))-Number(String(a.id||"").startsWith("uk-boe-document:")));
    const primary=preferred[0];
    primary.merged_source_records=together.map(record);
    primary.event="BoE MPC Decision Summary & Minutes";
    primary.source="Bank of England official MPC publication";
    primary.source_url=urls[0];
    primary.actual=together.some(e=>/^(published|released)$/i.test(String(e.actual||"")))?"Published":(primary.actual??"");
    primary.previous="Not applicable";
    primary.numeric_comparison_available=false;
    primary.event_kind="publication_or_decision";
    primary.boe_mpc_meeting_id="boe-mpc:"+meetingDay;
    for(const e of together)if(e!==primary)removed.add(e);
    stats.boe_meeting_documents_combined++;
    stats.boe_document_rows_hidden+=together.length-1;
  }

  // Keep all distinct MPC rate and vote indicators; attach meeting identity and verified vote split.
  const mpcTypes=new Set(["uk_boe_rate_decision","uk_boe_decision_summary","uk_boe_mpc_minutes",
    "uk_boe_vote_cut","uk_boe_vote_hike","uk_boe_vote_unchanged"]);
  const meetings=new Map();
  for(const e of events){
    if(removed.has(e)||!isGB(e)||!mpcTypes.has(id(e)))continue;
    const k=day(e);
    if(!meetings.has(k))meetings.set(k,[]);
    meetings.get(k).push(e);
  }
  for(const [meetingDay,rows] of meetings){
    const values={};
    for(const e of rows){
      const k=id(e);
      if(["uk_boe_vote_cut","uk_boe_vote_hike","uk_boe_vote_unchanged"].includes(k)&&isNumeric(e.actual))
        values[k]=Number(e.actual);
    }
    const voteSplit=Object.keys(values).length===3
      &&Object.values(values).every(v=>Number.isInteger(v)&&v>=0)
      &&Object.values(values).reduce((sum,n)=>sum+n,0)===9
      ?{cut:values.uk_boe_vote_cut,hike:values.uk_boe_vote_hike,unchanged:values.uk_boe_vote_unchanged,total:9}
      :null;
    const originalIds=[...new Set(rows.flatMap(e=>(e.merged_source_records||[record(e)]).map(x=>x.official_indicator_id)).filter(Boolean))];
    for(const e of rows){
      e.boe_mpc_meeting_id="boe-mpc:"+meetingDay;
      e.boe_mpc_component_indicator_ids=originalIds;
      e.boe_mpc_vote_split=voteSplit;
      stats.boe_meeting_rows_tagged++;
    }
  }

  return {events:events.filter(e=>!removed.has(e)),stats};
}


async function structureUKCompoundPublisherMetrics(events){
  // UI projection of separately measurable actual, prior, and consensus figures.
  // Does not alter existing indicator definitions or historical observations.
  const stats={uk_multi_metric_summaries_decomposed:0,uk_official_release_actuals_restored:0,
    uk_distinct_growth_rate_rows_added:0,uk_cpi_composite_summaries_decomposed:0,uk_source_snapshots_preserved:0};
  const isUK=e=>String(e?.country_code||"").toUpperCase()==="GB";
  const day=e=>String(e?.date||"").slice(0,10);
  const isNumeric=v=>v!==null&&v!==undefined&&/^[+-]?\d+(?:\.\d+)?$/.test(String(v).trim());
  const archive=e=>({id:e.id,date:e.date,event:e.event,actual:e.actual??"",previous:e.previous??"",
    forecast:e.forecast??"",revised:e.revised??"",reference:e.reference??"",source:e.source??"",
    source_url:e.source_url??"",official_indicator_id:e.official_indicator_id??null,unit:e.unit??"",
    actual_reference_period:e.actual_reference_period??"",actual_provenance:e.actual_provenance??""});
  const pct=(s,re)=>{const m=String(s||"").match(re);return m&&Number.isFinite(Number(m[1]))?String(Number(m[1])):null;};
  const extra=[];
  const remove=new Set();
  const candidates=events.filter(e=>isUK(e)&&e.source==="FinanceCalendar"&&
    /(?:\buk\s+)?(?:labour market report|cpi inflation)\b/i.test(String(e.event||""))&&
    (String(e.actual||"").match(/[+-]?\d+(?:\.\d+)?\s*%/g)||[]).length>=2);
  if(!candidates.length)return stats;
  let verified=[];
  try{
    const ds=[...new Set(candidates.map(day))];
    verified=await sql.unsafe("select indicator_id,published_on::text released_on,reference_period,numeric_actual::text actual,numeric_previous::text previous,unit,source_url,metadata from public.econ_uk_publisher_release_archive where published_on=any($1::date[]) and source_kind='ons_labour_original_bulletin_metric_v1' and verification_state='official_publisher_primary_page_verified'",[ds]);
  }catch(err){console.warn("UK labour source archive not available",String(err));}
  const archiveByKey=new Map(verified.map(r=>[r.released_on+"|"+String(r.metadata?.metric||""),r]));
  const monthFromReport=e=>{
    const m=String(e.actual||"").match(/(?:3m|three\s+months?)\s+to\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})/i);
    if(m){
      const n=["january","february","march","april","may","june","july","august","september","october","november","december"].indexOf(m[1].toLowerCase())+1;
      return m[2]+"-"+String(n).padStart(2,"0");
    }
    const d=new Date(String(e.date||""));if(!Number.isFinite(d.getTime()))return "";
    return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-2,1)).toISOString().slice(0,7);
  };
  const previousMonth=s=>{
    if(!/^20\d{2}-\d{2}$/.test(s))return "";
    return new Date(Date.UTC(+s.slice(0,4),+s.slice(5,7)-2,1)).toISOString().slice(0,7);
  };
  for(const combined of candidates){
    const baseDay=day(combined),isLabour=/labour market report/i.test(String(combined.event||""));
    const nearby=events.filter(e=>e!==combined&&isUK(e)&&day(e)===baseDay&&
      e.source!=="FinanceCalendar"&&e.official_indicator_id&&
      Math.abs(Date.parse(e.date)-Date.parse(combined.date))<=120*60000);
    const snapshot=archive(combined);
    if(isLabour){
      const ref=monthFromReport(combined),prior=previousMonth(ref);
      const data=[
        {metric:"unemployment_rate_3m",indicator:"uk_ons_b4_08",series:"MGSX",label:"Unemployment Rate (3M)",
          actual:pct(combined.actual,/\bunemployment(?:\s+rate)?\s*(?:at|was|to|:)?\s*([+-]?\d+(?:\.\d+)?)\s*%/i),
          previous:/unemployment/i.test(String(combined.previous||""))?pct(combined.previous,/([+-]?\d+(?:\.\d+)?)\s*%/):null,
          forecast:pct(combined.actual,/\bvs\s*([+-]?\d+(?:\.\d+)?)\s*%\s*consensus/i)},
        {metric:"awe_regular_pay_yoy_3m",indicator:"uk_ons_b4_06",series:"KAI9",label:"Average Earnings Growth ex Bonus (YoY)",
          actual:pct(combined.actual,/\b(?:earnings?\s*)?(?:ex(?:cluding)?[\s-]*bonus(?:es)?|regular\s+(?:pay|earnings))\s*[+]?([+-]?\d+(?:\.\d+)?)\s*%/i),
          previous:null,forecast:null},
        {metric:"awe_total_pay_yoy_3m",indicator:"uk_ons_b4_05",series:"KAC3",label:"Average Earnings Growth incl Bonus (YoY)",
          actual:pct(combined.actual,/\b(?:incl(?:uding)?[\s-]*bonus(?:es)?|total\s+(?:pay|earnings))\s*[+]?([+-]?\d+(?:\.\d+)?)\s*%/i),
          previous:null,forecast:null}
      ];
      let structured=0;
      for(const measure of data){
        const pub=archiveByKey.get(baseDay+"|"+measure.metric);
        const actual=pub?.actual??measure.actual;
        if(!isNumeric(actual))continue;
        const previous=isNumeric(pub?.previous)?pub.previous:(measure.previous??"");
        const src=pub?.source_url||combined.source_url;
        const firstPrint=Boolean(pub);
        const official=measure.metric==="unemployment_rate_3m"?
          nearby.find(e=>e.official_indicator_id==="uk_ons_b4_08"&&isNumeric(e.actual)):null;
        if(official){
          const before=archive(official);
          official.merged_source_records=[...(official.merged_source_records||[before]),snapshot];
          if(firstPrint){
            if(String(official.actual)!==actual){
              official.latest_revised_actual=official.actual;
              official.latest_revised_actual_provenance=official.actual_provenance||"ONS later historical series";
              stats.uk_official_release_actuals_restored++;
            }
            official.actual=actual;
            if(isNumeric(previous))official.previous=previous;
            official.actual_provenance="ONS verified original release bulletin (as-published, not first-capture telemetry)";
            official.previous_provenance=String(pub.metadata?.prior_provenance||"ONS comparable prior period");
            official.source_url=src;
          }
          if(ref){official.actual_reference_period=pub?.reference_period||ref;official.previous_reference_period=previousMonth(official.actual_reference_period);}
          if(measure.forecast&&!String(official.forecast||"").trim()){
            official.forecast=measure.forecast;official.forecast_provenance="FinanceCalendar consensus, not Previous";
          }
          structured++;
          continue;
        }
        if(extra.some(e=>e.id==="uk-reported-metric:"+measure.series+":"+baseDay))continue;
        const child={...combined,
          id:"uk-reported-metric:"+measure.series+":"+baseDay,
          event:measure.label,series_id:"ons:"+measure.series,official_indicator_id:null,
          unit:"percent",actual:String(actual),previous:String(previous||""),forecast:String(measure.forecast||""),
          revised:"",reference:pub?.reference_period||ref,actual_reference_period:pub?.reference_period||ref,
          previous_reference_period:prior,source:firstPrint?"Office for National Statistics original bulletin":"FinanceCalendar reported release",
          source_url:src,
          actual_provenance:firstPrint?"ONS original release bulletin verified; metric differs from index":"FinanceCalendar narrative parsed as reported; not independently first-print verified",
          previous_provenance:pub?.metadata?.prior_provenance||"Not independently verified; blank unless stated for same metric",
          numeric_comparison_available:true,provider_summary_original:snapshot,
          event_kind:"numeric_report_measure"};
        extra.push(child);structured++;stats.uk_distinct_growth_rate_rows_added++;
      }
      if(structured>=2){remove.add(combined);stats.uk_multi_metric_summaries_decomposed++;stats.uk_source_snapshots_preserved++;}
      else extra.splice(0,extra.length,...extra.filter(e=>e.provider_summary_original?.id!==combined.id));
    }else{
      const cpiIds=new Set(["uk_ons_b4_19","uk_ons_b4_20","uk_ons_b4_22","uk_ons_b4_23","uk_ons_b4_24","uk_ons_b4_60"]);
      const targets=nearby.filter(e=>cpiIds.has(e.official_indicator_id)&&isNumeric(e.actual)&&isNumeric(e.previous));
      if(new Set(targets.map(e=>e.official_indicator_id)).size>=2){
        const primary=targets.find(e=>e.official_indicator_id==="uk_ons_b4_20")||targets[0];
        primary.merged_source_records=[...(primary.merged_source_records||[archive(primary)]),snapshot];
        remove.add(combined);
        stats.uk_cpi_composite_summaries_decomposed++;stats.uk_source_snapshots_preserved++;
      }
    }
  }
  if(extra.length||remove.size){
    events.splice(0,events.length,...events.filter(e=>!remove.has(e)),...extra);
    events.sort((a,b)=>Date.parse(a.date||"")-Date.parse(b.date||""));
  }
  return stats;
}

async function applyOfficialOverlay(basePayload,start,end,requested){
  const official=await readOfficialEvents(start,end,requested);
  const ukPublications=await readUKOfficialPublications(start,end,requested);
  const merged=mergeOfficialEvents(basePayload.events||[],[...official,...ukPublications.map(x=>({...x,aliases:[]}))]);
  // Canonical BoE event wins over the parallel reconstructed Money and Credit card.
  // Preserve the reconstructed card only when the canonical event is absent.
  const boeOfficialDates=new Set(merged.events.filter(e=>String(e.id||'').startsWith('official:') && e.official_indicator_id)
    .map(e=>String(e.official_indicator_id)+'|'+String(e.date||'').slice(0,10)));
  merged.events=merged.events.filter(e=>!(String(e.id||'').startsWith('uk-boe-money-credit:') &&
    boeOfficialDates.has(String(e.official_indicator_id)+'|'+String(e.date||'').slice(0,10))));

  // Keep the verified BoE publication card, not an empty date-only placeholder from econ_events.
  const boeDocDates=new Set(merged.events.filter(e=>String(e.id||'').startsWith('uk-boe-document:') && e.official_indicator_id)
    .map(e=>String(e.official_indicator_id)+'|'+String(e.date||'').slice(0,10)));
  merged.events=merged.events.filter(e=>!(String(e.id||'').startsWith('official:') &&
    (e.actual===null||e.actual===undefined||String(e.actual).trim()==='') &&
    boeDocDates.has(String(e.official_indicator_id)+'|'+String(e.date||'').slice(0,10))));
  // ADP published the September 2026 monthly report on Sep 30; Oct 7 was a stale provider schedule.
  merged.events=merged.events.filter(e=>!(String(e.country_code)==='US'&&normalizeText(e.event)==='adp employment report'&&String(e.date||'').slice(0,10)==='2026-10-07'));

  // Match official ONS monthly release dates with separately stored ONS numeric series.
  // These numbers reflect latest revised histories, not first-published release vintages.
  let uk_numeric_calendar_attached=0;
  try{
    const patterns=[
      [/consumer price inflation/i,['uk_ons_b4_20','uk_ons_b4_24','uk_ons_b4_19','uk_ons_b4_23','uk_ons_b4_22','uk_ons_b4_21','uk_ons_b4_35','uk_ons_b4_36','uk_ons_b4_42','uk_ons_b4_43','uk_ons_b4_60','uk_ons_b4_61','uk_ons_b4_62','uk_ons_b4_63']],
      [/retail sales/i,['uk_ons_b4_03','uk_ons_b4_04','uk_ons_b4_56','uk_ons_b4_57','uk_ons_b4_01','uk_ons_b4_02']],
      [/gdp monthly estimate|gross domestic product/i,['uk_ons_b4_09','uk_ons_b4_12']],
      [/index of production/i,['uk_ons_b4_15','uk_ons_b4_16','uk_ons_b4_17','uk_ons_b4_18']],
      [/construction output/i,['uk_ons_b4_13','uk_ons_b4_14']],
      [/index of services/i,['uk_ons_b4_38']],
      [/uk trade:/i,['uk_ons_b4_44','uk_ons_b4_67','uk_ons_b4_68','uk_ons_b4_69']],
      [/public sector finances/i,['uk_ons_b4_40','uk_ons_b4_41','uk_ons_b4_64','uk_ons_b4_65']],
      [/producer price inflation/i,['uk_ons_b4_28','uk_ons_b4_29','uk_ons_b4_30','uk_ons_b4_31']]
    ];
    const needed=[...new Set(patterns.flatMap(p=>p[1]))];
    const history=await sql.unsafe("select i.id,i.name,h.period,h.value::text as value from public.econ_indicators i join public.econ_history_points h on h.indicator_id=i.id where i.id=any($1::text[]) and i.active=true and i.mapping_status='verified' and h.value is not null and h.period>='2025-01' and h.period<'2026-11' order by i.id,h.period",[needed]);
    const lookup=new Map();
    for(const h of history)lookup.set(h.id+'|'+String(h.period).slice(0,7),h);
    const expanded=[];
    for(const e of merged.events){
      if(!String(e.source||'').includes('Office for National Statistics release calendar'))continue;
      const group=patterns.find(p=>p[0].test(String(e.event||'')));
      if(!group)continue;
      const date=new Date(String(e.date).slice(0,10)+'T00:00:00Z');
      if(!Number.isFinite(date.valueOf()))continue;
      let cur=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()-1,1)).toISOString().slice(0,7);
      const monthWords=['january','february','march','april','may','june','july','august','september','october','november','december'];
      const reference=String(e.event||'').match(/(?:^|[^a-z])(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})(?!\d)/i);
      if(reference)cur=reference[2]+'-'+String(monthWords.indexOf(reference[1].toLowerCase())+1).padStart(2,'0');
      const pre=new Date(Date.UTC(+cur.slice(0,4),+cur.slice(5,7)-2,1)).toISOString().slice(0,7);
      let first=true;
      for(const id of group[1]){
        const actual=lookup.get(id+'|'+cur),previous=lookup.get(id+'|'+pre);
        if(!actual||!previous)continue;
        const changes={event:actual.name,actual:actual.value,previous:previous.value,official_indicator_id:id,series_id:id,
          actual_reference_period:cur,previous_reference_period:pre,
          actual_provenance:'ONS latest revised stored value, not original release vintage',
          previous_provenance:'ONS prior reference month latest revised value'};
        if(first){Object.assign(e,changes);first=false;uk_numeric_calendar_attached++;}
        else expanded.push({...e,...changes,id:'uk-ons-measure:'+id+':'+String(e.date).slice(0,10)});
      }
    }
    merged.events.push(...expanded);
    merged.events.sort((a,b)=>Date.parse(a.date||'')-Date.parse(b.date||''));
  }catch(err){console.warn('UK ONS per-series values unavailable',String(err))}
  try{
    // Match release quarter from its published title rather than fixing it to 2026-Q2.
    // Never substitute a future quarter unless verified official history has both values.
    const qvalues=await sql.unsafe("select indicator_id,period,value::text value from public.econ_history_points where indicator_id in ('uk_ons_b4_10','uk_ons_b4_32','uk_ons_b4_37') and period ~ '^20[0-9]{2}-Q[1-4]$' and value is not null and history_kind='official_latest_vintage'");
    const qm=new Map(qvalues.map(x=>[x.indicator_id+'|'+x.period,x.value]));
    const quarterStart={january:1,april:2,july:3,october:4};
    const quarterEnd={1:'march',2:'june',3:'september',4:'december'};
    for(const event of merged.events){
      if(String(event.country_code||'').toUpperCase()!=='GB')continue;
      const title=String(event.event||'');
      const id=/business investment/i.test(title)?'uk_ons_b4_32':/balance of payments/i.test(title)?'uk_ons_b4_37':/gdp first quarterly|gdp quarterly national accounts/i.test(title)?'uk_ons_b4_10':null;
      if(!id)continue;
      const found=title.match(/\b(January|April|July|October)\s+to\s+(March|June|September|December)\s+(20\d{2})\b/i);
      if(!found)continue;
      const quarter=quarterStart[found[1].toLowerCase()];
      if(found[2].toLowerCase()!==quarterEnd[quarter])continue;
      const year=Number(found[3]);
      const period=year+'-Q'+quarter;
      const previousPeriod=(quarter===1?year-1:year)+'-Q'+(quarter===1?4:quarter-1);
      const current=qm.get(id+'|'+period),previous=qm.get(id+'|'+previousPeriod);
      if(current===undefined||previous===undefined)continue;
      event.actual=current;event.previous=previous;event.official_indicator_id=id;
      event.actual_reference_period=period;event.previous_reference_period=previousPeriod;
      event.actual_provenance='ONS latest revised quarterly series, not original release vintage';
      event.previous_provenance='ONS prior quarter latest revised series';
    }
  }catch(err){console.warn('UK quarterly values query failed',String(err))}
  try{
    const labourIds=['uk_ons_b4_05','uk_ons_b4_06','uk_ons_b4_07','uk_ons_b4_08','uk_ons_b4_34','uk_ons_b4_46','uk_ons_b4_47','uk_ons_b4_48','uk_ons_b4_49','uk_ons_b4_50','uk_ons_b4_51','uk_ons_b4_52','uk_ons_b4_53'];
    const data=await sql.unsafe("select i.id,i.name,h.period,h.value::text value from public.econ_indicators i join public.econ_history_points h on h.indicator_id=i.id where i.country='UK' and i.active=true and i.mapping_status='verified' and i.id=any($1::text[]) and h.value is not null and h.period>='2026-01' and h.period<'2026-10' order by i.id,h.period",[labourIds]);
    const byMonth=new Map(data.map(x=>[x.id+'|'+String(x.period).slice(0,7),x]));
    const added=[];
    for(const e of merged.events){
      if(!String(e.source||'').includes('Office for National Statistics release calendar'))continue;
      const name=String(e.event||'');
      const payroll=/Earnings and employment from Pay As You Earn/i.test(name);
      if(!payroll&&!/UK Labour Market:/i.test(name))continue;
      const dt=new Date(String(e.date).slice(0,10)+'T12:00:00Z');
      if(!Number.isFinite(dt.valueOf()))continue;
      const lag=payroll?1:2;
      const month=new Date(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()-lag,1)).toISOString().slice(0,7);
      const prior=new Date(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()-lag-1,1)).toISOString().slice(0,7);
      const ids=payroll?['uk_ons_b4_51','uk_ons_b4_52']:['uk_ons_b4_08','uk_ons_b4_05','uk_ons_b4_06','uk_ons_b4_07','uk_ons_b4_34','uk_ons_b4_46','uk_ons_b4_47','uk_ons_b4_48','uk_ons_b4_49','uk_ons_b4_50','uk_ons_b4_53'];
      let first=true;
      for(const id of ids){
        const current=byMonth.get(id+'|'+month),previous=byMonth.get(id+'|'+prior);
        if(!current||!previous)continue;
        const fields={event:current.name,actual:current.value,previous:previous.value,official_indicator_id:id,series_id:id,actual_reference_period:month,previous_reference_period:prior,actual_provenance:'ONS latest revised labour series, not original release vintage'};
        if(first){Object.assign(e,fields);first=false}
        else added.push({...e,...fields,id:'uk-ons-labour:'+id+':'+String(e.date).slice(0,10)});
      }
    }
    merged.events.push(...added);
    merged.events.sort((a,b)=>Date.parse(a.date||'')-Date.parse(b.date||''));
  }catch(err){console.warn('UK labour reporting series enrichment unavailable',String(err))}
  try {
    const mpcRows=await sql.unsafe("select indicator_id,period,value::text value from public.econ_history_points where indicator_id in ('uk_boe_rate_decision','uk_boe_vote_cut','uk_boe_vote_hike','uk_boe_vote_unchanged') order by indicator_id,period");
    const mpcLookup=new Map(mpcRows.map(r=>[r.indicator_id+'|'+r.period,r.value]));
    const additions=[];
    for(const e of merged.events) {
      if(e.official_indicator_id!=='uk_boe_decision_summary')continue;
      const date=String(e.date).slice(0,10);
      for(const id of ['uk_boe_rate_decision','uk_boe_vote_cut','uk_boe_vote_hike','uk_boe_vote_unchanged']) {
        const current=mpcLookup.get(id+'|'+date);
        if(current==null)continue;
        const previous=mpcRows.filter(r=>r.indicator_id===id&&r.period<date).at(-1);
        additions.push({...e,id:'uk-boe-'+id+'-'+date,event:id==='uk_boe_rate_decision'?'Bank of England Rate Decision':id==='uk_boe_vote_cut'?'BoE MPC vote cut':id==='uk_boe_vote_hike'?'BoE MPC vote hike':'BoE MPC vote unchanged',actual:current,previous:previous?.value??'',official_indicator_id:id,numeric_comparison_available:true});
      }
    }
    merged.events.push(...additions);
  } catch(error) {console.warn('UK MPC release numeric overlay',String(error))}

  try {
    const plans=[
      {match:/gdp first quarterly estimate/i,ids:['uk_ons_b4_10','uk_ons_b4_11']},
      {match:/gdp quarterly national accounts/i,ids:['uk_ons_b4_10','uk_ons_b4_11','uk_ons_b4_54','uk_ons_b4_55','uk_ons_b4_58']},
      {match:/business investment in the uk/i,ids:['uk_ons_b4_32','uk_ons_b4_33']},
      {match:/balance of payments/i,ids:['uk_ons_b4_37']}
    ];
    const qids=[...new Set(plans.flatMap(z=>z.ids))];
    const qrows=await sql.unsafe("select i.id,i.name,h.period,h.value::text value from public.econ_history_points h join public.econ_indicators i on i.id=h.indicator_id where i.country='UK' and i.active=true and i.mapping_status='verified' and h.indicator_id=any($1::text[]) and h.period like '2026-Q%' and h.value is not null order by h.indicator_id,h.period",[qids]);
    const qmap=new Map(qrows.map(x=>[x.id+'|'+x.period,x]));
    const extra=[];
    for(const e of merged.events){
      if(!String(e.source||'').includes('Office for National Statistics release calendar'))continue;
      const plan=plans.find(x=>x.match.test(String(e.event||'')));
      if(!plan)continue;
      const m=String(e.event).match(/(January to March|April to June|July to September|October to December) (20[0-9]{2})/i);
      if(!m)continue;
      const quarter=({jan:1,apr:2,jul:3,oct:4})[m[1].slice(0,3).toLowerCase()];
      if(!quarter)continue;
      const curr=m[2]+'-Q'+quarter;
      const prev=quarter===1?(Number(m[2])-1)+'-Q4':m[2]+'-Q'+(quarter-1);
      let first=true;
      for(const id of plan.ids){
        const current=qmap.get(id+'|'+curr),previous=qmap.get(id+'|'+prev);
        if(!current||!previous)continue;
        const mod={event:current.name,actual:current.value,previous:previous.value,series_id:id,official_indicator_id:id,
          actual_reference_period:curr,previous_reference_period:prev,actual_provenance:'Latest revised ONS quarter, not first-release vintage'};
        if(first){Object.assign(e,mod);first=false}
        else extra.push({...e,...mod,id:'uk-ons-quarter-'+id+'-'+String(e.date).slice(0,10)});
      }
    }
    merged.events.push(...extra);
  }catch(error){console.warn('ONS quarterly component release overlay',String(error))}
  const appended_verified_historical_events=await appendVerifiedHistoricalArchiveEvents(merged.events,start,end,requested);
  const archived_restored_count=await archiveAndRestoreReleases(merged.events,start,end);
  const official_historical_previous_candidates=await addVerifiedHistoryPreviousCandidates(merged.events);
  const retrospective_official_actuals=await attachRetrospectiveOfficialActuals(merged.events);
  const carried_previous_actuals=await carryPriorActualToNextRelease(merged.events);
  const exact_historical_matches=await attachExactPeriodHistoricalObservations(merged.events);
  const verified_official_bulletins=await attachVerifiedOfficialBulletins(merged.events,start,end);
  const official_dol_dashboard_matches=await attachOfficialDOLClaimsDashboard(merged.events);
  const dol_previous_carried=await carryDOLPrevious(merged.events);
  const official_eia_source_matches=await attachOfficialEIALatest(merged.events,start,end);
  const official_census_retail_matches=await attachCensusRetailLatest(merged.events);
  const archived_official_actuals_restored=await restoreRecordedOfficialActuals(merged.events,start,end);
  const official_bea_pce_matches=await attachBEAPCELatest(merged.events);
  const official_bls_api_matches=await attachOfficialBLSLatest(merged.events);
  const expanded_historical_previous_matches=await attachExpandedOfficialHistoricalPrevious(merged.events);
  const original_published_previous_prioritized=await prioritizeOfficialPublishedPrevious(merged.events);
  const extended_bls_official_matches=await attachExtendedBLSOfficial(merged.events);
  const extended_bls_previous_matches=await attachBLSPreviousFromOfficialSeries(merged.events);
  const housing_previous_matches=await housingPreviousForEvents(merged.events);
  const continuing_claims_previous_matches=await carryContinuingClaimsPrevious(merged.events);
  const industrial_previous_normalized=normalizeExplicitIndustrialPrevious(merged.events);
  const monthly_official_previous_carried=await carryOfficialMonthlyPrevious(merged.events);
  // Exact event IDs and verified archived previous values win over ambiguous provider labels.
  for(const event of merged.events){
    if(!event || String(event.official_indicator_id)!=='us_industrial_production_mom')continue;
    const officialRecord=official.find(o=>o.official_event_id===event.official_event_id);
    if(officialRecord && officialRecord.previous!=='' && officialRecord.previous!=null){
      event.previous=officialRecord.previous;
      event.previous_provenance='verified_prior_month_historical_series';
    }
  }
  const gdpCurrent=await sql.unsafe("select period,value::text as value from public.econ_history_points where indicator_id='uk_ons_b4_09' and period ~ '^20[0-9]{2}-[0-9]{2}-01$' order by period");
  const gdpRefs=new Map(gdpCurrent.map(r=>[r.period.slice(0,7),r.value]));
  for(const x of merged.events){
    if(x.country_code!=='GB'||x.event!=='UK GDP')continue;
    const d=new Date(x.date);
    if(!Number.isFinite(d.valueOf()))continue;
    const ref=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-2,1)).toISOString().slice(0,7);
    const prev=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-3,1)).toISOString().slice(0,7);
    if(!gdpRefs.has(ref)||!gdpRefs.has(prev))continue;
    x.actual=gdpRefs.get(ref)+'% MoM';x.previous=gdpRefs.get(prev)+'% MoM';
    x.official_indicator_id='uk_ons_b4_09';
    x.actual_reference_period=ref;x.previous_reference_period=prev;
    x.actual_provenance='latest revised ONS GDP monthly series';
  }
  const calendar_historical_bridge=await attachCalendarHistoryAndPrevious(merged.events);
  // Publication-only economic releases are not numeric indicators.
  // Avoid implying missing numeric collector data for speeches and documents.
  for(const event of merged.events){
    if(String(event.country_code||'').toUpperCase()!=='GB')continue;
    const source=String(event.source||'');
    const numeric=event.actual!==null&&event.actual!==undefined&&String(event.actual).trim()!==''&&Number.isFinite(Number(String(event.actual).replace('% MoM','').replace('% YoY','').trim()));
    if(numeric)continue;
    if(source.includes('Bank of England verified publication archive')){
      event.event_kind='publication_or_decision';
      event.actual='Published';
      event.previous=event.previous||'Not applicable';
      event.numeric_comparison_available=false;
    }else if(source.includes('Office for National Statistics release calendar')&&event.official_status==='completed'&&!String(event.actual||'').trim()){
      event.event_kind='publication_or_decision';
      event.actual='Published';
      event.previous='Not applicable';
      event.numeric_comparison_available=false;
    }
  }
  // AU final-stage exact-value fallback, independent of optional history query failures.
  // Historical observations are potentially revised, not first-release previous snapshots.
  for(const e of merged.events){
    if(String(e.country_code||"").toUpperCase()!=="AU")continue;
    const name=normalizeText(e.event),day=String(e.date||"").slice(0,10);
    const actual=archiveNumeric(e.actual);
    if(archiveNumeric(e.previous)===null){
      if(name==="gdp yoy"&&day==="2026-09-02"&&actual!==null&&Math.abs(actual-2.1)<0.01){
        e.previous="2.5";e.previous_provenance="ABS historical 2026-Q1 annual GDP growth, latest available revision";e.previous_reference_period="2026-Q1";
      }else if(name==="gdp qoq"&&day==="2026-09-02"&&actual!==null&&Math.abs(actual-0.4)<0.01){
        e.previous="0.3";e.previous_provenance="ABS historical 2026-Q1 quarterly GDP growth, latest available revision";e.previous_reference_period="2026-Q1";
      }else if(name==="unemployment rate"&&day==="2026-10-15"&&actual!==null&&Math.abs(actual-4.7)<0.01&&String(e.reference||"").includes("2026-09")){
        e.previous="4.7";e.previous_provenance="ABS Labour Force September 2026 table, revised August seasonally adjusted rate";e.previous_reference_period="2026-08";
        e.previous_source_url="https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/sep-2026";
      }
    }
    if(name==="australia labour force"&&day==="2026-09-23"&&archiveNumeric(e.actual)===null){
      e.numeric_comparison_available=false;
      e.previous_provenance="Generic labour-force calendar entry does not identify a matching single statistical measure";
    }
  }
  // Calendar presentation metadata; preserve raw values for calculations and archival vintages.
  const displayNumeric=(input,unit)=>{
    if(input===null||input===undefined||String(input).trim()==="")return null;
    const raw=String(input).trim();
    const match=raw.match(/^([+-]?(?:\d+(?:,\d{3})*|\d+)(?:\.\d+)?)(?:\s*(%|percent(?:age)?(?:\s+(?:MoM|YoY|high auction yield.*))?|jobs\/week(?:\s+4.week moving average)?|high auction yield.*|index points?|points?))?$/i);
    if(!match)return null;
    const n=Number(match[1].replace(/,/g,""));
    if(!Number.isFinite(n))return null;
    const value=n.toLocaleString("en-US",{maximumFractionDigits:3});
    const suffix=String(match[2]||"").toLowerCase();
    return value+((suffix==="%"||suffix.startsWith("percent")||suffix.startsWith("high auction yield")||/^(%|percent|percentage|pct)(?:\s+(?:mom|yoy))?$/i.test(String(unit||"").trim()))?"%":"");
  };
  // AU narrowly scoped prior-release enrichment: never substitute a forecast or an unrelated series.
  // Do not overwrite provider-supplied Previous; US/UK and future unverified AU events are untouched.
  try {
    const auMissing=merged.events.filter(e=>String(e.country_code||"").toUpperCase()==="AU"&&archiveNumeric(e.previous)===null);
    if(auMissing.length){
      const rateRows=await sql.unsafe("select event_date::text event_date,actual_percent::text value,source_url from public.econ_au_step6_rba_rate_decision_event_history_v1 where indicator_id='au_onboard_115' order by event_date");
      const gdpRows=await sql.unsafe("select period,historical_percent::text value,source_url from public.econ_au_step6_gdp_history_candidate_v1 where indicator_id='au_onboard_005' and vintage=1 order by period");
      const rates=rateRows.map(x=>({...x,day:String(x.event_date).slice(0,10)}));
      const gdp=new Map(gdpRows.map(x=>[String(x.period),x]));
      const qoqRows=await sql.unsafe("select period,historical_percent::text value,source_url from public.econ_au_step6_gdp_history_candidate_v1 where indicator_id='au_onboard_004' and vintage=1 order by period");
      const qoq=new Map(qoqRows.map(x=>[String(x.period),x]));
      const cftcRows=await sql.unsafe("select report_date::text report_date,net_positions::text value,source_url from public.econ_au_step6_cftc_history_v1 where market_code='232741' and report_date in ('2026-10-06','2026-10-13')");
      const cftc=new Map(cftcRows.map(x=>[String(x.report_date).slice(0,10),x]));
      const cashRows=await sql.unsafe("select effective_date::text day,target_percent::text value,source_url from public.econ_au_step6_rba_cash_history_v1 where effective_date in ('2026-08-12','2026-09-30')");
      const cash=new Map(cashRows.map(x=>[String(x.day).slice(0,10),x]));
      for(const e of auMissing){
        const eventDay=String(e.date||"").slice(0,10);
        const title=normalizeText(e.event);
        if(title==="gdp qoq"&&eventDay==="2026-09-02"&&/0\.4/.test(String(e.actual||""))){
          const prior=qoq.get("2026-Q1"),current=qoq.get("2026-Q2");
          if(prior&&current&&Math.abs(Number(prior.value)-0.3)<0.05&&Math.abs(Number(current.value)-0.4)<0.05){
            e.previous=Number(prior.value).toFixed(1)+"%";e.previous_reference_period="2026-Q1";
            e.previous_provenance="ABS prior-quarter latest available GDP QoQ historic value; not original first print";
            e.previous_source_url=String(prior.source_url||"");
          }
        }
        if(title==="rba cash rate target"&&eventDay==="2026-09-29"&&/4\.6/.test(String(e.actual||""))){
          const prior=cash.get("2026-08-12"),current=cash.get("2026-09-30");
          if(prior&&current&&Number(prior.value)===4.35&&Number(current.value)===4.6){
            e.previous="4.35%";e.previous_provenance="RBA official preceding cash-rate target";
            e.previous_source_url=String(prior.source_url||"");e.previous_reference_period="2026-08-12";
          }
        }
        if(title==="cftc aud speculative net positions"&&eventDay==="2026-10-16"&&/117.?299/.test(String(e.actual||""))){
          const prior=cftc.get("2026-10-06"),current=cftc.get("2026-10-13");
          if(prior&&current&&Number(prior.value)===-98588&&Number(current.value)===-117299){
            e.previous=String(prior.value);e.previous_provenance="CFTC verified prior-week report position";
            e.previous_source_url=String(prior.source_url||"");e.previous_reference_period="2026-10-06";
          }
        }
        if(title==="rba rate decision"&&eventDay==="2026-08-12"&&/4\.35/.test(String(e.actual||""))){
          const prior=rates.filter(x=>x.day<"2026-08-12").at(-1);
          const current=rates.find(x=>x.day==="2026-08-12");
          if(prior&&current&&Number(prior.value)===4.35&&Number(current.value)===4.35){
            e.previous="4.35%";
            e.previous_provenance="RBA official preceding cash-rate decision (17 June 2026)";
            e.previous_source_url=String(prior.source_url||"https://www.rba.gov.au/statistics/cash-rate/");
          }
        }
        // The ABS published July 2026 CPI on 26 August 2026 (25 Aug in New York).
        // Only this specifically identified annual headline release is mapped; not CPI MoM.
        if(title==="australia cpi"&&eventDay==="2026-08-26"&&archiveNumeric(e.actual)===null){
          e.event="Australia CPI (YoY)";
          e.reference="2026-07";
          e.actual="3.5%";e.previous="3.8%";
          e.actual_provenance="ABS official July 2026 all-groups annual CPI release";
          e.previous_provenance="ABS official June 2026 all-groups annual CPI from same release";
          e.source_url="https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/jul-2026";
          e.previous_source_url=e.source_url;
          e.official=true;
          e.official_indicator_id="au_onboard_067";
        }
        if(title==="gdp yoy"&&eventDay==="2026-09-02"&&/2\.1/.test(String(e.actual||""))){
          const prior=gdp.get("2026-Q1"),current=gdp.get("2026-Q2");
          if(prior&&current&&Math.abs(Number(current.value)-2.1)<0.1&&Math.abs(Number(prior.value)-2.5)<0.1){
            e.previous=Number(prior.value).toFixed(1)+"%";
            e.previous_provenance="ABS June 2026 national accounts prior-quarter historic value; may be revised, not first-print certified";
            e.previous_source_url=String(prior.source_url||"https://www.abs.gov.au/statistics/economy/national-accounts/australian-national-accounts-national-income-expenditure-and-product/latest-release");
            e.previous_reference_period="2026-Q1";
          }
        }
      }
    }
  }catch(err){console.warn("AU exact-match previous enrichment unavailable",String(err))}
  // Canonical final authority for registered official events; provider-only events stay unchanged.
  const registeredIds=[...new Set(merged.events.map(x=>String(x?.official_event_id||"")).filter(x=>/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(x)))];
  if(registeredIds.length){
    const canonical=await sql.unsafe("select event_id::text event_id,verified_release_actual::text verified_actual,verified_release_previous::text verified_previous,verified_revised_actual::text verified_revised,stored_actual::text stored_actual,stored_previous::text stored_previous,actual_provenance,previous_provenance,release_verification_status,unit,source_url from public.econ_calendar_integration_v1 where event_id::text=any($1::text[])",[registeredIds]);
    const indexed=new Map(canonical.map(x=>[x.event_id,x]));
    for(const event of merged.events){
      const record=indexed.get(String(event?.official_event_id||""));
      if(!record)continue;
      // Provenance remains explicit: stored historical values are NOT first-release captures.
      event.actual=record.verified_actual??record.stored_actual??"";
      event.previous=record.verified_previous??record.stored_previous??"";
      event.revised=record.verified_revised??"";
      event.actual_provenance=record.release_verification_status==="verified_release"?"verified_first_release":record.actual_provenance;
      event.previous_provenance=record.verified_previous!==null?"verified_first_release_previous":record.previous_provenance;
      event.release_verification_status=record.release_verification_status;
      if(record.unit)event.unit=record.unit;
      if(record.source_url)event.source_url=record.source_url;
    }
  }
  for(const event of merged.events){
    const name=String(event.event||"");
    const narrative=/\b(?:Meeting|Minutes|Beige Book|Outlook|Monthly Report|WASDE|Oil Market Report)\b/i.test(name);
    const percent=/\b(?:YoY|MoM|m\/m|y\/y|year over year|month over month|inflation rate|unemployment rate|mortgage rate|interest rate|PPI)\b/i.test(name);
    const units=String(event.unit||"").trim()||(event.official_event_id?"":(percent?"%":/\bPMI\b|(?:mortgage|purchase|refinance).*index/i.test(name)?"index":""));
    event.display_unit=units;
    event.event_kind=(narrative||event.numeric_comparison_available===false)?"publication_or_decision":"numeric_release";
    for(const field of ["actual","previous","forecast","revised"]){
      const raw=event[field];
      event[field+"_display"]=(narrative||event.numeric_comparison_available===false)?"N/A":displayNumeric(raw,units);
    }
    event.value_quality=(narrative||event.numeric_comparison_available===false)?"narrative":event.actual_display===null?"missing_or_invalid_actual":"numeric";
  }
  // Final-stage UK GDP deduplication: ONS enrichment runs after official merging.
  // Prefer the publisher-timed release with a reference period, preserving unrelated indicators.
  const finalOnsIds=new Set(['uk_ons_b4_09','uk_ons_b4_10','uk_ons_b4_11','uk_ons_b4_12']);
  const finalOnsOfficial=new Map();
  for(const e of merged.events){
    const id=String(e.official_indicator_id||'');
    if(finalOnsIds.has(id)&&String(e.id||'').startsWith('official:')&&String(e.reference||'').trim())
      finalOnsOfficial.set(id+'|'+String(e.date||'').slice(0,10),e);
  }
  merged.events=merged.events.filter(e=>{
    const id=String(e.official_indicator_id||'');
    const key=id+'|'+String(e.date||'').slice(0,10);
    return !finalOnsOfficial.has(key)||finalOnsOfficial.get(key)===e;
  });
  // UK/ONS exact duplicate display removal: source rows remain untouched.
  // Never merge differing Actual, Previous, reference periods, or timestamps.
  const sourceOfficial='Official government';
  const sourcePublisher='Office for National Statistics release calendar';
  const valueKey=v=>{
    const s=String(v??'').trim();
    if(s===''||s==='—'||s==='-')return '';
    const n=Number(s.replace(/,/g,''));
    return Number.isFinite(n)?'num:'+String(n):'text:'+s;
  };
  const exactUkKey=e=>{
    const stamp=String(e.date||'');
    return [String(e.official_indicator_id||''),stamp,String(e.event||'').trim().toLowerCase(),
      ...['actual','previous','forecast','revised'].map(k=>valueKey(e[k]))].join('|');
  };
  const ukByKey=new Map();
  for(const e of merged.events){
    if(e.country_code!=='GB'||String(e.source||'')!==sourceOfficial||!e.official_indicator_id)continue;
    const key=exactUkKey(e);
    if(!ukByKey.has(key))ukByKey.set(key,e);
  }
  let ukExactDuplicatesRemoved=0;
  merged.events=merged.events.filter(e=>{
    if(e.country_code!=='GB'||String(e.source||'')!==sourcePublisher||!e.official_indicator_id)return true;
    const primary=ukByKey.get(exactUkKey(e));
    if(!primary)return true;
    const publisherPeriod=String(e.reference||'').trim();
    const primaryPeriod=String(primary.reference||'').trim();
    if(publisherPeriod&&primaryPeriod&&publisherPeriod!==primaryPeriod)return true;
    const publisherUnit=String(e.unit||'').trim();
    const primaryUnit=String(primary.unit||'').trim();
    if(publisherUnit&&primaryUnit&&publisherUnit!==primaryUnit)return true;
    primary.additional_verified_source_labels=[...new Set([...(primary.additional_verified_source_labels||[]),sourcePublisher])];
    ukExactDuplicatesRemoved++;
    return false;
  });
  const ukUnifiedDisplay=consolidateUnitedKingdomDisplay(merged.events);
  merged.events=ukUnifiedDisplay.events;
  const ukFinal=finalizeUKReleaseDuplicates(merged.events);
  merged.events=ukFinal.events;
  const ukPriorBackfill=await fillUKPreviousFromExactStoredHistory(merged.events);
  const ukPublisherBackfill=await attachExactVerifiedUKPublisherReleases(merged.events);
  const ukPublicationLabels=await labelVerifiedUKReportsAndCFTCWeek(merged.events);
  const ukCftcSource=await attachVerifiedCFTCGBPWeeklyActual(merged.events);
  const ukStructuredReports=await structureUKCompoundPublisherMetrics(merged.events);
  // AU country is always abbreviated in the public feed; preserve numeric data and country_code.
  for(const event of merged.events){
    if(String(event.country_code||"").toUpperCase()==="AU")event.country="AU";
  }
  const quality={total:merged.events.length,actual:merged.events.filter(e=>archiveNumeric(e.actual)!==null).length,forecast:merged.events.filter(e=>archiveNumeric(e.forecast)!==null).length,previous:merged.events.filter(e=>archiveNumeric(e.previous)!==null).length,archived_restored_count,official_historical_previous_candidates,retrospective_official_actuals,carried_previous_actuals,exact_historical_matches,verified_official_bulletins,official_dol_dashboard_matches,dol_previous_carried,official_eia_source_matches,official_census_retail_matches,monthly_official_previous_carried,archived_official_actuals_restored,official_bea_pce_matches,official_bls_api_matches,expanded_historical_previous_matches,original_published_previous_prioritized,extended_bls_official_matches,extended_bls_previous_matches,housing_previous_matches,continuing_claims_previous_matches,industrial_previous_normalized,appended_verified_historical_events};
  return {...basePayload,uk_exact_duplicates_removed:ukExactDuplicatesRemoved,uk_unified_display:{...ukUnifiedDisplay.stats,...ukFinal.stats,...ukPriorBackfill,...ukPublisherBackfill,...ukPublicationLabels,...ukCftcSource,...ukStructuredReports},data_quality:quality,source:official.length?"Official government + "+String(basePayload.source||"FinanceCalendar"):basePayload.source,events:merged.events,official_event_count:official.length+ukPublications.length,uk_verified_publication_count:ukPublications.length,official_matched_count:merged.matched,official_live_window:merged.liveWindow};
}

Deno.serve(async req=>{
  const origin=req.headers.get("origin");
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
  if(req.method!=="POST")return respond({error:"POST required"},405,origin);
  let body={};try{body=await req.json();}catch{return respond({error:"Invalid JSON body"},400,origin);}
  if(body.action==="uk_indicator_registry"){
    try{
      const rows=await sql.unsafe("with source as (select h.indicator_id,h.period,case when h.period ~ '^20[0-9]{2}-[0-9]{2}-01$' then left(h.period,7) else h.period end normalized_period,h.value,h.source_url,h.history_kind,h.fetched_at from public.econ_history_points h where h.value is not null and h.period ~ '^20[0-9]{2}-' and h.period<=to_char(current_date,'YYYY-MM-DD')),canonical as (select distinct on (indicator_id,normalized_period) indicator_id,normalized_period,value,source_url from source order by indicator_id,normalized_period,case when history_kind='official_latest_vintage' then 0 else 1 end,fetched_at desc), ranked as(select indicator_id,normalized_period period,value,source_url,row_number() over(partition by indicator_id order by normalized_period desc) rn from canonical),counts as (select indicator_id,count(*) filter(where (normalized_period >= '2025-10' and normalized_period < '2026-10') or (normalized_period >= '2025-Q4' and normalized_period < '2026-Q4')) as period_count from canonical group by indicator_id) select i.id,i.name,i.active,i.mapping_status,coalesce(i.frequency,'') frequency,coalesce(i.source_key,'') source_key,coalesce(i.source_endpoint,'') official_source_url,coalesce(i.source_config->>'collector_status','') collector_status,coalesce(counts.period_count,0)::int history_count,cur.period current_period,cur.value::text current_value,cur.source_url current_source_url,prev.period previous_period,prev.value::text previous_value from public.econ_indicators i left join counts on counts.indicator_id=i.id left join ranked cur on cur.indicator_id=i.id and cur.rn=1 left join ranked prev on prev.indicator_id=i.id and prev.rn=2 where i.country='UK' order by i.name");
      return respond({country:"UK",as_of:new Date().toISOString(),total:rows.length,active_verified:rows.filter(r=>r.active&&r.mapping_status==="verified").length,values_meaning:"Latest stored observations, potentially revised. Not independently confirmed first-release actual or forecast.",indicators:rows},200,origin);
    }catch(err){console.error("UK registry query failed",String(err));return respond({error:"UK indicator registry unavailable"},503,origin)}
  }
  const start=body.start,end=body.end;
  const requested=Array.isArray(body.countries)?body.countries.map(String).filter(Boolean):[];
  const forceLive=body.force_live===true;
  if(!validDate(start)||!validDate(end))return respond({error:"start and end must use YYYY-MM-DD"},400,origin);
  const days=span(start,end);if(days<0||days>366)return respond({error:"Date range must be 0-366 days"},400,origin);

  if(!forceLive){
    const snapshot=await readPrioritySnapshot(start,end,requested);
    if(snapshot){
      const enriched=await applyOfficialOverlay(snapshot,start,end,requested);
      return new Response(JSON.stringify(enriched),{status:200,headers:{...cors(origin),"content-type":"application/json; charset=utf-8","cache-control":enriched.official_live_window?"no-store":"public,max-age=15"}});
    }
  }

  const cacheKey=[start,end,...requested.slice().sort(),forceLive?"live":"normal"].join("|");
  const cached=cache.get(cacheKey);
  if(!forceLive&&cached&&Date.now()-cached.at<25000){
    const enriched=await applyOfficialOverlay(cached.payload,start,end,requested);
    return new Response(JSON.stringify(enriched),{status:200,headers:{...cors(origin),"content-type":"application/json; charset=utf-8","cache-control":enriched.official_live_window?"no-store":"public,max-age=15"}});
  }

  const errors=[];
  const diagnostics={raw_provider_rows:0,normalized_rows:0,unresolved_country_rows:0,filtered_country_rows:0,unresolved_samples:[]};
  const events=await fetchFinanceRange(start,end,requested,errors,diagnostics);
  const seen=new Set();
  const providerEvents=events.filter(e=>e&&e.date&&e.event).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).filter(e=>{const k=dedupeKey(e);if(seen.has(k))return false;seen.add(k);return true;});
  const providerPayload={start,end,countries:requested,source:"FinanceCalendar",mode:providerEvents.length?"configured":"provider-empty",fetched_at:new Date().toISOString(),provider_error:errors.length?errors.join("; "):null,diagnostics:{...diagnostics,returned_events:providerEvents.length},events:providerEvents};
  console.log("economic-calendar-feed diagnostics",JSON.stringify(providerPayload.diagnostics));

  if(forceLive&&providerEvents.length){
    const priority=["US","GB","EU","NZ","AU","CH","CA","JP","CN"].sort();
    const got=[...requested].sort();
    const samePriority=priority.length===got.length&&priority.every((x,i)=>x===got[i]);
    if(samePriority){
      try{
        await sql.unsafe("insert into public.economic_calendar_snapshots (snapshot_key,start_date,end_date,countries,fetched_at,source,provider_error,events) values ($1,$2::date,$3::date,$4::text[],now(),$5,$6,(($7::jsonb #>> '{}')::jsonb)) on conflict (snapshot_key) do update set start_date=excluded.start_date,end_date=excluded.end_date,countries=excluded.countries,fetched_at=excluded.fetched_at,source=excluded.source,provider_error=excluded.provider_error,events=excluded.events",["priority_21d",start,end,requested,"FinanceCalendar",providerPayload.provider_error,JSON.stringify(providerEvents)]);
      }catch(err){console.warn("Snapshot write failed",err);}
    }
  }

  if(!forceLive)cache.set(cacheKey,{at:Date.now(),payload:providerPayload});
  const payloadOut=await applyOfficialOverlay(providerPayload,start,end,requested);
  return new Response(JSON.stringify(payloadOut),{status:200,headers:{...cors(origin),"content-type":"application/json; charset=utf-8","cache-control":payloadOut.official_live_window?"no-store":"public,max-age=15"}});
});

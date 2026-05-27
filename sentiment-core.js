/*
  Public Sentiment Dash — sentiment-core.js
  Version: PSI_CORE_V2_UNIVERSAL

  OFFICIAL DEFINITIONS V1
  ---------------------------------------------------------------------------
  1) PSI means headline sentiment only.
     - Do not mix user votes into PSI.
     - Do not mix technical direction into PSI.
     - Global PSI should use dashboard_data.json headline_psi_score when available.

  2) Sentiment label scale:
     - 70–100 = Strong Bullish
     - 56–69  = Bullish
     - 45–55  = Mixed/Neutral
     - 31–44  = Bearish
     - 0–30   = Strong Bearish

  3) Article/headline count labels:
     - PSI Headlines = headline records used for PSI.
     - Relevant Headlines = current fresh relevant headline universe.
     - News Archive = cached long-retention article universe.
     - Instrument Articles = exact matched articles for one instrument.

  4) Technical direction:
     - Technical bias comes only from technical_data.json.
     - It is shown beside PSI, not blended into PSI.

  5) User vote:
     - User/community sentiment is separate from PSI.
     - It is never blended into PSI in V1.

  6) Instrument matching:
     - Use canonical instrument names and exact instrument-array matches first.
     - Avoid loose text.includes() matching against titles/descriptions.

  7) Timestamp:
     - Prefer dashboard_data.json updated_ny.
     - Fallback to status.json updated, then updated_utc fields.

  8) Regional pulse:
     - Use backend regional_pulse from dashboard_data.json/status.json.
     - Do not recalculate U.S./Europe PSI inside page scripts.

  9) Instrument dashboard:
     - Prefer backend instrument_history.json for instrument PSI and chart series.
     - Use dashboard_data.json headlines only as a legacy fallback when official history is missing.
*/
(function(){
  "use strict";

  const VERSION = "PSI_CORE_V2_UNIVERSAL";
  const MIN_INSTRUMENT_PSI_HEADLINES = 3;

  const INSTRUMENTS = [
    {name:"S&P 500 / ES", aliases:["s&p 500","sp 500","s&p","spx","es","s&p 500 / es"]},
    {name:"Nasdaq / NQ", aliases:["nasdaq","nq","ndx","nasdaq / nq"]},
    {name:"Dow / YM", aliases:["dow","dow jones","ym","dow / ym"]},
    {name:"Russell / RTY", aliases:["russell","rty","russell 2000","russell / rty"]},
    {name:"VIX", aliases:["vix","volatility"]},
    {name:"DAX", aliases:["dax"]},
    {name:"FTSE 100", aliases:["ftse","ftse 100"]},
    {name:"Nikkei 225", aliases:["nikkei","nikkei 225"]},
    {name:"Hang Seng", aliases:["hang seng","hsi"]},
    {name:"Euro Stoxx 50", aliases:["euro stoxx","euro stoxx 50","stoxx"]},
    {name:"CAC 40", aliases:["cac","cac 40"]},
    {name:"US 2Y Treasury", aliases:["us 2y","2y treasury","2-year yield","2 year yield"]},
    {name:"US 10Y Treasury", aliases:["10y","us 10y","10y treasury","10-year yield","10 year yield"]},
    {name:"Treasury Yields", aliases:["treasury yields","yields","bond yields","treasury"]},
    {name:"US Dollar / DXY", aliases:["dxy","us dollar","dollar index","usd index"]},
    {name:"EUR / EURUSD", aliases:["eurusd","eur/usd","euro","eur"]},
    {name:"GBP / GBPUSD", aliases:["gbpusd","gbp/usd","pound","gbp"]},
    {name:"JPY / USDJPY", aliases:["usdjpy","usd/jpy","yen","jpy"]},
    {name:"CHF / USDCHF", aliases:["usdchf","usd/chf","swiss franc","chf"]},
    {name:"CAD / USDCAD", aliases:["usdcad","usd/cad","canadian dollar","cad"]},
    {name:"AUD / AUDUSD", aliases:["audusd","aud/usd","australian dollar","aud"]},
    {name:"NZD / NZDUSD", aliases:["nzdusd","nzd/usd","new zealand dollar","nzd"]},
    {name:"EURJPY", aliases:["eurjpy","eur/jpy"]},
    {name:"EURGBP", aliases:["eurgbp","eur/gbp"]},
    {name:"GBPJPY", aliases:["gbpjpy","gbp/jpy"]},
    {name:"AUDJPY", aliases:["audjpy","aud/jpy"]},
    {name:"CADJPY", aliases:["cadjpy","cad/jpy"]},
    {name:"EURCHF", aliases:["eurchf","eur/chf"]},
    {name:"EURCAD", aliases:["eurcad","eur/cad"]},
    {name:"AUDCAD", aliases:["audcad","aud/cad"]},
    {name:"AUDNZD", aliases:["audnzd","aud/nzd"]},
    {name:"NZDJPY", aliases:["nzdjpy","nzd/jpy"]},
    {name:"USDTRY", aliases:["usdtry","usd/try","turkish lira"]},
    {name:"USDMXN", aliases:["usdmxn","usd/mxn","mexican peso"]},
    {name:"USDZAR", aliases:["usdzar","usd/zar","rand"]},
    {name:"Bitcoin / BTC", aliases:["bitcoin","btc"]},
    {name:"Ethereum / ETH", aliases:["ethereum","eth"]},
    {name:"Solana / SOL", aliases:["solana","sol"]},
    {name:"XRP", aliases:["xrp","ripple"]},
    {name:"BNB", aliases:["bnb","binance coin"]},
    {name:"Cardano / ADA", aliases:["cardano","ada"]},
    {name:"Dogecoin / DOGE", aliases:["dogecoin","doge"]},
    {name:"General Crypto", aliases:["crypto","cryptocurrency","digital assets"]},
    {name:"Gold", aliases:["gold","xau"]},
    {name:"Silver", aliases:["silver","xag"]},
    {name:"Copper", aliases:["copper"]},
    {name:"Crude Oil", aliases:["crude oil","oil","wti"]},
    {name:"Natural Gas", aliases:["natural gas","nat gas"]},
    {name:"Fed / FOMC", aliases:["fed","fomc","federal reserve"]},
    {name:"CPI / Inflation", aliases:["cpi","inflation"]},
    {name:"PPI", aliases:["ppi","producer price"]},
    {name:"Jobs / NFP", aliases:["jobs","nfp","nonfarm payrolls","payrolls"]},
    {name:"US GDP / Growth", aliases:["gdp","growth","us gdp"]},
    {name:"Geopolitical / Tariffs", aliases:["geopolitical","tariffs","tariff"]}
  ];

  const ALIAS_TO_CANONICAL = (() => {
    const map = new Map();
    INSTRUMENTS.forEach(ins => {
      map.set(normalizeKey(ins.name), ins.name);
      (ins.aliases || []).forEach(alias => map.set(normalizeKey(alias), ins.name));
    });
    return map;
  })();

  function normalizeKey(value){
    return String(value || "")
      .toLowerCase()
      .replace(/&amp;/g, "&")
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[^a-z0-9&+\-/\.\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanText(value){
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function clamp(value, min, max){
    const n = Number(value);
    if(!Number.isFinite(n)) return null;
    return Math.max(min, Math.min(max, n));
  }

  function roundScore(value){
    const n = clamp(value, 0, 100);
    return n == null ? null : Math.round(n);
  }

  function normalizeInstrumentName(value){
    const key = normalizeKey(value);
    return ALIAS_TO_CANONICAL.get(key) || cleanText(value);
  }

  function getInstrument(name){
    const canonical = normalizeInstrumentName(name);
    return INSTRUMENTS.find(ins => ins.name === canonical) || null;
  }

  function getInstrumentAliases(name){
    const ins = getInstrument(name);
    return ins ? [ins.name].concat(ins.aliases || []) : [cleanText(name)].filter(Boolean);
  }

  function classifySentiment(score){
    const s = roundScore(score);
    if(s == null) return "No PSI Match";
    if(s >= 70) return "Strong Bullish";
    if(s >= 56) return "Bullish";
    if(s >= 45) return "Mixed/Neutral";
    if(s >= 31) return "Bearish";
    return "Strong Bearish";
  }

  function badgeClass(score){
    return "badge-" + classifySentiment(score)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .replace("no-psi-match", "neutral");
  }

  function sentimentColor(score){
    const s = roundScore(score);
    if(s == null) return "#8b949e";
    if(s >= 70) return "#22c55e";
    if(s >= 56) return "#14b8a6";
    if(s >= 45) return "#58a6ff";
    if(s >= 31) return "#f97316";
    return "#ef4444";
  }

  function voteToSignedScore(vote){
    const t = normalizeKey(vote).replace(/\//g, " ");
    if(!t) return null;
    if(t.includes("mixed bullish")) return 1;
    if(t.includes("mixed bearish")) return -1;
    if(t.includes("strong bullish")) return 4;
    if(t.includes("strong bearish")) return -4;
    if(t.includes("bullish") && !t.includes("bearish")) return 3;
    if(t.includes("bearish") && !t.includes("bullish")) return -3;
    if(t.includes("mixed") || t.includes("neutral")) return 0;
    return null;
  }

  function signedScoreFromItem(item){
    if(!item || typeof item !== "object") return null;

    const weighted = Number(item.weighted_score);
    if(Number.isFinite(weighted) && weighted >= -10 && weighted <= 10) return weighted;

    const rawScore = Number(item.score);
    if(Number.isFinite(rawScore) && rawScore >= -10 && rawScore <= 10) return rawScore;

    return voteToSignedScore(item.vote || item.sentiment || item.label || item.direction);
  }

  function directPsiFromItem(item){
    if(!item || typeof item !== "object") return null;
    const fields = ["psi", "psi_score", "sentiment_score", "public_sentiment_index", "headline_psi_score"];
    for(const field of fields){
      const n = Number(item[field]);
      if(Number.isFinite(n) && n >= 0 && n <= 100) return n;
    }
    return null;
  }

  function calculatePSI(items){
    const list = Array.isArray(items) ? items : [];
    const direct = [];
    const signed = [];

    list.forEach(item => {
      const psi = directPsiFromItem(item);
      if(psi != null) direct.push(psi);
      else{
        const s = signedScoreFromItem(item);
        if(s != null) signed.push(s);
      }
    });

    if(direct.length){
      const avg = direct.reduce((a,b) => a + b, 0) / direct.length;
      return {
        score: roundScore(avg),
        itemCount: direct.length,
        method: "average_direct_psi_fields",
        formulaVersion: VERSION
      };
    }

    if(signed.length){
      const avgSigned = signed.reduce((a,b) => a + b, 0) / signed.length;
      return {
        score: roundScore(50 + avgSigned * 10),
        itemCount: signed.length,
        signedAverage: Number(avgSigned.toFixed(4)),
        method: "50_plus_average_signed_score_times_10",
        formulaVersion: VERSION
      };
    }

    return {
      score: null,
      itemCount: 0,
      method: "no_matched_headline_scores",
      formulaVersion: VERSION
    };
  }

  function getOfficialGlobalPSI(dashboardData, statusData){
    const candidates = [
      dashboardData && dashboardData.headline_psi_score,
      dashboardData && dashboardData.trust_layer && dashboardData.trust_layer.headline_psi_score,
      statusData && statusData.headline_psi_score
    ];

    for(const value of candidates){
      const score = roundScore(value);
      if(score != null){
        return {
          score,
          sentiment: classifySentiment(score),
          source: value === (statusData && statusData.headline_psi_score) ? "status.json" : "dashboard_data.json",
          formulaVersion: VERSION
        };
      }
    }

    const calculated = calculatePSI(dashboardData && dashboardData.psi_headlines);
    return {
      score: calculated.score,
      sentiment: classifySentiment(calculated.score),
      source: "calculated_from_dashboard_data.psi_headlines",
      formulaVersion: VERSION
    };
  }

  function itemInstrumentNames(item){
    if(!item || typeof item !== "object") return [];
    const raw = [];
    if(Array.isArray(item.instruments)) raw.push(...item.instruments);
    if(item.instrument) raw.push(item.instrument);
    if(item.symbol) raw.push(item.symbol);
    if(item.name) raw.push(item.name);
    if(item.label) raw.push(item.label);
    return raw.map(normalizeInstrumentName).filter(Boolean);
  }

  function matchesInstrument(item, instrumentName){
    const target = normalizeInstrumentName(instrumentName);
    if(!target) return false;
    return itemInstrumentNames(item).some(name => name === target);
  }

  function filterInstrumentItems(items, instrumentName){
    const list = Array.isArray(items) ? items : [];
    return list.filter(item => matchesInstrument(item, instrumentName));
  }

  function headlineBuckets(dashboardData, newsCacheData){
    const psiHeadlines = dashboardData && Array.isArray(dashboardData.psi_headlines) ? dashboardData.psi_headlines : [];
    const relevantHeadlines = dashboardData && Array.isArray(dashboardData.top_headlines) ? dashboardData.top_headlines : [];
    const newsArchive = newsCacheData && Array.isArray(newsCacheData.articles) ? newsCacheData.articles : [];
    return { psiHeadlines, relevantHeadlines, newsArchive };
  }

  function countBullBearNeutral(items){
    const result = { bullish:0, bearish:0, neutral:0, total:0 };
    (Array.isArray(items) ? items : []).forEach(item => {
      const signed = signedScoreFromItem(item);
      if(signed == null) return;
      result.total += 1;
      if(signed > 0) result.bullish += 1;
      else if(signed < 0) result.bearish += 1;
      else result.neutral += 1;
    });
    return result;
  }

  function getHeadlineCount(kind, dashboardData, statusData, newsCacheData, instrumentName){
    const buckets = headlineBuckets(dashboardData, newsCacheData);
    const trust = dashboardData && dashboardData.trust_layer ? dashboardData.trust_layer : {};

    if(kind === "psiHeadlines"){
      return Number(dashboardData && dashboardData.psi_headlines_used) || Number(trust.psi_headlines_used) || Number(statusData && statusData.psi_headlines_used) || buckets.psiHeadlines.length;
    }
    if(kind === "relevantHeadlines"){
      return Number(trust.relevant_headlines) || Number(statusData && statusData.relevant_headlines) || buckets.relevantHeadlines.length;
    }
    if(kind === "newsArchive"){
      return Number(newsCacheData && newsCacheData.article_count) || Number(statusData && statusData.news_cache_articles) || buckets.newsArchive.length;
    }
    if(kind === "instrumentPsiHeadlines"){
      return filterInstrumentItems(buckets.psiHeadlines, instrumentName).length;
    }
    if(kind === "instrumentRelevantHeadlines"){
      return filterInstrumentItems(buckets.relevantHeadlines, instrumentName).length;
    }
    if(kind === "instrumentArchiveArticles"){
      return filterInstrumentItems(buckets.newsArchive, instrumentName).length;
    }
    return 0;
  }

  function getTechnicalBias(technicalData, instrumentName, period){
    const usePeriod = period || "daily";
    const canonical = normalizeInstrumentName(instrumentName);
    const root = technicalData && technicalData.technical ? technicalData.technical : (technicalData || {});
    const entry = root && typeof root === "object" ? root[canonical] : null;
    const data = entry && typeof entry === "object" ? entry[usePeriod] : null;

    if(!data){
      return {
        instrument: canonical,
        period: usePeriod,
        direction: "N/A",
        score: null,
        source: "technical_data.json",
        formulaVersion: VERSION
      };
    }

    return {
      instrument: canonical,
      period: usePeriod,
      direction: cleanText(data.direction || data.signal || data.label || data.trend || "N/A"),
      score: Number.isFinite(Number(data.score)) ? Number(data.score) : null,
      close: Number.isFinite(Number(data.close)) ? Number(data.close) : null,
      rsi14: Number.isFinite(Number(data.rsi14)) ? Number(data.rsi14) : null,
      source: "technical_data.json",
      technicalVersion: technicalData && technicalData.technical_version || "",
      updatedUtc: technicalData && technicalData.updated_utc || "",
      formulaVersion: VERSION
    };
  }

  function getLastUpdated(dashboardData, statusData, technicalData, newsCacheData){
    return cleanText(
      (dashboardData && dashboardData.updated_ny) ||
      (statusData && statusData.updated) ||
      (dashboardData && dashboardData.updated_utc) ||
      (technicalData && technicalData.updated_utc) ||
      (newsCacheData && newsCacheData.updated_utc) ||
      ""
    );
  }

  function buildInstrumentSummary(options){
    const opts = options || {};
    const dashboardData = opts.dashboardData || null;
    const statusData = opts.statusData || null;
    const technicalData = opts.technicalData || null;
    const newsCacheData = opts.newsCacheData || null;
    const userVotes = opts.userVotes || (typeof window !== "undefined" ? window.PSD_USER_SENTIMENT : null) || {};
    const instrument = normalizeInstrumentName(opts.instrumentName || opts.instrument || "");
    const officialHistorySummary = buildInstrumentSummaryFromHistory(opts);
    if(officialHistorySummary) return officialHistorySummary;
    const buckets = headlineBuckets(dashboardData, newsCacheData);

    const psiMatches = filterInstrumentItems(buckets.psiHeadlines, instrument);
    const relevantMatches = filterInstrumentItems(buckets.relevantHeadlines, instrument);
    const archiveMatches = filterInstrumentItems(buckets.newsArchive, instrument);
    const basisItems = psiMatches.length >= MIN_INSTRUMENT_PSI_HEADLINES ? psiMatches : relevantMatches;
    const basis = psiMatches.length >= MIN_INSTRUMENT_PSI_HEADLINES ? "psi_headlines" : "top_headlines_fallback";
    const psi = calculatePSI(basisItems);
    const technical = getTechnicalBias(technicalData, instrument, opts.period || "daily");
    const counts = countBullBearNeutral(basisItems);

    return {
      name: instrument,
      score: psi.score,
      sentiment: classifySentiment(psi.score),
      label: classifySentiment(psi.score),
      badgeClass: badgeClass(psi.score),
      color: sentimentColor(psi.score),
      user: userVotes && userVotes[instrument] ? userVotes[instrument] : "N/A",
      tech: technical.direction,
      technical,
      headlines: relevantMatches.length,
      headlineCount: relevantMatches.length,
      psiHeadlineCount: psiMatches.length,
      archiveArticleCount: archiveMatches.length,
      bullishCount: counts.bullish,
      bearishCount: counts.bearish,
      neutralCount: counts.neutral,
      countBasis: basis,
      psiMethod: psi.method,
      signedAverage: psi.signedAverage,
      lastUpdated: getLastUpdated(dashboardData, statusData, technicalData, newsCacheData),
      formulaVersion: VERSION
    };
  }

  function buildGlobalSummary(options){
    const opts = options || {};
    const dashboardData = opts.dashboardData || null;
    const statusData = opts.statusData || null;
    const newsCacheData = opts.newsCacheData || null;
    const global = getOfficialGlobalPSI(dashboardData, statusData);
    return {
      score: global.score,
      sentiment: global.sentiment,
      source: global.source,
      psiHeadlines: getHeadlineCount("psiHeadlines", dashboardData, statusData, newsCacheData),
      relevantHeadlines: getHeadlineCount("relevantHeadlines", dashboardData, statusData, newsCacheData),
      newsArchive: getHeadlineCount("newsArchive", dashboardData, statusData, newsCacheData),
      lastUpdated: getLastUpdated(dashboardData, statusData, null, newsCacheData),
      formulaVersion: VERSION
    };
  }



  function pulseEntryFromOfficial(entry, fallback){
    const item = entry && typeof entry === "object" ? entry : {};
    const fb = fallback || {};
    const score = roundScore(item.score != null ? item.score : fb.score);
    const rawScore = roundScore(item.raw_score != null ? item.raw_score : (item.rawScore != null ? item.rawScore : (fb.raw_score != null ? fb.raw_score : score)));
    const count = Number.isFinite(Number(item.count)) ? Number(item.count) : (Number.isFinite(Number(fb.count)) ? Number(fb.count) : 0);
    const availableCount = Number.isFinite(Number(item.available_count)) ? Number(item.available_count) : (Number.isFinite(Number(item.availableCount)) ? Number(item.availableCount) : count);
    const confidence = cleanText(item.confidence || fb.confidence || (count >= 100 ? "High" : count >= 50 ? "Medium" : count >= 25 ? "Low-Medium" : count > 0 ? "Low" : "Pending"));
    const label = cleanText(item.label || fb.label || (score == null ? "Pending Backend Pulse" : classifySentiment(score)));

    return {
      score: score == null ? 50 : score,
      raw_score: rawScore == null ? (score == null ? 50 : score) : rawScore,
      rawScore: rawScore == null ? (score == null ? 50 : score) : rawScore,
      count,
      available_count: availableCount,
      availableCount,
      confidence,
      confidence_factor: Number.isFinite(Number(item.confidence_factor)) ? Number(item.confidence_factor) : null,
      confidenceFactor: Number.isFinite(Number(item.confidence_factor)) ? Number(item.confidence_factor) : null,
      label,
      weighted_headline_total: Number.isFinite(Number(item.weighted_headline_total)) ? Number(item.weighted_headline_total) : null,
      headline_limit: Number.isFinite(Number(item.headline_limit)) ? Number(item.headline_limit) : null,
      source: item.source || fb.source || "backend_regional_pulse",
      formulaVersion: VERSION
    };
  }

  function getOfficialRegionalPulseRoot(dashboardData, statusData){
    if(dashboardData && dashboardData.regional_pulse && typeof dashboardData.regional_pulse === "object") return dashboardData.regional_pulse;
    if(dashboardData && dashboardData.trust_layer && dashboardData.trust_layer.regional_pulse && typeof dashboardData.trust_layer.regional_pulse === "object") return dashboardData.trust_layer.regional_pulse;
    if(statusData && statusData.regional_pulse && typeof statusData.regional_pulse === "object") return statusData.regional_pulse;
    return null;
  }

  function buildRegionalPulse(options){
    const opts = options || {};
    const dashboardData = opts.dashboardData || null;
    const statusData = opts.statusData || null;
    const newsCacheData = opts.newsCacheData || null;
    const root = getOfficialRegionalPulseRoot(dashboardData, statusData);
    const globalSummary = buildGlobalSummary({dashboardData, statusData, newsCacheData});
    const globalFallback = {
      score: globalSummary.score,
      raw_score: globalSummary.score,
      count: globalSummary.psiHeadlines,
      confidence: globalSummary.psiHeadlines >= 100 ? "High" : globalSummary.psiHeadlines > 0 ? "Low" : "Pending",
      label: globalSummary.sentiment,
      source: globalSummary.source
    };

    if(!root){
      return {
        global: pulseEntryFromOfficial(null, globalFallback),
        us: pulseEntryFromOfficial(null, {score:50, raw_score:50, count:0, confidence:"Pending", label:"Pending Backend Pulse", source:"missing_regional_pulse"}),
        europe: pulseEntryFromOfficial(null, {score:50, raw_score:50, count:0, confidence:"Pending", label:"Pending Backend Pulse", source:"missing_regional_pulse"}),
        source: "missing_regional_pulse",
        formulaVersion: VERSION
      };
    }

    return {
      global: pulseEntryFromOfficial(root.global, globalFallback),
      us: pulseEntryFromOfficial(root.us, {score:50, raw_score:50, count:0, confidence:"Pending", label:"Pending Backend Pulse", source:"backend_regional_pulse"}),
      europe: pulseEntryFromOfficial(root.europe, {score:50, raw_score:50, count:0, confidence:"Pending", label:"Pending Backend Pulse", source:"backend_regional_pulse"}),
      source: "backend_regional_pulse",
      formulaVersion: VERSION
    };
  }

  function historyRecords(instrumentHistoryData){
    const records = instrumentHistoryData && Array.isArray(instrumentHistoryData.records) ? instrumentHistoryData.records.slice() : [];
    records.sort((a,b) => String(a.date || a.updated_utc || "").localeCompare(String(b.date || b.updated_utc || "")));
    return records;
  }

  function instrumentEntryFromRecord(record, instrumentName){
    if(!record || typeof record !== "object") return null;
    const canonical = normalizeInstrumentName(instrumentName);
    const instruments = record.instruments && typeof record.instruments === "object" ? record.instruments : {};
    if(instruments[canonical]) return instruments[canonical];

    const found = Object.entries(instruments).find(([key]) => normalizeInstrumentName(key) === canonical);
    return found ? found[1] : null;
  }

  function latestInstrumentHistoryEntry(instrumentHistoryData, instrumentName){
    const records = historyRecords(instrumentHistoryData).reverse();
    for(const record of records){
      const entry = instrumentEntryFromRecord(record, instrumentName);
      const score = roundScore(entry && (entry.psi != null ? entry.psi : (entry.score != null ? entry.score : entry.headline_psi_score)));
      if(entry && score != null) return {record, entry, score};
    }
    return null;
  }

  function technicalDirectionFromHistory(entry, fallbackTechnical){
    const tech = entry && entry.technical ? entry.technical : null;
    if(tech){
      const daily = tech.daily || tech.Daily || tech;
      if(typeof daily === "string") return daily;
      if(daily && typeof daily === "object") return cleanText(daily.direction || daily.signal || daily.label || daily.trend || daily.value || "N/A");
      if(tech.direction) return cleanText(tech.direction);
    }
    return fallbackTechnical && fallbackTechnical.direction ? fallbackTechnical.direction : "N/A";
  }

  function buildInstrumentSummaryFromHistory(options){
    const opts = options || {};
    const instrumentHistoryData = opts.instrumentHistoryData || opts.instrument_history || null;
    const instrument = normalizeInstrumentName(opts.instrumentName || opts.instrument || "");
    const found = latestInstrumentHistoryEntry(instrumentHistoryData, instrument);
    if(!found) return null;

    const entry = found.entry || {};
    const record = found.record || {};
    const score = found.score;
    const technical = getTechnicalBias(opts.technicalData || null, instrument, opts.period || "daily");
    const techDirection = technicalDirectionFromHistory(entry, technical);
    const label = cleanText(entry.sentiment_label || entry.sentiment || entry.label || classifySentiment(score));
    const userVotes = opts.userVotes || (typeof window !== "undefined" ? window.PSD_USER_SENTIMENT : null) || {};

    return {
      name: instrument,
      score,
      sentiment: label,
      label,
      badgeClass: badgeClass(score),
      color: sentimentColor(score),
      user: userVotes && userVotes[instrument] ? userVotes[instrument] : "N/A",
      tech: techDirection,
      technical: entry.technical || technical,
      headlines: Number.isFinite(Number(entry.headline_count)) ? Number(entry.headline_count) : 0,
      headlineCount: Number.isFinite(Number(entry.headline_count)) ? Number(entry.headline_count) : 0,
      psiHeadlineCount: Number.isFinite(Number(entry.headline_count)) ? Number(entry.headline_count) : 0,
      archiveArticleCount: 0,
      bullishCount: Number.isFinite(Number(entry.bullish_count)) ? Number(entry.bullish_count) : 0,
      bearishCount: Number.isFinite(Number(entry.bearish_count)) ? Number(entry.bearish_count) : 0,
      neutralCount: Number.isFinite(Number(entry.neutral_count)) ? Number(entry.neutral_count) : 0,
      mixedCount: Number.isFinite(Number(entry.mixed_count)) ? Number(entry.mixed_count) : 0,
      countBasis: "instrument_history.json",
      psiMethod: "backend_instrument_history",
      signedAverage: null,
      lastUpdated: cleanText(record.updated_ny || record.updated_utc || record.date || ""),
      topHeadlines: Array.isArray(entry.top_headlines) ? entry.top_headlines : [],
      source: "instrument_history.json",
      formulaVersion: VERSION
    };
  }

  function buildInstrumentSeries(options){
    const opts = options || {};
    const instrumentHistoryData = opts.instrumentHistoryData || opts.instrument_history || null;
    const instrument = normalizeInstrumentName(opts.instrumentName || opts.instrument || "");
    const period = opts.period || "daily";
    const fallbackScore = roundScore(opts.fallbackScore != null ? opts.fallbackScore : opts.score);
    const targetLength = period === "weekly" ? 7 : period === "monthly" ? 12 : 12;
    const values = [];

    historyRecords(instrumentHistoryData).forEach(record => {
      const entry = instrumentEntryFromRecord(record, instrument);
      const score = roundScore(entry && (entry.psi != null ? entry.psi : (entry.score != null ? entry.score : entry.headline_psi_score)));
      if(score != null) values.push(score);
    });

    let out = values.length ? values.slice(-targetLength) : [];
    const fill = out.length ? out[0] : (fallbackScore == null ? 50 : fallbackScore);
    while(out.length < targetLength) out.unshift(fill);
    if(out.length < 2) out = [fill, fill];
    return out;
  }

  function buildAuditSnapshot(options){
    const opts = options || {};
    const instrumentName = opts.instrumentName || opts.instrument || "";
    return {
      formulaVersion: VERSION,
      global: buildGlobalSummary(opts),
      instrument: instrumentName ? buildInstrumentSummary(opts) : null,
      rules: {
        psi: "Headline sentiment only; no user vote or technical blend.",
        labels: "70 Strong Bullish, 56 Bullish, 45 Mixed/Neutral, 31 Bearish, below 31 Strong Bearish.",
        matching: "Exact canonical instrument-array matching first; no loose title text includes.",
        timestamp: "dashboard_data.updated_ny preferred."
      }
    };
  }

  function carryForwardHourlyData(records, fieldName){
    const field = fieldName || "global_psi";
    const rows = Array.isArray(records) ? records.slice() : [];
    rows.sort((a,b) => String(a.ts || a.sample_key || a.date || "").localeCompare(String(b.ts || b.sample_key || b.date || "")));
    let last = null;
    return rows.map(row => {
      const copy = Object.assign({}, row);
      if(copy[field] == null && last != null) copy[field] = last;
      if(copy[field] != null) last = copy[field];
      return copy;
    });
  }

  const API = {
    VERSION,
    INSTRUMENTS,
    normalizeInstrumentName,
    getInstrument,
    getInstrumentAliases,
    classifySentiment,
    badgeClass,
    sentimentColor,
    voteToSignedScore,
    signedScoreFromItem,
    calculatePSI,
    getOfficialGlobalPSI,
    matchesInstrument,
    filterInstrumentItems,
    headlineBuckets,
    countBullBearNeutral,
    getHeadlineCount,
    getTechnicalBias,
    getLastUpdated,
    buildInstrumentSummary,
    buildInstrumentSummaryFromHistory,
    buildInstrumentSeries,
    buildGlobalSummary,
    buildRegionalPulse,
    buildAuditSnapshot,
    carryForwardHourlyData
  };

  if(typeof window !== "undefined"){
    window.PSD_SENTIMENT_CORE_VERSION = VERSION;
    window.PSDCore = API;
  }

  if(typeof module !== "undefined" && module.exports){
    module.exports = API;
  }
})();

/*
  PublicSentimentDash â€” Parallel Data Access V2
  Phase: LAB / READ-ONLY

  Purpose:
  - Standardize page data loading without changing production sources or calculations.
  - Keep current/live, technical, historical/search, X, account, and AI domains explicit.
  - Allow one-page-at-a-time migration with rollback to existing page files.

  Safety:
  - This module performs GET/read operations only.
  - It does not calculate PSI.
  - It does not blend technical direction, user votes, or X into PSI.
  - Production pages do not use this module until explicitly migrated.
*/
(function(){
  "use strict";

  const VERSION = "PSD_DATA_ACCESS_V2_R2_LIVE_1";

  // Public, read-only R2 endpoint. No R2 credentials are ever exposed to the browser.
  const R2_LIVE_BASE = "https://public-sentiment-r2-live.yehuda-kohen.workers.dev/";

  // These are engine-generated public payloads. V2 reads them from R2 only.
  const R2_LIVE_FILES = new Set([
    "dashboard_data.json",
    "dashboard_live.json",
    "dashboard_history.json",
    "engine_operational_history.json",
    "news_cache.json",
    "source_profiles.json",
    "news_latest.json",
    "technical_data.json",
    "status.json",
    "sentiment_history.json",
    "instrument_history.json",
    "instrument_history_compact.json",
    "market_pulse.json",
    "news_consensus.json",
    "event_intelligence.json",
    "market_pulse_ai.json",
    "ai_status.json",
    "x_signals_lab.json"
  ]);

  const SOURCES = Object.freeze({
    live: Object.freeze({
      dashboard: "dashboard_live.json",
      status: "status.json",
      technical: "technical_data.json"
    }),
    config: Object.freeze({
      priorityPrimary: "sources-v2.txt",
      priorityFallback: "sources.json",
      assets: "assets_config.json"
    }),
    history: Object.freeze({
      instrumentCompact: "instrument_history_compact.json",
      sentiment: "sentiment_history.json",
      dashboard: "dashboard_history.json"
    }),
    news: Object.freeze({
      latest: "news_latest.json",
      cache: "news_cache.json",
      consensus: "news_consensus.json"
    }),
    pulse: Object.freeze({
      current: "market_pulse.json",
      ai: "market_pulse_ai.json"
    }),
    intelligence: Object.freeze({
      events: "event_intelligence.json"
    }),
    x: Object.freeze({
      signals: "x_signals_lab.json"
    })
  });

  function resolveDataUrl(path){
    const raw = String(path || "");
    if(/^https?:\/\//i.test(raw)) return raw;

    const qIndex = raw.indexOf("?");
    const bare = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
    const query = qIndex >= 0 ? raw.slice(qIndex) : "";
    const filename = bare.replace(/^\.\//, "").split("/").pop();

    if(R2_LIVE_FILES.has(filename)){
      return `${R2_LIVE_BASE}${filename}${query}`;
    }
    return raw;
  }

  async function fetchJson(path, options){
    const opts = options || {};
    const required = opts.required !== false;
    const resolvedPath = resolveDataUrl(path);
    const requestOptions = { cache: opts.cache || "no-store" };
    if(opts.signal) requestOptions.signal = opts.signal;
    const response = await fetch(resolvedPath, requestOptions);

    if(!response.ok){
      if(required) throw new Error(`PSDDataV2: ${resolvedPath} returned HTTP ${response.status}`);
      return null;
    }

    try{
      return await response.json();
    }catch(error){
      if(required) throw new Error(`PSDDataV2: invalid JSON from ${resolvedPath}: ${error.message}`);
      return null;
    }
  }

  async function firstJson(paths){
    for(const path of paths){
      try{
        const data = await fetchJson(path, { required: false });
        if(data != null) return { data, source: path };
      }catch(error){}
    }
    return { data: null, source: null };
  }

  async function loadPrioritySources(){
    const result = await firstJson([
      SOURCES.config.priorityPrimary,
      SOURCES.config.priorityFallback
    ]);

    const list = Array.isArray(result.data)
      ? result.data.filter(source => source && source.name && source.url)
      : [];

    return { data: list, source: result.source };
  }

  async function loadHomePage(){
    const [dashboard, status, technical, priority] = await Promise.all([
      fetchJson(SOURCES.live.dashboard),
      fetchJson(SOURCES.live.status, { required: false }),
      fetchJson(SOURCES.live.technical, { required: false }),
      loadPrioritySources()
    ]);

    return Object.freeze({
      dashboard,
      status,
      technical,
      prioritySources: priority.data,
      meta: Object.freeze({
        adapterVersion: VERSION,
        page: "index.html",
        sources: Object.freeze({
          dashboard: SOURCES.live.dashboard,
          status: status ? SOURCES.live.status : null,
          technical: technical ? SOURCES.live.technical : null,
          prioritySources: priority.source
        })
      })
    });
  }


  async function loadDashboardBase(){
    const [assets, dashboard, status, history] = await Promise.all([
      fetchJson(SOURCES.config.assets, { required: false, cache: "no-cache" }),
      fetchJson(SOURCES.live.dashboard, { required: false, cache: "no-cache" }),
      fetchJson(SOURCES.live.status, { required: false, cache: "no-cache" }),
      fetchJson(SOURCES.history.instrumentCompact, { required: false, cache: "no-cache" })
    ]);

    return Object.freeze({
      assetsConfig: assets,
      dashboard,
      status,
      instrumentHistory: history,
      meta: Object.freeze({
        adapterVersion: VERSION,
        page: "dashboard.html",
        sources: Object.freeze({
          assetsConfig: assets ? SOURCES.config.assets : null,
          dashboard: dashboard ? SOURCES.live.dashboard : null,
          status: status ? SOURCES.live.status : null,
          instrumentHistory: history ? SOURCES.history.instrumentCompact : null
        })
      })
    });
  }

  async function loadTechnical(){
    return fetchJson(SOURCES.live.technical, { required: false, cache: "no-cache" });
  }

  async function loadNewsLatest(){
    return fetchJson(SOURCES.news.latest, { required: false, cache: "no-cache" });
  }

  async function loadXSignals(){
    return fetchJson(SOURCES.x.signals, { required: false, cache: "no-cache" });
  }


  async function loadSentimentHistory(options){
    const opts = options || {};
    const path = opts.cacheBust
      ? `${SOURCES.history.sentiment}?v=${Date.now()}`
      : SOURCES.history.sentiment;
    return fetchJson(path, { required: opts.required !== false, cache: opts.cache || "no-cache" });
  }

  async function loadDashboardDataLegacy(options){
    const opts = options || {};
    const base = "dashboard_data.json";
    const path = opts.cacheBust ? `${base}?v=${Date.now()}` : base;
    return fetchJson(path, { required: opts.required === true, cache: opts.cache || "no-store" });
  }

  async function loadHistoryDrivers(){
    const latest = await fetchJson(SOURCES.news.latest, { required: false, cache: "no-cache" });
    if(latest) return { data: latest, source: SOURCES.news.latest };
    const cache = await fetchJson(SOURCES.news.cache, { required: false, cache: "no-cache" });
    return { data: cache, source: cache ? SOURCES.news.cache : null };
  }


  async function loadNewsArticlesPage(){
    const [dashboard, latestNews, technical] = await Promise.all([
      fetchJson(SOURCES.live.dashboard, { required: true, cache: "no-store" }),
      fetchJson(SOURCES.news.latest, { required: false, cache: "no-store" }),
      fetchJson(SOURCES.live.technical, { required: false, cache: "no-store" })
    ]);
    return Object.freeze({
      dashboard,
      latestNews,
      technical,
      meta: Object.freeze({
        adapterVersion: VERSION,
        page: "news-articles.html",
        sources: Object.freeze({
          dashboard: SOURCES.live.dashboard,
          latestNews: latestNews ? SOURCES.news.latest : null,
          technical: technical ? SOURCES.live.technical : null
        })
      })
    });
  }


  async function loadMarketPulsePage(){
    const pulse = await fetchJson(SOURCES.pulse.current, { required: true, cache: "no-cache" });
    return Object.freeze({
      pulse,
      meta: Object.freeze({
        adapterVersion: VERSION,
        page: "market-pulse.html",
        sources: Object.freeze({pulse: SOURCES.pulse.current})
      })
    });
  }

  async function loadMarketPulseAnalysis(){
    const [consensus, aiPulse] = await Promise.all([
      fetchJson(SOURCES.news.consensus, { required: false, cache: "no-cache" }),
      fetchJson(SOURCES.pulse.ai, { required: false, cache: "no-cache" })
    ]);
    return Object.freeze({
      consensus: consensus || {analyses:[]},
      aiPulse,
      meta: Object.freeze({
        adapterVersion: VERSION,
        sources: Object.freeze({
          consensus: consensus ? SOURCES.news.consensus : null,
          aiPulse: aiPulse ? SOURCES.pulse.ai : null
        })
      })
    });
  }


  async function loadMarketIntelligencePage(options){
    const opts = options || {};
    const [pulseResult, intelligenceResult] = await Promise.allSettled([
      fetchJson(SOURCES.pulse.current, { required: true, cache: "no-cache", signal: opts.signal }),
      fetchJson(SOURCES.intelligence.events, { required: true, cache: "no-cache", signal: opts.signal })
    ]);
    if(pulseResult.status !== "fulfilled") throw pulseResult.reason;
    const intelligence = intelligenceResult.status === "fulfilled" ? intelligenceResult.value : null;
    return Object.freeze({
      pulse: pulseResult.value,
      intelligence,
      meta: Object.freeze({
        adapterVersion: VERSION,
        page: "market-intelligence.html",
        sources: Object.freeze({
          pulse: SOURCES.pulse.current,
          intelligence: intelligence ? SOURCES.intelligence.events : null
        })
      })
    });
  }


  async function loadLiveDashboard(options){
    const opts = options || {};
    return fetchJson(SOURCES.live.dashboard, {
      required: opts.required !== false,
      cache: opts.cache || "no-store",
      signal: opts.signal
    });
  }

  window.PSDDataV2 = Object.freeze({
    VERSION,
    R2_LIVE_BASE,
    R2_LIVE_FILES,
    SOURCES,
    resolveDataUrl,
    fetchJson,
    firstJson,
    loadPrioritySources,
    loadHomePage,
    loadDashboardBase,
    loadTechnical,
    loadNewsLatest,
    loadXSignals,
    loadSentimentHistory,
    loadDashboardDataLegacy,
    loadHistoryDrivers,
    loadNewsArticlesPage,
    loadMarketPulsePage,
    loadMarketPulseAnalysis,
    loadMarketIntelligencePage,
    loadLiveDashboard
  });
})();


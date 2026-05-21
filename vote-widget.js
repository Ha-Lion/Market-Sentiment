const PSD_SUPABASE_URL = "https://fupexuonvzakoguucglk.supabase.co";
const PSD_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1cGV4dW9udnpha29ndXVjZ2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUzNTQsImV4cCI6MjA5MzQ4MTM1NH0.YZF4SBqvDTSOyHDOf_TVhpBXDm0FEma74u32Bdryfjg";
const PSD_GA4_ID = "G-BZMQQZ2SVC";
const PSD_SITE_URL = "https://publicsentimentdash.com";
const PSD_X_PROFILE_URL = "https://x.com/PublicSentDash";

const PSD_VOTE_INSTRUMENTS = [
  "S&P 500 / ES","Nasdaq / NQ","Dow / YM","Russell / RTY","VIX",
  "DAX","FTSE 100","Nikkei 225","Hang Seng","Euro Stoxx 50","CAC 40",
  "US 2Y Treasury","US 10Y Treasury","Treasury Yields",
  "US Dollar / DXY","EUR / EURUSD","GBP / GBPUSD","JPY / USDJPY","CHF / USDCHF",
  "CAD / USDCAD","AUD / AUDUSD","NZD / NZDUSD","EURJPY","EURGBP","GBPJPY",
  "AUDJPY","CADJPY","EURCHF","EURCAD","AUDCAD","AUDNZD","NZDJPY",
  "USDTRY","USDMXN","USDZAR",
  "Bitcoin / BTC","Ethereum / ETH","Solana / SOL","XRP","BNB","Cardano / ADA",
  "Dogecoin / DOGE","General Crypto",
  "Gold","Silver","Copper","Crude Oil","Natural Gas",
  "Fed / FOMC","CPI / Inflation","PPI","Jobs / NFP","US GDP / Growth","Geopolitical / Tariffs"
];

window.PSD_USER_SENTIMENT = window.PSD_USER_SENTIMENT || {};

function psdLoadGA4(){
  if(!PSD_GA4_ID || window.PSD_GA4_LOADED) return;
  window.PSD_GA4_LOADED = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ window.dataLayer.push(arguments); };

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(PSD_GA4_ID);
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", PSD_GA4_ID, {
    page_title: document.title,
    page_path: window.location.pathname
  });
}

function psdTrack(eventName, params){
  if(typeof window.gtag === "function"){
    window.gtag("event", eventName, params || {});
  }
}

function psdCanonicalURL(){
  const canonical = document.querySelector('link[rel="canonical"]');
  if(canonical && canonical.href) return canonical.href;
  const path = window.location.pathname === "/" ? "/" : window.location.pathname;
  return PSD_SITE_URL + path;
}

function psdMetaDescription(){
  const meta = document.querySelector('meta[name="description"]');
  return meta ? meta.getAttribute("content") || "" : "";
}

function psdInjectStructuredData(){
  if(document.getElementById("psdStructuredData")) return;

  const currentUrl = psdCanonicalURL();
  const description = psdMetaDescription();
  const title = document.title || "Public Sentiment Dash";

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": PSD_SITE_URL + "/#organization",
        "name": "Public Sentiment Dash",
        "url": PSD_SITE_URL + "/",
        "logo": PSD_SITE_URL + "/logo.png",
        "sameAs": [PSD_X_PROFILE_URL],
        "description": "AI-assisted public market sentiment dashboard for stocks, forex, crypto, commodities, bonds, macro headlines, and financial news."
      },
      {
        "@type": "WebSite",
        "@id": PSD_SITE_URL + "/#website",
        "url": PSD_SITE_URL + "/",
        "name": "Public Sentiment Dash",
        "publisher": {"@id": PSD_SITE_URL + "/#organization"},
        "inLanguage": "en-US"
      },
      {
        "@type": "WebPage",
        "@id": currentUrl + "#webpage",
        "url": currentUrl,
        "name": title,
        "description": description,
        "isPartOf": {"@id": PSD_SITE_URL + "/#website"},
        "publisher": {"@id": PSD_SITE_URL + "/#organization"},
        "inLanguage": "en-US"
      }
    ]
  };

  const script = document.createElement("script");
  script.id = "psdStructuredData";
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

function psdEscape(value){
  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function psdClass(value){
  const clean = String(value || "N/A").replace(/[^a-zA-Z]/g,"");
  return clean || "NA";
}

function psdCreateAdvertiseBanner(){
  if(document.getElementById("psdAdvertiseBanner")) return;

  const header = document.querySelector(".header");
  if(!header) return;

  const style = document.createElement("style");
  style.textContent = `
    .psd-ad-banner{
      max-width:1120px;
      margin:14px auto 0;
      padding:11px 14px;
      border:1px solid rgba(210,153,34,.28);
      border-radius:999px;
      background:linear-gradient(90deg,rgba(210,153,34,.14),rgba(88,166,255,.08));
      color:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:10px;
      text-align:center;
      font-size:13px;
      line-height:1.45;
      box-shadow:0 10px 26px rgba(0,0,0,.16);
    }
    .psd-ad-banner strong{color:#ffd780;font-weight:800}
    .psd-ad-banner a{
      color:#fff;
      font-weight:800;
      text-decoration:none;
      border:1px solid rgba(255,255,255,.16);
      background:rgba(255,255,255,.07);
      padding:6px 10px;
      border-radius:999px;
      white-space:nowrap;
      transition:.18s ease;
    }
    .psd-ad-banner a:hover{border-color:rgba(210,153,34,.55);transform:translateY(-1px)}
    @media(max-width:760px){
      .psd-ad-banner{border-radius:18px;flex-direction:column;margin:12px 14px 0}
    }
  `;
  document.head.appendChild(style);

  const banner = document.createElement("div");
  banner.id = "psdAdvertiseBanner";
  banner.className = "psd-ad-banner";
  banner.innerHTML = `
    <span>📣 <strong>Partner with Public Sentiment Dash</strong> — advertising, investor, and business opportunities in market sentiment.</span>
    <a href="advertise.html">Learn More</a>
  `;

  header.insertAdjacentElement("afterend", banner);
}

function psdGetVoterId(){
  let id = localStorage.getItem("psd_voter_id");
  if(!id){
    id = window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : "voter_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("psd_voter_id", id);
  }
  return id;
}

function psdHeaders(){
  return {
    "apikey": PSD_SUPABASE_ANON_KEY,
    "Authorization": "Bearer " + PSD_SUPABASE_ANON_KEY,
    "Content-Type": "application/json"
  };
}

function psdEnhanceFooterLegalLinks(){
  document.querySelectorAll(".footer-links").forEach(footer => {
    const extraLinks = [
      ["advertise.html", "Business Opportunities"],
      ["privacy.html", "Privacy"],
      ["terms.html", "Terms"],
      ["disclaimer.html", "Disclaimer"]
    ];

    extraLinks.forEach(([href, label]) => {
      const exists = Array.from(footer.querySelectorAll("a")).some(a => (a.getAttribute("href") || "") === href);
      if(!exists){
        const a = document.createElement("a");
        a.href = href;
        a.textContent = label;
        if(window.location.pathname.toLowerCase().endsWith("/" + href.toLowerCase())){
          a.className = "active";
        }
        footer.appendChild(a);
      }
    });
  });
}

function psdEnhanceSocialLinks(){
  document.querySelectorAll(".social-links").forEach(social => {
    const xPill = Array.from(social.querySelectorAll(".social-pill")).find(el =>
      el.textContent.trim().toLowerCase() === "x"
    );

    if(xPill && xPill.tagName.toLowerCase() !== "a"){
      const a = document.createElement("a");
      a.className = xPill.className;
      a.textContent = "X";
      a.href = PSD_X_PROFILE_URL;
      a.target = "_blank";
      a.rel = "noopener";
      xPill.replaceWith(a);
    }else if(xPill){
      xPill.href = PSD_X_PROFILE_URL;
      xPill.target = "_blank";
      xPill.rel = "noopener";
    }
  });
}

function psdFallbackFromElement(el){
  const card = el.closest(".instrument-card");
  if(card){
    const dailyRow = Array.from(card.querySelectorAll(".info-row")).find(row =>
      row.textContent.trim().toLowerCase().startsWith("daily:")
    );
    if(dailyRow){
      const text = dailyRow.textContent.toLowerCase();
      if(text.includes("bullish")) return "Bullish";
      if(text.includes("bearish")) return "Bearish";
      if(text.includes("neutral")) return "Neutral";
    }
  }

  const rail = el.closest(".rail-item");
  if(rail){
    if(rail.classList.contains("direction-up")) return "Bullish";
    if(rail.classList.contains("direction-down")) return "Bearish";
    if(rail.classList.contains("direction-neutral")) return "Neutral";
  }

  const newsCard = el.closest(".news-card");
  if(newsCard){
    const tech = newsCard.querySelector(".tech-chip");
    const text = tech ? tech.textContent.toLowerCase() : "";
    if(text.includes("bullish")) return "Bullish";
    if(text.includes("bearish")) return "Bearish";
    if(text.includes("neutral")) return "Neutral";
  }

  return "N/A";
}

function psdEffectiveSentiment(instrument, fallback){
  const voted = window.PSD_USER_SENTIMENT?.[instrument];
  if(voted && voted !== "N/A") return voted;
  return fallback || "N/A";
}

async function psdLoadUserSentiment(){
  if(!PSD_SUPABASE_URL || !PSD_SUPABASE_ANON_KEY) return;

  try{
    const response = await fetch(`${PSD_SUPABASE_URL}/rest/v1/rpc/get_user_sentiment`, {
      method:"POST",
      headers:psdHeaders(),
      body:"{}"
    });

    if(!response.ok){
      console.warn("User sentiment load failed:", response.status);
      return;
    }

    const rows = await response.json();
    const map = {};
    rows.forEach(row => {
      map[row.instrument] = row.user_sentiment || "N/A";
    });

    window.PSD_USER_SENTIMENT = map;
    psdApplyUserSentiment();
    window.dispatchEvent(new CustomEvent("psdUserSentimentReady", { detail: map }));
  }catch(error){
    console.warn("User sentiment load failed", error);
  }
}

function psdApplyUserSentiment(){
  document.querySelectorAll("[data-user-sentiment]").forEach(el => {
    const instrument = el.getAttribute("data-user-sentiment");
    const fallback = psdFallbackFromElement(el);
    const value = psdEffectiveSentiment(instrument, fallback);

    if(el.classList.contains("user-chip")){
      el.textContent = "User: " + value;
      el.className = "chip user-chip " + psdClass(value);
    }else{
      el.textContent = value;
      el.className = "psd-user-sentiment-value " + psdClass(value);
    }
  });
}

async function psdSubmitVote(instrument, vote){
  const status = document.getElementById("psdVoteStatus");
  if(!status) return;

  status.textContent = "Submitting...";
  status.className = "psd-vote-status";

  try{
    const response = await fetch(`${PSD_SUPABASE_URL}/rest/v1/rpc/submit_instrument_vote`, {
      method:"POST",
      headers:psdHeaders(),
      body:JSON.stringify({
        p_instrument: instrument,
        p_vote: vote,
        p_voter_id: psdGetVoterId()
      })
    });

    let result = {};
    try{ result = await response.json(); }catch(e){ result = {}; }

    if(!response.ok || !result.ok){
      status.textContent = result.error || `Vote failed. Error ${response.status}`;
      status.className = "psd-vote-status error";
      console.warn("Vote failed:", response.status, result);
      return;
    }

    window.PSD_USER_SENTIMENT[instrument] = result.user_sentiment || "N/A";
    psdApplyUserSentiment();

    psdTrack("instrument_vote", {
      instrument: instrument,
      vote: vote,
      result_sentiment: result.user_sentiment || "N/A"
    });

    status.textContent = "Vote saved.";
    status.className = "psd-vote-status success";

    setTimeout(() => {
      const panel = document.getElementById("psdVotePanel");
      if(panel) panel.classList.remove("open");
    }, 700);
  }catch(error){
    status.textContent = "Vote failed.";
    status.className = "psd-vote-status error";
    console.warn("Vote failed:", error);
  }
}

function psdCreateVoteWidget(){
  if(document.getElementById("psdVoteWidget")) return;

  if(!document.getElementById("psdVoteWidgetFallbackCss")){
    const style = document.createElement("style");
    style.id = "psdVoteWidgetFallbackCss";
    style.textContent = `
      .psd-vote-widget{position:fixed;left:18px;top:50%;transform:translateY(-50%);z-index:1000;font-family:Inter,Segoe UI,Arial,sans-serif}
      .psd-vote-tab{display:flex;flex-direction:column;align-items:center;gap:4px;width:54px;min-height:78px;border:1px solid rgba(210,153,34,.45);border-radius:18px;background:linear-gradient(180deg,rgba(210,153,34,.22),rgba(13,17,23,.96));color:#ffd780;cursor:pointer;box-shadow:0 0 24px rgba(210,153,34,.18)}
      .psd-vote-tab-icon{font-size:20px;line-height:1}.psd-vote-tab-text{font-size:12px;font-weight:700}
      .psd-vote-panel{position:absolute;left:66px;top:50%;transform:translateY(-50%);width:290px;display:none;padding:16px;border-radius:18px;border:1px solid #263241;background:rgba(13,17,23,.98);box-shadow:0 20px 60px rgba(0,0,0,.42)}
      .psd-vote-panel.open{display:block}.psd-vote-title{color:#fff;font-size:17px;font-weight:700;margin-bottom:4px}.psd-vote-note,.psd-vote-status{color:#8b949e;font-size:12px}.psd-vote-label{display:block;color:#c9d1d9;font-size:12px;font-weight:600;margin:10px 0 6px}
      .psd-vote-select{width:100%;background:#111821;color:#e6edf3;border:1px solid #263241;border-radius:12px;padding:10px 12px}.psd-vote-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.psd-vote-choice{border:1px solid #263241;border-radius:12px;padding:10px;color:#fff;background:rgba(17,24,33,.88);cursor:pointer;font-weight:600}
      .psd-vote-choice.bullish.active{border-color:rgba(63,185,80,.65);background:rgba(63,185,80,.16);color:#9ff0aa}.psd-vote-choice.bearish.active{border-color:rgba(248,81,73,.65);background:rgba(248,81,73,.16);color:#ffaaa6}
      .psd-vote-submit{width:100%;border:0;border-radius:999px;padding:11px 14px;background:#d29922;color:#05070b;cursor:pointer;font-weight:800}.psd-vote-cancel{width:100%;margin-top:8px;border:1px solid #263241;border-radius:999px;padding:10px 14px;background:transparent;color:#c9d1d9;cursor:pointer;font-weight:600}
    `;
    document.head.appendChild(style);
  }

  const wrap = document.createElement("div");
  wrap.id = "psdVoteWidget";
  wrap.className = "psd-vote-widget";

  wrap.innerHTML = `
    <button class="psd-vote-tab" type="button" aria-label="Open voting widget">
      <span class="psd-vote-tab-icon">↕</span>
      <span class="psd-vote-tab-text">Vote</span>
    </button>

    <div class="psd-vote-panel" id="psdVotePanel">
      <div class="psd-vote-title">Your Market Vote</div>
      <div class="psd-vote-note">Anonymous daily vote. No registration.</div>

      <label class="psd-vote-label" for="psdVoteInstrument">Instrument</label>
      <select id="psdVoteInstrument" class="psd-vote-select">
        ${PSD_VOTE_INSTRUMENTS.map(x => `<option value="${psdEscape(x)}">${psdEscape(x)}</option>`).join("")}
      </select>

      <div class="psd-vote-actions">
        <button type="button" class="psd-vote-choice bullish active" data-vote="Bullish">Bullish</button>
        <button type="button" class="psd-vote-choice bearish" data-vote="Bearish">Bearish</button>
      </div>

      <button type="button" class="psd-vote-submit" id="psdVoteSubmit">Submit Vote</button>
      <button type="button" class="psd-vote-cancel" id="psdVoteCancel">Cancel</button>

      <div class="psd-vote-status" id="psdVoteStatus"></div>
    </div>
  `;

  document.body.appendChild(wrap);

  const tab = wrap.querySelector(".psd-vote-tab");
  const panel = wrap.querySelector("#psdVotePanel");
  const submit = wrap.querySelector("#psdVoteSubmit");
  const cancel = wrap.querySelector("#psdVoteCancel");
  const choices = wrap.querySelectorAll(".psd-vote-choice");

  let selectedVote = "Bullish";

  tab.addEventListener("click", () => {
    panel.classList.toggle("open");
    psdTrack("vote_widget_toggle", { open: panel.classList.contains("open") });
  });

  cancel.addEventListener("click", () => {
    panel.classList.remove("open");
  });

  choices.forEach(btn => {
    btn.addEventListener("click", () => {
      choices.forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      selectedVote = btn.getAttribute("data-vote");
    });
  });

  submit.addEventListener("click", () => {
    const instrument = document.getElementById("psdVoteInstrument").value;
    psdSubmitVote(instrument, selectedVote);
  });
}


function psdLoadPdfReportEngine(){
  return new Promise((resolve, reject) => {
    if(typeof window.psdOpenPdfReport === "function"){
      resolve();
      return;
    }

    const existing = document.getElementById("psdPdfReportScript");
    if(existing){
      existing.addEventListener("load", () => resolve(), { once:true });
      existing.addEventListener("error", () => reject(new Error("PDF report engine failed to load.")), { once:true });
      return;
    }

    const script = document.createElement("script");
    script.id = "psdPdfReportScript";
    script.src = "pdf-report.js?v=6";
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PDF report engine failed to load."));
    document.head.appendChild(script);
  });
}

function psdCreatePdfWidget(){
  if(document.getElementById("psdPdfWidget")) return;

  if(!document.getElementById("psdPdfWidgetCss")){
    const style = document.createElement("style");
    style.id = "psdPdfWidgetCss";
    style.textContent = `
      .psd-pdf-widget{position:fixed;left:18px;top:calc(50% + 96px);transform:translateY(-50%);z-index:999;font-family:Inter,Segoe UI,Arial,sans-serif}
      .psd-pdf-tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:54px;min-height:78px;border:1px solid rgba(88,166,255,.62);border-radius:18px;background:linear-gradient(180deg,rgba(30,78,135,.88),rgba(13,17,23,.98));color:#ffffff;cursor:pointer;box-shadow:0 0 22px rgba(88,166,255,.18);animation:psdPdfFloat 3.5s ease-in-out infinite;padding:7px 5px;text-align:center;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
      .psd-pdf-tab:hover{background:linear-gradient(180deg,rgba(44,105,176,.94),rgba(13,17,23,.98));transform:translateX(2px)}
      .psd-pdf-tab-icon{font-size:17px;line-height:1;font-weight:700;color:#ffffff;letter-spacing:.2px}.psd-pdf-tab-text{font-size:9.4px;font-weight:500;line-height:1.12;text-align:center;max-width:48px;color:#ffffff;text-shadow:none;letter-spacing:0}
      @keyframes psdPdfFloat{0%,100%{transform:translateY(4px)}50%{transform:translateY(-4px)}}
      @media(max-width:760px){.psd-pdf-widget{left:10px;top:calc(50% + 96px)}.psd-pdf-tab{width:54px;min-height:78px}}
      @media print{#psdVoteWidget,#psdPdfWidget{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  const wrap = document.createElement("div");
  wrap.id = "psdPdfWidget";
  wrap.className = "psd-pdf-widget";
  wrap.innerHTML = `
    <button class="psd-pdf-tab" type="button" aria-label="Save this page as PDF report">
      <span class="psd-pdf-tab-icon">PDF</span>
      <span class="psd-pdf-tab-text">Save<br>Page<br>as PDF</span>
    </button>
  `;

  document.body.appendChild(wrap);

  const btn = wrap.querySelector(".psd-pdf-tab");
  btn.addEventListener("click", async () => {
    const original = btn.innerHTML;
    btn.innerHTML = `<span class="psd-pdf-tab-icon">…</span><span class="psd-pdf-tab-text">Preparing<br>PDF</span>`;
    btn.disabled = true;

    try{
      await psdLoadPdfReportEngine();
      if(typeof window.psdOpenPdfReport === "function"){
        psdTrack("pdf_report_open", { page_path: window.location.pathname });
        await window.psdOpenPdfReport();
      }else{
        window.print();
      }
    }catch(error){
      console.warn("PDF report failed", error);
      alert("PDF report failed to load. Please refresh and try again.");
    }finally{
      btn.innerHTML = original;
      btn.disabled = false;
    }
  });
}

function psdSafe(name, fn){
  try{
    return fn();
  }catch(error){
    console.warn("PSD widget helper failed:", name, error);
    return null;
  }
}

function psdInit(){
  psdSafe("create vote widget", psdCreateVoteWidget);
  psdSafe("create PDF widget", psdCreatePdfWidget);
  psdSafe("load GA4", psdLoadGA4);
  psdSafe("inject structured data", psdInjectStructuredData);
  psdSafe("create advertise banner", psdCreateAdvertiseBanner);
  psdSafe("enhance footer legal links", psdEnhanceFooterLegalLinks);
  psdSafe("enhance social links", psdEnhanceSocialLinks);
  psdSafe("apply user sentiment", psdApplyUserSentiment);
  psdSafe("load user sentiment", psdLoadUserSentiment);

  setTimeout(() => psdSafe("apply user sentiment 500", psdApplyUserSentiment), 500);
  setTimeout(() => psdSafe("apply user sentiment 1500", psdApplyUserSentiment), 1500);
  setTimeout(() => psdSafe("apply user sentiment 3000", psdApplyUserSentiment), 3000);
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", psdInit);
}else{
  psdInit();
}

window.addEventListener("load", () => {
  psdSafe("create vote widget on load", psdCreateVoteWidget);
  psdSafe("create PDF widget on load", psdCreatePdfWidget);
  psdSafe("create advertise banner on load", psdCreateAdvertiseBanner);
  psdSafe("enhance footer legal links on load", psdEnhanceFooterLegalLinks);
  psdSafe("enhance social links on load", psdEnhanceSocialLinks);
  psdSafe("apply user sentiment on load", psdApplyUserSentiment);
});

window.psdApplyUserSentiment = psdApplyUserSentiment;

/*
  PSD Live Update
  - Shared auto-update layer for every page that loads vote-widget.js.
  - Adds cache-busting for same-site JSON data files.
  - Checks /status.json every 5 minutes.
  - Reloads once when new published data is detected.
*/
(function psdSiteLiveUpdateBootstrap(){
  const PSD_LIVE_STATUS_PATH = "/status.json";
  const PSD_LIVE_CHECK_MS = 5 * 60 * 1000;
  const PSD_LIVE_FIRST_CHECK_MS = 15000;
  const PSD_LIVE_STORAGE_KEY = "psd_live_status_signature_v1";
  const PSD_LIVE_RELOAD_KEY = "psd_live_reloaded_signature_v1:" + window.location.pathname;
  const PSD_JSON_DATA_FILE = /\/(?:dashboard_data|dashboard_history|sentiment_history|technical_data|status|news_cache|news_articles|latest_news|articles|news)\.json$/i;

  function psdInstallFreshJsonFetchGuard(){
    if(window.PSD_FRESH_JSON_FETCH_GUARD_INSTALLED || typeof window.fetch !== "function") return;
    window.PSD_FRESH_JSON_FETCH_GUARD_INSTALLED = true;

    const originalFetch = window.fetch.bind(window);

    window.fetch = function(input, init){
      try{
        const rawUrl = typeof input === "string"
          ? input
          : (input instanceof URL ? input.toString() : (input && input.url ? input.url : ""));

        if(rawUrl){
          const url = new URL(rawUrl, window.location.href);

          if(url.origin === window.location.origin && PSD_JSON_DATA_FILE.test(url.pathname)){
            url.searchParams.set("_psd_fresh", Date.now().toString());

            const nextInit = Object.assign({}, init || {}, { cache: "no-store" });

            if(typeof input === "string" || input instanceof URL){
              return originalFetch(url.toString(), nextInit);
            }

            if(input && input.url){
              return originalFetch(url.toString(), nextInit);
            }
          }
        }
      }catch(error){
        console.warn("PSD fresh JSON fetch guard skipped:", error);
      }

      return originalFetch(input, init);
    };
  }

  function psdStatusSignatureFromText(text){
    if(!text) return "";

    try{
      const json = JSON.parse(text);
      const direct =
        json.updated ||
        json.updated_at ||
        json.generated_at ||
        json.last_updated ||
        json.timestamp ||
        json.time ||
        json.run_id ||
        json.workflow_run ||
        "";

      if(direct) return String(direct);

      return JSON.stringify(json);
    }catch(error){
      return String(text);
    }
  }

  function psdIsPageSafeToReload(){
    if(document.visibilityState && document.visibilityState !== "visible") return false;

    const votePanel = document.getElementById("psdVotePanel");
    if(votePanel && votePanel.classList.contains("open")) return false;

    const active = document.activeElement;
    if(active && ["INPUT","TEXTAREA","SELECT"].includes(active.tagName)) return false;

    return true;
  }

  async function psdCheckForFreshSiteData(){
    if(window.PSD_LIVE_UPDATE_CHECKING) return;
    if(!psdIsPageSafeToReload()) return;

    window.PSD_LIVE_UPDATE_CHECKING = true;

    try{
      const url = new URL(PSD_LIVE_STATUS_PATH, window.location.origin);
      url.searchParams.set("_psd_status", Date.now().toString());

      const response = await fetch(url.toString(), { cache: "no-store" });
      if(!response.ok) return;

      const text = await response.text();
      const signature = psdStatusSignatureFromText(text);
      if(!signature) return;

      const previousSignature = localStorage.getItem(PSD_LIVE_STORAGE_KEY);
      const alreadyReloadedSignature = sessionStorage.getItem(PSD_LIVE_RELOAD_KEY);

      if(!previousSignature){
        localStorage.setItem(PSD_LIVE_STORAGE_KEY, signature);
        return;
      }

      if(previousSignature !== signature && alreadyReloadedSignature !== signature){
        localStorage.setItem(PSD_LIVE_STORAGE_KEY, signature);
        sessionStorage.setItem(PSD_LIVE_RELOAD_KEY, signature);

        psdTrack("site_auto_refresh", {
          page_path: window.location.pathname,
          status_signature: signature.slice(0, 80)
        });

        setTimeout(() => {
          window.location.reload();
        }, 650);

        return;
      }

      localStorage.setItem(PSD_LIVE_STORAGE_KEY, signature);
    }catch(error){
      console.warn("PSD live update check failed:", error);
    }finally{
      window.PSD_LIVE_UPDATE_CHECKING = false;
    }
  }

  function psdStartLiveUpdate(){
    if(window.PSD_LIVE_UPDATE_STARTED) return;
    window.PSD_LIVE_UPDATE_STARTED = true;

    setTimeout(psdCheckForFreshSiteData, PSD_LIVE_FIRST_CHECK_MS);
    setInterval(psdCheckForFreshSiteData, PSD_LIVE_CHECK_MS);

    document.addEventListener("visibilitychange", () => {
      if(document.visibilityState === "visible"){
        setTimeout(psdCheckForFreshSiteData, 1500);
      }
    });

    window.addEventListener("focus", () => {
      setTimeout(psdCheckForFreshSiteData, 1500);
    });
  }

  psdInstallFreshJsonFetchGuard();

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", psdStartLiveUpdate);
  }else{
    psdStartLiveUpdate();
  }

  window.psdCheckForFreshSiteData = psdCheckForFreshSiteData;
})();

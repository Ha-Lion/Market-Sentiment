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

function psdAddHomeLabel(){
  const brand = document.querySelector(".brand");
  const logo = document.querySelector(".brand .logo");
  if(!brand || !logo || document.querySelector(".psd-logo-home-wrap")) return;

  const style = document.createElement("style");
  style.textContent = `
    .psd-logo-home-wrap{display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0}
    .psd-logo-home-word{color:#ffd780;font-size:11px;font-weight:600;line-height:1;letter-spacing:.2px}
  `;
  document.head.appendChild(style);

  const wrap = document.createElement("span");
  wrap.className = "psd-logo-home-wrap";
  brand.insertBefore(wrap, logo);
  wrap.appendChild(logo);

  const word = document.createElement("span");
  word.className = "psd-logo-home-word";
  word.textContent = "Home";
  wrap.appendChild(word);
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
    <span>📣 <strong>Advertise on Public Sentiment Dash</strong> — reach finance, trading, investing, and market-sentiment readers.</span>
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

function psdFixNavigation(){
  const nav = document.querySelector(".nav");
  if(!nav) return;

  const order = [
    ["dashboard.html", "Interactive Dashboard"],
    ["sentiment-history.html", "Historical Sentiment"],
    ["news-articles.html", "News & Articles"],
    ["market-sentiment.html", "Guides"],
    ["contact.html", "Get in Touch"],
    ["how-it-works.html", "Dashboard Works"],
    ["about.html", "About"],
    ["advertise.html", "Advertise"]
  ];

  Array.from(nav.querySelectorAll("a")).forEach(link => {
    const href = link.getAttribute("href") || "";
    if(href.includes("index.html")) link.remove();
  });

  order.forEach(([href, label]) => {
    let link = Array.from(nav.querySelectorAll("a")).find(a => (a.getAttribute("href") || "").includes(href));
    if(!link){
      link = document.createElement("a");
      link.href = href;
      nav.appendChild(link);
    }
    link.textContent = label;
    const path = window.location.pathname.toLowerCase();
    if(path.endsWith("/" + href.toLowerCase())) link.classList.add("active");
    nav.appendChild(link);
  });

  const social = nav.querySelector(".social-links");
  if(social) nav.appendChild(social);
}

function psdEnhanceFooterLegalLinks(){
  document.querySelectorAll(".footer-links").forEach(footer => {
    const extraLinks = [
      ["advertise.html", "Advertise"],
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

function psdCreateShareButtons(){
  if(document.getElementById("psdShareBox")) return;

  const noSharePages = ["privacy.html","terms.html","disclaimer.html"].some(page =>
    window.location.pathname.toLowerCase().endsWith(page)
  );
  if(noSharePages) return;

  const main = document.querySelector("main.page");
  if(!main) return;

  const currentUrl = psdCanonicalURL();
  const title = document.title.replace(" — Public Sentiment Dash", "").replace(" - Public Sentiment Dash", "");
  const xShareText = `${title}\n\nPublic Sentiment Dash\n${currentUrl}`;
  const xShareUrl = `https://x.com/intent/post?text=${encodeURIComponent(xShareText)}`;

  const style = document.createElement("style");
  style.textContent = `
    .psd-share-box{max-width:1120px;margin:0 auto 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,rgba(17,24,33,.92),rgba(13,18,27,.92))}
    .psd-share-text{color:var(--muted);font-size:14px;line-height:1.5}
    .psd-share-actions{display:flex;gap:10px;flex-wrap:wrap}
    .psd-share-btn{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);background:#111821;color:#fff;border-radius:999px;padding:9px 13px;font-size:13px;font-weight:600;text-decoration:none;cursor:pointer;transition:.18s ease;white-space:nowrap}
    .psd-share-btn:hover{border-color:rgba(210,153,34,.55);transform:translateY(-1px)}
    .psd-share-x{background:rgba(88,166,255,.10);border-color:rgba(88,166,255,.25)}
    @media(max-width:720px){.psd-share-box{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);

  const box = document.createElement("section");
  box.id = "psdShareBox";
  box.className = "psd-share-box";
  box.innerHTML = `
    <div class="psd-share-text">Like this dashboard? Share it and help more traders discover it.</div>
    <div class="psd-share-actions">
      <a class="psd-share-btn psd-share-x" href="${psdEscape(xShareUrl)}" target="_blank" rel="noopener">Share on X</a>
      <a class="psd-share-btn" href="${psdEscape(PSD_X_PROFILE_URL)}" target="_blank" rel="noopener">Follow on X</a>
      <button class="psd-share-btn" type="button" id="psdCopyLinkBtn">Copy Link</button>
    </div>
  `;

  const firstPanel = main.querySelector(".panel.hero") || main.querySelector(".panel");
  if(firstPanel && firstPanel.nextSibling){
    main.insertBefore(box, firstPanel.nextSibling);
  }else{
    main.insertBefore(box, main.firstChild);
  }

  const copyBtn = document.getElementById("psdCopyLinkBtn");
  if(copyBtn){
    copyBtn.addEventListener("click", async () => {
      try{
        await navigator.clipboard.writeText(currentUrl);
        copyBtn.textContent = "Copied";
        psdTrack("copy_share_link", { page_url: currentUrl });
        setTimeout(() => copyBtn.textContent = "Copy Link", 1200);
      }catch(e){
        copyBtn.textContent = "Copy Failed";
        setTimeout(() => copyBtn.textContent = "Copy Link", 1200);
      }
    });
  }
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
  psdSafe("load GA4", psdLoadGA4);
  psdSafe("inject structured data", psdInjectStructuredData);
  psdSafe("add home label", psdAddHomeLabel);
  psdSafe("create advertise banner", psdCreateAdvertiseBanner);
  psdSafe("fix navigation", psdFixNavigation);
  psdSafe("enhance footer legal links", psdEnhanceFooterLegalLinks);
  psdSafe("enhance social links", psdEnhanceSocialLinks);
  psdSafe("create share buttons", psdCreateShareButtons);
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
  psdSafe("add home label on load", psdAddHomeLabel);
  psdSafe("create advertise banner on load", psdCreateAdvertiseBanner);
  psdSafe("fix navigation on load", psdFixNavigation);
  psdSafe("enhance footer legal links on load", psdEnhanceFooterLegalLinks);
  psdSafe("enhance social links on load", psdEnhanceSocialLinks);
  psdSafe("apply user sentiment on load", psdApplyUserSentiment);
});

window.psdApplyUserSentiment = psdApplyUserSentiment;

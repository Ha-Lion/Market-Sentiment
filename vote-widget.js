const PSD_SUPABASE_URL = "https://fupexuonvzakoguucglk.supabase.co";
const PSD_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6ImZ1cGV4dW9udnpha29ndXVjZ2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUzNTQsImV4cCI6MjA5MzQ4MTM1NH0.YZF4SBqvDTSOyHDOf_TVhpBXDm0FEma74u32Bdryfjg";
const PSD_GA4_ID = "G-BZMQQZ2SVC";
const PSD_SITE_URL = "https://publicsentimentdash.com";
const PSD_X_PROFILE_URL = "https://x.com/PublicSentDash";

const PSD_VOTE_INSTRUMENTS = [
  "S&P 500 / ES", "Nasdaq / NQ", "Dow / YM", "Russell / RTY", "VIX",
  "DAX", "FTSE 100", "Nikkei 225", "Hang Seng", "Euro Stoxx 50", "CAC 40",
  "US 2Y Treasury", "US 10Y Treasury", "Treasury Yields",
  "US Dollar / DXY", "EUR / EURUSD", "GBP / GBPUSD", "JPY / USDJPY", "CHF / USDCHF",
  "CAD / USDCAD", "AUD / AUDUSD", "NZD / NZDUSD", "EURJPY", "EURGBP", "GBPJPY",
  "AUDJPY", "CADJPY", "EURCHF", "EURCAD", "AUDCAD", "AUDNZD", "NZDJPY",
  "USDTRY", "USDMXN", "USDZAR",
  "Bitcoin / BTC", "Ethereum / ETH", "Solana / SOL", "XRP", "BNB", "Cardano / ADA",
  "Dogecoin / DOGE", "General Crypto",
  "Gold", "Silver", "Copper", "Crude Oil", "Natural Gas",
  "Fed / FOMC", "CPI / Inflation", "PPI", "Jobs / NFP", "US GDP / Growth", "Geopolitical / Tariffs"
];

window.PSD_USER_SENTIMENT = window.PSD_USER_SENTIMENT || {};

function psdEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function psdClass(value) {
  const clean = String(value || "N/A").replace(/[^a-zA-Z]/g, "");
  return clean || "NA";
}

function psdLoadGA4() {
  if (!PSD_GA4_ID || window.PSD_GA4_LOADED) return;
  window.PSD_GA4_LOADED = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };

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

function psdTrack(eventName, params) {
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params || {});
  }
}

function psdCanonicalURL() {
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical && canonical.href) return canonical.href;
  return PSD_SITE_URL + (window.location.pathname === "/" ? "/" : window.location.pathname);
}

function psdMetaDescription() {
  const meta = document.querySelector('meta[name="description"]');
  return meta ? meta.getAttribute("content") || "" : "";
}

function psdInjectGlobalMobileCSS() {
  if (document.getElementById("psdMobileInjectedCSS")) return;

  const style = document.createElement("style");
  style.id = "psdMobileInjectedCSS";
  style.textContent = `
    .psd-logo-home-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .psd-logo-home-word {
      color: #ffd780;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: .2px;
    }

    .psd-ad-banner {
      max-width: 760px;
      margin: 12px auto 0;
      padding: 10px 14px;
      border: 1px solid rgba(210,153,34,.30);
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(210,153,34,.14), rgba(88,166,255,.08));
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      text-align: center;
      font-size: 13px;
      line-height: 1.4;
      box-shadow: 0 10px 26px rgba(0,0,0,.16);
    }

    .psd-ad-banner strong {
      color: #ffd780;
      font-weight: 800;
    }

    .psd-ad-banner a {
      color: #fff;
      font-weight: 800;
      text-decoration: none;
      border: 1px solid rgba(255,255,255,.16);
      background: rgba(255,255,255,.07);
      padding: 6px 10px;
      border-radius: 999px;
      white-space: nowrap;
      transition: .18s ease;
    }

    .psd-ad-banner a:hover {
      border-color: rgba(210,153,34,.55);
      transform: translateY(-1px);
    }

    .psd-share-box {
      max-width: 1120px;
      margin: 0 auto 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border: 1px solid var(--line, rgba(255,255,255,.10));
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(17,24,33,.92), rgba(13,18,27,.92));
    }

    .psd-share-text {
      color: var(--muted, #aab4c5);
      font-size: 14px;
      line-height: 1.5;
    }

    .psd-share-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .psd-share-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--line, rgba(255,255,255,.12));
      background: #111821;
      color: #fff;
      border-radius: 999px;
      padding: 9px 13px;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      transition: .18s ease;
      white-space: nowrap;
    }

    .psd-share-btn:hover {
      border-color: rgba(210,153,34,.55);
      transform: translateY(-1px);
    }

    .psd-share-x {
      background: rgba(88,166,255,.10);
      border-color: rgba(88,166,255,.25);
    }

    .psd-vote-widget {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 9999;
      font-family: inherit;
    }

    .psd-vote-tab {
      border: 1px solid rgba(210,153,34,.45);
      background: linear-gradient(135deg, rgba(210,153,34,.95), rgba(168,109,21,.95));
      color: #111;
      border-radius: 999px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 900;
      cursor: pointer;
      box-shadow: 0 12px 28px rgba(0,0,0,.35);
    }

    .psd-vote-panel {
      position: absolute;
      right: 0;
      bottom: 48px;
      width: 320px;
      max-width: calc(100vw - 28px);
      display: none;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 18px;
      background: rgba(10,14,22,.96);
      backdrop-filter: blur(14px);
      box-shadow: 0 18px 50px rgba(0,0,0,.55);
      padding: 14px;
      color: #fff;
    }

    .psd-vote-panel.open {
      display: block;
    }

    .psd-vote-title {
      font-size: 16px;
      font-weight: 900;
      margin-bottom: 4px;
    }

    .psd-vote-subtitle {
      color: var(--muted, #aab4c5);
      font-size: 12px;
      margin-bottom: 12px;
      line-height: 1.4;
    }

    .psd-vote-label {
      display: block;
      color: var(--muted, #aab4c5);
      font-size: 12px;
      font-weight: 800;
      margin-bottom: 6px;
    }

    .psd-vote-select {
      width: 100%;
      min-height: 40px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.14);
      background: #111821;
      color: #fff;
      padding: 8px 10px;
      margin-bottom: 12px;
      outline: none;
    }

    .psd-vote-choice-row,
    .psd-vote-action-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 10px;
    }

    .psd-vote-choice,
    .psd-vote-submit,
    .psd-vote-cancel {
      min-height: 38px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.14);
      background: #111821;
      color: #fff;
      font-weight: 800;
      cursor: pointer;
    }

    .psd-vote-choice.active {
      border-color: rgba(210,153,34,.65);
      background: rgba(210,153,34,.18);
    }

    .psd-vote-submit {
      background: rgba(56,211,159,.16);
      border-color: rgba(56,211,159,.38);
    }

    .psd-vote-cancel {
      background: rgba(255,255,255,.06);
    }

    .psd-vote-status {
      color: var(--muted, #aab4c5);
      font-size: 12px;
      min-height: 16px;
    }

    .psd-vote-status.success {
      color: #38d39f;
    }

    .psd-vote-status.error {
      color: #ff6b6b;
    }

    @media (max-width: 760px) {
      .psd-ad-banner {
        width: calc(100% - 28px);
        max-width: 520px;
        border-radius: 16px;
        flex-direction: column;
        gap: 7px;
        padding: 9px 12px;
      }

      .psd-share-box {
        align-items: flex-start;
        flex-direction: column;
        margin-left: 0;
        margin-right: 0;
      }

      .psd-share-actions {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr;
      }

      .psd-share-btn {
        width: 100%;
      }

      .psd-vote-widget {
        right: 11px;
        bottom: 11px;
      }

      .psd-vote-tab {
        padding: 9px 12px;
        font-size: 12px;
      }

      .psd-vote-panel {
        right: 0;
        bottom: 44px;
        width: min(318px, calc(100vw - 22px));
        max-height: 58vh;
        overflow: auto;
        padding: 12px;
        border-radius: 16px;
      }

      .psd-vote-choice-row,
      .psd-vote-action-row {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 420px) {
      .psd-vote-widget {
        right: 8px;
        bottom: 8px;
      }

      .psd-vote-panel {
        width: calc(100vw - 16px);
        max-height: 52vh;
      }
    }
  `;

  document.head.appendChild(style);
}

function psdInjectStructuredData() {
  if (document.getElementById("psdStructuredData")) return;

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
        "publisher": { "@id": PSD_SITE_URL + "/#organization" },
        "inLanguage": "en-US"
      },
      {
        "@type": "WebPage",
        "@id": currentUrl + "#webpage",
        "url": currentUrl,
        "name": title,
        "description": description,
        "isPartOf": { "@id": PSD_SITE_URL + "/#website" },
        "publisher": { "@id": PSD_SITE_URL + "/#organization" },
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

function psdAddHomeLabel() {
  const brand = document.querySelector(".brand");
  const logo = document.querySelector(".brand .logo");
  if (!brand || !logo || document.querySelector(".psd-logo-home-wrap")) return;

  const wrap = document.createElement("span");
  wrap.className = "psd-logo-home-wrap";
  brand.insertBefore(wrap, logo);
  wrap.appendChild(logo);

  const word = document.createElement("span");
  word.className = "psd-logo-home-word";
  word.textContent = "Home";
  wrap.appendChild(word);
}

function psdCreateAdvertiseBanner() {
  if (document.getElementById("psdAdvertiseBanner")) return;

  const header = document.querySelector(".header, header, .site-header");
  if (!header) return;

  const banner = document.createElement("div");
  banner.id = "psdAdvertiseBanner";
  banner.className = "psd-ad-banner";
  banner.innerHTML = `
    <span><strong>Advertise on Public Sentiment Dash</strong> — reach finance, trading, investing, and market-sentiment readers.</span>
    <a href="advertise.html">Learn More</a>
  `;

  header.insertAdjacentElement("afterend", banner);
}

function psdGetVoterId() {
  let id = localStorage.getItem("psd_voter_id");
  if (!id) {
    id = window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : "voter_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("psd_voter_id", id);
  }
  return id;
}

function psdHeaders() {
  return {
    "apikey": PSD_SUPABASE_ANON_KEY,
    "Authorization": "Bearer " + PSD_SUPABASE_ANON_KEY,
    "Content-Type": "application/json"
  };
}

function psdFixNavigation() {
  const nav = document.querySelector(".nav");
  if (!nav) return;

  const order = [
    ["dashboard.html", "Interactive Dashboard"],
    ["news-articles.html", "News & Articles"],
    ["market-sentiment.html", "Guides"],
    ["contact.html", "Get in Touch"],
    ["how-it-works.html", "Dashboard Works"],
    ["about.html", "About"]
  ];

  Array.from(nav.querySelectorAll("a")).forEach(link => {
    const href = link.getAttribute("href") || "";
    if (href.includes("index.html")) link.remove();
  });

  order.forEach(([href, label]) => {
    const link = Array.from(nav.querySelectorAll("a")).find(a => (a.getAttribute("href") || "").includes(href));
    if (link) {
      link.textContent = label;
      nav.appendChild(link);
    }
  });

  const social = nav.querySelector(".social-links");
  if (social) nav.appendChild(social);
}

function psdEnhanceFooterLegalLinks() {
  document.querySelectorAll(".footer-links").forEach(footer => {
    const extraLinks = [
      ["advertise.html", "Advertise"],
      ["privacy.html", "Privacy"],
      ["terms.html", "Terms"],
      ["disclaimer.html", "Disclaimer"]
    ];

    extraLinks.forEach(([href, label]) => {
      const exists = Array.from(footer.querySelectorAll("a")).some(a => (a.getAttribute("href") || "") === href);
      if (!exists) {
        const a = document.createElement("a");
        a.href = href;
        a.textContent = label;
        if (window.location.pathname.toLowerCase().endsWith("/" + href.toLowerCase())) {
          a.className = "active";
        }
        footer.appendChild(a);
      }
    });
  });
}

function psdEnhanceSocialLinks() {
  document.querySelectorAll(".social-links").forEach(social => {
    const xPill = Array.from(social.querySelectorAll(".social-pill")).find(el => el.textContent.trim().toLowerCase() === "x");

    if (xPill && xPill.tagName.toLowerCase() !== "a") {
      const a = document.createElement("a");
      a.className = xPill.className;
      a.textContent = "X";
      a.href = PSD_X_PROFILE_URL;
      a.target = "_blank";
      a.rel = "noopener";
      xPill.replaceWith(a);
    } else if (xPill) {
      xPill.href = PSD_X_PROFILE_URL;
      xPill.target = "_blank";
      xPill.rel = "noopener";
    }
  });
}

function psdCreateShareButtons() {
  if (document.getElementById("psdShareBox")) return;

  const noSharePages = ["privacy.html", "terms.html", "disclaimer.html"].some(page =>
    window.location.pathname.toLowerCase().endsWith(page)
  );
  if (noSharePages) return;

  const main = document.querySelector("main.page, main, .page");
  if (!main) return;

  const currentUrl = psdCanonicalURL();
  const title = document.title.replace(" — Public Sentiment Dash", "").replace(" - Public Sentiment Dash", "");
  const xShareText = `${title}\n\nPublic Sentiment Dash\n${currentUrl}`;
  const xShareUrl = `https://x.com/intent/post?text=${encodeURIComponent(xShareText)}`;

  const box = document.createElement("section");
  box.id = "psdShareBox";
  box.className = "psd-share-box";
  box.innerHTML = `
    <div class="psd-share-text">Like this dashboard? Share it and help more traders discover it.</div>
    <div class="psd-share-actions">
      <a class="psd-share-btn psd-share-x" href="${xShareUrl}" target="_blank" rel="noopener">Share on X</a>
      <a class="psd-share-btn" href="${PSD_X_PROFILE_URL}" target="_blank" rel="noopener">Follow on X</a>
      <button class="psd-share-btn" id="psdCopyLinkBtn" type="button">Copy Link</button>
    </div>
  `;

  const firstPanel = main.querySelector(".panel.hero") || main.querySelector(".panel");
  if (firstPanel && firstPanel.nextSibling) {
    main.insertBefore(box, firstPanel.nextSibling);
  } else {
    main.insertBefore(box, main.firstChild);
  }

  const copyBtn = document.getElementById("psdCopyLinkBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(currentUrl);
        copyBtn.textContent = "Copied";
        psdTrack("copy_share_link", { page_url: currentUrl });
        setTimeout(() => copyBtn.textContent = "Copy Link", 1200);
      } catch (e) {
        copyBtn.textContent = "Copy Failed";
        setTimeout(() => copyBtn.textContent = "Copy Link", 1200);
      }
    });
  }
}

function psdFallbackFromElement(el) {
  const card = el.closest(".instrument-card");
  if (card) {
    const dailyRow = Array.from(card.querySelectorAll(".info-row")).find(row =>
      row.textContent.trim().toLowerCase().startsWith("daily:")
    );

    if (dailyRow) {
      const text = dailyRow.textContent.toLowerCase();
      if (text.includes("bullish")) return "Bullish";
      if (text.includes("bearish")) return "Bearish";
      if (text.includes("neutral")) return "Neutral";
    }
  }

  const rail = el.closest(".rail-item");
  if (rail) {
    if (rail.classList.contains("direction-up")) return "Bullish";
    if (rail.classList.contains("direction-down")) return "Bearish";
    if (rail.classList.contains("direction-neutral")) return "Neutral";
  }

  const newsCard = el.closest(".news-card");
  if (newsCard) {
    const tech = newsCard.querySelector(".tech-chip");
    const text = tech ? tech.textContent.toLowerCase() : "";
    if (text.includes("bullish")) return "Bullish";
    if (text.includes("bearish")) return "Bearish";
    if (text.includes("neutral")) return "Neutral";
  }

  return "N/A";
}

function psdEffectiveSentiment(instrument, fallback) {
  const voted = window.PSD_USER_SENTIMENT?.[instrument];
  if (voted && voted !== "N/A") return voted;
  return fallback || "N/A";
}

async function psdLoadUserSentiment() {
  if (!PSD_SUPABASE_URL || !PSD_SUPABASE_ANON_KEY) return;

  try {
    const response = await fetch(`${PSD_SUPABASE_URL}/rest/v1/rpc/get_user_sentiment`, {
      method: "POST",
      headers: psdHeaders(),
      body: "{}"
    });

    if (!response.ok) {
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
  } catch (error) {
    console.warn("User sentiment load failed", error);
  }
}

function psdApplyUserSentiment() {
  document.querySelectorAll("[data-user-sentiment]").forEach(el => {
    const instrument = el.getAttribute("data-user-sentiment");
    const fallback = psdFallbackFromElement(el);
    const value = psdEffectiveSentiment(instrument, fallback);

    if (el.classList.contains("user-chip")) {
      el.textContent = "User: " + value;
      el.className = "chip user-chip " + psdClass(value);
    } else {
      el.textContent = value;
      el.className = "psd-user-sentiment-value " + psdClass(value);
    }
  });
}

async function psdSubmitVote(instrument, vote) {
  const status = document.getElementById("psdVoteStatus");
  if (!status) return;

  status.textContent = "Submitting...";
  status.className = "psd-vote-status";

  try {
    const response = await fetch(`${PSD_SUPABASE_URL}/rest/v1/rpc/submit_instrument_vote`, {
      method: "POST",
      headers: psdHeaders(),
      body: JSON.stringify({
        p_instrument: instrument,
        p_vote: vote,
        p_voter_id: psdGetVoterId()
      })
    });

    let result = {};
    try {
      result = await response.json();
    } catch (e) {
      result = {};
    }

    if (!response.ok || !result.ok) {
      status.textContent = result.error || `Vote failed. Error ${response.status}`;
      status.className = "psd-vote-status error";
      console.warn("Vote failed:", response.status, result);
      return;
    }

    window.PSD_USER_SENTIMENT[instrument] = result.user_sentiment || "N/A";
    psdApplyUserSentiment();

    psdTrack("instrument_vote", {
      instrument,
      vote,
      result_sentiment: result.user_sentiment || "N/A"
    });

    status.textContent = "Vote saved.";
    status.className = "psd-vote-status success";

    setTimeout(() => {
      const panel = document.getElementById("psdVotePanel");
      if (panel) panel.classList.remove("open");
    }, 700);
  } catch (error) {
    status.textContent = "Vote failed.";
    status.className = "psd-vote-status error";
    console.warn("Vote failed:", error);
  }
}

function psdCreateVoteWidget() {
  if (document.getElementById("psdVoteWidget")) return;

  const wrap = document.createElement("div");
  wrap.id = "psdVoteWidget";
  wrap.className = "psd-vote-widget";

  wrap.innerHTML = `
    <button class="psd-vote-tab" type="button" aria-controls="psdVotePanel" aria-expanded="false">↕ Vote</button>

    <div class="psd-vote-panel" id="psdVotePanel">
      <div class="psd-vote-title">Your Market Vote</div>
      <div class="psd-vote-subtitle">Anonymous daily vote. No registration.</div>

      <label class="psd-vote-label" for="psdVoteInstrument">Instrument</label>
      <select class="psd-vote-select" id="psdVoteInstrument">
        ${PSD_VOTE_INSTRUMENTS.map(x => `<option value="${psdEscape(x)}">${psdEscape(x)}</option>`).join("")}
      </select>

      <div class="psd-vote-choice-row">
        <button class="psd-vote-choice active" type="button" data-vote="Bullish">Bullish</button>
        <button class="psd-vote-choice" type="button" data-vote="Bearish">Bearish</button>
      </div>

      <div class="psd-vote-action-row">
        <button class="psd-vote-submit" id="psdVoteSubmit" type="button">Submit Vote</button>
        <button class="psd-vote-cancel" id="psdVoteCancel" type="button">Cancel</button>
      </div>

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
    tab.setAttribute("aria-expanded", panel.classList.contains("open") ? "true" : "false");
    psdTrack("vote_widget_toggle", { open: panel.classList.contains("open") });
  });

  cancel.addEventListener("click", () => {
    panel.classList.remove("open");
    tab.setAttribute("aria-expanded", "false");
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

function psdInit() {
  psdInjectGlobalMobileCSS();
  psdLoadGA4();
  psdInjectStructuredData();
  psdAddHomeLabel();
  psdCreateAdvertiseBanner();
  psdFixNavigation();
  psdEnhanceFooterLegalLinks();
  psdEnhanceSocialLinks();
  psdCreateVoteWidget();
  psdCreateShareButtons();
  psdApplyUserSentiment();
  psdLoadUserSentiment();

  setTimeout(psdApplyUserSentiment, 500);
  setTimeout(psdApplyUserSentiment, 1500);
  setTimeout(psdApplyUserSentiment, 3000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", psdInit);
} else {
  psdInit();
}

window.addEventListener("load", () => {
  psdInjectGlobalMobileCSS();
  psdAddHomeLabel();
  psdCreateAdvertiseBanner();
  psdFixNavigation();
  psdEnhanceFooterLegalLinks();
  psdEnhanceSocialLinks();
  psdApplyUserSentiment();
});

window.psdApplyUserSentiment = psdApplyUserSentiment;

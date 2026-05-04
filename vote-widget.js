const PSD_SUPABASE_URL = "https://fupexuonvzakoguucglk.supabase.co";
const PSD_SUPABASE_ANON_KEY = "sb_publishable_70UGBdl_7955Ej6tK01awQ_DljLC6sv";

const PSD_VOTE_INSTRUMENTS = [
  "S&P 500 / ES",
  "Nasdaq / NQ",
  "Dow / YM",
  "Russell / RTY",
  "VIX",
  "DAX",
  "FTSE 100",
  "Nikkei 225",
  "Hang Seng",
  "Euro Stoxx 50",
  "CAC 40",
  "US 2Y Treasury",
  "US 10Y Treasury",
  "Treasury Yields",
  "US Dollar / DXY",
  "EUR / EURUSD",
  "GBP / GBPUSD",
  "JPY / USDJPY",
  "CHF / USDCHF",
  "CAD / USDCAD",
  "AUD / AUDUSD",
  "NZD / NZDUSD",
  "EURJPY",
  "EURGBP",
  "GBPJPY",
  "AUDJPY",
  "CADJPY",
  "EURCHF",
  "EURCAD",
  "AUDCAD",
  "AUDNZD",
  "NZDJPY",
  "USDTRY",
  "USDMXN",
  "USDZAR",
  "Bitcoin / BTC",
  "Ethereum / ETH",
  "Solana / SOL",
  "XRP",
  "BNB",
  "Cardano / ADA",
  "Dogecoin / DOGE",
  "General Crypto",
  "Gold",
  "Silver",
  "Copper",
  "Crude Oil",
  "Natural Gas",
  "Fed / FOMC",
  "CPI / Inflation",
  "PPI",
  "Jobs / NFP",
  "US GDP / Growth",
  "Geopolitical / Tariffs"
];

window.PSD_USER_SENTIMENT = window.PSD_USER_SENTIMENT || {};

function psdEscape(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
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
    .psd-logo-home-wrap{
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:4px;
      flex-shrink:0;
    }
    .psd-logo-home-word{
      color:#ffd780;
      font-size:11px;
      font-weight:600;
      line-height:1;
      letter-spacing:.2px;
    }
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
    ["news-articles.html", "News & Articles"],
    ["market-sentiment.html", "Guides"],
    ["contact.html", "Get in Touch"],
    ["how-it-works.html", "Dashboard Works"],
    ["about.html", "About"]
  ];

  Array.from(nav.querySelectorAll("a")).forEach(link => {
    const href = link.getAttribute("href") || "";
    if(href.includes("index.html")) link.remove();
  });

  order.forEach(([href, label]) => {
    const link = Array.from(nav.querySelectorAll("a")).find(a => (a.getAttribute("href") || "").includes(href));
    if(link){
      link.textContent = label;
      nav.appendChild(link);
    }
  });

  const social = nav.querySelector(".social-links");
  if(social) nav.appendChild(social);
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

  if(voted && voted !== "N/A"){
    return voted;
  }

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

    if(!response.ok) return;

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

    const result = await response.json();

    if(!response.ok || !result.ok){
      status.textContent = result.error || "Vote failed.";
      status.className = "psd-vote-status error";
      return;
    }

    window.PSD_USER_SENTIMENT[instrument] = result.user_sentiment || "N/A";
    psdApplyUserSentiment();

    status.textContent = "Vote saved.";
    status.className = "psd-vote-status success";

    setTimeout(() => {
      const panel = document.getElementById("psdVotePanel");
      if(panel) panel.classList.remove("open");
    }, 700);
  }catch(error){
    status.textContent = "Vote failed.";
    status.className = "psd-vote-status error";
  }
}

function psdCreateVoteWidget(){
  if(document.getElementById("psdVoteWidget")) return;

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

function psdInit(){
  psdAddHomeLabel();
  psdFixNavigation();
  psdCreateVoteWidget();
  psdApplyUserSentiment();
  psdLoadUserSentiment();

  setTimeout(psdApplyUserSentiment, 500);
  setTimeout(psdApplyUserSentiment, 1500);
  setTimeout(psdApplyUserSentiment, 3000);
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", psdInit);
}else{
  psdInit();
}

window.addEventListener("load", () => {
  psdAddHomeLabel();
  psdFixNavigation();
  psdApplyUserSentiment();
});

window.psdApplyUserSentiment = psdApplyUserSentiment;

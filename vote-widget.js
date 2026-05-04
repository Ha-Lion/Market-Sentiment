const PSD_SUPABASE_URL = "PASTE_SUPABASE_PROJECT_URL_HERE";
const PSD_SUPABASE_ANON_KEY = "PASTE_SUPABASE_ANON_PUBLIC_KEY_HERE";

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

window.PSD_USER_SENTIMENT = {};

function psdEscape(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function psdGetVoterId(){
  let id = localStorage.getItem("psd_voter_id");

  if(!id){
    if(window.crypto && crypto.randomUUID){
      id = crypto.randomUUID();
    }else{
      id = "voter_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }

    localStorage.setItem("psd_voter_id", id);
  }

  return id;
}

function psdVoteHeaders(){
  return {
    "apikey": PSD_SUPABASE_ANON_KEY,
    "Authorization": "Bearer " + PSD_SUPABASE_ANON_KEY,
    "Content-Type": "application/json"
  };
}

async function psdLoadUserSentiment(){
  if(!PSD_SUPABASE_URL || PSD_SUPABASE_URL.includes("PASTE_")) return;

  try{
    const response = await fetch(`${PSD_SUPABASE_URL}/rest/v1/rpc/get_user_sentiment`, {
      method:"POST",
      headers:psdVoteHeaders(),
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
    const value = window.PSD_USER_SENTIMENT[instrument] || "N/A";

    el.textContent = value;
    el.className = "psd-user-sentiment-value " + value.replace(/[^a-zA-Z]/g,"");
  });
}

async function psdSubmitVote(instrument, vote){
  const status = document.getElementById("psdVoteStatus");

  if(!PSD_SUPABASE_URL || PSD_SUPABASE_URL.includes("PASTE_")){
    status.textContent = "Voting is not connected yet.";
    status.className = "psd-vote-status error";
    return;
  }

  status.textContent = "Submitting...";
  status.className = "psd-vote-status";

  try{
    const response = await fetch(`${PSD_SUPABASE_URL}/rest/v1/rpc/submit_instrument_vote`, {
      method:"POST",
      headers:psdVoteHeaders(),
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
        <button type="button" class="psd-vote-choice bullish" data-vote="Bullish">Bullish</button>
        <button type="button" class="psd-vote-choice bearish" data-vote="Bearish">Bearish</button>
      </div>

      <button type="button" class="psd-vote-submit" id="psdVoteSubmit">Submit Vote</button>
      <div class="psd-vote-status" id="psdVoteStatus"></div>
    </div>
  `;

  document.body.appendChild(wrap);

  const tab = wrap.querySelector(".psd-vote-tab");
  const panel = wrap.querySelector("#psdVotePanel");
  const submit = wrap.querySelector("#psdVoteSubmit");
  const choices = wrap.querySelectorAll(".psd-vote-choice");

  let selectedVote = "Bullish";
  choices[0].classList.add("active");

  tab.addEventListener("click", () => {
    panel.classList.toggle("open");
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

document.addEventListener("DOMContentLoaded", () => {
  psdCreateVoteWidget();
  psdLoadUserSentiment();
});

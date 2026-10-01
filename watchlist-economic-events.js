(function(){
  "use strict";

  const FEED_URL="https://fupexuonvzakoguucglk.supabase.co/functions/v1/economic-calendar-feed";
  const MAJOR_COUNTRIES=["US","EU","GB","JP","CA","CN","AU","CH","NZ"];

  const grid=document.getElementById("watchlist-grid");
  const modal=document.getElementById("watchlist-modal");
  const modalTitle=document.getElementById("watchlist-modal-title");
  const modalBody=document.getElementById("watchlist-modal-body");

  if(!grid||!modal||!modalTitle||!modalBody)return;

  let weeklyFeedPromise=null;

  function esc(v){
    return String(v??"").replace(/[&<>"']/g,c=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  function pad(n){return String(n).padStart(2,"0");}
  function ymd(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}

  function startOfWeek(d){
    const x=new Date(d);
    x.setHours(12,0,0,0);
    const day=x.getDay();
    x.setDate(x.getDate()-(day===0?6:day-1));
    return x;
  }

  function addDays(d,n){
    const x=new Date(d);
    x.setDate(x.getDate()+n);
    return x;
  }

  function normalizedCountry(e){
    let c=String(e?.country_code||e?.countryCode||"").toUpperCase().trim();
    if(c==="UK")c="GB";
    if(c==="EA"||c==="EMU")c="EU";
    return c;
  }

  function impactName(e){
    const n=Number(e?.importance||0);
    return n>=3?"High":n===2?"Medium":"Low";
  }

  function impactClass(e){
    const v=impactName(e);
    return v==="High"?"high":v==="Medium"?"medium":"low";
  }

  function eventCategory(e){
    const s=`${e?.category||""} ${e?.event||""}`.toLowerCase();

    if(/cpi|pce|inflation|ppi|price index|consumer price|producer price/.test(s)) return "Inflation";
    if(/employment|unemployment|payroll|job|jolts|claims|wage|earnings/.test(s)) return "Labor";
    if(/interest rate|rate decision|fomc|fed|ecb|boe|boj|rba|rbnz|snb|monetary|speech/.test(s)) return "Central Bank";
    if(/retail|consumer confidence|consumer sentiment/.test(s)) return "Consumer";
    if(/gdp|pmi|industrial|manufacturing|services|production|orders|business|activity/.test(s)) return "Growth";
    if(/oil|crude|gas|inventory|eia/.test(s)) return "Energy";
    if(/housing|home|mortgage|building permit|construction/.test(s)) return "Housing";
    if(/trade|export|import|current account/.test(s)) return "Trade";
    return "Other";
  }

  function eventTime(e){
    const d=new Date(e?.date||"");
    if(Number.isNaN(d.getTime()))return "—";
    return new Intl.DateTimeFormat("en-US",{
      weekday:"short",
      month:"short",
      day:"numeric",
      hour:"numeric",
      minute:"2-digit"
    }).format(d);
  }

  function countryName(code){
    const names={
      US:"US",EU:"Eurozone",GB:"UK",JP:"Japan",CA:"Canada",
      CN:"China",AU:"Australia",CH:"Switzerland",NZ:"New Zealand"
    };
    return names[code]||code||"Global";
  }

  function minImpactAllows(e,profile){
    const impact=impactName(e);
    if(profile.minImpact==="medium" && impact==="Low")return false;
    if(profile.minImpact==="high" && impact!=="High")return false;
    return true;
  }

  function instrumentProfile(name,symbol){
    const n=String(name||"").trim();
    const s=String(symbol||"").replace(/\s+/g,"").toUpperCase();
    const text=`${n} ${s}`.toLowerCase();

    const currencyCountry={
      USD:"US",EUR:"EU",GBP:"GB",JPY:"JP",CAD:"CA",
      AUD:"AU",CHF:"CH",NZD:"NZ",CNY:"CN"
    };

    const makeFx=(a,b)=>({
      kind:"fx",
      countries:[currencyCountry[a],currencyCountry[b]].filter(Boolean),
      categories:[],
      minImpact:"low",
      maxEvents:8,
      categoryWeights:{
        "Central Bank":6,"Inflation":5,"Labor":4,"Growth":3,
        "Consumer":2,"Trade":2,"Housing":1,"Energy":1,"Other":1
      },
      patterns:[
        {re:/rate decision|fomc|fed|ecb|boe|boj|rba|rbnz|snb/i,bonus:36},
        {re:/cpi|pce|inflation|ppi/i,bonus:28},
        {re:/payroll|nfp|employment|jobless|unemployment/i,bonus:20},
        {re:/gdp|pmi/i,bonus:15}
      ],
      reason:`Events affecting ${a} or ${b}`
    });

    /* Forex pairs: events from both currencies. */
    const compact=s.replace(/[^A-Z]/g,"");
    if(/^[A-Z]{6}$/.test(compact)){
      return makeFx(compact.slice(0,3),compact.slice(3,6));
    }

    const pairMatch=n.toUpperCase().match(/\b(USD|EUR|GBP|JPY|CAD|AUD|CHF|NZD|CNY)\s*\/\s*(USD|EUR|GBP|JPY|CAD|AUD|CHF|NZD|CNY)\b/);
    if(pairMatch) return makeFx(pairMatch[1],pairMatch[2]);

    if(/\b(bitcoin|btc|ethereum|eth|crypto)\b/i.test(text)){
      return {
        kind:"crypto",
        countries:["US"],
        categories:["Inflation","Labor","Central Bank","Growth"],
        minImpact:"medium",
        maxEvents:4,
        categoryWeights:{"Central Bank":6,"Inflation":6,"Labor":3,"Growth":2},
        patterns:[
          {re:/fomc|federal reserve|fed|rate decision|interest rate/i,bonus:38},
          {re:/cpi|pce|inflation|ppi/i,bonus:34},
          {re:/nonfarm|nfp|payroll/i,bonus:22},
          {re:/gdp/i,bonus:12},
          {re:/ism|pmi/i,bonus:10},
          {re:/jobless|claims/i,bonus:5}
        ],
        reason:"Top U.S. liquidity, rate and inflation releases most relevant to crypto"
      };
    }

    if(/\b(gold|gld|precious|real yields|gold etf|gold flows)\b/i.test(text)){
      return {
        kind:"gold",
        countries:["US"],
        categories:["Inflation","Labor","Central Bank","Growth"],
        minImpact:"medium",
        maxEvents:4,
        categoryWeights:{"Inflation":7,"Central Bank":6,"Labor":4,"Growth":1},
        patterns:[
          {re:/cpi|pce|inflation|ppi/i,bonus:42},
          {re:/fomc|federal reserve|fed|rate decision|interest rate/i,bonus:38},
          {re:/nonfarm|nfp|payroll|jobless|claims/i,bonus:24},
          {re:/gdp/i,bonus:6},
          {re:/ism|pmi/i,bonus:1}
        ],
        reason:"Top U.S. inflation, rate and real-yield drivers most relevant to gold"
      };
    }

    if(/\b(crude|wti|brent|oil|energy|natural gas)\b/i.test(text)){
      return {
        kind:"energy",
        countries:["US"],
        categories:["Energy","Growth","Central Bank"],
        minImpact:"medium",
        maxEvents:4,
        categoryWeights:{"Energy":8,"Growth":4,"Central Bank":2},
        patterns:[
          {re:/eia|inventory|inventories|crude|oil|gas/i,bonus:50},
          {re:/gdp|ism|pmi|manufacturing/i,bonus:22},
          {re:/fomc|fed|rate decision/i,bonus:8}
        ],
        reason:"Energy inventories and demand-sensitive macro releases most relevant to this asset"
      };
    }

    if(/\b(pltr|palantir|dow|ym|s&p|spy|nasdaq|nq|russell|rty|mstr|coin|djt|lmt)\b/i.test(text)){
      return {
        kind:"us-equity",
        countries:["US"],
        categories:["Inflation","Labor","Central Bank","Consumer","Growth","Housing"],
        minImpact:"medium",
        maxEvents:5,
        categoryWeights:{
          "Central Bank":6,"Growth":5,"Labor":4,"Consumer":4,"Inflation":3,"Housing":2
        },
        patterns:[
          {re:/fomc|fed|rate decision|interest rate/i,bonus:36},
          {re:/gdp|ism|pmi/i,bonus:26},
          {re:/nonfarm|nfp|payroll/i,bonus:23},
          {re:/consumer confidence|retail sales/i,bonus:20},
          {re:/cpi|pce|inflation/i,bonus:18}
        ],
        reason:"Highest-impact U.S. macro releases most relevant to this equity asset"
      };
    }

    const regional=(countries,reason)=>({
      kind:"regional",
      countries,
      categories:[],
      minImpact:"medium",
      maxEvents:6,
      categoryWeights:{
        "Central Bank":6,"Inflation":5,"Labor":4,"Growth":4,
        "Consumer":3,"Trade":2,"Housing":2,"Energy":1,"Other":1
      },
      patterns:[
        {re:/rate decision|central bank|fomc|ecb|boe|boj|rba|rbnz|snb/i,bonus:32},
        {re:/cpi|inflation|ppi/i,bonus:25},
        {re:/employment|payroll|unemployment|jobless/i,bonus:20},
        {re:/gdp|pmi/i,bonus:18}
      ],
      reason
    });

    if(/\b(dax|euro|eur|stoxx)\b/i.test(text)) return regional(["EU","DE","FR","IT","ES"],"Euro-area economic releases most relevant to this asset");
    if(/\b(ftse|gbp|uk)\b/i.test(text)) return regional(["GB"],"UK economic releases most relevant to this asset");
    if(/\b(nikkei|jpy|japan)\b/i.test(text)) return regional(["JP"],"Japan economic releases most relevant to this asset");
    if(/\b(cad|canada|tsx)\b/i.test(text)) return regional(["CA"],"Canadian economic releases most relevant to this asset");
    if(/\b(aud|australia|asx)\b/i.test(text)) return regional(["AU"],"Australian economic releases most relevant to this asset");
    if(/\b(chf|swiss|switzerland|smi)\b/i.test(text)) return regional(["CH"],"Swiss economic releases most relevant to this asset");
    if(/\b(nzd|new zealand)\b/i.test(text)) return regional(["NZ"],"New Zealand economic releases most relevant to this asset");

    return {
      kind:"default",
      countries:[],
      categories:["Inflation","Labor","Central Bank","Growth"],
      minImpact:"high",
      maxEvents:4,
      categoryWeights:{"Central Bank":6,"Inflation":5,"Labor":4,"Growth":3},
      patterns:[],
      reason:"Major high-impact macro releases most likely to affect this asset"
    };
  }

  function eventRelevanceScore(e,profile){
    if(!minImpactAllows(e,profile)) return -1;

    const country=normalizedCountry(e);
    const category=eventCategory(e);
    const text=`${e?.event||""} ${e?.category||""}`.toLowerCase();

    if(profile.countries.length && !profile.countries.includes(country)) return -1;
    if(profile.categories.length && !profile.categories.includes(category)) return -1;

    let score=0;

    const impact=impactName(e);
    score += impact==="High" ? 30 : impact==="Medium" ? 18 : 7;

    if(profile.countries.includes(country)) score += 20;

    const categoryWeight=Number(profile.categoryWeights?.[category]||0);
    score += categoryWeight*10;

    for(const rule of profile.patterns||[]){
      if(rule.re.test(text)) score += Number(rule.bonus||0);
    }

    return score;
  }

  async function getWeeklyFeed(){
    if(weeklyFeedPromise)return weeklyFeedPromise;

    weeklyFeedPromise=(async()=>{
      const start=startOfWeek(new Date());
      const end=addDays(start,6);

      const res=await fetch(FEED_URL,{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          start:ymd(start),
          end:ymd(end),
          countries:MAJOR_COUNTRIES
        }),
        cache:"no-store"
      });

      if(!res.ok)throw new Error("Economic calendar feed unavailable.");

      const data=await res.json();
      return (Array.isArray(data.events)?data.events:[])
        .filter(e=>e&&e.date);
    })();

    return weeklyFeedPromise;
  }

  function renderEvents(name,profile,events){
    modalBody.textContent="";

    const style=document.getElementById("watchlist-card-economic-style")||document.createElement("style");
    if(!style.id){
      style.id="watchlist-card-economic-style";
      style.textContent=`
        .watchlist-economic-note{margin:0 0 10px;color:var(--muted);font-size:11px}
        .watchlist-economic-list{display:grid;gap:7px}
        .watchlist-economic-row{
          display:grid;
          grid-template-columns:155px 75px 90px minmax(240px,1fr) 115px 115px 115px 65px;
          gap:8px;align-items:center;border:1px solid var(--line);border-radius:10px;
          padding:8px 9px;background:var(--card)
        }
        .watchlist-economic-row strong{font-size:11px}
        .watchlist-economic-row small{display:block;color:var(--muted);font-size:9px;margin-top:2px}
        .watchlist-economic-impact{font-size:10px;font-weight:900}
        .watchlist-economic-impact.high{color:#d83b38}
        .watchlist-economic-impact.medium{color:#c77b13}
        .watchlist-economic-impact.low{color:#248b4d}
        .watchlist-economic-number{font-size:10px;font-weight:800;white-space:nowrap}
        .watchlist-economic-link{
          justify-self:end;text-decoration:none;border:1px solid #9a6500;border-radius:999px;
          padding:5px 8px;background:#fff7df;color:#563800;font-size:9px;font-weight:900
        }
        body.dark-mode .watchlist-economic-link{background:#33280d;color:#ffe4a3;border-color:#b88a24}
        @media(max-width:900px){
          .watchlist-economic-row{grid-template-columns:1fr 1fr}
          .watchlist-economic-row > div:nth-child(4){grid-column:1/-1}
          .watchlist-economic-link{justify-self:start}
        }
      `;
      document.head.appendChild(style);
    }

    const note=document.createElement("div");
    note.className="watchlist-economic-note";
    note.textContent=profile.reason+" · Ranked by relevance · Current week";
    modalBody.appendChild(note);

    if(!events.length){
      const empty=document.createElement("div");
      empty.className="watchlist-popup-empty";
      empty.textContent="No closely related economic releases are scheduled for this asset this week.";
      modalBody.appendChild(empty);
      return;
    }

    const list=document.createElement("div");
    list.className="watchlist-economic-list";

    events.forEach(item=>{
      const e=item.event;
      const country=normalizedCountry(e);
      const q=encodeURIComponent(e.event||e.category||"");
      const row=document.createElement("article");
      row.className="watchlist-economic-row";
      row.innerHTML=`
        <div><strong>${esc(eventTime(e))}</strong></div>
        <div class="watchlist-economic-impact ${impactClass(e)}">${esc(impactName(e))}</div>
        <div><strong>${esc(countryName(country))}</strong><small>${esc(country)}</small></div>
        <div>
          <strong>${esc(e.event||e.category||"Economic event")}</strong>
          <small>${esc(eventCategory(e))} · relevance ${esc(item.score)}</small>
        </div>
        <div class="watchlist-economic-number">Actual: ${esc(e.actual??"—")}</div>
        <div class="watchlist-economic-number">Forecast: ${esc(e.forecast??e.te_forecast??"—")}</div>
        <div class="watchlist-economic-number">Previous: ${esc(e.previous??"—")}</div>
        <a class="watchlist-economic-link" href="economic-calendar.html?range=week&q=${q}">View</a>
      `;
      list.appendChild(row);
    });

    modalBody.appendChild(list);
  }

  async function openEconomicCalendarForCard(card){
    const titleNode=card.querySelector("h2");
    const symbolNode=card.querySelector(".watchlist-symbol");
    const name=titleNode?titleNode.textContent.trim():"Selected Asset";
    const symbol=symbolNode?symbolNode.textContent.trim():"";
    const profile=instrumentProfile(name,symbol);

    modalTitle.textContent=name+" — Economic Calendar This Week";
    modalBody.innerHTML='<div class="watchlist-popup-empty">Loading relevant economic releases…</div>';
    modal.classList.add("open");
    document.body.style.overflow="hidden";

    try{
      const allEvents=await getWeeklyFeed();
      if(!modal.classList.contains("open"))return;

      const relevant=allEvents
        .map(event=>({event,score:eventRelevanceScore(event,profile)}))
        .filter(item=>item.score>=0)
        .sort((a,b)=>b.score-a.score || new Date(a.event.date)-new Date(b.event.date))
        .slice(0,profile.maxEvents||5);

      renderEvents(name,profile,relevant);
    }catch(err){
      console.error("Asset economic-calendar load failed",err);
      if(modal.classList.contains("open")){
        modalBody.innerHTML='<div class="watchlist-popup-empty">Economic releases could not be loaded right now.</div>';
      }
    }
  }

  function installButtons(){
    grid.querySelectorAll(".watchlist-card").forEach(card=>{
      const actions=card.querySelector(".watchlist-card-actions");
      if(!actions)return;
      if(actions.querySelector(".watchlist-economic-button"))return;

      const button=document.createElement("button");
      button.type="button";
      button.className="watchlist-economic-button";
      button.textContent="Economic Calendar";
      button.addEventListener("click",()=>openEconomicCalendarForCard(card));
      actions.appendChild(button);
    });
  }

  installButtons();

  const observer=new MutationObserver(()=>installButtons());
  observer.observe(grid,{childList:true,subtree:true});

  window.addEventListener("beforeunload",()=>observer.disconnect());
})();

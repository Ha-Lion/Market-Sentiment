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

  function ymd(d){
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

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

  function eventMatchesProfile(e,profile){
    const country=normalizedCountry(e);
    const category=eventCategory(e);
    const impact=impactName(e);

    if(profile.minImpact==="medium" && impact==="Low")return false;
    if(profile.minImpact==="high" && impact!=="High")return false;

    if(profile.countries.length && !profile.countries.includes(country))return false;
    if(profile.categories.length && !profile.categories.includes(category))return false;

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

    /* Forex pairs: events from both currencies. */
    const compact=s.replace(/[^A-Z]/g,"");
    if(/^[A-Z]{6}$/.test(compact)){
      const a=compact.slice(0,3);
      const b=compact.slice(3,6);
      return {
        countries:[currencyCountry[a],currencyCountry[b]].filter(Boolean),
        categories:[],
        minImpact:"low",
        reason:`Events affecting ${a} or ${b}`
      };
    }

    /* Some card titles expose the pair instead of the compact symbol. */
    const pairMatch=n.toUpperCase().match(/\b(USD|EUR|GBP|JPY|CAD|AUD|CHF|NZD|CNY)\s*\/\s*(USD|EUR|GBP|JPY|CAD|AUD|CHF|NZD|CNY)\b/);
    if(pairMatch){
      return {
        countries:[currencyCountry[pairMatch[1]],currencyCountry[pairMatch[2]]].filter(Boolean),
        categories:[],
        minImpact:"low",
        reason:`Events affecting ${pairMatch[1]} or ${pairMatch[2]}`
      };
    }

    /* U.S. equity names and U.S. index futures. */
    if(
      /\b(pltr|palantir|dow|ym|s&p|spy|nasdaq|nq|russell|rty|mstr|coin|djt|lmt)\b/i.test(text)
    ){
      return {
        countries:["US"],
        categories:["Inflation","Labor","Central Bank","Consumer","Growth","Housing"],
        minImpact:"medium",
        reason:"U.S. macro events most relevant to this asset"
      };
    }

    /* Bitcoin / crypto: focus on liquidity, rates, inflation and labor. */
    if(/\b(bitcoin|btc|ethereum|eth|crypto)\b/i.test(text)){
      return {
        countries:["US"],
        categories:["Inflation","Labor","Central Bank","Growth"],
        minImpact:"medium",
        reason:"U.S. liquidity, rates and macro events most relevant to crypto"
      };
    }

    /* Gold / real yields / precious-metals cards. */
    if(/\b(gold|gld|precious|real yields|inflation)\b/i.test(text)){
      return {
        countries:["US"],
        categories:["Inflation","Labor","Central Bank","Growth"],
        minImpact:"medium",
        reason:"U.S. inflation, rates and growth events most relevant to gold and real yields"
      };
    }

    /* Oil / energy. */
    if(/\b(crude|wti|brent|oil|energy|natural gas)\b/i.test(text)){
      return {
        countries:["US"],
        categories:["Energy","Growth","Central Bank"],
        minImpact:"medium",
        reason:"Energy inventories and major U.S. macro events"
      };
    }

    /* Europe. */
    if(/\b(dax|euro|eur|stoxx)\b/i.test(text)){
      return {
        countries:["EU","DE","FR","IT","ES"],
        categories:[],
        minImpact:"medium",
        reason:"Euro-area economic releases"
      };
    }

    /* UK. */
    if(/\b(ftse|gbp|uk)\b/i.test(text)){
      return {
        countries:["GB"],
        categories:[],
        minImpact:"medium",
        reason:"UK economic releases"
      };
    }

    /* Japan. */
    if(/\b(nikkei|jpy|japan)\b/i.test(text)){
      return {
        countries:["JP"],
        categories:[],
        minImpact:"medium",
        reason:"Japan economic releases"
      };
    }

    /* Canada. */
    if(/\b(cad|canada|tsx)\b/i.test(text)){
      return {
        countries:["CA"],
        categories:[],
        minImpact:"medium",
        reason:"Canadian economic releases"
      };
    }

    /* Australia. */
    if(/\b(aud|australia|asx)\b/i.test(text)){
      return {
        countries:["AU"],
        categories:[],
        minImpact:"medium",
        reason:"Australian economic releases"
      };
    }

    /* Switzerland. */
    if(/\b(chf|swiss|switzerland|smi)\b/i.test(text)){
      return {
        countries:["CH"],
        categories:[],
        minImpact:"medium",
        reason:"Swiss economic releases"
      };
    }

    /* New Zealand. */
    if(/\b(nzd|new zealand)\b/i.test(text)){
      return {
        countries:["NZ"],
        categories:[],
        minImpact:"medium",
        reason:"New Zealand economic releases"
      };
    }

    /* Default: global high-impact events only. */
    return {
      countries:[],
      categories:["Inflation","Labor","Central Bank","Growth"],
      minImpact:"high",
      reason:"Major macro releases most likely to affect this asset"
    };
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
        .filter(e=>e&&e.date)
        .sort((a,b)=>new Date(a.date)-new Date(b.date));
    })();

    return weeklyFeedPromise;
  }

  function renderEvents(name,profile,events){
    modalBody.textContent="";

    const style=document.getElementById("watchlist-card-economic-style")||document.createElement("style");
    if(!style.id){
      style.id="watchlist-card-economic-style";
      style.textContent=`
        .watchlist-economic-note{
          margin:0 0 10px;
          color:var(--muted);
          font-size:11px;
        }
        .watchlist-economic-list{
          display:grid;
          gap:7px;
        }
        .watchlist-economic-row{
          display:grid;
          grid-template-columns:155px 75px 90px minmax(240px,1fr) 115px 115px 115px 65px;
          gap:8px;
          align-items:center;
          border:1px solid var(--line);
          border-radius:10px;
          padding:8px 9px;
          background:var(--card);
        }
        .watchlist-economic-row strong{font-size:11px}
        .watchlist-economic-row small{
          display:block;
          color:var(--muted);
          font-size:9px;
          margin-top:2px;
        }
        .watchlist-economic-impact{
          font-size:10px;
          font-weight:900;
        }
        .watchlist-economic-impact.high{color:#d83b38}
        .watchlist-economic-impact.medium{color:#c77b13}
        .watchlist-economic-impact.low{color:#248b4d}
        .watchlist-economic-number{
          font-size:10px;
          font-weight:800;
          white-space:nowrap;
        }
        .watchlist-economic-link{
          justify-self:end;
          text-decoration:none;
          border:1px solid #9a6500;
          border-radius:999px;
          padding:5px 8px;
          background:#fff7df;
          color:#563800;
          font-size:9px;
          font-weight:900;
        }
        body.dark-mode .watchlist-economic-link{
          background:#33280d;
          color:#ffe4a3;
          border-color:#b88a24;
        }
        @media(max-width:900px){
          .watchlist-economic-row{
            grid-template-columns:1fr 1fr;
          }
          .watchlist-economic-row > div:nth-child(4){
            grid-column:1/-1;
          }
          .watchlist-economic-link{
            justify-self:start;
          }
        }
      `;
      document.head.appendChild(style);
    }

    const note=document.createElement("div");
    note.className="watchlist-economic-note";
    note.textContent=profile.reason+" · Current week";
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

    events.forEach(e=>{
      const country=normalizedCountry(e);
      const q=encodeURIComponent(e.event||e.category||"");
      const row=document.createElement("article");
      row.className="watchlist-economic-row";
      row.innerHTML=`
        <div><strong>${esc(eventTime(e))}</strong></div>
        <div class="watchlist-economic-impact ${impactClass(e)}">${esc(impactName(e))}</div>
        <div><strong>${esc(countryName(country))}</strong><small>${esc(country)}</small></div>
        <div><strong>${esc(e.event||e.category||"Economic event")}</strong><small>${esc(eventCategory(e))}</small></div>
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
        .filter(e=>eventMatchesProfile(e,profile))
        .slice(0,40);

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
      button.addEventListener("click",()=>{
        openEconomicCalendarForCard(card);
      });

      actions.appendChild(button);
    });
  }

  installButtons();

  const observer=new MutationObserver(()=>{
    installButtons();
  });

  observer.observe(grid,{
    childList:true,
    subtree:true
  });

  window.addEventListener("beforeunload",()=>{
    observer.disconnect();
  });
})();

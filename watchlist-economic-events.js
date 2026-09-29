(function(){
  "use strict";

  const FEED_URL="https://fupexuonvzakoguucglk.supabase.co/functions/v1/economic-calendar-feed";

  function esc(v){
    return String(v??"").replace(/[&<>"']/g,c=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  function pad(n){return String(n).padStart(2,"0");}
  function ymd(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}

  function startOfWeek(d){
    const x=new Date(d);
    x.setHours(0,0,0,0);
    const day=x.getDay();
    x.setDate(x.getDate()-(day===0?6:day-1));
    return x;
  }

  function addDays(d,n){
    const x=new Date(d);
    x.setDate(x.getDate()+n);
    return x;
  }

  function impact(e){
    const n=Number(e.importance||0);
    return n>=3?"High":n===2?"Medium":"Low";
  }

  function impactClass(v){
    return v==="High"?"high":v==="Medium"?"medium":"low";
  }

  function when(e){
    const d=new Date(e.date);
    if(Number.isNaN(d.getTime()))return "—";
    return new Intl.DateTimeFormat("en-US",{
      weekday:"short",
      month:"short",
      day:"numeric",
      hour:"numeric",
      minute:"2-digit"
    }).format(d);
  }

  function countryLabel(e){
    return String(e.country||e.country_code||e.countryCode||"").trim() || "Global";
  }

  function installSection(){
    let section=document.getElementById("watchlist-economic-events");
    if(section)return section;

    const grid=document.getElementById("watchlist-grid");
    if(!grid)return null;

    section=document.createElement("section");
    section.id="watchlist-economic-events";
    section.className="panel watchlist-economic-events";
    section.hidden=true;

    section.innerHTML=`
      <div class="watchlist-economic-head">
        <div>
          <h2>Economic Releases This Week</h2>
          <p>Live scheduled economic releases for the current week.</p>
        </div>
        <a class="watchlist-action secondary" href="economic-calendar.html?range=week">Open Full Economic Calendar</a>
      </div>

      <div id="watchlist-economic-status" class="watchlist-status">
        Open the weekly calendar to load economic releases.
      </div>

      <div id="watchlist-economic-list" class="watchlist-economic-list"></div>
    `;

    grid.insertAdjacentElement("afterend",section);

    if(!document.getElementById("watchlist-economic-style")){
      const style=document.createElement("style");
      style.id="watchlist-economic-style";
      style.textContent=`
        .watchlist-economic-events{
          margin-top:14px;
          padding:14px;
        }

        .watchlist-economic-events[hidden]{
          display:none!important;
        }

        .watchlist-economic-head{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:12px;
          margin-bottom:10px;
        }

        .watchlist-economic-head h2{
          margin:0 0 3px;
          font-size:22px;
        }

        .watchlist-economic-head p{
          margin:0;
          color:var(--muted);
          font-size:12px;
        }

        .watchlist-economic-list{
          display:grid;
          gap:7px;
          margin-top:8px;
        }

        .watchlist-economic-row{
          display:grid;
          grid-template-columns:165px 85px 110px minmax(260px,1fr) 100px;
          align-items:center;
          gap:10px;
          border:1px solid var(--line);
          border-radius:10px;
          padding:9px 10px;
          background:var(--card);
        }

        .watchlist-economic-row strong{
          font-size:12px;
        }

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

        .watchlist-economic-country{
          font-size:10px;
          font-weight:850;
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
          white-space:nowrap;
        }

        .watchlist-economic-link:hover{
          background:#f5df9c;
          color:#2f1e00;
          border-color:#6b4700;
        }

        body.dark-mode .watchlist-economic-link{
          background:#33280d;
          color:#ffe4a3;
          border-color:#b88a24;
        }

        #watchlist-economic-toggle[aria-expanded="true"]{
          box-shadow:inset 0 0 0 1px rgba(255,255,255,.35),0 3px 12px rgba(154,101,0,.28);
        }

        @media(max-width:1000px){
          .watchlist-economic-row{
            grid-template-columns:150px 75px 90px minmax(220px,1fr) 80px;
          }
        }

        @media(max-width:760px){
          .watchlist-economic-head{
            flex-direction:column;
          }

          .watchlist-economic-row{
            grid-template-columns:1fr;
            gap:4px;
          }

          .watchlist-economic-link{
            justify-self:start;
            margin-top:3px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    return section;
  }

  let loaded=false;
  let loading=false;

  async function loadEvents(){
    if(loaded||loading)return;
    loading=true;

    const status=document.getElementById("watchlist-economic-status");
    const list=document.getElementById("watchlist-economic-list");

    if(status)status.textContent="Loading this week’s economic releases…";

    try{
      const start=startOfWeek(new Date());
      const end=addDays(start,6);

      const res=await fetch(FEED_URL,{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          start:ymd(start),
          end:ymd(end),
          countries:[]
        }),
        cache:"no-store"
      });

      if(!res.ok)throw new Error("Economic calendar feed unavailable.");

      const data=await res.json();
      const events=(Array.isArray(data.events)?data.events:[])
        .filter(e=>e && e.date)
        .sort((a,b)=>new Date(a.date)-new Date(b.date));

      if(!events.length){
        status.textContent="No economic releases are scheduled for this week.";
        list.innerHTML="";
        loaded=true;
        return;
      }

      status.textContent=`${events.length} economic release${events.length===1?"":"s"} scheduled this week.`;

      list.innerHTML=events.map(e=>{
        const imp=impact(e);
        const q=encodeURIComponent(e.event||e.category||"");
        return `
          <article class="watchlist-economic-row">
            <div>
              <strong>${esc(when(e))}</strong>
            </div>

            <div class="watchlist-economic-impact ${impactClass(imp)}">
              ${esc(imp)}
            </div>

            <div class="watchlist-economic-country">
              ${esc(countryLabel(e))}
            </div>

            <div>
              <strong>${esc(e.event||e.category||"Economic event")}</strong>
              <small>
                ${esc(e.category||"")}
                ${e.actual!==null&&e.actual!==undefined&&e.actual!==""?` · Actual: ${esc(e.actual)}`:""}
                ${e.forecast!==null&&e.forecast!==undefined&&e.forecast!==""?` · Forecast: ${esc(e.forecast)}`:""}
              </small>
            </div>

            <a class="watchlist-economic-link"
               href="economic-calendar.html?q=${q}&range=week">
              View
            </a>
          </article>
        `;
      }).join("");

      loaded=true;
    }catch(err){
      console.error("Watchlist economic calendar load failed",err);
      if(status)status.textContent="Economic releases could not be loaded right now.";
    }finally{
      loading=false;
    }
  }

  function initialize(){
    const button=document.getElementById("watchlist-economic-toggle");
    const section=installSection();

    if(!button||!section)return;

    button.addEventListener("click",async()=>{
      const opening=section.hidden;

      section.hidden=!opening;
      button.setAttribute("aria-expanded",opening?"true":"false");
      button.textContent=opening?"Close Economic Calendar":"Economic Calendar";

      if(opening){
        await loadEvents();
        requestAnimationFrame(()=>{
          section.scrollIntoView({
            behavior:"smooth",
            block:"start"
          });
        });
      }
    });
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",initialize,{once:true});
  }else{
    initialize();
  }
})();

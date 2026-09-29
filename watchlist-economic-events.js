(function(){
  "use strict";

  const FEED_URL="https://fupexuonvzakoguucglk.supabase.co/functions/v1/economic-calendar-feed";
  const client=window.psdSupabase;
  if(!client)return;

  function esc(v){
    return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  }
  function pad(n){return String(n).padStart(2,"0");}
  function ymd(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
  function startOfWeek(d){
    const x=new Date(d);x.setHours(0,0,0,0);
    const day=x.getDay();x.setDate(x.getDate()-(day===0?6:day-1));return x;
  }
  function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}

  function watchlistTags(name){
    const s=String(name||"").toLowerCase();
    const tags=[];
    if(/s&p 500|\/ es\b|\bspy\b|nasdaq|\/ nq\b|dow|\/ ym\b|russell|\/ rty\b/.test(s)) tags.push("SPY");
    if(/dollar|dxy/.test(s)) tags.push("USD");
    if(/eur|eurusd/.test(s)) tags.push("EUR");
    if(/gbp|gbpusd/.test(s)) tags.push("GBP");
    if(/jpy|usdjpy/.test(s)) tags.push("JPY");
    if(/cad|usdcad/.test(s)) tags.push("CAD");
    if(/aud|audusd/.test(s)) tags.push("AUD");
    if(/bitcoin|btc/.test(s)) tags.push("BTC");
    if(/gold/.test(s)) tags.push("Gold");
    if(/silver/.test(s)) tags.push("Silver");
    if(/copper/.test(s)) tags.push("Copper");
    if(/crude|oil/.test(s)) tags.push("WTI","Brent");
    if(/natural gas/.test(s)) tags.push("Natural Gas");
    if(/dax/.test(s)) tags.push("DAX");
    if(/ftse/.test(s)) tags.push("FTSE 100");
    if(/nikkei|n225/.test(s)) tags.push("Nikkei 225");
    if(/hang seng|hsi/.test(s)) tags.push("Hang Seng");
    if(/inflation|real yields/.test(s)) tags.push("Gold","Treasuries","USD");
    return [...new Set(tags)];
  }

  function countryAssets(e){
    const c=String(e.country_code||"").toUpperCase();
    const out=[];
    if(c==="US")out.push("USD","SPY","Treasuries","Gold");
    if(c==="EU"||c==="DE"||c==="FR"||c==="IT"||c==="ES")out.push("EUR","DAX","Gold");
    if(c==="GB"||c==="UK")out.push("GBP","FTSE 100","Gold");
    if(c==="JP")out.push("JPY","Nikkei 225");
    if(c==="CA")out.push("CAD");
    if(c==="CN")out.push("CNY","Hang Seng","Copper");
    if(c==="AU")out.push("AUD","Gold");
    if(c==="CH")out.push("CHF");
    const name=String(e.event||e.category||"").toLowerCase();
    if(/oil|crude|petroleum|inventory/.test(name))out.push("WTI","Brent");
    if(/inflation|cpi|pce|ppi/.test(name))out.push("Gold","Treasuries");
    return [...new Set(out)];
  }

  function impact(e){
    const n=Number(e.importance||0);
    return n>=3?"High":n===2?"Medium":"Low";
  }
  function impactClass(v){return v==="High"?"high":v==="Medium"?"medium":"low";}
  function when(e){
    const d=new Date(e.date);
    if(Number.isNaN(d.getTime()))return "—";
    return new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(d);
  }

  function installSection(){
    if(document.getElementById("watchlist-economic-events"))return document.getElementById("watchlist-economic-events");
    const grid=document.getElementById("watchlist-grid");
    if(!grid)return null;

    const section=document.createElement("section");
    section.id="watchlist-economic-events";
    section.className="panel watchlist-economic-events";
    section.innerHTML=`
      <div class="watchlist-economic-head">
        <div>
          <h2>Economic Events This Week</h2>
          <p>Events connected to markets already saved in your Watchlist.</p>
        </div>
        <a class="watchlist-action secondary" href="economic-calendar.html">Open Economic Calendar</a>
      </div>
      <div id="watchlist-economic-status" class="watchlist-status">Loading economic events…</div>
      <div id="watchlist-economic-list" class="watchlist-economic-list"></div>`;
    grid.insertAdjacentElement("afterend",section);

    const style=document.createElement("style");
    style.id="watchlist-economic-style";
    style.textContent=`
      .watchlist-economic-events{margin-top:14px;padding:14px}
      .watchlist-economic-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
      .watchlist-economic-head h2{margin:0 0 3px;font-size:22px}
      .watchlist-economic-head p{margin:0;color:var(--muted);font-size:12px}
      .watchlist-economic-list{display:grid;gap:7px}
      .watchlist-economic-row{display:grid;grid-template-columns:150px 95px minmax(220px,1fr) 220px 90px;align-items:center;gap:10px;border:1px solid var(--line);border-radius:10px;padding:9px 10px;background:var(--card)}
      .watchlist-economic-row strong{font-size:12px}
      .watchlist-economic-row small{display:block;color:var(--muted);font-size:9px;margin-top:2px}
      .watchlist-economic-impact{font-size:10px;font-weight:900}
      .watchlist-economic-impact.high{color:#d83b38}.watchlist-economic-impact.medium{color:#c77b13}.watchlist-economic-impact.low{color:#248b4d}
      .watchlist-economic-assets{display:flex;flex-wrap:wrap;gap:4px}
      .watchlist-economic-chip{padding:3px 6px;border-radius:999px;background:var(--soft);border:1px solid var(--line);font-size:9px;font-weight:800}
      .watchlist-economic-link{justify-self:end;text-decoration:none;border:1px solid #9a6500;border-radius:999px;padding:5px 8px;background:#fff7df;color:#563800;font-size:9px;font-weight:900}
      body.dark-mode .watchlist-economic-link{background:#33280d;color:#ffe4a3;border-color:#b88a24}
      @media(max-width:900px){.watchlist-economic-row{grid-template-columns:1fr}.watchlist-economic-link{justify-self:start}}
    `;
    document.head.appendChild(style);
    return section;
  }

  async function load(){
    const section=installSection();
    if(!section)return;

    const status=document.getElementById("watchlist-economic-status");
    const list=document.getElementById("watchlist-economic-list");

    try{
      const sessionResult=await client.auth.getSession();
      const user=sessionResult?.data?.session?.user;
      if(!user){status.textContent="Sign in to see watchlist-linked economic events.";return;}

      const {data:wl,error:wlErr}=await client.from("watchlists")
        .select("id").eq("user_id",user.id).eq("is_default",true).limit(1).maybeSingle();
      if(wlErr)throw wlErr;
      if(!wl?.id){status.textContent="Your watchlist is empty.";return;}

      const {data:items,error:itemErr}=await client.from("watchlist_items")
        .select("instrument").eq("watchlist_id",wl.id).order("display_order",{ascending:true});
      if(itemErr)throw itemErr;

      const tagSet=new Set();
      (items||[]).forEach(x=>watchlistTags(x.instrument).forEach(t=>tagSet.add(t)));
      if(!tagSet.size){status.textContent="No economic-market mappings are available for your current watchlist yet.";return;}

      const start=startOfWeek(new Date());
      const end=addDays(start,6);
      const res=await fetch(FEED_URL,{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({start:ymd(start),end:ymd(end),countries:[]})
      });
      if(!res.ok)throw new Error("Economic calendar feed unavailable.");
      const data=await res.json();
      const events=(Array.isArray(data.events)?data.events:[])
        .map(e=>({...e,_assets:countryAssets(e)}))
        .filter(e=>e._assets.some(a=>tagSet.has(a)))
        .sort((a,b)=>new Date(a.date)-new Date(b.date))
        .slice(0,20);

      if(!events.length){
        status.textContent="No watchlist-linked economic events are scheduled this week.";
        list.innerHTML="";
        return;
      }

      status.textContent=`${events.length} watchlist-linked economic event${events.length===1?"":"s"} this week.`;
      list.innerHTML=events.map(e=>{
        const rel=e._assets.filter(a=>tagSet.has(a));
        const imp=impact(e);
        const q=encodeURIComponent(e.event||e.category||"");
        return `<article class="watchlist-economic-row">
          <div><strong>${esc(when(e))}</strong><small>${esc(e.country||e.country_code||"")}</small></div>
          <div class="watchlist-economic-impact ${impactClass(imp)}">${esc(imp)}</div>
          <div><strong>${esc(e.event||e.category||"Economic event")}</strong><small>${esc(e.category||"")}</small></div>
          <div class="watchlist-economic-assets">${rel.map(a=>`<span class="watchlist-economic-chip">${esc(a)}</span>`).join("")}</div>
          <a class="watchlist-economic-link" href="economic-calendar.html?q=${q}">View</a>
        </article>`;
      }).join("");
    }catch(err){
      console.error(err);
      status.textContent="Economic events could not be loaded right now.";
    }
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load,{once:true});
  else load();
})();

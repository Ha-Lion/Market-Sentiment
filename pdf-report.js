/*
  Public Sentiment Dash PDF Report Engine v3
  Builds a clean PDF report instead of printing the live animated page.
*/
(function(){
  const PSD_PDF_VERSION = "v3";

  function q(selector, root=document){ return root.querySelector(selector); }
  function qa(selector, root=document){ return Array.from(root.querySelectorAll(selector)); }
  function txt(selector, root=document, fallback=""){
    const el = q(selector, root);
    return cleanText(el ? el.textContent : fallback);
  }
  function cleanText(value){ return String(value || "").replace(/\s+/g," ").trim(); }
  function esc(value){
    return String(value ?? "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }
  function safeHtml(value){ return value ? String(value) : ""; }
  function reportScore(value){
    const n = Number(String(value || "").replace(/[^0-9.]/g,""));
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 50;
  }
  function reportSentClass(value){
    return String(value || "neutral").toLowerCase().replace(/[^a-z]/g,"") || "neutral";
  }
  function reportSentColor(value){
    const v = reportSentClass(value);
    if(v === "bullish") return "#3fb950";
    if(v === "mixedbullish") return "#2dd4bf";
    if(v === "mixedbearish") return "#f59e0b";
    if(v === "bearish") return "#f85149";
    return "#58a6ff";
  }

  function reportHash(value){
    let h = 0;
    const text = String(value || "");
    for(let i=0;i<text.length;i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function reportClamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

  function reportNumber(value, fallback=50){
    const n = Number(String(value || "").replace(/[^0-9.-]/g,""));
    return Number.isFinite(n) ? n : fallback;
  }

  function reportSeries(name, score){
    const base = reportClamp(reportNumber(score,50), 5, 95);
    const len = 24;
    let seed = reportHash(name + "|" + base);
    const values = [];
    for(let i=0;i<len;i++){
      seed = (seed * 9301 + 49297) % 233280;
      const wave = Math.sin((i/(len-1))*Math.PI*2 + seed/65000) * 7.5;
      const drift = (i - 17) * ((base - 50) / 88);
      const noise = ((seed / 233280) - .5) * 5.5;
      values.push(reportClamp(Math.round(base - 4 + (i/(len-1))*8 + wave + drift + noise), 8, 94));
    }
    values[values.length-1] = base;
    return values;
  }

  function reportUserScore(value){
    const t = String(value || "").toLowerCase();
    if(t.includes("bull")) return 82;
    if(t.includes("bear")) return 22;
    if(t.includes("neutral")) return 52;
    return 50;
  }

  function reportTechScore(value){
    const t = String(value || "").toLowerCase();
    if(t.includes("up") || t.includes("bull")) return 82;
    if(t.includes("down") || t.includes("bear")) return 22;
    if(t.includes("neutral") || t.includes("mixed")) return 52;
    return 50;
  }

  function reportHeadlineScore(value){
    const n = reportNumber(value, 0);
    if(n <= 0) return 35;
    return reportClamp(Math.round(22 + Math.log10(n + 1) * 23), 25, 95);
  }

  function reportStability(series){
    if(!series || series.length < 2) return 60;
    let total = 0;
    for(let i=1;i<series.length;i++) total += Math.abs(series[i] - series[i-1]);
    return reportClamp(Math.round(100 - (total / (series.length - 1)) * 7), 25, 95);
  }

  function reportLineColor(idx){
    return ["#58a6ff","#d29922","#3fb950","#c084fc","#f85149","#2dd4bf"][idx % 6];
  }

  function trySelectedData(){
    try{
      if(typeof window.selectedData === "function"){
        const rows = window.selectedData();
        if(Array.isArray(rows) && rows.length){
          return rows.slice(0,5).map((d,idx) => ({
            name: cleanText(d.name || `Market ${idx+1}`),
            sentiment: cleanText(d.sentiment || (d.score >= 56 ? "Mixed Bullish" : d.score <= 44 ? "Mixed Bearish" : "Neutral")),
            psi: String(Math.round(reportNumber(d.score,50))),
            user: cleanText(d.user || "Neutral"),
            technical: cleanText(d.tech || "N/A"),
            headlines: String(d.headlines ?? "--"),
            series: Array.isArray(d.series) && d.series.length ? d.series.map(x => reportClamp(Math.round(Number(x)||50),0,100)) : null
          }));
        }
      }
    }catch(error){
      console.warn("PDF selectedData fallback used", error);
    }
    return null;
  }

  function reportCardsWithSeries(cards){
    const live = trySelectedData();
    const base = live && live.length ? live : cards;
    return base.slice(0,5).map((card,idx) => {
      const series = card.series || reportSeries(card.name, card.psi);
      return Object.assign({}, card, {
        name: card.name || `Market ${idx+1}`,
        sentiment: card.sentiment || "Neutral",
        psi: String(reportScore(card.psi)),
        user: card.user || "Neutral",
        technical: card.technical || "N/A",
        headlines: card.headlines || "--",
        series
      });
    });
  }

  function skylineSvg(rows, period){
    const w = 980, h = 430;
    const plot = {x:64, y:48, w:690, h:300};
    const labelX = 778;
    const maxPoints = Math.max(...rows.map(r => (r.series || []).length), 2);
    const yFor = v => plot.y + plot.h - (reportClamp(v,0,100) / 100) * plot.h;
    const xFor = i => plot.x + (i / (maxPoints - 1)) * plot.w;
    const grid = [0,25,50,75,100].map(v => {
      const y = yFor(v);
      return `<line x1="${plot.x}" y1="${y}" x2="${plot.x+plot.w}" y2="${y}" stroke="rgba(230,237,243,.18)" stroke-width="1"/><text x="24" y="${y+5}" fill="#e6edf3" font-size="15" font-weight="800">${v}</text>`;
    }).join("");
    const defs = `
      <defs>
        <linearGradient id="psdChartBg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#101826"/>
          <stop offset="56%" stop-color="#0d1117"/>
          <stop offset="100%" stop-color="#05070b"/>
        </linearGradient>
        <radialGradient id="psdGoldGlow" cx="88%" cy="8%" r="75%">
          <stop offset="0%" stop-color="#d29922" stop-opacity=".23"/>
          <stop offset="55%" stop-color="#58a6ff" stop-opacity=".09"/>
          <stop offset="100%" stop-color="#05070b" stop-opacity="0"/>
        </radialGradient>
        <filter id="psdGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>`;
    const sorted = rows.slice().sort((a,b)=>reportScore(b.psi)-reportScore(a.psi));
    const labels = sorted.map((r,idx) => {
      const color = reportSentColor(r.sentiment) || reportLineColor(idx);
      const y = 87 + idx * 52;
      const shortName = r.name.replace("S&P 500 / ES","S&P 500").replace("Nasdaq / NQ","Nasdaq").replace("Russell / RTY","Russell");
      return `<g>
        <rect x="${labelX}" y="${y-19}" width="176" height="36" rx="12" fill="#0b111a" stroke="${color}" stroke-opacity=".75"/>
        <text x="${labelX+13}" y="${y+4}" fill="#ffffff" font-size="13" font-weight="900">${esc(shortName)} • Now ${esc(r.psi)} • ${esc(String(r.sentiment).replace("Mixed ","M/"))}</text>
      </g>`;
    }).join("");
    const lines = rows.map((r,idx) => {
      const series = r.series || reportSeries(r.name, r.psi);
      const color = reportSentColor(r.sentiment) || reportLineColor(idx);
      const points = series.map((v,i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`);
      const path = series.map((v,i)=>`${i?"L":"M"}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(" ");
      const lastY = yFor(series[series.length-1]);
      return `<polyline points="${points.join(" ")} ${plot.x+plot.w},${plot.y+plot.h} ${plot.x},${plot.y+plot.h}" fill="${color}" fill-opacity=".09"/>
        <path d="${path}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity=".22" filter="url(#psdGlow)"/>
        <path d="${path}" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${plot.x+plot.w}" cy="${lastY}" r="5" fill="${color}" stroke="#ffffff" stroke-width="1.2"/>`;
    }).join("");
    return `<svg class="psd-custom-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Sentiment Skyline chart">
      ${defs}
      <rect x="0" y="0" width="${w}" height="${h}" rx="18" fill="url(#psdChartBg)"/>
      <rect x="0" y="0" width="${w}" height="${h}" rx="18" fill="url(#psdGoldGlow)"/>
      <text x="${w-72}" y="42" fill="rgba(255,255,255,.10)" font-size="38" font-weight="900">PSI</text>
      ${grid}
      ${lines}
      <text x="${plot.x}" y="${plot.y+plot.h+36}" fill="#e6edf3" font-size="14" font-weight="800">${period === "Daily" ? "24H ago" : period === "Weekly" ? "7D ago" : "30D ago"}</text>
      <text x="${plot.x+plot.w-28}" y="${plot.y+plot.h+36}" fill="#e6edf3" font-size="14" font-weight="800">Now</text>
      ${labels}
    </svg>`;
  }

  function radarSvg(rows){
    const w = 620, h = 430;
    const cx = 310, cy = 224, radius = 150;
    const axes = [
      {name:"PSI", value:r=>reportScore(r.psi)},
      {name:"User", value:r=>reportUserScore(r.user)},
      {name:"Headlines", value:r=>reportHeadlineScore(r.headlines)},
      {name:"Technical", value:r=>reportTechScore(r.technical)},
      {name:"Stability", value:r=>reportStability(r.series)}
    ];
    function point(axisIndex, value, rad=radius){
      const angle = (-Math.PI/2) + axisIndex * ((Math.PI*2)/axes.length);
      const r = (reportClamp(value,0,100) / 100) * rad;
      return [cx + Math.cos(angle)*r, cy + Math.sin(angle)*r];
    }
    const rings = [25,50,75,100].map(v => {
      const pts = axes.map((_,i)=>point(i,v).map(n=>n.toFixed(1)).join(",")).join(" ");
      return `<polygon points="${pts}" fill="none" stroke="rgba(230,237,243,.17)" stroke-width="1.2"/>`;
    }).join("");
    const axisLines = axes.map((a,i) => {
      const [x,y] = point(i,100);
      const [tx,ty] = point(i,115);
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(230,237,243,.28)" stroke-width="1.2"/>
              <text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="18" font-weight="900">${a.name}</text>`;
    }).join("");
    const polys = rows.map((r,idx) => {
      const color = reportSentColor(r.sentiment) || reportLineColor(idx);
      const pts = axes.map((a,i)=>point(i,a.value(r)).map(n=>n.toFixed(1)).join(",")).join(" ");
      const dots = axes.map((a,i)=> {
        const [x,y]=point(i,a.value(r));
        return `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="#ffffff" stroke-width=".8"/>`;
      }).join("");
      return `<polygon points="${pts}" fill="${color}" fill-opacity=".18" stroke="${color}" stroke-width="2.2"/>${dots}`;
    }).join("");
    const defs = `
      <defs>
        <linearGradient id="psdRadarBg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#101826"/>
          <stop offset="100%" stop-color="#05070b"/>
        </linearGradient>
        <radialGradient id="psdRadarGlow" cx="50%" cy="42%" r="70%">
          <stop offset="0%" stop-color="#58a6ff" stop-opacity=".16"/>
          <stop offset="100%" stop-color="#05070b" stop-opacity="0"/>
        </radialGradient>
      </defs>`;
    return `<svg class="psd-custom-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Radar Comparison chart">
      ${defs}
      <rect x="0" y="0" width="${w}" height="${h}" rx="18" fill="url(#psdRadarBg)"/>
      <rect x="0" y="0" width="${w}" height="${h}" rx="18" fill="url(#psdRadarGlow)"/>
      ${rings}
      ${axisLines}
      ${polys}
    </svg>`;
  }

  function wait(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

  async function waitForDashboardReady(){
    for(let i=0;i<20;i++){
      if(q("#snapshotCards .sentiment-card") && q("#skylineChart") && q("#radarChart") && q("#heatmapGrid") && q("#rankingList")) return;
      await wait(150);
    }
  }

  function svgHtml(selector){
    const svg = q(selector);
    if(!svg) return `<div class="psd-empty">Chart unavailable</div>`;
    const clone = svg.cloneNode(true);
    clone.removeAttribute("id");
    clone.setAttribute("width", "100%");
    clone.setAttribute("height", "100%");
    clone.style.width = "100%";
    clone.style.height = "100%";
    return clone.outerHTML;
  }

  function getMetric(card, label){
    const row = qa(".metric-line", card).find(x => cleanText(x.textContent).toLowerCase().startsWith(label.toLowerCase()));
    if(!row) return "--";
    const spans = qa("span", row);
    return cleanText(spans[1] ? spans[1].textContent : row.textContent.replace(label, "")) || "--";
  }

  function collectCards(){
    return qa("#snapshotCards .sentiment-card").slice(0,5).map((card, idx) => {
      const spark = q("svg.sparkline", card);
      const sparkClone = spark ? spark.cloneNode(true) : null;
      if(sparkClone){
        sparkClone.removeAttribute("id");
        sparkClone.setAttribute("width", "100%");
        sparkClone.setAttribute("height", "42");
      }
      return {
        name: txt(".market-name", card, `Market ${idx+1}`),
        sentiment: txt(".sentiment-badge", card, "Neutral"),
        psi: txt(".psi-big", card, "--"),
        user: getMetric(card, "User"),
        technical: getMetric(card, "Technical"),
        headlines: getMetric(card, "Headlines"),
        spark: sparkClone ? sparkClone.outerHTML : ""
      };
    });
  }

  function collectRanking(){
    const rows = qa("#rankingList .rank-item");
    return rows.slice(0,6).map(row => {
      const num = txt(".rank-num", row, "");
      const title = txt(".rank-title", row, "");
      const meta = txt(".rank-meta", row, "");
      const score = txt(".rank-score", row, "");
      return {num,title,meta,score};
    });
  }

  function heatmapHtml(){
    const heatmap = q("#heatmapGrid");
    if(!heatmap) return `<div class="psd-empty">Heatwave unavailable</div>`;
    const clone = heatmap.cloneNode(true);
    clone.removeAttribute("id");
    qa("[style]", clone).forEach(el => {
      const style = el.getAttribute("style") || "";
      el.setAttribute("style", style.replace(/animation:[^;]+;?/gi, ""));
    });
    return clone.outerHTML;
  }

  function currentPeriodLabel(){
    const active = q("[data-period].active");
    return active ? cleanText(active.textContent) : "Daily";
  }

  function buildCardHtml(cards){
    return cards.map(card => `
      <article class="psd-card psd-sent-${reportSentClass(card.sentiment)}">
        <div class="psd-card-top">
          <div class="psd-card-name">${esc(card.name)}</div>
          <div class="psd-card-badge">${esc(card.sentiment)}</div>
        </div>
        <div class="psd-card-mid">
          <div class="psd-psi-box" style="--psi:${reportScore(card.psi)};--accent:${reportSentColor(card.sentiment)}"><strong>${esc(card.psi)}</strong><span>PSI / 100</span></div>
          <div class="psd-metrics">
            <div><span>User</span><b>${esc(card.user)}</b></div>
            <div><span>Technical</span><b>${esc(card.technical)}</b></div>
            <div><span>Headlines</span><b>${esc(card.headlines)}</b></div>
          </div>
        </div>
        <div class="psd-spark">${safeHtml(card.spark)}</div>
      </article>
    `).join("");
  }

  function buildRankingHtml(rows){
    if(!rows.length) return `<div class="psd-empty">Ranking unavailable</div>`;
    return rows.map(row => `
      <div class="psd-rank-row">
        <div class="psd-rank-num">${esc(row.num)}</div>
        <div class="psd-rank-main"><b>${esc(row.title)}</b><span>${esc(row.meta)}</span></div>
        <div class="psd-rank-score">${esc(row.score)}</div>
      </div>
    `).join("");
  }

  function reportCss(){
    return `
      @page{size:letter landscape;margin:.18in;}
      *{box-sizing:border-box;}
      html,body{
        margin:0;
        padding:0;
        background:#05070b!important;
        color:#e6edf3!important;
        font-family:Inter,Segoe UI,Arial,sans-serif;
      }
      body{
        font-size:12px;
        line-height:1.35;
        -webkit-print-color-adjust:exact!important;
        print-color-adjust:exact!important;
      }
      .psd-print-toolbar{
        position:fixed;
        top:10px;
        right:10px;
        z-index:9999;
        display:flex;
        gap:8px;
        font-family:Arial,sans-serif;
      }
      .psd-print-toolbar button{
        border:0;
        border-radius:999px;
        padding:9px 14px;
        font-weight:900;
        cursor:pointer;
        background:#d29922;
        color:#05070b;
        box-shadow:0 8px 24px rgba(0,0,0,.28);
      }
      .psd-report{width:100%;}
      .psd-page{
        position:relative;
        height:7.58in;
        break-after:page;
        page-break-after:always;
        overflow:hidden;
        display:flex;
        flex-direction:column;
        gap:9px;
        padding:0;
        background:#05070b!important;
        color:#e6edf3!important;
      }
      .psd-page:before{
        content:"";
        position:absolute;
        inset:0;
        background:
          radial-gradient(circle at top left,rgba(210,153,34,.22),transparent 3.2in),
          radial-gradient(circle at top right,rgba(88,166,255,.18),transparent 3.0in),
          linear-gradient(180deg,#0a0f18,#05070b);
        z-index:0;
      }
      .psd-page>*{position:relative;z-index:1;}
      .psd-page:last-child{break-after:auto;page-break-after:auto;}
      .psd-report-header{
        display:grid;
        grid-template-columns:auto 1fr auto;
        gap:12px;
        align-items:center;
        border:1px solid rgba(210,153,34,.46);
        border-radius:18px;
        padding:10px 12px;
        background:#0d1117!important;
        color:#e6edf3!important;
        box-shadow:0 12px 34px rgba(0,0,0,.38);
      }
      .psd-logo{
        width:48px;
        height:48px;
        object-fit:contain;
        border-radius:12px;
        box-shadow:0 0 20px rgba(210,153,34,.35);
      }
      .psd-title-block h1{
        font-size:24px;
        line-height:1.05;
        margin:0 0 4px;
        color:#ffffff!important;
        letter-spacing:-.02em;
      }
      .psd-title-block .psd-chip{
        display:inline-flex;
        border:1px solid rgba(210,153,34,.65);
        border-radius:999px;
        padding:4px 9px;
        background:#2a1d0d!important;
        color:#ffd780!important;
        font-size:10px;
        font-weight:900;
        margin-bottom:5px;
      }
      .psd-title-block p{margin:0;color:#c9d1d9!important;font-size:11px;}
      .psd-ribbon{
        border:1px solid rgba(210,153,34,.58);
        border-radius:999px;
        padding:7px 11px;
        color:#ffd780!important;
        background:#1d160b!important;
        font-size:11px;
        font-weight:900;
        white-space:nowrap;
        box-shadow:0 0 18px rgba(210,153,34,.20);
      }
      .psd-ad{
        border:1px solid rgba(210,153,34,.46);
        border-radius:999px;
        padding:7px 12px;
        text-align:center;
        background:#141b25!important;
        color:#ffffff!important;
        font-weight:850;
        font-size:11px;
      }
      .psd-description{
        border:1px solid rgba(88,166,255,.32);
        border-radius:16px;
        padding:10px 12px;
        background:#0d1117!important;
        color:#e6edf3!important;
      }
      .psd-description p{margin:0 0 5px;font-size:12px;color:#e6edf3!important;}
      .psd-description p:last-child{margin-bottom:0;color:#c9d1d9!important;font-size:11px;}
      .psd-card-grid{
        display:grid;
        grid-template-columns:repeat(5,1fr);
        gap:8px;
        flex:1;
        align-items:stretch;
      }
      .psd-card{
        position:relative;
        border:1px solid rgba(88,166,255,.26);
        border-radius:18px;
        padding:10px;
        background:#0c121c!important;
        display:flex;
        flex-direction:column;
        min-width:0;
        overflow:hidden;
        box-shadow:0 18px 35px rgba(0,0,0,.38);
      }
      .psd-card:before{
        content:"";
        position:absolute;
        inset:0;
        border-radius:18px;
        background:
          radial-gradient(circle at top right,rgba(210,153,34,.24),transparent 1.1in),
          linear-gradient(135deg,rgba(210,153,34,.10),transparent 42%,rgba(88,166,255,.16));
        pointer-events:none;
      }
      .psd-card-top,.psd-card-mid,.psd-spark{position:relative;z-index:1;}
      .psd-card-top{display:flex;justify-content:space-between;gap:6px;align-items:flex-start;margin-bottom:8px;}
      .psd-card-name{font-weight:900;color:#ffffff!important;font-size:12px;line-height:1.15;max-width:58%;}
      .psd-card-badge{
        font-size:9px;
        font-weight:900;
        border:1px solid rgba(255,255,255,.16);
        background:#142033!important;
        color:#d8ebff!important;
        border-radius:999px;
        padding:4px 6px;
        white-space:nowrap;
      }
      .psd-sent-bullish .psd-card-badge{background:#12321c!important;border-color:rgba(63,185,80,.55);color:#baf7c5!important;}
      .psd-sent-mixedbullish .psd-card-badge{background:#102d2b!important;border-color:rgba(45,212,191,.55);color:#b8fff6!important;}
      .psd-sent-mixedbearish .psd-card-badge{background:#332311!important;border-color:rgba(245,158,11,.55);color:#ffd8a8!important;}
      .psd-sent-bearish .psd-card-badge{background:#351616!important;border-color:rgba(248,81,73,.55);color:#ffaaa6!important;}
      .psd-card-mid{display:grid;grid-template-columns:66px 1fr;gap:8px;align-items:center;}
      .psd-psi-box{
        position:relative;
        height:66px;
        width:66px;
        border-radius:50%;
        display:grid;
        place-items:center;
        text-align:center;
        background:conic-gradient(var(--accent) calc(var(--psi)*1%),#26313f 0)!important;
        color:#fff!important;
        box-shadow:0 0 26px rgba(88,166,255,.20);
      }
      .psd-psi-box:before{
        content:"";
        position:absolute;
        width:46px;
        height:46px;
        border-radius:50%;
        background:#0d1117!important;
        border:1px solid rgba(255,255,255,.10);
      }
      .psd-psi-box strong,.psd-psi-box span{position:relative;z-index:1;display:block;}
      .psd-psi-box strong{font-size:18px;line-height:1;color:#ffffff!important;}
      .psd-psi-box span{font-size:7px;color:#d8dee9!important;font-weight:850;margin-top:2px;}
      .psd-metrics{display:grid;gap:4px;min-width:0;}
      .psd-metrics div{display:flex;justify-content:space-between;gap:5px;border-bottom:1px solid rgba(255,255,255,.09);padding-bottom:3px;font-size:9.5px;}
      .psd-metrics span{color:#c9d1d9!important;}
      .psd-metrics b{color:#ffffff!important;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .psd-spark{margin-top:auto;height:44px;opacity:1;}
      .psd-spark svg{width:100%;height:44px;display:block;}
      .psd-chart-grid{
        display:grid;
        grid-template-columns:1.16fr .84fr;
        gap:10px;
        flex:1;
        min-height:0;
      }
      .psd-section{
        border:1px solid rgba(88,166,255,.26);
        border-radius:18px;
        background:#0d1117!important;
        padding:10px;
        display:flex;
        flex-direction:column;
        min-height:0;
        overflow:hidden;
        box-shadow:0 16px 36px rgba(0,0,0,.38);
      }
      .psd-section h2{margin:0 0 3px;font-size:17px;color:#ffffff!important;letter-spacing:-.01em;}
      .psd-section-note{margin:0 0 8px;color:#c9d1d9!important;font-size:10.5px;line-height:1.35;}
      .psd-chart-box{
        border:1px solid rgba(255,255,255,.12);
        border-radius:14px;
        background:#090e16!important;
        overflow:hidden;
        flex:1;
        min-height:0;
        display:flex;
        align-items:stretch;
        justify-content:center;
        padding:0;
      }
      .psd-chart-box svg{
        width:100%;
        height:100%;
        display:block;
        max-width:100%;
        max-height:100%;
      }
      .psd-custom-svg text{
        paint-order:stroke;
        stroke:#05070b;
        stroke-width:2px;
        stroke-linejoin:round;
      }
      .psd-page-label{font-size:10px;color:#c9d1d9!important;font-weight:900;text-align:right;margin-top:-4px;}
      .psd-heat-rank-grid{
        display:grid;
        grid-template-columns:1.48fr .52fr;
        gap:10px;
        flex:1;
        min-height:0;
      }
      .psd-heat-legend{display:flex;flex-wrap:wrap;gap:5px;margin:2px 0 7px;}
      .psd-heat-legend span{
        display:inline-flex;
        align-items:center;
        gap:4px;
        border:1px solid rgba(255,255,255,.14);
        border-radius:999px;
        padding:3px 6px;
        background:#111821!important;
        color:#e6edf3!important;
        font-size:8.5px;
        font-weight:900;
      }
      .psd-heat-legend i{width:8px;height:8px;border-radius:50%;display:inline-block;box-shadow:0 0 10px currentColor;}
      .heatmap{display:grid!important;gap:5px!important;margin-top:4px!important;}
      .heat-row{display:grid!important;grid-template-columns:1.18in repeat(12,minmax(0,1fr))!important;gap:4px!important;align-items:center!important;}
      .heat-name{color:#ffffff!important;font-size:9.2px!important;font-weight:900!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
      .heat-head{color:#e6edf3!important;font-size:8px!important;font-weight:900!important;text-align:center!important;}
      .heat-cell{
        height:21px!important;
        border-radius:7px!important;
        font-size:8.2px!important;
        font-weight:900!important;
        display:grid!important;
        place-items:center!important;
        color:#fff!important;
        text-shadow:0 1px 2px rgba(0,0,0,.55)!important;
        box-shadow:inset 0 0 12px rgba(255,215,128,.12),0 0 12px rgba(0,0,0,.18)!important;
        animation:none!important;
        border:1px solid rgba(255,255,255,.14)!important;
      }
      .heat-cell:before{display:none!important;}
      .preview-note{
        margin-top:7px!important;
        border:1px solid rgba(210,153,34,.34)!important;
        background:#1b170d!important;
        color:#f4d17d!important;
        padding:7px 9px!important;
        border-radius:12px!important;
        font-size:9px!important;
        line-height:1.28!important;
      }
      .psd-rank-list{display:grid;gap:6px;overflow:hidden;}
      .psd-rank-row{
        display:grid;
        grid-template-columns:24px 1fr 30px;
        gap:7px;
        align-items:center;
        border:1px solid rgba(255,255,255,.12);
        border-radius:13px;
        padding:7px;
        background:#111821!important;
      }
      .psd-rank-num{
        width:22px;
        height:22px;
        border-radius:50%;
        display:grid;
        place-items:center;
        background:#2a1d0d!important;
        color:#ffd780!important;
        font-weight:900;
        font-size:10px;
      }
      .psd-rank-main{min-width:0;}
      .psd-rank-main b{display:block;color:#ffffff!important;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .psd-rank-main span{display:block;color:#c9d1d9!important;font-size:8.7px;line-height:1.25;margin-top:1px;}
      .psd-rank-score{font-size:15px;font-weight:900;color:#58a6ff!important;text-align:right;}
      .psd-footer{
        border-top:1px solid rgba(255,255,255,.16);
        padding-top:7px;
        color:#c9d1d9!important;
        font-size:9.5px;
        line-height:1.35;
      }
      .psd-footer-links{font-size:9px;color:#e6edf3!important;margin-bottom:5px;font-weight:850;}
      .psd-footer p{margin:3px 0 0;color:#c9d1d9!important;}
      .psd-empty{color:#8b949e!important;font-weight:900;padding:20px;text-align:center;}
      @media print{
        .psd-print-toolbar{display:none!important;}
        body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
        .psd-page{height:7.58in;}
      }
    `;
  }

  function buildDashboardReport(){
    const cards = reportCardsWithSeries(collectCards());
    const ranking = collectRanking();
    const period = currentPeriodLabel();
    const skyline = skylineSvg(cards, period);
    const radar = radarSvg(cards);
    const heat = heatmapHtml();
    const chip = txt(".page-chip", document, "Interactive Dashboard");
    const title = txt(".lab-hero h1", document, document.title || "Interactive Market Sentiment Dashboard");
    const main = txt(".lab-hero-main", document, "Compare up to 5 markets using PSI, user sentiment, technical direction, headline strength, skyline trends, radar comparison, heatwave pressure, and strength ranking.");
    const small = txt(".lab-small", document, "Focused on selected-market sentiment. PSI uses instrument headlines; user sentiment falls back to technical direction when direct votes are unavailable.");
    const ribbon = txt(".header-pill", document, "Constantly learning & improving");
    const ad = txt("#psdAdvertiseBanner", document, "Partner with Public Sentiment Dash — advertising, investor, and business opportunities in market sentiment.");
    const footerLinks = qa(".footer-links a").map(a => cleanText(a.textContent)).filter(Boolean).join("  •  ");
    const disclaimer = txt(".legal", document, "Disclaimer: Public Sentiment Dash is for informational and educational purposes only. It is not financial advice, investment advice, trading advice, or a recommendation to buy or sell any asset.");
    const copyright = qa(".footer p").map(p => cleanText(p.textContent)).find(t => t.includes("©")) || "© 2026 Public Sentiment Dash. All rights reserved.";

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${esc(document.baseURI)}">
  <title>${esc("publicsentimentdash.com - " + chip)}</title>
  <style>${reportCss()}</style>
</head>
<body>
  <div class="psd-print-toolbar"><button onclick="window.print()">Print / Save PDF</button><button onclick="window.close()">Close</button></div>
  <main class="psd-report">
    <section class="psd-page">
      <header class="psd-report-header">
        <img class="psd-logo" src="logo.png" alt="Public Sentiment Dash Logo">
        <div class="psd-title-block">
          <div class="psd-chip">${esc(chip)}</div>
          <h1>${esc(title)}</h1>
          <p>Public Sentiment Dash • ${esc(period)} Report • ${esc(new Date().toLocaleString())}</p>
        </div>
        <div class="psd-ribbon">${esc(ribbon)}</div>
      </header>
      <div class="psd-ad">📣 ${esc(ad.replace("📣", ""))}</div>
      <section class="psd-description"><p>${esc(main)}</p><p>${esc(small)}</p></section>
      <section class="psd-card-grid">${buildCardHtml(cards)}</section>
      <div class="psd-page-label">Page 1 / 3 • Summary</div>
    </section>

    <section class="psd-page">
      <div class="psd-chart-grid">
        <section class="psd-section">
          <h2>Sentiment Skyline</h2>
          <p class="psd-section-note">Multi-market PSI movement with end-point labels and ${esc(period)} values.</p>
          <div class="psd-chart-box">${skyline}</div>
        </section>
        <section class="psd-section">
          <h2>Radar Comparison</h2>
          <p class="psd-section-note">Axes compare PSI, user bias, headline strength, technical direction, and stability.</p>
          <div class="psd-chart-box">${radar}</div>
        </section>
      </div>
      <div class="psd-page-label">Page 2 / 3 • Charts</div>
    </section>

    <section class="psd-page">
      <div class="psd-heat-rank-grid">
        <section class="psd-section">
          <h2>Sentiment Heatwave</h2>
          <p class="psd-section-note">Recent PSI-style pressure matrix for the selected markets.</p>
          <div class="psd-heat-legend">
            <span><i style="background:#ef4444"></i>0–30 Bearish</span>
            <span><i style="background:#facc15"></i>31–44 Mixed Bearish</span>
            <span><i style="background:#3b82f6"></i>45–55 Neutral</span>
            <span><i style="background:#2dd4bf"></i>56–69 Mixed Bullish</span>
            <span><i style="background:#16a34a"></i>70–100 Bullish</span>
          </div>
          ${heat}
        </section>
        <section class="psd-section">
          <h2>Strength Ranking</h2>
          <p class="psd-section-note">Simple ranked read of selected markets.</p>
          <div class="psd-rank-list">${buildRankingHtml(ranking)}</div>
        </section>
      </div>
      <footer class="psd-footer">
        <div class="psd-footer-links">${esc(footerLinks)}</div>
        <p><b>Disclaimer:</b> ${esc(disclaimer.replace(/^Disclaimer:\s*/i,""))}</p>
        <p>${esc(copyright)}</p>
      </footer>
      <div class="psd-page-label">Page 3 / 3 • Heatwave, Ranking, Disclaimer</div>
    </section>
  </main>
</body>
</html>`;
  }

  function buildGenericReport(){
    const title = document.title || "Public Sentiment Dash";
    const main = q("main") ? cleanText(q("main").textContent).slice(0, 4500) : cleanText(document.body.textContent).slice(0, 4500);
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc("publicsentimentdash.com - " + title)}</title><style>${reportCss()} .psd-page{height:auto;min-height:7.28in}.psd-generic{white-space:pre-wrap;font-size:12px;line-height:1.5;border:1px solid #d7dde6;border-radius:14px;padding:14px;background:#fff;}</style></head><body><div class="psd-print-toolbar"><button onclick="window.print()">Print / Save PDF</button><button onclick="window.close()">Close</button></div><main class="psd-report"><section class="psd-page"><header class="psd-report-header"><img class="psd-logo" src="logo.png"><div class="psd-title-block"><div class="psd-chip">Public Sentiment Dash</div><h1>${esc(title)}</h1><p>${esc(new Date().toLocaleString())}</p></div><div class="psd-ribbon">PDF Report</div></header><div class="psd-generic">${esc(main)}</div></section></main></body></html>`;
  }

  function openReportWindow(html){
    const win = window.open("", "_blank");
    if(!win){
      alert("Popup blocked. Please allow popups for this site and try again.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      try{ win.focus(); win.print(); }catch(error){ console.warn("PDF print failed", error); }
    }, 900);
  }

  async function psdOpenPdfReport(){
    try{
      const isDashboard = /dashboard\.html$/i.test(window.location.pathname) || !!q("#snapshotCards");
      if(isDashboard){
        await waitForDashboardReady();
        openReportWindow(buildDashboardReport());
      }else{
        openReportWindow(buildGenericReport());
      }
    }catch(error){
      console.error("PSD PDF report failed", error);
      alert("PDF report failed to prepare. Please refresh the page and try again.");
    }
  }

  window.psdOpenPdfReport = psdOpenPdfReport;
  window.PSD_PDF_REPORT_VERSION = PSD_PDF_VERSION;
})();

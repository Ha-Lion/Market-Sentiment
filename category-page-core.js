/* PublicSentimentDash Category Page Core v2
   Iteration 3 lab-safe shared category utilities.
   Namespaced to avoid global collisions. */
(function(global){
  "use strict";
/* PublicSentimentDash Category Page Core v1
   Website Optimization Iteration 3
   Shared, behavior-preserving functions extracted from category pages.
   No visual styles, data definitions, PSI formulas, or history retention logic live here. */

function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

function normalizeText(v){ return String(v || "").toLowerCase(); }

function labelForScore(score){
      if(score == null) return "No PSI";
      if(score >= 70) return "Strong Bullish";
      if(score >= 56) return "Bullish";
      if(score >= 45) return "Mixed/Neutral";
      if(score >= 31) return "Bearish";
      return "Strong Bearish";
    }

function colorForScore(score){
      if(score == null) return "#8b949e";
      if(score >= 70) return "#22c55e";
      if(score >= 56) return "#14b8a6";
      if(score >= 45) return "#58a6ff";
      if(score >= 31) return "#f97316";
      return "#ef4444";
    }

function pillStyle(score){
      const c = colorForScore(score);
      return `--status-color:${c};`;
    }

function headlineText(h){
      return normalizeText([
        h.title,
        h.description,
        h.source,
        h.query,
        ...(Array.isArray(h.instruments) ? h.instruments : []),
        ...(Array.isArray(h.markets) ? h.markets : [])
      ].join(" "));
    }

function uniqueTerms(values){
      return Array.from(new Set((values || []).map(x => normalizeText(x)).filter(Boolean)));
    }

function categoryEntry(asset, categoryKey){
      return (Array.isArray(asset?.categories) ? asset.categories : []).find(c => c?.category === categoryKey && c?.enabled !== false);
    }

function currentInstrumentRow(item){
      const instruments = currentLatestRecord()?.instruments || {};
      const keys = instrumentKeysForItem(item, item?.name);
      const foundKey = Object.keys(instruments).find(k => keys.includes(normalizeText(k)));
      return foundKey ? instruments[foundKey] : null;
    }

function historyInstrumentRow(record, item, fallbackName){
      const instruments = record?.instruments || {};
      const keys = instrumentKeysForItem(item, fallbackName);
      const foundKey = Object.keys(instruments).find(k => keys.includes(normalizeText(k)));
      return foundKey ? instruments[foundKey] : null;
    }

function headlineInstruments(h){
      return Array.isArray(h.instruments) ? h.instruments.map(x => normalizeText(x)) : [];
    }

function headlineMarkets(h){
      return Array.isArray(h.markets) ? h.markets.map(x => normalizeText(x)) : [];
    }

function titleDescriptionText(h){
      return normalizeText([h.title, h.description].join(" "));
    }

function hasTerm(text, terms){
      return terms.some(term => text.includes(term));
    }

function scoreFromHeadlineSet(name, symbol, headlines, source){
      if(!headlines.length){
        return {
          name,
          symbol,
          score:null,
          label:"No PSI",
          headlineCount:0,
          bullish:0,
          bearish:0,
          neutral:0,
          source,
          topHeadlines:[]
        };
      }

      let total = 0;
      let bullish = 0;
      let bearish = 0;
      let neutral = 0;

      headlines.forEach(h => {
        const s = Number(h.weighted_score ?? h.score ?? 0);
        total += Number.isFinite(s) ? s : 0;

        const vote = normalizeText(h.vote);
        if(vote.includes("bull")) bullish++;
        else if(vote.includes("bear")) bearish++;
        else neutral++;
      });

      const avg = total / headlines.length;
      const score = Math.round(clamp(50 + avg * 6, 0, 100));

      return {
        name,
        symbol,
        score,
        label:labelForScore(score),
        headlineCount:headlines.length,
        bullish,
        bearish,
        neutral,
        source,
        topHeadlines:headlines.slice(0,5)
      };
    }

function currentLatestRecord(){
      const records = Array.isArray(historyData?.records) ? historyData.records : [];
      return records[records.length - 1] || null;
    }

function priorityValue(headline){
      const value=Number(headline?.source_priority ?? headline?.priority ?? 3);
      return Number.isFinite(value)?Math.max(1,Math.min(3,value)):3;
    }

function priorityHeadlines(headlines,limit=6){
      return [...(headlines||[])].sort((a,b)=>priorityValue(a)-priorityValue(b)||String(b.published_utc||"").localeCompare(String(a.published_utc||""))).slice(0,limit);
    }

function technicalForItem(item){
      const technical=technicalData?.technical||{};
      const keys=instrumentKeysForItem(item,item?.name);
      const key=Object.keys(technical).find(name=>keys.includes(normalizeText(name)));
      if(key)return technical[key];
      return historyInstrumentRow(currentLatestRecord(),item,item?.name)?.technical||{};
    }

function changeAiCardPage(direction){
      const pageCount = Math.max(1, Math.ceil(currentRows.length / aiCardPageSize));
      const target = Math.max(0, Math.min(pageCount - 1, aiCardPage + Number(direction || 0)));
      if(target === aiCardPage) return;
      aiCardPage = target;
      renderTopCards();
      document.getElementById("aiCarousel")?.scrollIntoView({behavior:"smooth",block:"nearest"});
    }

function updateCompareVisuals(){
      document.querySelectorAll(".compare-checkbox").forEach(cb => {
        const isSelected = selectedCompareNames.includes(cb.dataset.name);
        cb.checked = isSelected;
        const card = cb.closest(".ai-card");
        if(card) card.classList.toggle("compare-selected", isSelected);
      });
    }

function toggleCompare(name, checked, input){
      if(checked){
        if(!selectedCompareNames.includes(name)){
          if(selectedCompareNames.length >= 2){
            input.checked = false;
            return;
          }
          selectedCompareNames.push(name);
        }
      }else{
        selectedCompareNames = selectedCompareNames.filter(x => x !== name);
      }

      updateCompareVisuals();

      if(selectedCompareNames.length === 2){
        openCompareHistory();
      }
    }

function openCompareHistory(){
      if(selectedCompareNames.length !== 2) return;

      activeCompareNames = [...selectedCompareNames];
      activeHistoryPeriod = "daily";

      const layer = document.getElementById("historyLayer");
      const card = document.querySelector(".history-card");
      if(layer) layer.classList.add("open");
      if(card) card.classList.add("compare-card");
      document.body.style.overflow = "hidden";

      document.querySelectorAll(".history-period").forEach(btn => btn.classList.toggle("active", btn.dataset.period === "daily"));
      renderHistory();
    }

function domainFromUrl(url){
      try{ return new URL(url).hostname.replace(/^www\./, ""); }
      catch(e){ return ""; }
    }

function releaseDateText(h){
      const raw = h.published_utc || h.published || h.date || "";
      if(!raw) return "Release date: latest scan";
      return "Release date: " + String(raw).replace(" UTC","").replace(" GMT","");
    }

function sourceLogoUrl(h){
      const source=normalizeText(h.source).replace(/[^a-z0-9.]+/g," ").trim();
      const publishers={"bloomberg markets":"bloomberg.com","bnn bloomberg":"bnnbloomberg.ca","cnbc":"cnbc.com","cnbc markets":"cnbc.com","wsj":"wsj.com","the wall street journal markets":"wsj.com","financial times markets":"ft.com","reuters":"reuters.com","reuters markets":"reuters.com","yahoo finance":"finance.yahoo.com","yahoo finance uk":"uk.finance.yahoo.com","yahoo finance singapore":"sg.finance.yahoo.com","marketwatch":"marketwatch.com","barron s":"barrons.com","investing.com":"investing.com","investing.com india":"in.investing.com","investing.com australia":"au.investing.com","fxstreet":"fxstreet.com","forexlive":"forexlive.com","oilprice":"oilprice.com","kitco news":"kitco.com","coindesk":"coindesk.com","cointelegraph":"cointelegraph.com","decrypt":"decrypt.co","the block":"theblock.co","morningstar":"morningstar.com","morningstar markets":"morningstar.com","trading economics news":"tradingeconomics.com","euronews business":"euronews.com","nasdaq news":"nasdaq.com","eia today in energy":"eia.gov","tradingview.com":"tradingview.com","ca.finance.yahoo.com":"ca.finance.yahoo.com"};
      const domain = publishers[source] || (domainFromUrl(h.source_url || h.link || "")==="news.google.com" ? "" : domainFromUrl(h.source_url || h.link || ""));
      return domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : "";
    }

function renderHero(){
      const overall = currentRows.length
        ? Math.round(currentRows.filter(r => r.score != null).reduce((a,r) => a + r.score, 0) / Math.max(1,currentRows.filter(r => r.score != null).length))
        : null;

      const overallEl = document.getElementById("overallScore");
      const updatedEl = document.getElementById("updatedText");

      if(overallEl) overallEl.textContent = overall == null ? "--" : `${overall}/100`;
      if(updatedEl){
        updatedEl.textContent = `${labelForScore(overall)} • Updated: ${dashboardData?.updated_ny || historyData?.updated_ny || "latest scan"}`;
      }
    }

function savedHeadlinesForRecord(record){
      const out = [];
      const seen = new Set();
      const instruments = record?.instruments || {};
      Object.values(instruments).forEach(row => {
        (Array.isArray(row?.top_headlines) ? row.top_headlines : []).forEach(h => {
          const key = h.link || `${h.source || ""}|${h.title || ""}`;
          if(!key || seen.has(key)) return;
          seen.add(key);
          out.push(h);
        });
      });
      return out;
    }

function derivedHistoryRowForItem(record, item){
      const matches = savedHeadlinesForRecord(record).filter(h => itemMatchesHeadline(item, h));
      if(!matches.length) return proxyHistoryRowForAI(record, item);

      let total = 0;
      let bullish = 0;
      let bearish = 0;
      let neutral = 0;

      matches.forEach(h => {
        const s = Number(h.weighted_score ?? h.score ?? 0);
        total += Number.isFinite(s) ? s : 0;

        const vote = normalizeText(h.vote);
        if(vote.includes("bull")) bullish++;
        else if(vote.includes("bear")) bearish++;
        else neutral++;
      });

      const avg = total / matches.length;
      const value = Math.round(clamp(50 + avg * 6, 0, 100));

      return {
        date:record.date,
        label:record.date,
        value:value,
        count:matches.length,
        bullish:bullish,
        bearish:bearish,
        neutral:neutral,
        sentiment:labelForScore(value),
        source:"derived"
      };
    }

function weekKey(dateText){
      const d = new Date(dateText + "T00:00:00");
      const oneJan = new Date(d.getFullYear(),0,1);
      const week = Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
      return `${d.getFullYear()} W${String(week).padStart(2,"0")}`;
    }

function monthKey(dateText){
      const d = new Date(dateText + "T00:00:00");
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    }

function aggregateSeries(series, mode){
      if(mode === "daily") return series;
      const map = new Map();
      series.forEach(row => {
        const key = mode === "weekly" ? weekKey(row.date) : monthKey(row.date);
        if(!map.has(key)) map.set(key, {label:key, total:0, count:0, headlines:0});
        const item = map.get(key);
        item.total += Number(row.value || 0);
        item.count += 1;
        item.headlines += Number(row.count || 0);
      });
      return Array.from(map.values()).map(x => ({
        label:x.label,
        value:Math.round(x.total / Math.max(1,x.count)),
        count:x.headlines,
        sentiment:labelForScore(Math.round(x.total / Math.max(1,x.count)))
      }));
    }

function drawHistoryChart(series, svgId = "historyChart"){
      const svg = document.getElementById(svgId);
      if(!svg) return;

      if(!series.length){
        svg.innerHTML = `<text x="450" y="210" text-anchor="middle" fill="#8b949e" font-size="18" font-weight="800">No saved history yet</text>`;
        return;
      }

      const w = 900;
      const h = 420;
      const padL = 58;
      const padR = 28;
      const padT = 30;
      const padB = 50;
      const innerW = w - padL - padR;
      const innerH = h - padT - padB;
      const n = series.length;

      const points = series.map((row, i) => {
        const x = n === 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW;
        const y = padT + (100 - clamp(row.value,0,100)) / 100 * innerH;
        return {x,y,row};
      });

      const d = points.map((p,i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
      const area = `${d} L ${points[points.length-1].x.toFixed(1)} ${padT + innerH} L ${points[0].x.toFixed(1)} ${padT + innerH} Z`;
      const last = series[series.length - 1];
      const color = colorForScore(last.value);

      const yTicks = [0,25,50,75,100].map(v => {
        const y = padT + (100 - v) / 100 * innerH;
        return `<line x1="${padL}" y1="${y}" x2="${w-padR}" y2="${y}" stroke="rgba(45,212,191,.16)" stroke-dasharray="3 9"></line>
                <text x="${padL-12}" y="${y+4}" text-anchor="end" fill="#78a6c8" font-size="11" font-weight="800">${v}</text>`;
      }).join("");

      const vLines = points.map((p,i) => {
        if(n > 10 && i % Math.ceil(n/6) !== 0 && i !== n-1) return "";
        return `<line x1="${p.x}" y1="${padT}" x2="${p.x}" y2="${padT+innerH}" stroke="rgba(88,166,255,.08)" stroke-dasharray="2 10"></line>`;
      }).join("");

      const labels = points.map((p,i) => {
        if(n > 8 && i % Math.ceil(n/6) !== 0 && i !== n-1) return "";
        return `<text x="${p.x}" y="${h-18}" text-anchor="middle" fill="#8fb8d8" font-size="10" font-weight="800">${esc(p.row.label).slice(5)}</text>`;
      }).join("");

      const circles = points.map((p,i) => `
        <g>
          <circle cx="${p.x}" cy="${p.y}" r="9" fill="${color}" opacity=".10"></circle>
          <circle cx="${p.x}" cy="${p.y}" r="4.2" fill="#07101d" stroke="${color}" stroke-width="2.2">
            <title>${esc(p.row.label)}: ${p.row.value}/100 • ${esc(p.row.sentiment)}</title>
          </circle>
        </g>
      `).join("");

      svg.innerHTML = `
        <defs>
          <linearGradient id="neonFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity=".34"></stop>
            <stop offset="46%" stop-color="#2dd4bf" stop-opacity=".12"></stop>
            <stop offset="100%" stop-color="#050b12" stop-opacity=".02"></stop>
          </linearGradient>
          <linearGradient id="neonLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stop-color="#2dd4bf"></stop>
            <stop offset="50%" stop-color="${color}"></stop>
            <stop offset="100%" stop-color="#ffd780"></stop>
          </linearGradient>
          <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur"></feGaussianBlur>
            <feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge>
          </filter>
        </defs>
        <rect x="${padL}" y="${padT}" width="${innerW}" height="${innerH}" fill="rgba(3,10,18,.30)" stroke="rgba(88,166,255,.10)"></rect>
        ${vLines}
        ${yTicks}
        <path d="${area}" fill="url(#neonFill)"></path>
        <path d="${d}" fill="none" stroke="rgba(45,212,191,.20)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"></path>
        <path d="${d}" fill="none" stroke="url(#neonLine)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#neonGlow)"></path>
        ${circles}
        ${labels}
        <text x="${w-padR}" y="${padT+16}" text-anchor="end" fill="#ffd780" font-size="12" font-weight="950">LATEST ${last.value}/100</text>
        <text x="${padL}" y="${padT-10}" text-anchor="start" fill="#2dd4bf" font-size="10" font-weight="900" letter-spacing="2">SENTIMENT SIGNAL</text>
      `;
    }

function ensureCharts(){
      if(window.LightweightCharts)return Promise.resolve();
      if(chartLibraryPromise)return chartLibraryPromise;
      chartLibraryPromise=new Promise((resolve,reject)=>{const script=document.createElement("script");script.src="https://unpkg.com/lightweight-charts@5.2.0/dist/lightweight-charts.standalone.production.js";script.async=true;script.onload=resolve;script.onerror=()=>reject(Error("Interactive charts unavailable"));document.head.appendChild(script)});
      return chartLibraryPromise;
    }

function clearComparisonSync(){comparisonSyncCleanup.splice(0).forEach(cleanup=>cleanup());comparisonCharts.clear()}

function clearCharts(){clearComparisonSync();chartCleanup.splice(0).forEach(cleanup=>cleanup())}

function makeInteractiveChart(id,data,color,isPsi,comparisonKey=""){
      const box=document.getElementById(id);if(!box)return;box.textContent="";
      if(!data.length){box.innerHTML='<div class="empty-note" style="height:300px;display:grid;place-items:center">No applicable history is available.</div>';return}
      const dark=document.body.classList.contains("dark-mode"),background=dark?"#070e17":"#ffffff",text=dark?"#d5e0ea":"#10263b",grid=dark?"rgba(255,255,255,.07)":"rgba(17,42,68,.10)",border=dark?"#334155":"#8fa9bd";
      const chart=LightweightCharts.createChart(box,{width:box.clientWidth,height:Math.max(210,box.clientHeight||360),layout:{background:{type:LightweightCharts.ColorType.Solid,color:background},textColor:text,attributionLogo:false},grid:{vertLines:{color:grid},horzLines:{color:grid}},crosshair:{mode:LightweightCharts.CrosshairMode.Normal},timeScale:{borderColor:border,rightOffset:2},rightPriceScale:{borderColor:border,autoScale:true},handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true},handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true}});
      const series=chart.addSeries(LightweightCharts.AreaSeries,{lineColor:color,topColor:color+"55",bottomColor:color+"08",lineWidth:2,priceFormat:isPsi?{type:"price",precision:0,minMove:1}:{type:"price",precision:3,minMove:.001},autoscaleInfoProvider:isPsi?()=>({priceRange:{minValue:0,maxValue:100},margins:{above:0,below:0}}):undefined});
      const chartData=data.map(point=>({time:point.date,value:Number(point.value)}));series.setData(chartData);chart.timeScale().fitContent();
      const observer=new ResizeObserver(entries=>entries.forEach(entry=>chart.applyOptions({width:Math.max(1,entry.contentRect.width),height:Math.max(210,entry.contentRect.height)})));observer.observe(box);chartCleanup.push(()=>{observer.disconnect();chart.remove()});
      if(comparisonKey)comparisonCharts.set(comparisonKey,{chart,series,data:chartData});
      return{chart,series,data:chartData};
    }

function nearestChartPoint(data,time){
      if(!data.length||time==null)return null;
      const target=typeof time==="string"?Date.parse(time):Date.parse(`${time.year}-${String(time.month).padStart(2,"0")}-${String(time.day).padStart(2,"0")}`);
      let best=data[0],distance=Math.abs(Date.parse(best.time)-target);
      for(const point of data){const next=Math.abs(Date.parse(point.time)-target);if(next<distance){best=point;distance=next}}
      return best;
    }

function comparisonGroups(mode){
      if(mode==="pair")return[["sentiment-0","market-0"],["sentiment-1","market-1"]];
      if(mode==="sentiment")return[["sentiment-0","sentiment-1"]];
      if(mode==="market")return[["market-0","market-1"]];
      if(mode==="all")return[["sentiment-0","market-0","sentiment-1","market-1"]];
      return[];
    }

function activateComparisonSync(mode){
      comparisonSyncCleanup.splice(0).forEach(cleanup=>cleanup());
      comparisonSyncMode=mode;
      document.querySelectorAll("[data-sync-mode]").forEach(button=>button.classList.toggle("active",button.dataset.syncMode===mode));
      comparisonGroups(mode).forEach(keys=>{
        const members=keys.map(key=>comparisonCharts.get(key)).filter(Boolean);
        const state={crosshair:false,range:false};
        members.forEach(source=>{
          const crosshairHandler=param=>{
            if(state.crosshair)return;
            state.crosshair=true;
            members.filter(target=>target!==source).forEach(target=>{
              if(!param?.time||!param?.point){try{target.chart.clearCrosshairPosition()}catch(_error){}return}
              const point=nearestChartPoint(target.data,param.time);
              if(point)try{target.chart.setCrosshairPosition(point.value,param.time,target.series)}catch(_error){}
            });
            requestAnimationFrame(()=>{state.crosshair=false});
          };
          const rangeHandler=range=>{
            if(state.range||!range)return;
            state.range=true;
            members.filter(target=>target!==source).forEach(target=>{try{target.chart.timeScale().setVisibleRange(range)}catch(_error){}});
            requestAnimationFrame(()=>{state.range=false});
          };
          source.chart.subscribeCrosshairMove(crosshairHandler);
          source.chart.timeScale().subscribeVisibleTimeRangeChange(rangeHandler);
          comparisonSyncCleanup.push(()=>{source.chart.unsubscribeCrosshairMove(crosshairHandler);source.chart.timeScale().unsubscribeVisibleTimeRangeChange(rangeHandler)});
        });
      });
    }

function newsHtml(news){return news.map(h=>{const logo=sourceLogoUrl(h),initial=esc(String(h.source||"N").slice(0,1).toUpperCase()),logoHtml=logo?`<img class="headline-logo" src="${esc(logo)}" alt="${esc(h.source||"Source")} logo" loading="lazy">`:`<span class="headline-logo-fallback">${initial}</span>`;return `<a href="${esc(h.link||'#')}" target="_blank" rel="noopener">${logoHtml}<span>${esc(h.title||"Untitled headline")}<small>${esc(h.source||"Source")} • ${esc(h.vote||"Neutral")}</small></span></a>`}).join("")||'<div class="empty-note">No recent news available.</div>'}

function toggleChart(name){const panel=document.querySelector(`[data-chart-panel="${name}"]`),expand=!panel.classList.contains("expanded");document.querySelectorAll(".pulse-chart-panel").forEach(item=>item.classList.remove("expanded"));document.querySelectorAll("[data-chart-size]").forEach(button=>button.textContent="Maximize");if(expand){panel.classList.add("expanded");panel.querySelector("[data-chart-size]").textContent="Minimize"}}

function openHistory(name){activeCompareNames=[];activeHistoryName=name;document.getElementById("historyLayer").classList.add("open");document.body.style.overflow="hidden";renderHistory()}

function closeHistory(){clearCharts();document.getElementById("historyLayer").classList.remove("open");document.body.style.overflow="";activeCompareNames=[];selectedCompareNames=[];updateCompareVisuals()}

function setHistoryPeriod(){renderHistory()}

async function fetchOptionalJson(url){
      try{
        const resp = await fetch(url, {cache:"no-cache"});
        if(!resp.ok) return null;
        return await resp.json();
      }catch(err){
        return null;
      }
    }


  global.PSDCategoryCore = Object.freeze({
    clamp,
    normalizeText,
    labelForScore,
    colorForScore,
    pillStyle,
    headlineText,
    uniqueTerms,
    categoryEntry,
    currentInstrumentRow,
    historyInstrumentRow,
    headlineInstruments,
    headlineMarkets,
    titleDescriptionText,
    hasTerm,
    scoreFromHeadlineSet,
    currentLatestRecord,
    priorityValue,
    priorityHeadlines,
    technicalForItem,
    changeAiCardPage,
    updateCompareVisuals,
    toggleCompare,
    openCompareHistory,
    domainFromUrl,
    releaseDateText,
    sourceLogoUrl,
    renderHero,
    savedHeadlinesForRecord,
    derivedHistoryRowForItem,
    weekKey,
    monthKey,
    aggregateSeries,
    drawHistoryChart,
    ensureCharts,
    clearComparisonSync,
    clearCharts,
    makeInteractiveChart,
    nearestChartPoint,
    comparisonGroups,
    activateComparisonSync,
    newsHtml,
    toggleChart,
    openHistory,
    closeHistory,
    setHistoryPeriod
  });
  global.PSDCategoryCoreVersion = "CATEGORY_CORE_V2";
})(window);

/* PublicSentimentDash Category Page Core v6
   Roadmap Iteration 1 — Category Intelligence.
   Keeps the reliability hardening from Website Optimization Iteration 4 and adds
   lazy, non-blocking category intelligence powered by existing published feeds. */
(function(global){
  "use strict";
/* PublicSentimentDash Category Page Core v1
   Website Optimization Iteration 3
   Shared, behavior-preserving functions extracted from category pages.
   No visual styles, data definitions, PSI formulas, or history retention logic live here. */

function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

function normalizeText(v){ return String(v || "").toLowerCase(); }

function labelForScore(score,fallback="No PSI"){
      const n=Number(score);
      if(!Number.isFinite(n)) return String(fallback || "No PSI");
      if(global.PSDCore && typeof global.PSDCore.classifySentiment === "function"){
        return global.PSDCore.classifySentiment(n);
      }
      return String(fallback || "No PSI");
    }

function colorForScore(score){
      const n=Number(score);
      if(!Number.isFinite(n)) return "#8b949e";
      if(global.PSDCore && typeof global.PSDCore.sentimentColor === "function"){
        return global.PSDCore.sentimentColor(n);
      }
      return "#8b949e";
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
      const rawSource=String(h.source || "").trim().toLowerCase().replace(/^www\./,"");
      const source=normalizeText(h.source).replace(/[^a-z0-9.]+/g," ").trim();
      const publishers={"ecb all news and publications":"ecb.europa.eu","forex.com":"forex.com","cme group":"cmegroup.com","etf.com":"etf.com","federal reserve news":"federalreserve.gov","mining.com":"mining.com","nikkei asia business":"asia.nikkei.com","moomoo.com":"moomoo.com","upstox.com":"upstox.com","binance":"binance.com","bitcoin foundation":"bitcoinfoundation.org","bitget":"bitget.com","cryptorank":"cryptorank.io","investor s business daily":"investors.com","stocktwits":"stocktwits.com","tradingkey":"tradingkey.com","cryptopotato":"cryptopotato.com","the globe and mail":"theglobeandmail.com","bloomberg":"bloomberg.com","bloomberg.com":"bloomberg.com","bnnbloomberg.ca":"bnnbloomberg.ca","financial times":"ft.com","forbes":"forbes.com","fortune":"fortune.com","fortune.com":"fortune.com","bbc":"bbc.com","cnn":"cnn.com","ap business":"apnews.com","cbs news":"cbsnews.com","nbc news":"nbcnews.com","fox business":"foxbusiness.com","fox business markets":"foxbusiness.com","benzinga":"benzinga.com","benzinga markets":"benzinga.com","benzinga.com":"benzinga.com","seeking alpha":"seekingalpha.com","seeking alpha market news":"seekingalpha.com","investopedia":"investopedia.com","investopedia.com":"investopedia.com","business insider":"businessinsider.com","markets.businessinsider.com":"businessinsider.com","barchart":"barchart.com","barchart.com":"barchart.com","marketbeat":"marketbeat.com","marketbeat.com":"marketbeat.com","the motley fool":"fool.com","thestreet":"thestreet.com","thestreet.com":"thestreet.com","tipranks":"tipranks.com","zacks":"zacks.com","zacks investment research":"zacks.com","kitco":"kitco.com","coingecko":"coingecko.com","coinmarketcap":"coinmarketcap.com","cryptoslate":"cryptoslate.com","beincrypto":"beincrypto.com","beincrypto.com":"beincrypto.com","fxempire":"fxempire.com","daily forex":"dailyforex.com","dailyforex":"dailyforex.com","rigzone":"rigzone.com","world gold council":"gold.org","world gold council goldhub":"gold.org","tradingview":"tradingview.com","reuters europe":"reuters.com","wsj.com":"wsj.com","marketwatch.com":"marketwatch.com","coindesk.com":"coindesk.com","fxstreet.com":"fxstreet.com","finance.yahoo.com":"finance.yahoo.com","yahoo":"finance.yahoo.com","yahoo finance australia":"au.finance.yahoo.com","yahoo finance canada":"ca.finance.yahoo.com","bloomberg markets":"bloomberg.com","bnn bloomberg":"bnnbloomberg.ca","cnbc":"cnbc.com","cnbc markets":"cnbc.com","wsj":"wsj.com","the wall street journal markets":"wsj.com","financial times markets":"ft.com","reuters":"reuters.com","reuters markets":"reuters.com","yahoo finance":"finance.yahoo.com","yahoo finance uk":"uk.finance.yahoo.com","yahoo finance singapore":"sg.finance.yahoo.com","marketwatch":"marketwatch.com","barron s":"barrons.com","investing.com":"investing.com","investing.com india":"in.investing.com","investing.com australia":"au.investing.com","fxstreet":"fxstreet.com","forexlive":"forexlive.com","oilprice":"oilprice.com","kitco news":"kitco.com","coindesk":"coindesk.com","cointelegraph":"cointelegraph.com","decrypt":"decrypt.co","the block":"theblock.co","morningstar":"morningstar.com","morningstar markets":"morningstar.com","trading economics news":"tradingeconomics.com","euronews business":"euronews.com","nasdaq news":"nasdaq.com","eia today in energy":"eia.gov","tradingview.com":"tradingview.com","ca.finance.yahoo.com":"ca.finance.yahoo.com","24 7 wall st.":"247wallst.com","euronext press releases":"euronext.com","kalkine media":"kalkinemedia.com","south china morning post business":"scmp.com","bitcoin world":"bitcoinworld.co.in","moomoo":"moomoo.com","the economic times":"economictimes.indiatimes.com","bbn times":"bbntimes.com","bybit":"bybit.com","vt markets":"vtmarkets.com","the times of india":"timesofindia.indiatimes.com","exchange rates org uk":"exchangerates.org.uk","eurostat news":"ec.europa.eu","hdfc sky":"hdfcsky.com","usa today":"usatoday.com","investing.com south africa":"investing.com","stockstory":"stockstory.org","coingape":"coingape.com","investing.com nigeria":"investing.com","ndtv profit":"ndtvprofit.com","action forex":"actionforex.com","euronext company news":"euronext.com","msn":"msn.com","stock titan":"stocktitan.net","economy middle east":"economymiddleeast.com","investinglive":"investinglive.com","business standard":"business-standard.com","crypto briefing":"cryptobriefing.com","tradingpedia":"tradingpedia.com","streetinsider":"streetinsider.com","litefinance":"litefinance.org","gurufocus":"gurufocus.com","investing.com uk":"investing.com","tmgm trading":"tmgm.com","the twelfth magpie":"twelfthmagpie.com","ad hoc news":"ad-hoc-news.de","forex factory":"forexfactory.com","coinpedia":"coinpedia.org","mitrade":"mitrade.com","kalkine":"kalkinemedia.com","cnbc tv18":"cnbctv18.com","discovery alert":"discoveryalert.com","the cryptonomist":"cryptonomist.ch","kucoin":"kucoin.com","chartmill":"chartmill.com","quiver quantitative":"quiverquant.com","99bitcoins":"99bitcoins.com","indexbox":"indexbox.io","investing.com canada":"investing.com","exchange rates uk":"exchangerates.org.uk","action network":"actionnetwork.com","pluang":"pluang.com","cryptoticker":"cryptoticker.io","city index uk":"cityindex.com","globes israel business news":"globes.co.il","bls news":"bls.gov","deutsche boerse press releases":"deutsche-boerse.com","bloomberg law news":"bloomberglaw.com","globenewswire":"globenewswire.com","the guardian":"theguardian.com","mshale":"mshale.com","golfweek":"golfweek.usatoday.com","chiefs wire":"chiefswire.usatoday.com","shanghai metals market":"metal.com","armenpress":"armenpress.am","fathom journal":"fathomjournal.org","free malaysia today":"freemalaysiatoday.com","tmgm":"tmgm.com","kavout ai":"kavout.com","fxleaders":"fxleaders.com","asktraders":"asktraders.com","altcoinbuzz":"altcoinbuzz.io","vinanet":"vinanet.vn","hindustan times":"hindustantimes.com","trefis":"trefis.com","norada real estate investments":"noradarealestate.com","invezz":"invezz.com","robinhood":"robinhood.com","india today":"indiatoday.in","al jazeera":"aljazeera.com","memeburn":"memeburn.com","business recorder":"brecorder.com","t rkiye today":"turkiyetoday.com","wolf street":"wolfstreet.com","tech times":"techtimes.com","oklahoma energy today":"okenergytoday.com","stocks down under":"stocksdownunder.com","the sunday guardian":"sundayguardianlive.com","stockhouse":"stockhouse.com","the manila times":"manilatimes.net","the washington post":"washingtonpost.com","bank of england news":"bankofengland.co.uk","okx":"okx.com","abc news breaking news latest news and videos":"abcnews.go.com","crux investor":"cruxinvestor.com","goldsilver":"goldsilver.com","the new york times":"nytimes.com","businesstoday malaysia":"businesstoday.com.my","law360":"law360.com","brave new coin":"bravenewcoin.com","upstox":"upstox.com","quantum commodity intelligence":"qcintel.com","ambcrypto":"ambcrypto.com","politico":"politico.com","social media today":"socialmediatoday.com","financialcontent":"financialcontent.com","traders union":"tradersunion.com","dailyfx":"dailyfx.com","hart energy":"hartenergy.com","sd bullion":"sdbullion.com","pr newswire":"prnewswire.com","anadolu ajans":"aa.com.tr","advisor perspectives":"advisorperspectives.com","coinfomania":"coinfomania.com","bullionvault":"bullionvault.com","business insider africa":"africa.businessinsider.com","kiplinger":"kiplinger.com"};
      const sourceDomain = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(rawSource) ? rawSource : "";
      const articleDomain = domainFromUrl(h.source_url || h.link || "");
      const domain = publishers[source] || sourceDomain || (articleDomain === "news.google.com" ? "" : articleDomain);
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

async function fetchOptionalJson(url, timeoutMs=30000){
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(()=>controller.abort(), Math.max(1000, Number(timeoutMs) || 30000)) : null;
      try{
        const options = {cache:"no-cache"};
        if(controller) options.signal = controller.signal;
        const resp = await fetch(url, options);
        if(!resp.ok) return null;
        return await resp.json();
      }catch(err){
        return null;
      }finally{
        if(timer) clearTimeout(timer);
      }
    }


/* ---------- Roadmap Phase 2: Category Intelligence ---------- */
const CATEGORY_INTELLIGENCE_CONFIG = Object.freeze({
  ai_assets: {label:"AI Assets", pulseCategory:"ai_assets", consensusTopics:["ai"], consensusLabel:"14-day AI & technology news consensus"},
  crypto: {label:"Crypto", pulseCategory:"crypto", consensusTopics:["bitcoin"], consensusLabel:"14-day crypto news consensus"},
  energy: {label:"Energy", pulseCategory:"energy", consensusTopics:["oil"], consensusLabel:"14-day energy news consensus"},
  forex: {label:"Forex", pulseCategory:"forex", consensusTopics:["dollar"], consensusLabel:"14-day U.S. dollar news consensus"},
  indices: {label:"Indices", pulseCategory:"indices", consensusTopics:["equities"], consensusLabel:"14-day U.S. equities news consensus"},
  policy_geopolitical: {label:"Policy & Geo", pulseCategory:"policy_geopolitical", consensusTopics:["rates","inflation"], consensusLabel:"Related 14-day macro news consensus"},
  precious_metals: {label:"Precious Metals", pulseCategory:"precious_metals", consensusTopics:["gold"], consensusLabel:"14-day precious-metals news consensus"}
});

function ciEsc(value){
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
}

function ciNum(value){
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}

function ciSigned(value, digits=0, suffix=""){
  const n=ciNum(value);
  if(n==null) return "—";
  const rounded=n.toFixed(digits);
  return `${n>0?"+":""}${rounded}${suffix}`;
}

function ciInstrumentName(row){
  return String(row?.display_name || row?.instrument || row?.symbol || "Asset");
}

function ciBucket(score){
  const label=labelForScore(score,"");
  if(label.includes("Bullish")) return "bullish";
  if(label.includes("Bearish")) return "bearish";
  return "neutral";
}

function ciInjectStyles(){
  if(document.getElementById("psd-category-intelligence-styles")) return;
  const style=document.createElement("style");
  style.id="psd-category-intelligence-styles";
  style.textContent=`
    .category-intelligence-mount{margin:7px 0 8px}
    .ci-shell{border:1px solid var(--theme-line,#31475c);border-radius:16px;background:linear-gradient(145deg,var(--theme-card,#111b27),var(--theme-card-2,#0b141f));box-shadow:0 10px 28px rgba(0,0,0,.10);overflow:hidden}
    .ci-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:15px 17px 11px;border-bottom:1px solid var(--theme-line,#31475c)}
    .ci-head h2{margin:0;color:var(--theme-text,#fff);font-size:20px;line-height:1.2}
    .ci-head p{margin:5px 0 0;color:var(--theme-muted,#9fb0c3);font-size:12px;line-height:1.45;font-weight:650}
    .ci-updated{flex:0 0 auto;color:var(--theme-muted,#9fb0c3);font-size:10px;font-weight:850;text-align:right;white-space:nowrap}
    .ci-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;padding:8px}
    .ci-card{min-width:0;padding:11px 12px;border:1px solid var(--theme-line,#31475c);border-radius:12px;background:var(--theme-card-2,#0b141f)}
    .ci-kicker{display:block;margin-bottom:5px;color:var(--theme-muted,#9fb0c3);font-size:9px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}
    .ci-value{display:block;color:var(--theme-text,#fff);font-size:17px;font-weight:950;line-height:1.2;overflow-wrap:anywhere}
    .ci-value[data-tone="bullish"]{color:#22c55e}.ci-value[data-tone="bearish"]{color:#ef6b61}.ci-value[data-tone="neutral"]{color:#69b9ff}
    .ci-note{display:block;margin-top:5px;color:var(--theme-muted,#9fb0c3);font-size:10px;font-weight:700;line-height:1.4}
    .ci-bottom{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.75fr);gap:7px;padding:0 8px 8px}
    .ci-story,.ci-consensus{padding:12px 13px;border:1px solid var(--theme-line,#31475c);border-radius:12px;background:var(--theme-card-2,#0b141f)}
    .ci-story h3,.ci-consensus h3{margin:0 0 6px;color:var(--theme-text,#fff);font-size:12px;font-weight:950}
    .ci-story p,.ci-consensus p{margin:0;color:var(--theme-text,#fff);font-size:11px;line-height:1.5;font-weight:650}
    .ci-consensus-row+.ci-consensus-row{margin-top:8px;padding-top:8px;border-top:1px dashed var(--theme-line,#31475c)}
    .ci-consensus-meta{display:block;margin-top:4px;color:var(--theme-muted,#9fb0c3);font-size:9px;font-weight:800}
    .ci-loading,.ci-unavailable{padding:12px 15px;border:1px solid var(--theme-line,#31475c);border-radius:14px;background:var(--theme-card-2,#0b141f);color:var(--theme-muted,#9fb0c3);font-size:11px;font-weight:800}
    body:not(.dark-mode) .ci-shell,body:not(.dark-mode) .ci-card,body:not(.dark-mode) .ci-story,body:not(.dark-mode) .ci-consensus,body:not(.dark-mode) .ci-loading,body:not(.dark-mode) .ci-unavailable{box-shadow:0 7px 18px rgba(28,58,83,.08)}
    body:not(.dark-mode) .ci-head h2,body:not(.dark-mode) .ci-value,body:not(.dark-mode) .ci-story p,body:not(.dark-mode) .ci-consensus p{color:#061522}
    body:not(.dark-mode) .ci-head p,body:not(.dark-mode) .ci-updated,body:not(.dark-mode) .ci-kicker,body:not(.dark-mode) .ci-note,body:not(.dark-mode) .ci-consensus-meta{color:#334e68}
    @media(max-width:1180px){.ci-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:760px){.ci-head{display:block}.ci-updated{margin-top:7px;text-align:left}.ci-grid,.ci-bottom{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function ciBestChange(rows, field, minimumHeadlines){
  return rows
    .filter(row=>ciNum(row?.[field])!=null && Number(row?.headline_count||0)>=minimumHeadlines)
    .sort((a,b)=>Math.abs(Number(b[field]))-Math.abs(Number(a[field])))[0] || null;
}

function ciDivergenceText(row){
  if(!row) return {value:"None flagged", note:"No qualified sentiment/price divergence is flagged today.", tone:"neutral"};
  const sent=ciNum(row.change_1d), price=ciNum(row.price_change_1d_pct);
  const sentText=ciSigned(sent,0," PSI");
  const priceText=ciSigned(price,2,"%");
  return {
    value:ciInstrumentName(row),
    note:`Sentiment ${sentText} while price moved ${priceText}.`,
    tone:sent>0?"bullish":(sent<0?"bearish":"neutral")
  };
}

function ciConsensusHtml(consensusPayload, cfg){
  const analyses=Array.isArray(consensusPayload?.analyses)?consensusPayload.analyses:[];
  const selected=(cfg.consensusTopics||[]).map(id=>analyses.find(a=>a?.topic_id===id)).filter(Boolean);
  if(!selected.length) return `<p>Consensus feed is not available for this category right now.</p>`;
  return selected.map(item=>{
    const score=ciNum(item.outlook_score);
    const scoreText=score==null?"":` • outlook ${ciSigned(score,0)}`;
    const meta=`${Number(item.outlet_count||0).toLocaleString()} independent outlets • ${Number(item.article_count||0).toLocaleString()} articles${scoreText}`;
    return `<div class="ci-consensus-row"><p><b>${ciEsc(item.topic)}:</b> ${ciEsc(item.consensus||"Mixed/Neutral")} — ${ciEsc(item.outlook||"Mixed outlook")}</p><span class="ci-consensus-meta">${ciEsc(meta)}</span></div>`;
  }).join("");
}

function ciBuildStory(rows, average, strongest24, divergence, counts){
  const tone=ciBucket(average);
  const breadth=counts.bullish>counts.bearish?"bullish breadth leads":counts.bearish>counts.bullish?"bearish breadth leads":"breadth is balanced";
  const parts=[`Category PSI averages ${Math.round(average)}/100 (${labelForScore(average)}), and ${breadth}.`];
  if(strongest24) parts.push(`${ciInstrumentName(strongest24)} has the largest qualified 24H sentiment move at ${ciSigned(strongest24.change_1d,0," PSI")}.`);
  if(divergence) parts.push(`${ciInstrumentName(divergence)} is the clearest flagged sentiment/price divergence to watch.`);
  else if(rows.some(r=>r?.is_reversal)) parts.push(`${rows.filter(r=>r?.is_reversal).length} reversal signal${rows.filter(r=>r?.is_reversal).length===1?" is":"s are"} currently flagged.`);
  return {text:parts.join(" "),tone};
}

async function loadCategoryIntelligence(options={}){
  const mount=document.getElementById(options.mountId||"categoryIntelligence");
  if(!mount) return;
  ciInjectStyles();
  const cfg=CATEGORY_INTELLIGENCE_CONFIG[options.categoryKey];
  if(!cfg){mount.innerHTML='<div class="ci-unavailable">Category intelligence is not configured for this page.</div>';return;}
  mount.innerHTML='<div class="ci-loading">Loading category intelligence…</div>';

  const [pulse,consensus]=await Promise.all([
    fetchOptionalJson("market_pulse.json",20000),
    fetchOptionalJson("news_consensus.json",20000)
  ]);

  const universe=Array.isArray(pulse?.universe)?pulse.universe:[];
  const rows=universe.filter(row=>row?.category===cfg.pulseCategory && ciNum(row?.psi)!=null);
  if(!rows.length){
    mount.innerHTML='<div class="ci-unavailable">Category intelligence is temporarily unavailable. The rest of this page is unaffected.</div>';
    return;
  }

  const minimumHeadlines=Math.max(1,Number(pulse?.selection_rules?.minimum_headlines||5));
  const average=rows.reduce((sum,row)=>sum+Number(row.psi),0)/rows.length;
  const counts=rows.reduce((acc,row)=>{acc[ciBucket(row.psi)]++;return acc;},{bullish:0,neutral:0,bearish:0});
  const strongest24=ciBestChange(rows,"change_1d",minimumHeadlines);
  const strongest7=ciBestChange(rows,"change_7d",minimumHeadlines);
  const divergences=rows.filter(row=>row?.is_divergence).sort((a,b)=>Math.abs(Number(b.change_1d||0))-Math.abs(Number(a.change_1d||0)));
  const divergence=divergences[0]||null;
  const reversals=rows.filter(row=>row?.is_reversal).length;
  const extremes=rows.filter(row=>row?.is_extreme).length;
  const story=ciBuildStory(rows,average,strongest24,divergence,counts);
  const div=ciDivergenceText(divergence);
  const updated=String(pulse?.data_updated_ny||pulse?.data_updated_utc||"").trim();

  mount.innerHTML=`
    <section class="ci-shell" aria-label="${ciEsc(cfg.label)} Category Intelligence">
      <div class="ci-head">
        <div><h2>${ciEsc(cfg.label)} Category Intelligence</h2><p>What changed, what is leading, and where sentiment disagrees with market price.</p></div>
        <div class="ci-updated">${updated?`Updated ${ciEsc(updated)}`:"Latest published data"}</div>
      </div>
      <div class="ci-grid">
        <article class="ci-card"><span class="ci-kicker">Category PSI</span><b class="ci-value" data-tone="${ciEsc(story.tone)}">${Math.round(average)}/100</b><span class="ci-note">${counts.bullish} bullish • ${counts.neutral} neutral • ${counts.bearish} bearish</span></article>
        <article class="ci-card"><span class="ci-kicker">Strongest 24H shift</span><b class="ci-value" data-tone="${ciBucket(strongest24?.psi)}">${strongest24?ciEsc(ciInstrumentName(strongest24)):"No qualified move"}</b><span class="ci-note">${strongest24?`${ciEsc(ciSigned(strongest24.change_1d,0," PSI"))} • PSI ${Math.round(Number(strongest24.psi))}/100`:`Requires at least ${minimumHeadlines} headlines.`}</span></article>
        <article class="ci-card"><span class="ci-kicker">Strongest 7D shift</span><b class="ci-value" data-tone="${ciBucket(strongest7?.psi)}">${strongest7?ciEsc(ciInstrumentName(strongest7)):"Building history"}</b><span class="ci-note">${strongest7?`${ciEsc(ciSigned(strongest7.change_7d,0," PSI"))} • PSI ${Math.round(Number(strongest7.psi))}/100`:"Not enough qualified 7-day history yet."}</span></article>
        <article class="ci-card"><span class="ci-kicker">Divergence watch</span><b class="ci-value" data-tone="${ciEsc(div.tone)}">${ciEsc(div.value)}</b><span class="ci-note">${ciEsc(div.note)}</span></article>
      </div>
      <div class="ci-bottom">
        <article class="ci-story"><h3>What stands out</h3><p>${ciEsc(story.text)} <b>Signal map:</b> ${reversals} reversal${reversals===1?"":"s"}, ${divergences.length} divergence${divergences.length===1?"":"s"}, ${extremes} extreme${extremes===1?"":"s"}.</p></article>
        <article class="ci-consensus"><h3>${ciEsc(cfg.consensusLabel)}</h3>${ciConsensusHtml(consensus,cfg)}</article>
      </div>
    </section>`;
}

function scheduleCategoryIntelligence(options={}){
  const mount=document.getElementById(options.mountId||"categoryIntelligence");
  if(!mount || mount.dataset.ciScheduled==="1") return;
  mount.dataset.ciScheduled="1";
  ciInjectStyles();
  mount.innerHTML='<div class="ci-loading">Category intelligence will load as this section comes into view…</div>';
  let observer=null;
  const start=()=>{
    if(mount.dataset.ciStarted==="1") return;
    mount.dataset.ciStarted="1";
    if(observer) observer.disconnect();
    loadCategoryIntelligence(options).catch(()=>{
      mount.innerHTML='<div class="ci-unavailable">Category intelligence is temporarily unavailable. The rest of this page is unaffected.</div>';
    });
  };
  if("IntersectionObserver" in global){
    observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)) start();},{rootMargin:"500px 0px"});
    observer.observe(mount);
  }else{
    global.setTimeout(start,200);
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
    fetchOptionalJson,
    loadCategoryIntelligence,
    scheduleCategoryIntelligence,
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
  global.PSDCategoryCoreVersion = "CATEGORY_CORE_V5";
})(window);

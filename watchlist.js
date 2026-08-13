(function(){
  "use strict";

  const client = window.psdSupabase;
  if(!client) return;

  const statusNode = document.getElementById("watchlist-status");
  const grid = document.getElementById("watchlist-grid");
  const modal = document.getElementById("watchlist-modal");
  const modalTitle = document.getElementById("watchlist-modal-title");
  const modalBody = document.getElementById("watchlist-modal-body");
  const modalClose = document.getElementById("watchlist-modal-close");
  let historyPromise = null;
  let technicalPromise = null;
  let newsPromise = null;
  let chartLibraryPromise = null;
  let liveHeadlines = [];
  let activeChartCleanup = null;

  function ensureChartLibrary(){
    if(window.LightweightCharts) return Promise.resolve(window.LightweightCharts);
    if(chartLibraryPromise) return chartLibraryPromise;

    chartLibraryPromise = new Promise(function(resolve,reject){
      const existing = document.getElementById("psd-lightweight-charts");
      const script = existing || document.createElement("script");
      const timeout = window.setTimeout(function(){
        reject(new Error("Chart library timed out."));
      },12000);

      function loaded(){
        window.clearTimeout(timeout);
        if(window.LightweightCharts) resolve(window.LightweightCharts);
        else reject(new Error("Chart library did not initialize."));
      }

      function failed(){
        window.clearTimeout(timeout);
        chartLibraryPromise = null;
        reject(new Error("Chart library could not be loaded."));
      }

      if(existing){
        existing.addEventListener("load",loaded,{once:true});
        existing.addEventListener("error",failed,{once:true});
        return;
      }

      script.id = "psd-lightweight-charts";
      script.src = "https://unpkg.com/lightweight-charts@5.2.0/dist/lightweight-charts.standalone.production.js";
      script.async = true;
      script.addEventListener("load",loaded,{once:true});
      script.addEventListener("error",failed,{once:true});
      document.head.appendChild(script);
    });

    return chartLibraryPromise;
  }

  function setStatus(message,type){
    statusNode.textContent = message || "";
    statusNode.className = "watchlist-status" + (type ? " " + type : "");
  }

  function classFor(value){
    const text = String(value || "").toLowerCase();
    if(text.includes("bull")) return "bullish";
    if(text.includes("bear")) return "bearish";
    return "neutral";
  }

  function safeText(value,fallback){
    return String(value == null || value === "" ? (fallback || "—") : value);
  }

  function normalizedKey(value){
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g,"");
  }

  function assetKeys(asset,instrument){
    return [instrument,asset && asset.name,asset && asset.display_name,asset && asset.data_key,asset && asset.symbol]
      .concat(Array.isArray(asset && asset.aliases) ? asset.aliases : [])
      .concat(Array.isArray(asset && asset.history_keys) ? asset.history_keys : [])
      .filter(Boolean)
      .map(normalizedKey)
      .filter(Boolean);
  }

  async function fetchJson(path){
    try{
      const response = await fetch(path,{cache:"no-cache"});
      if(response.ok) return await response.json();
    }catch(_error){}
    return {};
  }

  function primaryCategory(asset){
    const categories = Array.isArray(asset && asset.categories)
      ? asset.categories.filter(function(item){ return item && item.enabled !== false; })
      : [];
    return categories.find(function(item){ return item.role === "primary"; }) || categories[0] || {};
  }

  function buildAssetMap(payload){
    const map = new Map();
    (Array.isArray(payload.assets) ? payload.assets : []).forEach(function(asset){
      if(!asset || !asset.name || asset.enabled === false) return;
      const keys = [asset.name,asset.display_name,asset.data_key,asset.symbol]
        .concat(Array.isArray(asset.aliases) ? asset.aliases : [])
        .concat(Array.isArray(asset.history_keys) ? asset.history_keys : []);
      keys.filter(Boolean).forEach(function(key){
        map.set(String(key).trim().toLowerCase(),asset);
      });
    });
    return map;
  }

  function relatedPageFor(asset,instrument,category){
    const categoryName = String(category && category.category || "").toLowerCase();
    const categoryPages = {
      crypto:"crypto.html",
      energy:"energy.html",
      precious_metals:"precious-metals.html",
      indices:"indices.html",
      policy_assets:"policy-assets.html",
      ai_assets:"ai-assets.html",
      forex:"forex-sentiment-today.html"
    };
    if(categoryPages[categoryName]) return categoryPages[categoryName];
    if(category && category.page && category.page !== "dashboard.html") return category.page;

    const type = String(asset && asset.type || "").toLowerCase();
    const symbol = String(asset && asset.symbol || "").replace(/[^A-Za-z]/g,"").toUpperCase();
    const name = String(instrument || asset && (asset.display_name || asset.name) || "");
    if(["forex","fx","currency"].includes(type) || (/^[A-Z]{6}$/.test(symbol) && name.includes("/"))){
      return "forex-sentiment-today.html";
    }
    return category && category.page || "dashboard.html";
  }

  function aggregateHeadlineMix(headlines,instrument){
    const counts = {Bullish:0,Bearish:0,Mixed:0,Neutral:0,total:0};
    (Array.isArray(headlines) ? headlines : []).forEach(function(headline){
      const instruments = Array.isArray(headline.instruments) ? headline.instruments : [];
      if(!instruments.some(function(name){
        return String(name).toLowerCase() === String(instrument).toLowerCase();
      })) return;

      const vote = String(headline.vote || "Neutral");
      const voteLower = vote.toLowerCase();
      if(voteLower.includes("bull")) counts.Bullish += 1;
      else if(voteLower.includes("bear")) counts.Bearish += 1;
      else if(voteLower.includes("mixed")) counts.Mixed += 1;
      else counts.Neutral += 1;
      counts.total += 1;
    });
    return counts;
  }

  function dominantHeadlineLabel(mix){
    if(!mix.total) return "No fresh headlines";
    const choices = ["Bullish","Bearish","Mixed","Neutral"];
    choices.sort(function(a,b){ return mix[b] - mix[a]; });
    return choices[0];
  }

  function makeMetric(label,value){
    const box = document.createElement("div");
    box.className = "watchlist-metric";
    const small = document.createElement("span");
    small.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = safeText(value);
    strong.className = classFor(value);
    box.appendChild(small);
    box.appendChild(strong);
    return box;
  }

  function makeChip(text){
    const chip = document.createElement("span");
    chip.className = "watchlist-chip";
    chip.textContent = text;
    return chip;
  }

  function makeLink(text,href){
    const link = document.createElement("a");
    link.href = href;
    link.textContent = text;
    return link;
  }

  function makeButton(text,handler){
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click",handler);
    return button;
  }

  function openModal(title){
    modalTitle.textContent = title;
    modalBody.innerHTML = '<div class="watchlist-popup-empty">Loading…</div>';
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeModal(){
    if(activeChartCleanup){activeChartCleanup();activeChartCleanup=null;}
    modal.classList.remove("open");
    modalBody.textContent = "";
    document.body.style.overflow = "";
  }

  function historyData(){
    if(!historyPromise) historyPromise = fetchJson("instrument_history_compact.json");
    return historyPromise;
  }

  function technicalData(){
    if(!technicalPromise) technicalPromise = fetchJson("technical_data.json");
    return technicalPromise;
  }

  function newsData(){
    if(!newsPromise) newsPromise = fetchJson("news_latest.json");
    return newsPromise;
  }

  function instrumentEntry(record,instrument,asset){
    const instruments = record && record.instruments && typeof record.instruments === "object" ? record.instruments : {};
    const wanted = new Set(assetKeys(asset,instrument));
    const key = Object.keys(instruments).find(function(name){ return wanted.has(normalizedKey(name)); });
    return key ? instruments[key] : null;
  }

  function technicalEntry(payload,instrument,asset){
    const technical = payload && payload.technical && typeof payload.technical === "object" ? payload.technical : {};
    const wanted = new Set(assetKeys(asset,instrument));
    const key = Object.keys(technical).find(function(name){ return wanted.has(normalizedKey(name)); });
    return key ? technical[key] : null;
  }

  function chartPoints(payload,technicalPayload,instrument,asset){
    const byDate = new Map();
    (Array.isArray(payload && payload.records) ? payload.records : []).forEach(function(record){
      const entry = instrumentEntry(record,instrument,asset);
      if(!entry) return;
      const daily = entry.technical && entry.technical.daily || {};
      const psi = Number(entry.psi);
      const close = Number(daily.close);
      const date=String(record.date || "").slice(0,10).replace(/[^0-9-]/g,"");
      if(!date) return;
      byDate.set(date,{
        date:date,
        psi:Number.isFinite(psi) ? psi : null,
        close:Number.isFinite(close) ? close : null,
        ma20:null,
        ma50:null,
      });
    });
    const currentTechnical=technicalEntry(technicalPayload,instrument,asset);
    const dailyHistory=Array.isArray(currentTechnical && currentTechnical.daily_history) ? currentTechnical.daily_history : [];
    dailyHistory.forEach(function(item){
      const date=String(item && item.date || "").slice(0,10).replace(/[^0-9-]/g,"");
      const close=Number(item && item.close);
      if(!date || !Number.isFinite(close)) return;
      const point=byDate.get(date) || {date:date,psi:null,close:null};
      point.close=close;
      const ma20=Number(item && item.ma20);
      const ma50=Number(item && item.ma50);
      point.ma20=Number.isFinite(ma20) ? ma20 : null;
      point.ma50=Number.isFinite(ma50) ? ma50 : null;
      byDate.set(date,point);
    });
    return Array.from(byDate.values())
      .filter(function(point){return Number.isFinite(point.psi)||Number.isFinite(point.close);})
      .sort(function(a,b){return a.date.localeCompare(b.date);});
  }

  function exponentialMovingAverage(points,period,key){
    const out=[];
    const seed=[];
    const alpha=2/(period+1);
    let ema=null;
    points.forEach(function(point){
      const value=Number(point[key]);
      if(!Number.isFinite(value)) return;
      if(ema===null){
        seed.push(value);
        if(seed.length<period) return;
        ema=seed.reduce(function(a,b){return a+b;},0)/period;
      }else{
        ema=(value*alpha)+(ema*(1-alpha));
      }
      out.push({time:point.date,value:ema});
    });
    return out;
  }

  function rsi(values,period){
    const clean=values.filter(Number.isFinite);
    if(clean.length<period+1) return null;
    let gains=0,losses=0;
    const start=clean.length-period-1;
    for(let i=start+1;i<clean.length;i++){
      const change=clean[i]-clean[i-1];
      if(change>0) gains+=change; else losses-=change;
    }
    const averageGain=gains/period;
    const averageLoss=losses/period;
    if(averageLoss===0) return averageGain===0?50:100;
    return 100-(100/(1+(averageGain/averageLoss)));
  }

  function formatValue(value,decimals){
    return Number.isFinite(value)?value.toLocaleString(undefined,{minimumFractionDigits:decimals,maximumFractionDigits:decimals}):"N/A";
  }

  function renderInstrumentChart(points,instrument,asset){
    if(!points.length){
      modalBody.innerHTML = '<div class="watchlist-popup-empty">No saved chart history is available for this instrument yet.</div>';
      return;
    }
    if(!window.LightweightCharts){
      modalBody.innerHTML='<div class="watchlist-popup-empty">The interactive chart library could not load. Refresh the page and try again.</div>';
      return;
    }
    const hasNumericalFeed=Boolean(asset && asset.market_data);
    const isEconomic=asset && asset.market_data && asset.market_data.data_kind === "economic_indicator";
    const valueLabel=isEconomic ? "Indicator" : "Market";
    const latest=points[points.length-1];
    const latestMarket=points.slice().reverse().find(function(point){return Number.isFinite(point.close);}) || {};
    const latestSentiment=points.slice().reverse().find(function(point){return Number.isFinite(point.psi);}) || {};
    const configuredDecimals=Number(asset && asset.market_data && asset.market_data.price_decimals);
    const priceDecimals=Number.isFinite(configuredDecimals)?Math.max(0,Math.min(6,configuredDecimals)):2;
    const prices=points.map(function(p){return p.close;});
    const sentiments=points.map(function(p){return p.psi;});
    const marketRsi=rsi(prices,14);
    const sentimentRsi=rsi(sentiments,14);
    const marketEma20=exponentialMovingAverage(points,20,"close");
    const marketEma50=exponentialMovingAverage(points,50,"close");
    const sentimentEma20=exponentialMovingAverage(points,20,"psi");
    const sentimentEma50=exponentialMovingAverage(points,50,"psi");

    const summary=document.createElement("div");
    summary.className="watchlist-chart-summary";
    const summaryItems=[{text:"Latest: "+latest.date}];
    if(hasNumericalFeed){
      summaryItems.push({key:"market",text:valueLabel+": "+formatValue(latestMarket.close,priceDecimals),className:"market-value series-label"});
    }
    summaryItems.push({key:"sentiment",text:"PSI: "+(Number.isFinite(latestSentiment.psi)?Math.round(latestSentiment.psi)+"/100":"N/A"),className:"psi-value series-label"});
    if(hasNumericalFeed){
      summaryItems.push({text:valueLabel+" RSI(14): "+formatValue(marketRsi,1),className:"market-rsi series-label"});
    }
    summaryItems.push({text:"Sentiment RSI(14): "+formatValue(sentimentRsi,1),className:"sentiment-rsi series-label"});
    if(hasNumericalFeed){
      summaryItems.push({key:"marketEma20",text:"Market EMA20: "+(marketEma20.length?formatValue(marketEma20[marketEma20.length-1].value,priceDecimals):"N/A"),className:"market-ema20-value series-label"});
      summaryItems.push({key:"marketEma50",text:"Market EMA50: "+(marketEma50.length?formatValue(marketEma50[marketEma50.length-1].value,priceDecimals):"N/A"),className:"market-ema50-value series-label"});
    }
    summaryItems.push({key:"sentimentEma20",text:"Sentiment EMA20: "+(sentimentEma20.length?formatValue(sentimentEma20[sentimentEma20.length-1].value,1):"N/A"),className:"sentiment-ema20-value series-label"});
    summaryItems.push({key:"sentimentEma50",text:"Sentiment EMA50: "+(sentimentEma50.length?formatValue(sentimentEma50[sentimentEma50.length-1].value,1):"N/A"),className:"sentiment-ema50-value series-label"});
    const summaryNodes={};
    summaryItems.forEach(function(item,index){
      const node=document.createElement(item.key?"button":"span");if(item.key){node.type="button";node.classList.add("watchlist-series-toggle");node.dataset.series=item.key;node.setAttribute("aria-pressed","true");const dot=document.createElement("i");dot.setAttribute("aria-hidden","true");node.appendChild(dot);}if(item.className) node.className+=(node.className?" ":"")+item.className;
      const text=document.createElement("span");text.className="watchlist-series-text";text.textContent=item.text;node.appendChild(text);
      summary.appendChild(node);summaryNodes[(item.className||("item"+index)).split(" ")[0]]=text;
    });
    const toolbar=document.createElement("div");
    toolbar.className="watchlist-chart-toolbar";
    function tool(label){const button=document.createElement("button");button.type="button";button.className="watchlist-chart-tool";button.textContent=label;toolbar.appendChild(button);return button;}
    const trendTool=tool("╱ Trend line");
    const levelTool=tool("— Price level");
    const cursorTool=tool("＋ Free cursor");
    const resetTool=tool("Reset 7D");
    const fitTool=tool("Fit");
    const clearTool=tool("Clear drawings");
    toolbar.hidden=!hasNumericalFeed;

    const wrap=document.createElement("div");
    wrap.className="watchlist-chart-wrap";
    const chartBox=document.createElement("div");chartBox.className="watchlist-chart-canvas";wrap.appendChild(chartBox);

    modalBody.textContent="";
    modalBody.appendChild(toolbar);
    modalBody.appendChild(summary);
    modalBody.appendChild(wrap);

    const chart=LightweightCharts.createChart(chartBox,{
      width:chartBox.clientWidth,height:chartBox.clientHeight,
      layout:{background:{type:LightweightCharts.ColorType.Solid,color:"#0b111b"},textColor:"#aeb8c7",fontFamily:"Inter,system-ui,-apple-system,'Segoe UI',sans-serif",fontSize:12,attributionLogo:false},
      grid:{vertLines:{color:"rgba(255,255,255,.08)"},horzLines:{color:"rgba(255,255,255,.08)"}},
      crosshair:{mode:LightweightCharts.CrosshairMode.Magnet,vertLine:{color:"#758696",width:1,style:LightweightCharts.LineStyle.Dashed,labelBackgroundColor:"#2962ff"},horzLine:{color:"#758696",width:1,style:LightweightCharts.LineStyle.Dashed,labelBackgroundColor:"#43b5aa"}},
      rightPriceScale:{borderColor:"#2a3443",scaleMargins:{top:.10,bottom:.10}},
      leftPriceScale:{visible:true,borderColor:"#2a3443",scaleMargins:{top:.10,bottom:.10}},
      timeScale:{borderColor:"#2a3443",timeVisible:false,secondsVisible:false,rightOffset:2,barSpacing:12,minBarSpacing:4},
      handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},
      handleScale:{axisPressedMouseMove:false,mouseWheel:true,pinch:true},
      localization:{locale:navigator.language||"en-US"}
    });
    const priceSeries=chart.addSeries(LightweightCharts.LineSeries,{title:valueLabel,color:"#4f6dff",lineWidth:2,priceScaleId:"right",priceLineVisible:true,lastValueVisible:true,crosshairMarkerVisible:true,priceFormat:{type:"price",precision:priceDecimals,minMove:Math.pow(10,-priceDecimals)}});
    const psiSeries=chart.addSeries(LightweightCharts.LineSeries,{title:"PSI",color:"#43b5aa",lineWidth:2,priceScaleId:"left",priceLineVisible:true,lastValueVisible:true,crosshairMarkerVisible:true,priceFormat:{type:"price",precision:0,minMove:1},autoscaleInfoProvider:function(){return {priceRange:{minValue:0,maxValue:100},margins:{above:0,below:0}};}});
    const marketPriceFormat={type:"price",precision:priceDecimals,minMove:Math.pow(10,-priceDecimals)};
    const marketEma20Series=chart.addSeries(LightweightCharts.LineSeries,{title:"Market EMA20",color:"#ef4444",lineWidth:1,priceScaleId:"right",priceLineVisible:false,lastValueVisible:true,crosshairMarkerVisible:false,priceFormat:marketPriceFormat});
    const marketEma50Series=chart.addSeries(LightweightCharts.LineSeries,{title:"Market EMA50",color:"#f59e0b",lineWidth:1,priceScaleId:"right",priceLineVisible:false,lastValueVisible:true,crosshairMarkerVisible:false,priceFormat:marketPriceFormat});
    const sentimentEma20Series=chart.addSeries(LightweightCharts.LineSeries,{title:"Sentiment EMA20",color:"#22d3ee",lineWidth:1,priceScaleId:"left",priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,priceFormat:{type:"price",precision:1,minMove:.1}});
    const sentimentEma50Series=chart.addSeries(LightweightCharts.LineSeries,{title:"Sentiment EMA50",color:"#84cc16",lineWidth:1,priceScaleId:"left",priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,priceFormat:{type:"price",precision:1,minMove:.1}});
    const priceData=points.filter(function(p){return Number.isFinite(p.close);}).map(function(p){return {time:p.date,value:p.close};});
    const psiData=points.filter(function(p){return Number.isFinite(p.psi);}).map(function(p){return {time:p.date,value:p.psi};});
    priceSeries.setData(priceData);psiSeries.setData(psiData);marketEma20Series.setData(marketEma20);marketEma50Series.setData(marketEma50);sentimentEma20Series.setData(sentimentEma20);sentimentEma50Series.setData(sentimentEma50);
    const seriesByKey={market:priceSeries,sentiment:psiSeries,marketEma20:marketEma20Series,marketEma50:marketEma50Series,sentimentEma20:sentimentEma20Series,sentimentEma50:sentimentEma50Series};
    summary.querySelectorAll(".watchlist-series-toggle").forEach(function(button){button.addEventListener("click",function(){const active=button.getAttribute("aria-pressed")!=="true";button.setAttribute("aria-pressed",String(active));button.classList.toggle("inactive",!active);seriesByKey[button.dataset.series].applyOptions({visible:active});});});
    let linkedMargin=.10;
    function applyLinkedMargin(value){linkedMargin=Math.max(.02,Math.min(.36,value));["left","right"].forEach(function(side){chart.priceScale(side).applyOptions({autoScale:true,scaleMargins:{top:linkedMargin,bottom:linkedMargin}});});}
    function resetSevenDays(){applyLinkedMargin(.10);const count=Math.max(priceData.length,psiData.length);chart.timeScale().setVisibleLogicalRange({from:Math.max(0,count-7),to:Math.max(0,count-1)});}
    resetSevenDays();
    let edgeDrag=null;
    chartBox.addEventListener("pointerdown",function(event){const rect=chartBox.getBoundingClientRect();const x=event.clientX-rect.left;if(x>58&&x<rect.width-58) return;edgeDrag={y:event.clientY,margin:linkedMargin};chartBox.setPointerCapture(event.pointerId);event.preventDefault();});
    chartBox.addEventListener("pointermove",function(event){if(!edgeDrag) return;applyLinkedMargin(edgeDrag.margin+((event.clientY-edgeDrag.y)/Math.max(200,chartBox.clientHeight))*.35);});
    chartBox.addEventListener("pointerup",function(){edgeDrag=null;});chartBox.addEventListener("pointercancel",function(){edgeDrag=null;});

    let drawingMode="",trendStart=null,freeCursor=false;
    const drawingSeries=[],priceLines=[];
    function setMode(mode,button){drawingMode=drawingMode===mode?"":mode;trendStart=null;[trendTool,levelTool].forEach(function(x){x.classList.remove("active");});if(drawingMode) button.classList.add("active");}
    trendTool.addEventListener("click",function(){setMode("trend",trendTool);});
    levelTool.addEventListener("click",function(){setMode("level",levelTool);});
    cursorTool.addEventListener("click",function(){freeCursor=!freeCursor;chart.applyOptions({crosshair:{mode:freeCursor?LightweightCharts.CrosshairMode.Normal:LightweightCharts.CrosshairMode.Magnet}});cursorTool.classList.toggle("active",freeCursor);cursorTool.textContent=freeCursor?"⊕ Magnet cursor":"＋ Free cursor";});
    resetTool.addEventListener("click",resetSevenDays);
    fitTool.addEventListener("click",function(){chart.timeScale().fitContent();});
    clearTool.addEventListener("click",function(){drawingSeries.splice(0).forEach(function(series){chart.removeSeries(series);});priceLines.splice(0).forEach(function(line){priceSeries.removePriceLine(line);});drawingMode="";trendStart=null;trendTool.classList.remove("active");levelTool.classList.remove("active");});
    chart.subscribeClick(function(param){
      if(!drawingMode||!param.time) return;
      const item=param.seriesData.get(priceSeries);
      if(!item||!Number.isFinite(item.value)) return;
      if(drawingMode==="level"){
        priceLines.push(priceSeries.createPriceLine({price:item.value,color:"#ffd780",lineWidth:1,lineStyle:LightweightCharts.LineStyle.Dashed,axisLabelVisible:true,title:"Level"}));
        setMode("",levelTool);return;
      }
      if(!trendStart){trendStart={time:param.time,value:item.value};return;}
      const series=chart.addSeries(LightweightCharts.LineSeries,{color:"#ffd780",lineWidth:2,priceScaleId:"right",priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
      const pair=[trendStart,{time:param.time,value:item.value}].sort(function(a,b){return String(a.time).localeCompare(String(b.time));});
      series.setData(pair);drawingSeries.push(series);setMode("",trendTool);
    });
    chart.subscribeCrosshairMove(function(param){
      const market=param.seriesData.get(priceSeries);const sentiment=param.seriesData.get(psiSeries);
      if(summaryNodes["market-value"]&&market&&Number.isFinite(market.value)) summaryNodes["market-value"].textContent=valueLabel+": "+formatValue(market.value,priceDecimals);
      if(summaryNodes["psi-value"]&&sentiment&&Number.isFinite(sentiment.value)) summaryNodes["psi-value"].textContent="PSI: "+Math.round(sentiment.value)+"/100";
    });
    const observer=new ResizeObserver(function(entries){entries.forEach(function(entry){chart.applyOptions({width:Math.max(1,entry.contentRect.width),height:Math.max(1,entry.contentRect.height)});});});
    observer.observe(chartBox);
    activeChartCleanup=function(){observer.disconnect();chart.remove();};
  }

  async function openChartPopup(instrument,asset){
    const title=asset && asset.market_data
      ? instrument+" — Daily "+(asset.market_data.data_kind === "economic_indicator" ? "Indicator" : "Market")+" & Sentiment Comparison"
      : instrument+" — Daily Sentiment History";
    openModal(title);
    const data=await Promise.all([historyData(),technicalData(),ensureChartLibrary()]);
    if(!modal.classList.contains("open")) return;
    renderInstrumentChart(chartPoints(data[0],data[1],instrument,asset),instrument,asset);
  }

  function relevantNews(payload,instrument,asset){
    const wanted=new Set(assetKeys(asset,instrument));
    const latest=Array.isArray(payload && payload.articles)?payload.articles:[];
    const combined=latest.concat(liveHeadlines);
    const seen=new Set();
    return combined.filter(function(article){
      const matches=(Array.isArray(article && article.instruments)?article.instruments:[]).some(function(name){return wanted.has(normalizedKey(name));});
      if(!matches) return false;
      const key=String(article.link || article.title || "").trim().toLowerCase();
      if(!key || seen.has(key)) return false;
      seen.add(key);return true;
    }).slice(0,50);
  }

  function renderNewsPopup(articles){
    modalBody.textContent="";
    if(!articles.length){
      modalBody.innerHTML='<div class="watchlist-popup-empty">No relevant saved articles were found for this instrument.</div>';
      return;
    }
    const list=document.createElement("div");
    list.className="watchlist-news-list";
    articles.forEach(function(article){
      const link=document.createElement("a");
      link.className="watchlist-news-item";
      link.href=article.link || "#";
      link.target="_blank";
      link.rel="noopener";
      const title=document.createElement("div");
      title.className="watchlist-news-title";
      title.textContent=safeText(article.title,"Untitled article");
      const meta=document.createElement("div");
      meta.className="watchlist-news-meta";
      meta.textContent=[article.source || "Source",article.vote || "Neutral",(article.impact || "Normal")+" impact",article.published_utc || article.published || ""].filter(Boolean).join(" • ");
      link.appendChild(title);link.appendChild(meta);list.appendChild(link);
    });
    modalBody.appendChild(list);
  }

  async function openNewsPopup(instrument,asset){
    openModal(instrument+" — Relevant News & Articles");
    const payload=await newsData();
    if(!modal.classList.contains("open")) return;
    renderNewsPopup(relevantNews(payload,instrument,asset));
  }

  modalClose.addEventListener("click",closeModal);
  modal.addEventListener("click",function(event){if(event.target===modal) closeModal();});
  document.addEventListener("keydown",function(event){if(event.key==="Escape" && modal.classList.contains("open")) closeModal();});

  async function removeItem(itemId,watchlistId){
    const confirmed = window.confirm("Remove this instrument from your watchlist?");
    if(!confirmed) return;

    const result = await client
      .from("watchlist_items")
      .delete()
      .eq("id",itemId)
      .eq("watchlist_id",watchlistId);

    if(result.error){
      setStatus(result.error.message,"error");
      return;
    }

    setStatus("Watchlist updated.","success");
    await load();
    window.dispatchEvent(new CustomEvent("psd-preferences-updated"));
  }

  function renderEmpty(){
    grid.textContent = "";
    const card = document.createElement("article");
    card.className = "panel watchlist-empty";
    const title = document.createElement("h2");
    title.textContent = "Your watchlist is empty";
    const text = document.createElement("p");
    text.textContent = "Choose tracked instruments from your Account page.";
    const link = document.createElement("a");
    link.className = "watchlist-action";
    link.href = "account.html#watchlist";
    link.textContent = "Add Instruments";
    card.appendChild(title);
    card.appendChild(text);
    card.appendChild(link);
    grid.appendChild(card);
  }

  function renderCards(items,assetMap,headlines,technicalMap,userMap){
    grid.textContent = "";
    items.forEach(function(item){
      const key = String(item.instrument).toLowerCase();
      const asset = assetMap.get(key) || {};
      const category = primaryCategory(asset);
      const relatedPage = relatedPageFor(asset,item.instrument,category);
      const technical = technicalMap[item.instrument] || technicalMap[asset.name] || {};
      const daily = technical.daily || {};
      const userSentiment = userMap[key] || "N/A";
      const mix = aggregateHeadlineMix(headlines,item.instrument);
      const headlineLabel = dominantHeadlineLabel(mix);

      const card = document.createElement("article");
      card.className = "panel watchlist-card";

      const top = document.createElement("div");
      top.className = "watchlist-card-top";

      const nameBox = document.createElement("div");
      const title = document.createElement("h2");
      title.textContent = item.instrument;
      const symbol = document.createElement("div");
      symbol.className = "watchlist-symbol";
      symbol.textContent =
        safeText(asset.symbol,asset.type || "Tracked instrument");

      const comparison = document.createElement("button");
      comparison.type = "button";
      comparison.className = "watchlist-comparison";
      comparison.textContent = "Comparison";
      comparison.addEventListener("click",function(){
        openChartPopup(item.instrument,asset).catch(function(error){
          console.error(error);
          modalBody.innerHTML = '<div class="watchlist-popup-empty">Chart could not be loaded.</div>';
        });
      });

      const cardTools = document.createElement("div");
      cardTools.className = "watchlist-card-tools";
      cardTools.appendChild(comparison);

      nameBox.appendChild(title);
      nameBox.appendChild(symbol);
      top.appendChild(nameBox);
      top.appendChild(cardTools);

      const metrics = document.createElement("div");
      metrics.className = "watchlist-metrics";
      metrics.appendChild(makeMetric("User Sentiment",userSentiment));
      metrics.appendChild(makeMetric("Technical Daily",daily.direction || "N/A"));
      metrics.appendChild(makeMetric("Headline Mix",headlineLabel));

      const headlineRow = document.createElement("div");
      headlineRow.className = "watchlist-headline-row";
      headlineRow.appendChild(makeChip("Fresh: " + mix.total));
      headlineRow.appendChild(makeChip("Bullish: " + mix.Bullish));
      headlineRow.appendChild(makeChip("Bearish: " + mix.Bearish));
      headlineRow.appendChild(makeChip("Mixed/Neutral: " + (mix.Mixed + mix.Neutral)));

      const actions = document.createElement("div");
      actions.className = "watchlist-card-actions";
      actions.appendChild(makeLink("Related Sentiment Page",relatedPage));
      actions.appendChild(makeLink("Market Charts","charts.html"));
      actions.appendChild(makeButton("News & Articles",function(){
        openNewsPopup(item.instrument,asset).catch(function(error){
          console.error(error);
          modalBody.innerHTML = '<div class="watchlist-popup-empty">News could not be loaded.</div>';
        });
      }));

      card.appendChild(top);
      card.appendChild(metrics);
      card.appendChild(headlineRow);
      card.appendChild(actions);
      grid.appendChild(card);
    });
  }

  async function load(){
    setStatus("Loading your private watchlist…");
    grid.textContent = "";

    const sessionResult = await client.auth.getSession();
    const session = sessionResult.data && sessionResult.data.session;
    if(!session){
      window.location.replace("auth.html");
      return;
    }

    const watchlistResult = await client
      .from("watchlists")
      .select("id")
      .eq("user_id",session.user.id)
      .eq("is_default",true)
      .limit(1)
      .maybeSingle();

    if(watchlistResult.error) throw watchlistResult.error;
    if(!watchlistResult.data){
      renderEmpty();
      setStatus("No default watchlist exists yet.");
      return;
    }

    const watchlistId = watchlistResult.data.id;
    const firstResults = await Promise.all([
      client
        .from("watchlist_items")
        .select("id,instrument,display_order,created_at")
        .eq("watchlist_id",watchlistId)
        .order("display_order",{ascending:true})
        .order("created_at",{ascending:true}),
      fetchJson("assets_config.json")
    ]);

    if(firstResults[0].error) throw firstResults[0].error;
    const items = firstResults[0].data || [];
    if(!items.length){
      renderEmpty();
      setStatus("Your watchlist is ready for instruments.");
      return;
    }

    const assetMap = buildAssetMap(firstResults[1] || {});
    renderCards(items,assetMap,[],{},{});

    setStatus(
      "Showing " + items.length + " saved instrument" +
      (items.length === 1 ? "." : "s.") +
      " Loading the latest readings…",
      "success"
    );

    const backgroundResults = await Promise.all([
      fetchJson("dashboard_live.json"),
      fetchJson("technical_data.json"),
      client.rpc("get_user_sentiment")
    ]);
    const headlines = (backgroundResults[0] && backgroundResults[0].psi_headlines) || [];
    liveHeadlines = headlines;
    const technicalMap = (backgroundResults[1] && backgroundResults[1].technical) || {};
    const userMap = {};
    if(!backgroundResults[2].error && Array.isArray(backgroundResults[2].data)){
      backgroundResults[2].data.forEach(function(row){
        userMap[String(row.instrument).toLowerCase()] = row.user_sentiment || "N/A";
      });
    }
    renderCards(items,assetMap,headlines,technicalMap,userMap);
    setStatus(
      "Showing " + items.length + " saved instrument" +
      (items.length === 1 ? "." : "s.") +
      " Data updates whenever the website data updates.",
      "success"
    );
  }

  load().catch(function(error){
    console.error(error);
    setStatus(error.message || "Watchlist could not be loaded.","error");
  });
})();

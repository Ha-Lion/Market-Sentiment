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
  let liveHeadlines = [];
  let activeChartCleanup = null;

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

  function marketChartHrefFor(asset,instrument){
    const rawSymbol = String(asset && asset.symbol || "").trim();
    const symbol = rawSymbol.replace(/\s+/g,"");
    const name = String(instrument || asset && (asset.display_name || asset.name) || "").trim();
    const key = normalizedKey(name);
    const symbolKey = normalizedKey(symbol);
    const type = String(asset && asset.type || "").toLowerCase();

    const direct = {
      "sp500es":"CME_MINI:ES1!",
      "nasdaqnq":"CME_MINI:NQ1!",
      "dowym":"CBOT_MINI:YM1!",
      "russellrty":"CME_MINI:RTY1!",
      "vix":"CBOE:VIX",
      "dax":"EUREX:FDAX1!",
      "ftse100":"OANDA:UK100GBP",
      "nikkei225":"OANDA:JP225USD",
      "hangseng":"OANDA:HK33HKD",
      "eurostoxx50":"EUREX:FESX1!",

      "crudeoil":"NYMEX:CL1!",
      "wtioil":"NYMEX:CL1!",
      "naturalgas":"NYMEX:NG1!",
      "brentoil":"NYMEX:BZ1!",
      "gasoline":"NYMEX:RB1!",
      "heatingoil":"NYMEX:HO1!",

      "gold":"AMEX:GLD",
      "silver":"AMEX:SLV",
      "platinum":"NYMEX:PL1!",
      "palladium":"NYMEX:PA1!",
      "copper":"COMEX:HG1!",
      "goldetfsflows":"AMEX:GLD",
      "miningstocks":"AMEX:GDX",

      "trump":"BINANCE:TRUMPUSDT",
      "wlfi":"BINANCE:WLFIUSDT",
      "djt":"NASDAQ:DJT",
      "coin":"NASDAQ:COIN",
      "mstr":"NASDAQ:MSTR",
      "ita":"CBOE:ITA",
      "lmt":"NYSE:LMT",
      "remx":"AMEX:REMX",
      "fxi":"AMEX:FXI",
      "ura":"AMEX:URA",
      "geo":"NYSE:GEO"
    };

    if(direct[key]) return "charts.html?symbol="+encodeURIComponent(direct[key]);
    if(direct[symbolKey]) return "charts.html?symbol="+encodeURIComponent(direct[symbolKey]);

    // Forex pairs need the TradingView exchange prefix.
    if((type === "forex" || type === "fx" || type === "currency" || /^[A-Z]{6}$/.test(symbol.toUpperCase()))
      && /^[A-Za-z]{6}$/.test(symbol)){
      return "charts.html?symbol="+encodeURIComponent("OANDA:"+symbol.toUpperCase());
    }

    // Crypto chart symbols are explicit so the chart page cannot fall back.
    const crypto = new Set(["BTC","ETH","SOL","XRP","BNB","DOGE","ADA","LINK","LTC","AVAX","DOT","BCH"]);
    if(type === "crypto" && crypto.has(symbol.toUpperCase())){
      return "charts.html?symbol="+encodeURIComponent("BINANCE:"+symbol.toUpperCase()+"USDT");
    }

    // Stocks, ETFs, and most supported chart items can be resolved by
    // the short ticker already registered in charts.html.
    if(symbol){
      return "charts.html?symbol="+encodeURIComponent(symbol);
    }

    return "charts.html";
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
    /* On full market-comparison charts, RSI readouts live in the toolbar
       as beveled indicators instead of the oval summary row. Keep the
       sentiment RSI in the summary only for sentiment-only instruments. */
    if(!hasNumericalFeed){
      summaryItems.push({text:"Sentiment RSI(14): "+formatValue(sentimentRsi,1),className:"sentiment-rsi series-label"});
    }
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
    const drawingsTool=tool("Drawings (0)");

    function rsiIndicator(label,value,className){
      const badge=document.createElement("span");
      badge.className="watchlist-rsi-indicator "+className;
      badge.setAttribute("aria-label",label+" "+formatValue(value,1));
      const name=document.createElement("span");
      name.className="watchlist-rsi-indicator-label";
      name.textContent=label;
      const number=document.createElement("strong");
      number.className="watchlist-rsi-indicator-value";
      number.textContent=formatValue(value,1);
      badge.appendChild(name);
      badge.appendChild(number);
      toolbar.appendChild(badge);
      return badge;
    }

    if(hasNumericalFeed){
      rsiIndicator(valueLabel+" RSI(14)",marketRsi,"market-rsi");
      rsiIndicator("Sentiment RSI(14)",sentimentRsi,"sentiment-rsi");
    }
    toolbar.hidden=!hasNumericalFeed;

    const wrap=document.createElement("div");
    wrap.className="watchlist-chart-wrap";
    const chartBox=document.createElement("div");chartBox.className="watchlist-chart-canvas";wrap.appendChild(chartBox);

    const drawingManager=document.createElement("section");
    drawingManager.className="watchlist-drawing-manager";
    drawingManager.hidden=true;
    drawingManager.innerHTML=
      '<div class="watchlist-drawing-manager-head">'+
        '<div><strong>Drawing Manager</strong><span class="watchlist-drawing-manager-help">Select a drawing to edit it.</span></div>'+
        '<button type="button" class="watchlist-drawing-manager-close" aria-label="Close drawing manager">×</button>'+
      '</div>'+
      '<div class="watchlist-drawing-manager-body">'+
        '<div class="watchlist-drawing-list" role="listbox" aria-label="Chart drawings"></div>'+
        '<div class="watchlist-drawing-editor">'+
          '<div class="watchlist-drawing-empty">No drawing selected.</div>'+
        '</div>'+
      '</div>'+
      '<div class="watchlist-drawing-status" aria-live="polite">Choose Trend line or Price level to start drawing.</div>';

    modalBody.textContent="";
    modalBody.appendChild(toolbar);
    modalBody.appendChild(drawingManager);
    modalBody.appendChild(summary);
    modalBody.appendChild(wrap);

    const chartIsDark=document.body.classList.contains("dark-mode");
    const chart=LightweightCharts.createChart(chartBox,{
      width:chartBox.clientWidth,height:chartBox.clientHeight,
      layout:{background:{type:LightweightCharts.ColorType.Solid,color:chartIsDark?"#0b111b":"#ffffff"},textColor:chartIsDark?"#f8fbff":"#061522",fontFamily:"Inter,system-ui,-apple-system,'Segoe UI',sans-serif",fontSize:12,attributionLogo:false},
      grid:{vertLines:{color:chartIsDark?"rgba(255,255,255,.08)":"rgba(71,85,105,.16)"},horzLines:{color:chartIsDark?"rgba(255,255,255,.08)":"rgba(71,85,105,.16)"}},
      crosshair:{mode:LightweightCharts.CrosshairMode.Magnet,vertLine:{color:"#758696",width:1,style:LightweightCharts.LineStyle.Dashed,labelBackgroundColor:"#2962ff"},horzLine:{color:"#758696",width:1,style:LightweightCharts.LineStyle.Dashed,labelBackgroundColor:"#43b5aa"}},
      rightPriceScale:{borderColor:chartIsDark?"#2a3443":"#9eb4c6",scaleMargins:{top:.10,bottom:.10}},
      leftPriceScale:{visible:true,borderColor:chartIsDark?"#2a3443":"#9eb4c6",scaleMargins:{top:.10,bottom:.10}},
      timeScale:{borderColor:chartIsDark?"#2a3443":"#9eb4c6",timeVisible:false,secondsVisible:false,rightOffset:2,barSpacing:12,minBarSpacing:4},
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

    let drawingMode="",trendStart=null,freeCursor=false,editState=null;
    let previewTrendSeries=null,previewPriceLine=null;
    let drawingCounter=0,selectedDrawingId=null;
    const drawings=[];

    const drawingList=drawingManager.querySelector(".watchlist-drawing-list");
    const drawingEditor=drawingManager.querySelector(".watchlist-drawing-editor");
    const drawingStatus=drawingManager.querySelector(".watchlist-drawing-status");
    const drawingClose=drawingManager.querySelector(".watchlist-drawing-manager-close");

    function drawingSetStatus(message){
      drawingStatus.textContent=message;
    }

    function openDrawingManager(){
      drawingManager.hidden=false;
      drawingsTool.classList.add("active");
    }

    function closeDrawingManager(){
      drawingManager.hidden=true;
      drawingsTool.classList.remove("active");
    }

    drawingsTool.addEventListener("click",function(){
      if(drawingManager.hidden) openDrawingManager();
      else closeDrawingManager();
    });
    drawingClose.addEventListener("click",closeDrawingManager);

    function updateDrawingCount(){
      drawingsTool.textContent="Drawings ("+drawings.length+")";
    }

    function chartPointFromParam(param){
      if(!param||!param.point) return null;
      let time=param.time;
      if(time==null && chart.timeScale().coordinateToTime){
        time=chart.timeScale().coordinateToTime(param.point.x);
      }
      let value=priceSeries.coordinateToPrice(param.point.y);
      if(!Number.isFinite(value)){
        const item=param.seriesData&&param.seriesData.get(priceSeries);
        value=item&&Number.isFinite(item.value)?item.value:NaN;
      }
      if(time==null||!Number.isFinite(value)) return null;
      return {time:time,value:value};
    }

    function timeOrderValue(time){
      if(typeof time==="number") return time;
      if(typeof time==="string"){
        const parsed=Date.parse(time);
        return Number.isFinite(parsed)?parsed:0;
      }
      if(time&&typeof time==="object"&&Number.isFinite(time.year)){
        return Date.UTC(time.year,Number(time.month||1)-1,Number(time.day||1));
      }
      return 0;
    }

    function orderedPair(a,b){
      return timeOrderValue(a.time)<=timeOrderValue(b.time)?[a,b]:[b,a];
    }

    function displayTime(time){
      if(typeof time==="string") return time;
      if(typeof time==="number"){
        try{return new Date(time*1000).toLocaleDateString();}catch(error){return String(time);}
      }
      if(time&&typeof time==="object"&&time.year){
        return String(time.year)+"-"+String(time.month).padStart(2,"0")+"-"+String(time.day).padStart(2,"0");
      }
      return "N/A";
    }

    function lineStyleValue(style){
      if(style==="dotted") return LightweightCharts.LineStyle.Dotted;
      if(style==="dashed") return LightweightCharts.LineStyle.Dashed;
      return LightweightCharts.LineStyle.Solid;
    }

    function safeLineWidth(width){
      return Math.max(1,Math.min(4,Number(width)||1));
    }

    function removePreview(){
      if(previewTrendSeries){
        try{chart.removeSeries(previewTrendSeries);}catch(error){}
        previewTrendSeries=null;
      }
      if(previewPriceLine){
        try{priceSeries.removePriceLine(previewPriceLine);}catch(error){}
        previewPriceLine=null;
      }
    }

    function cancelDrawingInteraction(message){
      removePreview();
      drawingMode="";
      trendStart=null;
      editState=null;
      trendTool.classList.remove("active");
      levelTool.classList.remove("active");
      chartBox.classList.remove("watchlist-drawing-active");
      if(message) drawingSetStatus(message);
      renderDrawingManager();
    }

    function setMode(mode,button){
      const same=drawingMode===mode&&!editState;
      removePreview();
      editState=null;
      drawingMode=same?"":mode;
      trendStart=null;
      [trendTool,levelTool].forEach(function(x){x.classList.remove("active");});
      if(drawingMode){
        button.classList.add("active");
        chartBox.classList.add("watchlist-drawing-active");
        openDrawingManager();
        drawingSetStatus(drawingMode==="trend"?"Trend line: click the first point.":"Price level: move the mouse to preview the level, then click to place it.");
      }else{
        chartBox.classList.remove("watchlist-drawing-active");
        drawingSetStatus("Drawing mode cancelled.");
      }
    }

    function nextDrawingName(type){
      drawingCounter+=1;
      return (type==="trend"?"Trend ":"Level ")+drawingCounter;
    }

    function createTrendDrawing(p1,p2,options){
      const opts=options||{};
      const drawing={
        id:"drawing-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),
        type:"trend",
        name:opts.name||nextDrawingName("trend"),
        p1:{time:p1.time,value:p1.value},
        p2:{time:p2.time,value:p2.value},
        color:opts.color||"#ffd780",
        width:safeLineWidth(opts.width||2),
        style:opts.style||"solid",
        series:null
      };
      drawing.series=chart.addSeries(LightweightCharts.LineSeries,{
        color:drawing.color,
        lineWidth:drawing.width,
        lineStyle:lineStyleValue(drawing.style),
        priceScaleId:"right",
        priceLineVisible:false,
        lastValueVisible:false,
        crosshairMarkerVisible:false
      });
      drawing.series.setData(orderedPair(drawing.p1,drawing.p2));
      drawings.push(drawing);
      selectedDrawingId=drawing.id;
      updateDrawingCount();
      openDrawingManager();
      renderDrawingManager();
      return drawing;
    }

    function createLevelDrawing(price,options){
      const opts=options||{};
      const drawing={
        id:"drawing-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),
        type:"level",
        name:opts.name||nextDrawingName("level"),
        price:Number(price),
        color:opts.color||"#ffd780",
        width:safeLineWidth(opts.width||1),
        style:opts.style||"dashed",
        priceLine:null
      };
      drawing.priceLine=priceSeries.createPriceLine({
        price:drawing.price,
        color:drawing.color,
        lineWidth:drawing.width,
        lineStyle:lineStyleValue(drawing.style),
        axisLabelVisible:true,
        title:drawing.name
      });
      drawings.push(drawing);
      selectedDrawingId=drawing.id;
      updateDrawingCount();
      openDrawingManager();
      renderDrawingManager();
      return drawing;
    }

    function refreshDrawing(drawing){
      if(!drawing) return;
      if(drawing.type==="trend"){
        drawing.series.applyOptions({
          color:drawing.color,
          lineWidth:safeLineWidth(drawing.width),
          lineStyle:lineStyleValue(drawing.style)
        });
        drawing.series.setData(orderedPair(drawing.p1,drawing.p2));
      }else{
        if(drawing.priceLine){
          try{priceSeries.removePriceLine(drawing.priceLine);}catch(error){}
        }
        drawing.priceLine=priceSeries.createPriceLine({
          price:drawing.price,
          color:drawing.color,
          lineWidth:safeLineWidth(drawing.width),
          lineStyle:lineStyleValue(drawing.style),
          axisLabelVisible:true,
          title:drawing.name
        });
      }
    }

    function deleteDrawing(id){
      const index=drawings.findIndex(function(drawing){return drawing.id===id;});
      if(index<0) return;
      const drawing=drawings[index];
      if(drawing.type==="trend"&&drawing.series){
        try{chart.removeSeries(drawing.series);}catch(error){}
      }
      if(drawing.type==="level"&&drawing.priceLine){
        try{priceSeries.removePriceLine(drawing.priceLine);}catch(error){}
      }
      drawings.splice(index,1);
      if(selectedDrawingId===id) selectedDrawingId=drawings.length?drawings[Math.max(0,index-1)].id:null;
      updateDrawingCount();
      renderDrawingManager();
      drawingSetStatus(drawings.length?"Drawing deleted.":"No drawings on this chart.");
    }

    function clearAllDrawings(){
      removePreview();
      drawings.splice(0).forEach(function(drawing){
        if(drawing.type==="trend"&&drawing.series){
          try{chart.removeSeries(drawing.series);}catch(error){}
        }
        if(drawing.type==="level"&&drawing.priceLine){
          try{priceSeries.removePriceLine(drawing.priceLine);}catch(error){}
        }
      });
      selectedDrawingId=null;
      drawingMode="";
      trendStart=null;
      editState=null;
      trendTool.classList.remove("active");
      levelTool.classList.remove("active");
      chartBox.classList.remove("watchlist-drawing-active");
      updateDrawingCount();
      renderDrawingManager();
      drawingSetStatus("All drawings cleared.");
    }

    function selectDrawing(id){
      selectedDrawingId=id;
      renderDrawingManager();
    }

    function selectedDrawing(){
      return drawings.find(function(drawing){return drawing.id===selectedDrawingId;})||null;
    }

    function beginEdit(drawing,part){
      removePreview();
      drawingMode="";
      trendStart=null;
      [trendTool,levelTool].forEach(function(button){button.classList.remove("active");});
      editState={id:drawing.id,part:part};
      chartBox.classList.add("watchlist-drawing-active");
      openDrawingManager();
      if(part==="p1") drawingSetStatus(drawing.name+": move the mouse to preview Point 1, then click its new position.");
      else if(part==="p2") drawingSetStatus(drawing.name+": move the mouse to preview Point 2, then click its new position.");
      else drawingSetStatus(drawing.name+": move the mouse to preview the new level, then click to place it.");
      renderDrawingManager();
    }

    function renderDrawingManager(){
      drawingList.textContent="";
      if(!drawings.length){
        const empty=document.createElement("div");
        empty.className="watchlist-drawing-list-empty";
        empty.textContent="No drawings yet.";
        drawingList.appendChild(empty);
      }else{
        drawings.forEach(function(drawing){
          const row=document.createElement("button");
          row.type="button";
          row.className="watchlist-drawing-row"+(drawing.id===selectedDrawingId?" selected":"");
          row.setAttribute("role","option");
          row.setAttribute("aria-selected",drawing.id===selectedDrawingId?"true":"false");
          const swatch=document.createElement("span");
          swatch.className="watchlist-drawing-swatch";
          swatch.style.background=drawing.color;
          const copy=document.createElement("span");
          copy.className="watchlist-drawing-row-copy";
          const name=document.createElement("strong");
          name.textContent=drawing.name;
          const meta=document.createElement("small");
          meta.textContent=drawing.type==="trend"
            ? displayTime(drawing.p1.time)+" "+formatValue(drawing.p1.value,priceDecimals)+" → "+displayTime(drawing.p2.time)+" "+formatValue(drawing.p2.value,priceDecimals)
            : valueLabel+" "+formatValue(drawing.price,priceDecimals);
          copy.append(name,meta);
          row.append(swatch,copy);
          row.addEventListener("click",function(){selectDrawing(drawing.id);});
          drawingList.appendChild(row);
        });
      }

      const drawing=selectedDrawing();
      drawingEditor.textContent="";
      if(!drawing){
        const empty=document.createElement("div");
        empty.className="watchlist-drawing-empty";
        empty.textContent="Select a drawing to modify color, width, style, position, or delete it.";
        drawingEditor.appendChild(empty);
        return;
      }

      const title=document.createElement("div");
      title.className="watchlist-drawing-editor-title";
      title.innerHTML="<strong>"+drawing.name+"</strong><span>"+(drawing.type==="trend"?"Trend line":"Price level")+"</span>";
      drawingEditor.appendChild(title);

      const fields=document.createElement("div");
      fields.className="watchlist-drawing-fields";

      function field(labelText,control){
        const label=document.createElement("label");
        const caption=document.createElement("span");
        caption.textContent=labelText;
        label.append(caption,control);
        fields.appendChild(label);
      }

      const color=document.createElement("input");
      color.type="color";
      color.value=drawing.color;
      color.addEventListener("input",function(){
        drawing.color=color.value;
        refreshDrawing(drawing);
        renderDrawingManager();
      });
      field("Color",color);

      const width=document.createElement("select");
      [1,2,3,4].forEach(function(value){
        const option=document.createElement("option");
        option.value=String(value);
        option.textContent=value+" px";
        if(value===drawing.width) option.selected=true;
        width.appendChild(option);
      });
      width.addEventListener("change",function(){
        drawing.width=safeLineWidth(width.value);
        refreshDrawing(drawing);
      });
      field("Width",width);

      const style=document.createElement("select");
      [["solid","Solid"],["dashed","Dashed"],["dotted","Dotted"]].forEach(function(pair){
        const option=document.createElement("option");
        option.value=pair[0];
        option.textContent=pair[1];
        if(pair[0]===drawing.style) option.selected=true;
        style.appendChild(option);
      });
      style.addEventListener("change",function(){
        drawing.style=style.value;
        refreshDrawing(drawing);
      });
      field("Style",style);

      drawingEditor.appendChild(fields);

      const actions=document.createElement("div");
      actions.className="watchlist-drawing-editor-actions";
      function action(label,handler,className){
        const button=document.createElement("button");
        button.type="button";
        button.textContent=label;
        if(className) button.className=className;
        button.addEventListener("click",handler);
        actions.appendChild(button);
      }
      if(drawing.type==="trend"){
        action("Move Point 1",function(){beginEdit(drawing,"p1");});
        action("Move Point 2",function(){beginEdit(drawing,"p2");});
      }else{
        action("Move Level",function(){beginEdit(drawing,"level");});
      }
      action("Delete",function(){deleteDrawing(drawing.id);},"danger");
      drawingEditor.appendChild(actions);
    }

    function updateTrendPreview(startPoint,endPoint,color,width,style){
      if(!previewTrendSeries){
        previewTrendSeries=chart.addSeries(LightweightCharts.LineSeries,{
          color:color||"#ffd780",
          lineWidth:safeLineWidth(width||2),
          lineStyle:lineStyleValue(style||"dashed"),
          priceScaleId:"right",
          priceLineVisible:false,
          lastValueVisible:false,
          crosshairMarkerVisible:false
        });
      }else{
        previewTrendSeries.applyOptions({
          color:color||"#ffd780",
          lineWidth:safeLineWidth(width||2),
          lineStyle:lineStyleValue(style||"dashed")
        });
      }
      previewTrendSeries.setData(orderedPair(startPoint,endPoint));
    }

    function updateLevelPreview(price,color,width,style){
      if(previewPriceLine){
        try{priceSeries.removePriceLine(previewPriceLine);}catch(error){}
      }
      previewPriceLine=priceSeries.createPriceLine({
        price:price,
        color:color||"#ffd780",
        lineWidth:safeLineWidth(width||1),
        lineStyle:lineStyleValue(style||"dashed"),
        axisLabelVisible:true,
        title:"Preview"
      });
    }

    trendTool.addEventListener("click",function(){setMode("trend",trendTool);});
    levelTool.addEventListener("click",function(){setMode("level",levelTool);});
    cursorTool.addEventListener("click",function(){
      freeCursor=!freeCursor;
      chart.applyOptions({crosshair:{mode:freeCursor?LightweightCharts.CrosshairMode.Normal:LightweightCharts.CrosshairMode.Magnet}});
      cursorTool.classList.toggle("active",freeCursor);
      cursorTool.textContent=freeCursor?"⊕ Magnet cursor":"＋ Free cursor";
    });
    resetTool.addEventListener("click",resetSevenDays);
    fitTool.addEventListener("click",function(){chart.timeScale().fitContent();});
    clearTool.addEventListener("click",clearAllDrawings);

    chart.subscribeClick(function(param){
      const point=chartPointFromParam(param);
      if(!point) return;

      if(editState){
        const drawing=drawings.find(function(item){return item.id===editState.id;});
        if(!drawing){
          cancelDrawingInteraction("Drawing no longer exists.");
          return;
        }
        if(editState.part==="p1") drawing.p1={time:point.time,value:point.value};
        else if(editState.part==="p2") drawing.p2={time:point.time,value:point.value};
        else drawing.price=point.value;
        refreshDrawing(drawing);
        selectedDrawingId=drawing.id;
        cancelDrawingInteraction(drawing.name+" updated.");
        openDrawingManager();
        return;
      }

      if(!drawingMode) return;

      if(drawingMode==="level"){
        createLevelDrawing(point.value);
        cancelDrawingInteraction("Price level added. Select it in Drawing Manager to modify it.");
        openDrawingManager();
        return;
      }

      if(!trendStart){
        trendStart={time:point.time,value:point.value};
        drawingSetStatus("Trend line: first point set. Move the mouse to preview the line, then click the second point.");
        return;
      }

      createTrendDrawing(trendStart,point);
      cancelDrawingInteraction("Trend line added. Select it in Drawing Manager to modify it.");
      openDrawingManager();
    });

    chart.subscribeCrosshairMove(function(param){
      const point=chartPointFromParam(param);
      if(!point) return;

      if(editState){
        const drawing=drawings.find(function(item){return item.id===editState.id;});
        if(!drawing) return;
        if(drawing.type==="trend"){
          const p1=editState.part==="p1"?point:drawing.p1;
          const p2=editState.part==="p2"?point:drawing.p2;
          updateTrendPreview(p1,p2,drawing.color,drawing.width,drawing.style);
        }else{
          updateLevelPreview(point.value,drawing.color,drawing.width,drawing.style);
        }
        return;
      }

      if(drawingMode==="trend"&&trendStart){
        updateTrendPreview(trendStart,point,"#ffd780",2,"dashed");
      }else if(drawingMode==="level"){
        updateLevelPreview(point.value,"#ffd780",1,"dashed");
      }
    });

    const drawingKeyHandler=function(event){
      const tag=event.target&&event.target.tagName?event.target.tagName.toLowerCase():"";
      if(tag==="input"||tag==="select"||tag==="textarea") return;
      if(event.key==="Escape"&&(drawingMode||editState)){
        cancelDrawingInteraction("Drawing action cancelled.");
      }else if((event.key==="Delete"||event.key==="Backspace")&&selectedDrawingId&&!drawingManager.hidden){
        event.preventDefault();
        deleteDrawing(selectedDrawingId);
      }
    };
    document.addEventListener("keydown",drawingKeyHandler);

    updateDrawingCount();
    renderDrawingManager();

    chart.subscribeCrosshairMove(function(param){
      const market=param.seriesData.get(priceSeries);const sentiment=param.seriesData.get(psiSeries);
      if(summaryNodes["market-value"]&&market&&Number.isFinite(market.value)) summaryNodes["market-value"].textContent=valueLabel+": "+formatValue(market.value,priceDecimals);
      if(summaryNodes["psi-value"]&&sentiment&&Number.isFinite(sentiment.value)) summaryNodes["psi-value"].textContent="PSI: "+Math.round(sentiment.value)+"/100";
    });
    function applyChartTheme(event){
      const dark=event && event.detail ? event.detail.theme==="dark" : document.body.classList.contains("dark-mode");
      chart.applyOptions({
        layout:{background:{type:LightweightCharts.ColorType.Solid,color:dark?"#0b111b":"#ffffff"},textColor:dark?"#f8fbff":"#061522"},
        grid:{vertLines:{color:dark?"rgba(255,255,255,.08)":"rgba(71,85,105,.16)"},horzLines:{color:dark?"rgba(255,255,255,.08)":"rgba(71,85,105,.16)"}},
        rightPriceScale:{borderColor:dark?"#2a3443":"#9eb4c6"},
        leftPriceScale:{borderColor:dark?"#2a3443":"#9eb4c6"},
        timeScale:{borderColor:dark?"#2a3443":"#9eb4c6"}
      });
    }
    window.addEventListener("psd-theme-change",applyChartTheme);
    const observer=new ResizeObserver(function(entries){entries.forEach(function(entry){chart.applyOptions({width:Math.max(1,entry.contentRect.width),height:Math.max(1,entry.contentRect.height)});});});
    observer.observe(chartBox);
    activeChartCleanup=function(){
      window.removeEventListener("psd-theme-change",applyChartTheme);
      document.removeEventListener("keydown",drawingKeyHandler);
      removePreview();
      observer.disconnect();
      chart.remove();
    };
  }

  async function openChartPopup(instrument,asset){
    const title=asset && asset.market_data
      ? instrument+" — Daily "+(asset.market_data.data_kind === "economic_indicator" ? "Indicator" : "Market")+" & Sentiment Comparison"
      : instrument+" — Daily Sentiment History";
    openModal(title);
    const data=await Promise.all([historyData(),technicalData()]);
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
      actions.appendChild(makeLink("Market Charts",marketChartHrefFor(asset,item.instrument)));
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

    const assetConfigPromise = fetchJson("assets_config.json");
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
    const backgroundPromise = Promise.all([
      fetchJson("dashboard_live.json"),
      fetchJson("technical_data.json"),
      client.rpc("get_user_sentiment")
    ]);
    const firstResults = await Promise.all([
      client
        .from("watchlist_items")
        .select("id,instrument,display_order,created_at")
        .eq("watchlist_id",watchlistId)
        .order("display_order",{ascending:true})
        .order("created_at",{ascending:true}),
      assetConfigPromise
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

    const backgroundResults = await backgroundPromise;
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

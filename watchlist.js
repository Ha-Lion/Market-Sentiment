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
  let newsPromise = null;
  let liveHeadlines = [];

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
      const response = await fetch(path,{cache:"no-store"});
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
    modal.classList.remove("open");
    modalBody.textContent = "";
    document.body.style.overflow = "";
  }

  function historyData(){
    if(!historyPromise) historyPromise = fetchJson("instrument_history_compact.json");
    return historyPromise;
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

  function chartPoints(payload,instrument,asset){
    return (Array.isArray(payload && payload.records) ? payload.records : []).map(function(record){
      const entry = instrumentEntry(record,instrument,asset);
      if(!entry) return null;
      const daily = entry.technical && entry.technical.daily || {};
      const psi = Number(entry.psi);
      const close = Number(daily.close);
      return {
        date:String(record.date || "").slice(0,10).replace(/[^0-9-]/g,""),
        psi:Number.isFinite(psi) ? psi : null,
        close:Number.isFinite(close) ? close : null
      };
    }).filter(function(point){ return point && (Number.isFinite(point.psi) || Number.isFinite(point.close)); });
  }

  function linePath(points,key,min,max,width,height,pad){
    const span = max-min || 1;
    let started = false;
    return points.map(function(point,index){
      const value = point[key];
      if(!Number.isFinite(value)){started=false;return "";}
      const x = pad + (points.length === 1 ? 0 : index/(points.length-1))*(width-pad*2);
      const y = pad + (max-value)/span*(height-pad*2);
      const command = started ? "L" : "M";
      started = true;
      return command+x.toFixed(1)+" "+y.toFixed(1);
    }).filter(Boolean).join(" ");
  }

  function renderInstrumentChart(points){
    if(!points.length){
      modalBody.innerHTML = '<div class="watchlist-popup-empty">No saved chart history is available for this instrument yet.</div>';
      return;
    }
    const width=820,height=360,pad=42;
    const prices=points.map(function(p){return p.close;}).filter(Number.isFinite);
    let priceMin=prices.length?Math.min.apply(null,prices):0;
    let priceMax=prices.length?Math.max.apply(null,prices):1;
    if(priceMin===priceMax){priceMin-=1;priceMax+=1;}
    const pricePadding=(priceMax-priceMin)*.08;
    priceMin-=pricePadding;priceMax+=pricePadding;
    const pricePath=linePath(points,"close",priceMin,priceMax,width,height,pad);
    const psiPath=linePath(points,"psi",0,100,width,height,pad);
    const latest=points[points.length-1];

    const summary=document.createElement("div");
    summary.className="watchlist-chart-summary";
    ["Latest date: "+latest.date,"Market: "+(Number.isFinite(latest.close)?latest.close.toLocaleString(undefined,{maximumFractionDigits:4}):"N/A"),"PSI: "+(Number.isFinite(latest.psi)?Math.round(latest.psi)+"/100":"N/A"),"Periods: "+points.length].forEach(function(text){
      const item=document.createElement("span");item.textContent=text;summary.appendChild(item);
    });

    const wrap=document.createElement("div");
    wrap.className="watchlist-chart-wrap";
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("viewBox","0 0 "+width+" "+height);
    const grid=[0,1,2,3,4].map(function(i){
      const y=pad+i*(height-pad*2)/4;
      const psi=Math.round(100-i*25);
      const price=(priceMax-i*(priceMax-priceMin)/4).toLocaleString(undefined,{maximumFractionDigits:4});
      return '<line x1="'+pad+'" y1="'+y+'" x2="'+(width-pad)+'" y2="'+y+'" stroke="rgba(255,255,255,.10)"/><text x="8" y="'+(y+4)+'" fill="#8fa0b8" font-size="10">'+psi+'</text><text x="'+(width-7)+'" y="'+(y+4)+'" fill="#8fa0b8" font-size="10" text-anchor="end">'+price+'</text>';
    }).join("");
    const labels=[0,Math.floor((points.length-1)/2),points.length-1].filter(function(v,i,a){return a.indexOf(v)===i;}).map(function(index){
      const x=pad+(points.length===1?0:index/(points.length-1))*(width-pad*2);
      return '<text x="'+x+'" y="'+(height-12)+'" fill="#8fa0b8" font-size="10" text-anchor="middle">'+points[index].date+'</text>';
    }).join("");
    svg.innerHTML=grid+
      (pricePath?'<path d="'+pricePath+'" fill="none" stroke="#4f6dff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>':"")+
      (psiPath?'<path d="'+psiPath+'" fill="none" stroke="#43b5aa" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>':"")+labels;
    wrap.appendChild(svg);

    const legend=document.createElement("div");
    legend.className="watchlist-chart-legend";
    legend.innerHTML='<span><i class="watchlist-legend-dot" style="background:#4f6dff"></i>Market price</span><span><i class="watchlist-legend-dot" style="background:#43b5aa"></i>Public Sentiment Index</span>';
    modalBody.textContent="";
    modalBody.appendChild(summary);
    modalBody.appendChild(wrap);
    modalBody.appendChild(legend);
  }

  async function openChartPopup(instrument,asset){
    openModal(instrument+" — Market & Sentiment History");
    const payload=await historyData();
    if(!modal.classList.contains("open")) return;
    renderInstrumentChart(chartPoints(payload,instrument,asset));
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

    const results = await Promise.all([
      client
        .from("watchlist_items")
        .select("id,instrument,display_order,created_at")
        .eq("watchlist_id",watchlistId)
        .order("display_order",{ascending:true})
        .order("created_at",{ascending:true}),
      fetchJson("assets_config.json"),
      fetchJson("dashboard_live.json"),
      fetchJson("technical_data.json"),
      client.rpc("get_user_sentiment")
    ]);

    if(results[0].error) throw results[0].error;

    const items = results[0].data || [];
    if(!items.length){
      renderEmpty();
      setStatus("Your watchlist is ready for instruments.");
      return;
    }

    const assetMap = buildAssetMap(results[1] || {});
    const headlines = (results[2] && results[2].psi_headlines) || [];
    liveHeadlines = headlines;
    const technicalMap = (results[3] && results[3].technical) || {};
    const userMap = {};

    if(!results[4].error && Array.isArray(results[4].data)){
      results[4].data.forEach(function(row){
        userMap[String(row.instrument).toLowerCase()] =
          row.user_sentiment || "N/A";
      });
    }

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

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "watchlist-remove";
      remove.textContent = "Remove";
      remove.addEventListener("click",function(){
        removeItem(item.id,watchlistId).catch(function(error){
          setStatus(error.message || "Could not update watchlist.","error");
        });
      });

      const maximize = document.createElement("button");
      maximize.type = "button";
      maximize.className = "watchlist-maximize";
      maximize.textContent = "Maximize";
      maximize.addEventListener("click",function(){
        openChartPopup(item.instrument,asset).catch(function(error){
          console.error(error);
          modalBody.innerHTML = '<div class="watchlist-popup-empty">Chart could not be loaded.</div>';
        });
      });

      const cardTools = document.createElement("div");
      cardTools.className = "watchlist-card-tools";
      cardTools.appendChild(maximize);
      cardTools.appendChild(remove);

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

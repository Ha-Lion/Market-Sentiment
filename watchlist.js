(function(){
  "use strict";

  const client = window.psdSupabase;
  if(!client) return;

  const statusNode = document.getElementById("watchlist-status");
  const grid = document.getElementById("watchlist-grid");

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

      nameBox.appendChild(title);
      nameBox.appendChild(symbol);
      top.appendChild(nameBox);
      top.appendChild(remove);

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
      actions.appendChild(makeLink("News & Articles","news-articles.html"));

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

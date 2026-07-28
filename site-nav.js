(function(){
  "use strict";

  const mainLinks = [
    { href: "dashboard.html", label: "📊 Interactive Dashboard" },
    { href: "sentiment-history.html", label: "📈 Historical Sentiment" },
    { href: "news-articles.html", label: "📰 News & Articles" },
    { href: "charts.html", label: "📈 Market Charts" },
    { href: "market-sentiment.html", label: "📘 Guides" },
    { href: "advertise.html", label: "💼 Business Opportunities" },
    { href: "contact.html", label: "✉️ Get in Touch" },
    { href: "about.html", label: "ℹ️ About" }
  ];

  const assetLinks = [
    { href: "crypto.html", label: "🪙 Crypto Sentiment" },
    { href: "energy.html", label: "⚡ Energy Sentiment" },
    { href: "precious-metals.html", label: "🥇 Precious Metals" },
    { href: "indices.html", label: "📊 Indices" },
    { href: "policy-assets.html", label: "🏛️ Policy & Geo Assets" },
    { href: "ai-assets.html", label: "🤖 AI Assets" }
  ];

  const supportUrl = "https://gofund.me/0d687f045";
  const tourVideoUrl = "https://pub-1132861191d043c088b0fcf5ba3538fe.r2.dev/Public_Sentiment_Dash_2_Minute_Video.mp4";

  function currentFile(){
    const path = (window.location.pathname || "").split("/").pop();
    return path || "index.html";
  }

  function linkHtml(link, current){
    const isActive = link.href === current;
    return '<a href="' + link.href + '"' + (isActive ? ' class="active"' : '') + '>' + link.label + '</a>';
  }

  function ensureTourStyles(){
    if(document.getElementById("site-tour-styles")) return;

    const style = document.createElement("style");
    style.id = "site-tour-styles";
    style.textContent = `
      .site-tour-banner{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        margin:7px 8px 0;
        padding:7px 15px;
        border:1px solid rgba(255,204,82,.72);
        border-radius:999px;
        background:linear-gradient(180deg,rgba(85,61,12,.96),rgba(28,24,18,.96));
        color:#ffe08a;
        font:inherit;
        font-size:11px;
        font-weight:900;
        line-height:1;
        white-space:nowrap;
        cursor:pointer;
        box-shadow:0 0 18px rgba(225,167,39,.22);
        transition:transform .18s ease,box-shadow .18s ease,background .18s ease;
      }
      .site-tour-banner:hover,.site-tour-banner:focus-visible{
        transform:translateY(-1px);
        background:linear-gradient(180deg,#d7a42f,#8c6314);
        color:#07090d;
        box-shadow:0 0 24px rgba(255,198,69,.42);
        outline:none;
      }
      body.site-tour-open{overflow:hidden}
      .site-tour-overlay{
        position:fixed;
        inset:0;
        z-index:2147483647;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#000;
      }
      .site-tour-overlay video{
        display:block;
        width:100vw;
        height:100vh;
        object-fit:contain;
        background:#000;
      }
      .site-tour-close{
        position:absolute;
        top:max(16px,env(safe-area-inset-top));
        right:max(16px,env(safe-area-inset-right));
        z-index:2;
        padding:11px 18px;
        border:2px solid #fff2b3;
        border-radius:999px;
        background:#f5b82e;
        color:#161006;
        font:inherit;
        font-size:14px;
        font-weight:900;
        cursor:pointer;
        box-shadow:0 6px 22px rgba(0,0,0,.55),0 0 0 3px rgba(245,184,46,.22);
      }
      .site-tour-close:hover,.site-tour-close:focus-visible{
        background:#ffd35c;
        border-color:#fff8d6;
        outline:none;
      }
      @media (max-width:900px){
        .site-tour-banner{margin-top:8px;font-size:10px;padding:7px 12px}
      }
    `;
    document.head.appendChild(style);
  }

  function exitFullscreen(){
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if(exit && (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement)){
      try{
        const result = exit.call(document);
        if(result && typeof result.catch === "function") result.catch(function(){});
      }catch(error){}
    }
  }

  function openTour(){
    if(document.getElementById("site-tour-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "site-tour-overlay";
    overlay.className = "site-tour-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Public Sentiment Dash website tour video");

    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = tourVideoUrl;
    video.setAttribute("aria-label", "Public Sentiment Dash website tour");
    video.muted = false;
    video.volume = 1;

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "site-tour-close";
    closeButton.textContent = "Skip video";
    closeButton.setAttribute("aria-label", "Close website tour video");

    overlay.appendChild(video);
    overlay.appendChild(closeButton);
    document.body.appendChild(overlay);
    document.body.classList.add("site-tour-open");

    let closed = false;

    const closeTour = function(){
      if(closed) return;
      closed = true;
      video.pause();
      exitFullscreen();
      document.body.classList.remove("site-tour-open");
      overlay.remove();
      document.removeEventListener("keydown", onKeyDown);
    };

    const onKeyDown = function(event){
      if(event.key === "Escape") closeTour();
    };

    video.addEventListener("ended", closeTour, { once:true });
    closeButton.addEventListener("click", closeTour);
    document.addEventListener("keydown", onKeyDown);

    const requestFullscreen = overlay.requestFullscreen || overlay.webkitRequestFullscreen || overlay.msRequestFullscreen;
    if(requestFullscreen){
      try{
        const fullResult = requestFullscreen.call(overlay);
        if(fullResult && typeof fullResult.catch === "function") fullResult.catch(function(){});
      }catch(error){}
    }else if(typeof video.webkitEnterFullscreen === "function"){
      try{ video.webkitEnterFullscreen(); }catch(error){}
    }

    const playResult = video.play();
    if(playResult && typeof playResult.catch === "function"){
      playResult.catch(function(){
        video.controls = true;
      });
    }
  }

  function render(){
    const mount = document.getElementById("site-header");
    if(!mount) return;
    const current = currentFile();
    const linksOne = mainLinks.map(link => linkHtml(link, current)).join("\n      ");
    const linksTwo = assetLinks.map(link => linkHtml(link, current)).join("\n      ");
    mount.outerHTML = `
  <header class="header">
    <a class="brand" href="index.html" aria-label="Go to Public Sentiment Dash home page">
      <span class="brand-logo-block" style="display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0;">
        <img src="logo.png" alt="Public Sentiment Dash Logo" class="logo">
        <span style="font-size:12px;font-weight:600;color:#ffd780;line-height:1;">Home</span>
      </span>
      <div class="brand-copy">
        <div class="brand-stamp">AI-built public market sentiment dashboard</div>
        <div class="site-subtitle">Global market public sentiment dashboard</div>
      </div>
    </a>
    <div class="header-center">
      <div class="header-pill" style="display:inline-flex;align-items:center;justify-content:center;height:26px;min-height:26px;padding:0 26px;line-height:1;border-radius:999px;box-sizing:border-box;">✨ Constantly learning & improving</div>
      <a href="${supportUrl}" target="_blank" rel="noopener" aria-label="Donate to support Public Sentiment Dash" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-top:8px;transform:translateY(62px);padding:5px 12px;border:1px solid rgba(210,153,34,.45);border-radius:999px;background:rgba(16,20,31,.92);box-shadow:0 0 18px rgba(210,153,34,.16);color:#ffd780;text-decoration:none;font-size:11px;font-weight:800;line-height:1;white-space:nowrap;">
        <span>🚀 Help take Public Sentiment Dash to the next level</span>
        <span style="display:inline-flex;align-items:center;justify-content:center;padding:5px 10px;border-radius:999px;background:linear-gradient(180deg,#f4d17d,#d29922);color:#05070b;font-weight:900;">Donate Now</span>
      </a>
    </div>
    <nav class="nav" aria-label="Main navigation">
      ${linksOne}
      <span class="nav-row-break" aria-hidden="true"></span>
      ${linksTwo}
      <button class="site-tour-banner" id="site-tour-button" type="button" aria-label="Play the two-minute Public Sentiment Dash website tour">
        <span aria-hidden="true">🎬</span>
        <span>Take a 2-Minute Website Tour</span>
      </button>
      <div class="social-links">
        <span class="social-label">Follow us</span>
        <span class="social-pill">X</span>
        <span class="social-pill linkedin">LinkedIn</span>
      </div>
    </nav>
  </header>`;

    ensureTourStyles();
    const tourButton = document.getElementById("site-tour-button");
    if(tourButton) tourButton.addEventListener("click", openTour);
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();

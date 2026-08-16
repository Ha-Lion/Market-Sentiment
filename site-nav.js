(function(){
  "use strict";

  const mainLinks = [
    { href: "dashboard.html", icon: "▦", label: "Interactive Dashboard" },
    { href: "sentiment-history.html", icon: "↗", label: "Historical Sentiment" },
    { href: "news-articles.html", icon: "▤", label: "News & Articles" },
    { href: "charts.html", icon: "⌁", label: "Market Charts" },
    { href: "market-sentiment.html", icon: "▣", label: "Guides" },
    { href: "advertise.html", icon: "◆", label: "Business Opportunities" },
    { href: "about.html", icon: "i", label: "About" },
    { href: "contact.html", icon: "✉", label: "Get in Touch" },
    { href: "auth.html", label: "Sign In" }
  ];

  const assetLinks = [
    { href: "crypto.html", icon: "₿", label: "Crypto Sentiment" },
    { href: "forex-sentiment-today.html", icon: "⇄", label: "Forex Sentiment" },
    { href: "energy.html", icon: "⚡", label: "Energy Sentiment" },
    { href: "precious-metals.html", icon: "◆", label: "Precious Metals" },
    { href: "indices.html", icon: "▥", label: "Indices Sentiment" },
    { href: "policy-assets.html", icon: "⚖", label: "Policy & Geo Assets" },
    { href: "ai-assets.html", icon: "AI", label: "AI Assets" }
  ];

  const supportUrl = "https://gofund.me/0d687f045";
  const tourVideoUrl = "https://pub-1132861191d043c088b0fcf5ba3538fe.r2.dev/Public_Sentiment_Dash_2_Minute_Video.mp4";
  const homeUrl = "https://publicsentimentdash.com/";

  function currentFile(){
    const path = (window.location.pathname || "").split("/").pop();
    return path || "index.html";
  }

  function linkHtml(link, current){
    const isActive = link.href === current;

    if(link.href === "auth.html"){
      return `
        <span class="psd-account-nav-wrap">
          <a href="auth.html" id="psd-account-nav-link"${isActive ? ' class="active"' : ''}>${link.label}</a>
          <div class="psd-account-menu" id="psd-account-menu" hidden>
            <a href="account.html#preferences">Preferences</a>
            <a href="account.html#profile">Update Information</a>
            <a href="watchlist.html">My Watchlist</a>
            <a href="activity-report.html" id="psd-activity-report-link" hidden>Control Center</a>
            <button type="button" id="psd-nav-signout">Log Out</button>
          </div>
        </span>`;
    }

    return '<a href="' + link.href + '" class="psd-nav-link' + (isActive ? ' active' : '') + '">' + link.label + '</a>';
  }

  function ensureTourStyles(){
    if(document.getElementById("site-tour-styles")) return;

    const style = document.createElement("style");
    style.id = "site-tour-styles";
    style.textContent = `

      @keyframes psdLabelDance{
        0%,100%{transform:translateY(0) rotate(0deg)}
        25%{transform:translateY(-2px) rotate(-.25deg)}
        50%{transform:translateY(1px) rotate(0deg)}
        75%{transform:translateY(-2px) rotate(.25deg)}
      }
      @keyframes psdLabelShine{
        0%,100%{box-shadow:0 0 10px rgba(210,153,34,.18);filter:brightness(1)}
        50%{box-shadow:0 0 25px rgba(240,183,47,.55),inset 0 0 12px rgba(255,215,128,.12);filter:brightness(1.12)}
      }
      .psd-shared-header .psd-dancing-label{
        width:340px!important;
        min-width:340px!important;
        max-width:340px!important;
        justify-content:center!important;
        box-sizing:border-box!important;
        translate:0 2px;
        animation:psdLabelDance 3.2s ease-in-out infinite,psdLabelShine 2.1s ease-in-out infinite!important;
        transform-origin:center!important;
        will-change:transform,filter,box-shadow;
      }
      /* AI-Built copies the live rendered height of Constantly Learning in alignRibbonGeometry(). */
      .psd-shared-header .brand-stamp.psd-dancing-label{
        animation-delay:.35s,.35s!important;
      }
      .psd-shared-header .site-subtitle.psd-ai-subtitle{
        position:relative;
        top:42px;
        margin-top:3px;
        font-family:"OCR A Std","Eurostile","Bank Gothic","Courier New",monospace!important;
        font-size:14.5px!important;
        font-weight:700!important;
        letter-spacing:.7px!important;
      }
      @media(prefers-reduced-motion:reduce){
        .psd-shared-header .psd-dancing-label{animation:psdLabelShine 2.8s ease-in-out infinite!important}
      }

      /*
       * Shared-ribbon stacking fix.
       * The donation/tour row intentionally extends beyond the center grid cell.
       * Keep that complete row above the navigation hit area on every page.
       */
      .psd-shared-header .header-center{
        position:relative!important;
        z-index:100!important;
        overflow:visible!important;
      }
      .psd-shared-header .nav{
        position:relative!important;
        z-index:1!important;
      }
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
        position:relative;
        z-index:101;
        pointer-events:auto;
        isolation:isolate;
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

    /*
     * The overlay already fills the viewport. Avoid consuming the browser's
     * click permission with requestFullscreen() before video.play().
     */
    const startPlayback = function(){
      const playResult = video.play();

      if(playResult && typeof playResult.catch === "function"){
        playResult.catch(function(){
          /*
           * Browser fallback: start muted if unmuted playback is blocked.
           * Controls remain visible so the viewer can immediately unmute.
           */
          video.muted = true;
          const mutedPlay = video.play();
          if(mutedPlay && typeof mutedPlay.catch === "function"){
            mutedPlay.catch(function(){
              video.controls = true;
            });
          }
        });
      }
    };

    startPlayback();
  }

  function loadStylesheet(href, id){
    if(document.getElementById(id)) return Promise.resolve();

    return new Promise(function(resolve, reject){
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = href;
      link.addEventListener("load", resolve, { once:true });
      link.addEventListener("error", reject, { once:true });
      document.head.appendChild(link);
    });
  }

  function loadScript(src, id){
    if(document.getElementById(id)) return Promise.resolve();

    return new Promise(function(resolve, reject){
      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.defer = true;
      script.addEventListener("load", resolve, { once:true });
      script.addEventListener("error", reject, { once:true });
      document.head.appendChild(script);
    });
  }

  async function openAuthPopup(event){
    if(event) event.preventDefault();

    try{
      await loadStylesheet("account.css?v=20260802-ribbon-final2", "psd-account-styles");

      if(!window.supabase || typeof window.supabase.createClient !== "function"){
        await loadScript(
          "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
          "psd-supabase-sdk"
        );
      }

      if(!window.psdSupabase){
        await loadScript("supabase-client.js?v=20260802-ribbon-final2", "psd-supabase-client");
      }

      if(!window.PSDAuthModal){
        await loadScript("auth-modal.js?v=20260802-ribbon-final2", "psd-auth-modal-script");
      }

      if(!window.psdSupabase || !window.PSDAuthModal){
        throw new Error("Account popup did not initialize.");
      }

      const sessionResult = await window.psdSupabase.auth.getSession();
      if(sessionResult.data && sessionResult.data.session){
        window.location.href = "account.html";
        return;
      }

      window.PSDAuthModal.open();
    }catch(error){
      console.error(error);
      window.location.href = "auth.html";
    }
  }


  function ensureAccountNavStyles(){
    if(document.getElementById("psd-account-nav-styles")) return;

    const style = document.createElement("style");
    style.id = "psd-account-nav-styles";
    style.textContent = `
      .psd-account-nav-wrap{
        position:relative;
        display:inline-flex;
        align-items:center;
      }
      .psd-account-menu{
        position:absolute;
        top:calc(100% + 9px);
        right:0;
        z-index:2147483000;
        width:190px;
        padding:8px;
        border:1px solid rgba(210,153,34,.38);
        border-radius:14px;
        background:rgba(13,17,23,.99);
        box-shadow:0 18px 48px rgba(0,0,0,.52);
      }
      .psd-account-menu[hidden]{display:none!important}
      .psd-account-menu a,
      .psd-account-menu button{
        display:flex!important;
        width:100%;
        justify-content:flex-start;
        box-sizing:border-box;
        margin:0;
        padding:10px 11px!important;
        border:0;
        border-radius:9px;
        background:transparent;
        color:#e6edf3;
        font:600 12px Inter,Segoe UI,Arial,sans-serif;
        text-align:left;
        cursor:pointer;
      }
      .psd-account-menu a::before{display:none!important}
      .psd-account-menu a:hover,
      .psd-account-menu button:hover{
        background:rgba(210,153,34,.16);
        color:#ffd780;
      }
      #psd-account-nav-link.psd-member-link{
        color:#ffd780;
        border:1px solid rgba(210,153,34,.32);
        background:rgba(210,153,34,.10);
      }

      /* Shared ribbon rows are rendered explicitly in render(); theme CSS owns row placement.
         Do not suppress .nav a::before here: those pseudo-elements carry the ribbon page icons. */
      .psd-ribbon-social-wrap{
        display:inline-flex;
        align-items:center;
      }
      .psd-ribbon-social-wrap .social-links{margin-left:0!important}
      #psd-ribbon-watchlist-link:hover,
      #psd-ribbon-watchlist-link:focus-visible{
        color:#fff;
        background:rgba(210,153,34,.20);
        border-color:rgba(210,153,34,.52);
        outline:none;
      }
      #psd-ribbon-watchlist-link[hidden]{display:none!important}
    `;
    document.head.appendChild(style);
  }

  async function ensureAccountInfrastructure(){
    if(!window.supabase || typeof window.supabase.createClient !== "function"){
      await loadScript(
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
        "psd-supabase-sdk"
      );
    }

    if(!window.psdSupabase){
      await loadScript("supabase-client.js?v=20260802-ribbon-final2", "psd-supabase-client");
    }

    return window.psdSupabase;
  }

  async function refreshAccountNavigation(){
    const accountLink = document.getElementById("psd-account-nav-link");
    const menu = document.getElementById("psd-account-menu");
    if(!accountLink || !menu) return;

    try{
      const client = await ensureAccountInfrastructure();
      if(!client) return;

      const sessionResult = await client.auth.getSession();
      const session = sessionResult.data && sessionResult.data.session;

      const ribbonWatchlistLink =
        document.getElementById("psd-ribbon-watchlist-link");

      if(!session){
        if(ribbonWatchlistLink) ribbonWatchlistLink.hidden = true;
        accountLink.textContent = "Sign In";
        accountLink.href = "auth.html";
        accountLink.classList.remove("psd-member-link");
        accountLink.dataset.signedIn = "false";
        const reportLink = document.getElementById("psd-activity-report-link");
        if(reportLink) reportLink.hidden = true;
        menu.hidden = true;
        return;
      }

      const profileResult = await client
        .from("profiles")
        .select("username,display_name,is_admin")
        .eq("id", session.user.id)
        .single();

      const profile = profileResult.data || {};
      const name = profile.username || profile.display_name || "Member";
      const reportLink = document.getElementById("psd-activity-report-link");
      if(reportLink) reportLink.hidden = profile.is_admin !== true;

      if(ribbonWatchlistLink) ribbonWatchlistLink.hidden = false;

      accountLink.textContent = name;
      accountLink.href = "#";
      accountLink.classList.add("psd-member-link");
      accountLink.dataset.signedIn = "true";
    }catch(error){
      console.error(error);
    }
  }

  function initializeAccountNavigation(){
    ensureAccountNavStyles();

    const accountLink = document.getElementById("psd-account-nav-link");
    const menu = document.getElementById("psd-account-menu");
    const signout = document.getElementById("psd-nav-signout");
    if(!accountLink || !menu) return;

    accountLink.addEventListener("click", async function(event){
      if(accountLink.dataset.signedIn === "true"){
        event.preventDefault();
        menu.hidden = !menu.hidden;
        return;
      }

      await openAuthPopup(event);
    });

    if(signout){
      signout.addEventListener("click", async function(){
        const originalText = signout.textContent;
        signout.disabled = true;
        signout.textContent = "Logging out…";

        try{
          /* On the account page, save any pending preference fields first. */
          if(typeof window.PSDSavePendingAccountSettings === "function"){
            await window.PSDSavePendingAccountSettings();
          }

          const client = await ensureAccountInfrastructure();
          if(!client) throw new Error("Account service is unavailable.");

          /* End only this browser session and clear its stored auth session. */
          const result = await client.auth.signOut({ scope: "local" });
          if(result && result.error) throw result.error;

          menu.hidden = true;

          /* replace() loads a fresh home page and removes the private page
             from the Back-button history. */
          window.location.replace(homeUrl);
        }catch(error){
          console.error("Logout failed:", error);
          signout.disabled = false;
          signout.textContent = originalText;
          window.alert("Logout did not complete. Please try again.");
        }
      });
    }

    document.addEventListener("click", function(event){
      if(!event.target.closest(".psd-account-nav-wrap")) menu.hidden = true;
    });

    document.addEventListener("keydown", function(event){
      if(event.key === "Escape") menu.hidden = true;
    });

    window.addEventListener("psd-member-status-change", function(){
      refreshAccountNavigation();
    });

    window.addEventListener("psd-profile-updated", function(){
      refreshAccountNavigation();
    });

    refreshAccountNavigation();
  }

  function installTourClickFallback(){
    if(window.__PSD_TOUR_CLICK_FALLBACK__) return;
    window.__PSD_TOUR_CLICK_FALLBACK__ = true;

    document.addEventListener("click", function(event){
      const button = event.target && event.target.closest
        ? event.target.closest("#site-tour-button")
        : null;

      if(!button) return;

      event.preventDefault();
      event.stopPropagation();
      openTour();
    }, true);
  }

  function ensureMaintenanceStyles(){
    if(document.getElementById("psd-maintenance-styles")) return;
    const style=document.createElement("style");
    style.id="psd-maintenance-styles";
    style.textContent=`
      .psd-maintenance-banner{
        display:flex;align-items:center;justify-content:center;gap:8px;
        width:100%;box-sizing:border-box;padding:14px 20px;
        border-top:1px solid rgba(174,48,68,.9);
        border-bottom:1px solid rgba(174,48,68,.9);
        background:linear-gradient(90deg,#350711,#681523,#350711);
        color:#ffe4e8;text-align:center;font-size:15px;font-weight:800;
        box-shadow:0 5px 18px rgba(0,0,0,.22);position:relative;z-index:50
      }
      .psd-maintenance-banner strong{color:#fff2f4}
      @media(max-width:700px){.psd-maintenance-banner{font-size:13px;padding:12px 14px}}
    `;
    document.head.appendChild(style);
  }

  async function loadSiteStatus(){
    try{
      const client=await ensureAccountInfrastructure();
      if(!client) return;
      const result=await client.rpc("ms_get_site_status");
      if(result.error||!result.data||result.data.maintenance!==true) return;
      const header=document.querySelector(".psd-shared-header");
      if(!header||document.getElementById("psd-maintenance-banner")) return;
      ensureMaintenanceStyles();
      const banner=document.createElement("div");
      banner.id="psd-maintenance-banner";
      banner.className="psd-maintenance-banner";
      banner.setAttribute("role","status");
      const icon=document.createElement("span");icon.textContent="🛠️";icon.setAttribute("aria-hidden","true");
      const message=document.createElement("strong");message.textContent=String(result.data.message||"Website updates are in progress.");
      banner.append(icon,message);
      if(result.data.expected_back){const expected=document.createElement("span");expected.textContent=String(result.data.expected_back);banner.appendChild(expected);}
      header.insertAdjacentElement("afterend",banner);
    }catch(error){
      /* A status-control outage must never interfere with the website. */
    }
  }


  function alignRibbonGeometry(){
    const aiBuilt = document.querySelector(".psd-shared-header .brand-stamp.psd-dancing-label");
    const learning = document.querySelector(".psd-shared-header .psd-learning-label");

    if(aiBuilt && learning){
      /* Keep the approved left-edge alignment. */
      learning.style.translate = "0px 2px";

      window.requestAnimationFrame(function(){
        const aiRect = aiBuilt.getBoundingClientRect();
        const learningRect = learning.getBoundingClientRect();
        const horizontalShift = Math.round(aiRect.left - learningRect.left);
        learning.style.translate = horizontalShift + "px 2px";

        /*
         * Copy the ACTUAL layout height of Constantly Learning to AI-Built.
         * offsetHeight ignores the dancing transform/rotation, so both pills
         * become exactly the same physical height without guessing pixels.
         */
        const learningHeight = learning.offsetHeight;
        if(learningHeight > 0){
          aiBuilt.style.setProperty("height", learningHeight + "px", "important");
          aiBuilt.style.setProperty("min-height", learningHeight + "px", "important");
          aiBuilt.style.setProperty("max-height", learningHeight + "px", "important");
        }
      });
    }

    /*
     * Align Market Pulse's icon/link left edge exactly with Crypto Sentiment.
     * This is measured from the live ribbon, so it stays exact even if the
     * browser width changes.
     */
    const crypto = document.querySelector('.psd-shared-header .psd-nav-assets a[href="crypto.html"]');
    const pulse = document.querySelector('.psd-shared-header .psd-market-pulse-link');
    const pulseRow = document.querySelector('.psd-shared-header .psd-nav-fourth');

    if(crypto && pulse && pulseRow){
      if(window.matchMedia("(max-width:1180px)").matches){
        pulse.style.removeProperty("margin-left");
      }else{
        const cryptoLeft = crypto.getBoundingClientRect().left;
        const rowLeft = pulseRow.getBoundingClientRect().left;
        const exactMargin = Math.max(0, Math.round(cryptoLeft - rowLeft));
        pulse.style.setProperty("margin-left", exactMargin + "px", "important");
      }
    }
  }


  function initializeRibbonThemeButton(){
    const button = document.getElementById("psd-ribbon-theme-toggle");
    if(!button) return;

    const syncLabel = function(){
      const dark = document.body.classList.contains("dark-mode");
      button.textContent = dark ? "☀ Light mode" : "◐ Dark mode";
      button.setAttribute("aria-pressed", dark ? "true" : "false");
    };

    syncLabel();

    const bodyObserver = new MutationObserver(syncLabel);
    bodyObserver.observe(document.body, { attributes:true, attributeFilter:["class"] });

    button.addEventListener("click", function(){
      const before = document.body.classList.contains("dark-mode");

      /*
       * Give the existing site-theme.js handler the first chance to act.
       * Only use this fallback if that handler did not change the mode.
       */
      window.setTimeout(function(){
        const afterExistingHandler = document.body.classList.contains("dark-mode");
        if(afterExistingHandler !== before){
          syncLabel();
          return;
        }

        const dark = !before;
        document.body.classList.toggle("dark-mode", dark);
        syncLabel();

        try{
          localStorage.setItem("psd-theme", dark ? "dark" : "light");
        }catch(error){}

        window.dispatchEvent(new CustomEvent("psd-theme-change", {
          detail:{ theme: dark ? "dark" : "light" }
        }));
      }, 0);
    });
  }

  function render(){
    const mount = document.getElementById("site-header");
    if(!mount) return;
    const current = currentFile();
    const primaryLinks = mainLinks.filter(link => link.href !== "auth.html").map(link => linkHtml(link, current)).join("\n        ");
    const accountLink = linkHtml(mainLinks.find(link => link.href === "auth.html"), current);
    const linksTwo = assetLinks.map(link => linkHtml(link, current)).join("\n        ");
    mount.outerHTML = `
  <header class="header psd-shared-header">
    <a class="brand" href="index.html" aria-label="Go to Public Sentiment Dash home page">
      <span class="brand-logo-block" style="display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0;">
        <img src="logo.png" alt="Public Sentiment Dash Logo" class="logo">
        <span class="psd-home-label" style="font-size:12px;font-weight:600;color:#ffd780;line-height:1;">Home</span>
      </span>
      <div class="brand-copy">
        <div class="brand-stamp psd-dancing-label">AI-built public market sentiment dashboard</div>
        <div class="site-subtitle psd-ai-subtitle">Global market public sentiment dashboard</div>
      </div>
    </a>
    <div class="header-center">
      <div class="header-pill psd-dancing-label psd-learning-label">✨ Constantly learning & improving</div>
      <a href="${supportUrl}" target="_blank" rel="noopener" aria-label="Donate to support Public Sentiment Dash" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-top:8px;transform:translateY(25px);min-height:28px!important;padding:3px 12px!important;border:1px solid rgba(210,153,34,.45);border-radius:999px;background:rgba(16,20,31,.92);box-shadow:0 0 18px rgba(210,153,34,.16);color:#ffd780;text-decoration:none;font-size:11px;font-weight:800;line-height:1;white-space:nowrap;">
        <span>🚀 Help take Public Sentiment Dash to the next level</span>
        <span style="display:inline-flex;align-items:center;justify-content:center;min-height:22px!important;padding:4px 10px!important;border-radius:999px;background:linear-gradient(180deg,#f4d17d,#d29922);color:#05070b;font-weight:900;">Donate Now</span>
      </a>
      <button
        class="site-tour-banner"
        id="site-tour-button"
        type="button"
        aria-label="Play the two-minute Public Sentiment Dash website tour"
        style="margin:8px 0 0 12px;transform:translateY(25px);min-height:28px!important;padding:5px 15px!important;flex-shrink:0;"
      >
        <span aria-hidden="true">🎬</span>
        <span>Take a 2-Minute Website Tour</span>
      </button>
    </div>
    <nav class="nav" aria-label="Main navigation">
      <div class="psd-nav-row psd-nav-main">
        ${primaryLinks}
      </div>
      <div class="psd-nav-row psd-nav-social">
        <div class="psd-ribbon-social-wrap">
          <div class="social-links">
            <span class="social-label">Follow us</span>
            <a class="social-pill psd-social-brand psd-x-link" href="https://x.com/PublicSentDash" target="_blank" rel="noopener noreferrer" aria-label="Follow Public Sentiment Dash on X.com"><span class="psd-social-logo psd-x-logo" aria-hidden="true">X</span><span class="psd-social-text">X.com</span></a>
            <span class="social-pill linkedin psd-social-brand" aria-label="Public Sentiment Dash on LinkedIn"><span class="psd-social-logo psd-linkedin-logo" aria-hidden="true">in</span><span class="psd-social-text">LinkedIn</span></span>
          </div>
        </div>
        ${accountLink}
      </div>
      <div class="psd-nav-row psd-nav-assets">
        ${linksTwo}
      </div>
      <div class="psd-nav-row psd-nav-fourth">
        <a class="psd-nav-link psd-market-pulse-link${current === "market-pulse.html" ? ' active' : ''}" href="market-pulse.html">Market Pulse</a>
        <div class="psd-ribbon-actions">
          <a href="watchlist.html" id="psd-ribbon-watchlist-link" hidden>My Watchlist</a>
          <button type="button" class="psd-theme-toggle" id="psd-ribbon-theme-toggle" aria-label="Switch between light and dark mode">◐ Dark mode</button>
        </div>
      </div>
    </nav>
  </header>`;

    ensureTourStyles();
    initializeRibbonThemeButton();

    /* Align after the header has had time to settle into its final grid geometry. */
    alignRibbonGeometry();
    window.setTimeout(alignRibbonGeometry, 80);
    window.setTimeout(alignRibbonGeometry, 240);

    const tourButton = document.getElementById("site-tour-button");
    if(tourButton){
      tourButton.onclick = function(event){
        event.preventDefault();
        event.stopPropagation();
        openTour();
      };
    }

    initializeAccountNavigation();
    loadSiteStatus();
  }

  installTourClickFallback();
  window.addEventListener("resize", function(){
    window.requestAnimationFrame(alignRibbonGeometry);
  });

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();

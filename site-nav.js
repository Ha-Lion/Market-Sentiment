(function(){
  "use strict";

  const mainLinks = [
    { href: "dashboard.html", icon: "▦", label: "Interactive Dashboard" },
    { href: "sentiment-history.html", icon: "↗", label: "Historical Sentiment" },
    { href: "news-articles.html", icon: "▤", label: "Search World News & Articles" },
    { href: "charts.html", icon: "⌁", label: "Market Charts" },
    { href: "market-sentiment.html", icon: "▣", label: "Guides" },
    { href: "advertise.html", icon: "◆", label: "Business Opportunities" },
    { href: "about.html", icon: "i", label: "About" },
    { href: "contact.html", icon: "✉", label: "Get in Touch" },
    { href: "auth.html", label: "Sign In" }
  ];

  const assetLinks = [
    { href: "market-pulse.html", icon: "✦", label: "AI Market Pulse", memberOnly: true },
    { href: "dashboard-lab.html", icon: "AI", label: "AI Market Intelligence", memberOnly: true },
    { href: "crypto.html", icon: "₿", label: "Crypto Sentiment" },
    { href: "forex-sentiment-today.html", icon: "⇄", label: "Forex Sentiment" },
    { href: "energy.html", icon: "⚡", label: "Energy Sentiment" },
    { href: "precious-metals.html", icon: "◆", label: "Precious Metals" },
    { href: "indices.html", icon: "▥", label: "Indices Sentiment" },
    { href: "policy-assets.html", icon: "⚖", label: "Policy & Geo Assets" },
    { href: "ai-assets.html", icon: "AI", label: "AI Assets" }
  ];

  const supportUrl = "https://gofund.me/0d687f045";
  const MEMBER_UI_CACHE_KEY = "psd-ribbon-member-ui";

  function cachedMemberUI(){
    try{
      return sessionStorage.getItem(MEMBER_UI_CACHE_KEY) === "true";
    }catch(error){
      return false;
    }
  }

  function cacheMemberUI(active){
    try{
      if(active) sessionStorage.setItem(MEMBER_UI_CACHE_KEY, "true");
      else sessionStorage.removeItem(MEMBER_UI_CACHE_KEY);
    }catch(error){}
  }

  const tourVideoUrl = "https://pub-1132861191d043c088b0fcf5ba3538fe.r2.dev/Public_Sentiment_Dash_2_Minute_Video.mp4";
  const homeUrl = "https://publicsentimentdash.com/";
  const memberFeaturePages = Object.freeze({
    "market-pulse.html": "AI Market Pulse",
    "dashboard-lab.html": "AI Market Intelligence"
  });
  const MEMBER_FEATURE_TARGET_KEY = "psd-member-feature-target-v1";

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

    const memberAttrs = link.memberOnly
      ? ' data-psd-member-feature="true" aria-label="' + link.label + ' — free account required"'
      : '';

    return '<a href="' + link.href + '" class="psd-nav-link' + (isActive ? ' active' : '') + '"' + memberAttrs + '>' + link.label + '</a>';
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
        translate:0 6px;
        justify-content:center!important;
        text-align:center!important;
        white-space:nowrap!important;
        font-size:12px!important;
        letter-spacing:.2px!important;
        animation-delay:.35s,.35s!important;
      }
      .psd-shared-header .site-subtitle.psd-ai-subtitle{
        position:relative;
        top:38px;
        margin-top:3px;
        font-family:"OCR A Std","Eurostile","Bank Gothic","Courier New",monospace!important;
        font-size:15.5px!important;
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
        pointer-events:none!important;
      }
      .psd-shared-header .header-center > a[target="_blank"],
      .psd-shared-header #site-tour-button{
        pointer-events:auto!important;
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
        await loadScript("supabase-client.js?v=16-auth-stable", "psd-supabase-client");
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


  function ensureMemberFeatureGateStyles(){
    if(document.getElementById("psd-member-feature-gate-styles")) return;

    const style = document.createElement("style");
    style.id = "psd-member-feature-gate-styles";
    style.textContent = `
      body.psd-member-feature-gate-open{overflow:hidden!important}
      .psd-member-feature-gate{
        position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;
        padding:18px;background:rgba(3,7,12,.76);backdrop-filter:blur(7px)
      }
      .psd-member-feature-card{
        position:relative;width:min(560px,calc(100vw - 28px));padding:26px 28px 24px;
        border:1px solid rgba(226,173,56,.66);border-radius:22px;
        background:linear-gradient(145deg,#121923,#090e15);color:#f6f8fb;
        box-shadow:0 28px 80px rgba(0,0,0,.58),0 0 34px rgba(226,173,56,.12);
        font-family:Inter,"Segoe UI",Arial,sans-serif;text-align:left
      }
      .psd-member-feature-kicker{
        display:inline-flex;margin:0 0 12px;padding:6px 11px;border:1px solid rgba(255,211,111,.68);
        border-radius:999px;background:#fff8df;color:#624812;font-size:12px;font-weight:900
      }
      .psd-member-feature-card h2{margin:0 48px 9px 0;color:#fff;font-size:24px;line-height:1.13;letter-spacing:-.02em}
      .psd-member-feature-card p{margin:0;color:#dbe4ed;font-size:14px;line-height:1.45}
      .psd-member-feature-privacy{margin-top:10px!important;color:#aebdca!important;font-size:12px!important}
      .psd-member-feature-actions{display:flex;align-items:center;gap:10px;margin-top:20px}
      .psd-member-feature-signin{
        display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 18px;
        border:1px solid #d8a633;border-radius:999px;background:linear-gradient(180deg,#5a4315,#211b10);
        color:#ffe08a;font:900 13px Inter,"Segoe UI",Arial,sans-serif;cursor:pointer;
        box-shadow:0 0 18px rgba(226,173,56,.16)
      }
      .psd-member-feature-signin:hover,.psd-member-feature-signin:focus-visible{
        border-color:#ffe08a;background:linear-gradient(180deg,#72571c,#2b2211);outline:none
      }
      .psd-member-feature-close{
        position:absolute;top:14px;right:14px;width:40px;height:40px;display:grid;place-items:center;
        border:2px solid #fff0ad;border-radius:50%;background:#f4b92f;color:#171006;
        font:900 23px/1 Arial,sans-serif;cursor:pointer;
        box-shadow:0 5px 18px rgba(0,0,0,.42),0 0 0 3px rgba(244,185,47,.16)
      }
      .psd-member-feature-close:hover,.psd-member-feature-close:focus-visible{background:#ffd35c;outline:none}
      @media(max-width:620px){
        .psd-member-feature-card{padding:23px 20px 21px}
        .psd-member-feature-card h2{font-size:21px}
        .psd-member-feature-signin{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  function rememberMemberFeatureTarget(target){
    if(!memberFeaturePages[target]) return;
    try{ sessionStorage.setItem(MEMBER_FEATURE_TARGET_KEY, target); }catch(error){}
  }

  function takeMemberFeatureTarget(){
    try{
      const target = sessionStorage.getItem(MEMBER_FEATURE_TARGET_KEY) || "";
      sessionStorage.removeItem(MEMBER_FEATURE_TARGET_KEY);
      return memberFeaturePages[target] ? target : "";
    }catch(error){
      return "";
    }
  }

  function closeMemberFeatureGate(returnHome){
    const gate = document.getElementById("psd-member-feature-gate");
    if(gate) gate.remove();
    document.body.classList.remove("psd-member-feature-gate-open");
    if(returnHome) window.location.replace("index.html");
  }

  function showMemberFeatureGate(target, directVisit){
    if(!memberFeaturePages[target]) return;
    ensureMemberFeatureGateStyles();

    const oldGate = document.getElementById("psd-member-feature-gate");
    if(oldGate) oldGate.remove();

    const gate = document.createElement("div");
    gate.id = "psd-member-feature-gate";
    gate.className = "psd-member-feature-gate";
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.setAttribute("aria-labelledby", "psd-member-feature-title");
    gate.innerHTML = `
      <section class="psd-member-feature-card">
        <button class="psd-member-feature-close" type="button" aria-label="Close">×</button>
        <div class="psd-member-feature-kicker">Free Account</div>
        <h2 id="psd-member-feature-title">Create a Free Account to Unlock More AI-Built Features</h2>
        <p>Just email + password.</p>
        <p class="psd-member-feature-privacy">No spam. No marketing emails.</p>
        <div class="psd-member-feature-actions">
          <button class="psd-member-feature-signin" type="button">Sign Up / Log In →</button>
        </div>
      </section>`;

    document.body.appendChild(gate);
    document.body.classList.add("psd-member-feature-gate-open");

    const closeButton = gate.querySelector(".psd-member-feature-close");
    const signinButton = gate.querySelector(".psd-member-feature-signin");
    const closeGate = function(){ closeMemberFeatureGate(directVisit === true); };

    closeButton.addEventListener("click", closeGate);
    gate.addEventListener("click", function(event){
      if(event.target === gate) closeGate();
    });
    document.addEventListener("keydown", function onGateKeydown(event){
      if(event.key !== "Escape") return;
      document.removeEventListener("keydown", onGateKeydown);
      closeGate();
    });

    signinButton.addEventListener("click", function(event){
      event.preventDefault();
      rememberMemberFeatureTarget(target);
      closeMemberFeatureGate(false);
      window.location.href = "auth.html";
    });

    window.setTimeout(function(){ signinButton.focus(); }, 0);
  }

  async function userHasActiveSession(){
    try{
      const client = await ensureAccountInfrastructure();
      if(!client) return false;
      return !!(await getStableActiveSession(client));
    }catch(error){
      console.error(error);
      return false;
    }
  }

  function initializeMemberFeatureAccess(){
    document.querySelectorAll('a[data-psd-member-feature="true"]').forEach(function(link){
      link.addEventListener("click", async function(event){
        event.preventDefault();
        const target = link.getAttribute("href") || "";

        if(await userHasActiveSession()){
          window.location.href = target;
          return;
        }

        showMemberFeatureGate(target, false);
      });
    });

    window.addEventListener("psd-member-status-change", function(event){
      const detail = event && event.detail ? event.detail : {};
      if(detail.visitor_type !== "member") return;
      const target = takeMemberFeatureTarget();
      if(target) window.location.href = target;
    });

    const current = currentFile();
    if(memberFeaturePages[current]){
      userHasActiveSession().then(function(signedIn){
        if(!signedIn) showMemberFeatureGate(current, true);
      });
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
      #psd-account-nav-link.psd-member-link::after{
        content:"▾";
        display:inline-block;
        margin-left:6px;
        font-size:9px;
        font-weight:900;
        line-height:1;
        color:currentColor;
        vertical-align:middle;
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
      .psd-shared-header .psd-nav-link[href="dashboard-lab.html"]::before{
        content:"AI"!important;
        font-family:Inter,"Segoe UI",Arial,sans-serif!important;
        font-size:8px!important;
      }
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
      await loadScript("supabase-client.js?v=16-auth-stable", "psd-supabase-client");
    }

    return window.psdSupabase;
  }

  async function getStableActiveSession(client){
    if(!client || !client.auth) return null;

    for(let attempt = 0; attempt < 5; attempt += 1){
      try{
        const result = await client.auth.getSession();
        const session = result && result.data ? result.data.session : null;
        if(session) return session;
      }catch(error){
        if(attempt === 4) console.error(error);
      }

      if(attempt < 4){
        await new Promise(function(resolve){ window.setTimeout(resolve, 100); });
      }
    }

    return null;
  }

  async function refreshAccountNavigation(){
    const accountLink = document.getElementById("psd-account-nav-link");
    const menu = document.getElementById("psd-account-menu");
    if(!accountLink || !menu) return;

    try{
      const client = await ensureAccountInfrastructure();
      if(!client) return;

      const session = await getStableActiveSession(client);

      const ribbonWatchlistLink =
        document.getElementById("psd-ribbon-watchlist-link");

      if(!session){
        cacheMemberUI(false);
        if(ribbonWatchlistLink) ribbonWatchlistLink.hidden = true;
        accountLink.textContent = "Sign In";
        accountLink.href = "auth.html";
        accountLink.classList.remove("psd-member-link");
        accountLink.dataset.signedIn = "false";
        accountLink.removeAttribute("aria-haspopup");
        accountLink.removeAttribute("aria-expanded");
        const reportLink = document.getElementById("psd-activity-report-link");
        if(reportLink) reportLink.hidden = true;
        menu.hidden = true;
        return;
      }

      /* A confirmed auth session is enough to keep My Watchlist visible.
         Show it before the optional profile lookup so changing pages cannot
         make the ribbon link disappear while profile data is loading. */
      cacheMemberUI(true);
      if(ribbonWatchlistLink) ribbonWatchlistLink.hidden = false;

      const profileResult = await client
        .from("profiles")
        .select("username,display_name,is_admin")
        .eq("id", session.user.id)
        .single();

      const profile = profileResult.data || {};
      const name = profile.username || profile.display_name || "Member";
      const reportLink = document.getElementById("psd-activity-report-link");
      if(reportLink) reportLink.hidden = profile.is_admin !== true;

      accountLink.textContent = name;
      accountLink.href = "#";
      accountLink.classList.add("psd-member-link");
      accountLink.dataset.signedIn = "true";
      accountLink.setAttribute("aria-haspopup","menu");
      accountLink.setAttribute("aria-expanded","false");
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
        accountLink.setAttribute("aria-expanded",menu.hidden ? "false" : "true");
        return;
      }

      event.preventDefault();
      window.location.href = "auth.html";
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
      if(!event.target.closest(".psd-account-nav-wrap")){
        menu.hidden = true;
        if(accountLink.dataset.signedIn === "true") accountLink.setAttribute("aria-expanded","false");
      }
    });

    document.addEventListener("keydown", function(event){
      if(event.key === "Escape"){
        menu.hidden = true;
        if(accountLink.dataset.signedIn === "true") accountLink.setAttribute("aria-expanded","false");
      }
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
      window.requestAnimationFrame(function(){
        const aiRect = aiBuilt.getBoundingClientRect();
        const learningRect = learning.getBoundingClientRect();

        /*
         * getBoundingClientRect() includes the translate already applied by
         * the previous alignment pass. Subtract that existing X shift before
         * calculating the new one, otherwise repeated calls alternate between
         * aligned and unaligned positions.
         */
        const currentInlineTranslate = String(learning.style.translate || "");
        const currentShiftX = Number.parseFloat(currentInlineTranslate) || 0;
        const unshiftedLearningLeft = learningRect.left - currentShiftX;
        const horizontalShift = Math.round(aiRect.left - unshiftedLearningLeft);

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
    const primaryLinks = mainLinks
      .filter(link => link.href !== "auth.html")
      .map(link => linkHtml(link, current))
      .join("\n        ");
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
        <div class="brand-stamp psd-dancing-label">AI-built public market sentiment website</div>
        <div class="site-subtitle psd-ai-subtitle"><span class="psd-follow-us psd-ai-subtitle-wave" aria-label="Global market public sentiment dashboard" style="font-size:inherit!important;line-height:inherit!important;letter-spacing:inherit!important;"><span aria-hidden="true" style="--follow-i:0">G</span><span aria-hidden="true" style="--follow-i:1">l</span><span aria-hidden="true" style="--follow-i:2">o</span><span aria-hidden="true" style="--follow-i:3">b</span><span aria-hidden="true" style="--follow-i:4">a</span><span aria-hidden="true" style="--follow-i:5">l</span><span class="psd-follow-space" aria-hidden="true">&nbsp;</span><span aria-hidden="true" style="--follow-i:6">m</span><span aria-hidden="true" style="--follow-i:7">a</span><span aria-hidden="true" style="--follow-i:8">r</span><span aria-hidden="true" style="--follow-i:9">k</span><span aria-hidden="true" style="--follow-i:10">e</span><span aria-hidden="true" style="--follow-i:11">t</span><span class="psd-follow-space" aria-hidden="true">&nbsp;</span><span aria-hidden="true" style="--follow-i:12">p</span><span aria-hidden="true" style="--follow-i:13">u</span><span aria-hidden="true" style="--follow-i:14">b</span><span aria-hidden="true" style="--follow-i:15">l</span><span aria-hidden="true" style="--follow-i:16">i</span><span aria-hidden="true" style="--follow-i:17">c</span><span class="psd-follow-space" aria-hidden="true">&nbsp;</span><span aria-hidden="true" style="--follow-i:18">s</span><span aria-hidden="true" style="--follow-i:19">e</span><span aria-hidden="true" style="--follow-i:20">n</span><span aria-hidden="true" style="--follow-i:21">t</span><span aria-hidden="true" style="--follow-i:22">i</span><span aria-hidden="true" style="--follow-i:23">m</span><span aria-hidden="true" style="--follow-i:24">e</span><span aria-hidden="true" style="--follow-i:25">n</span><span aria-hidden="true" style="--follow-i:26">t</span><span class="psd-follow-space" aria-hidden="true">&nbsp;</span><span aria-hidden="true" style="--follow-i:27">d</span><span aria-hidden="true" style="--follow-i:28">a</span><span aria-hidden="true" style="--follow-i:29">s</span><span aria-hidden="true" style="--follow-i:30">h</span><span aria-hidden="true" style="--follow-i:31">b</span><span aria-hidden="true" style="--follow-i:32">o</span><span aria-hidden="true" style="--follow-i:33">a</span><span aria-hidden="true" style="--follow-i:34">r</span><span aria-hidden="true" style="--follow-i:35">d</span></span></div>
      </div>
    </a>
    <div class="header-center">
      <div class="header-pill psd-dancing-label psd-learning-label">✨ Constantly learning & improving</div>
    </div>
    <nav class="nav" aria-label="Main navigation">
      <div class="psd-nav-row psd-nav-main">
        ${primaryLinks}
        ${accountLink}
        <button type="button" class="psd-theme-toggle" id="psd-ribbon-theme-toggle" aria-label="Switch between light and dark mode">◐ Dark mode</button>
      </div>
      <div class="psd-nav-row psd-nav-assets">
        ${linksTwo}
      </div>
      <div class="psd-nav-row psd-nav-bottom">
        <div class="psd-bottom-promos">
          <a class="psd-bottom-donate" href="${supportUrl}" target="_blank" rel="noopener" aria-label="Donate to support Public Sentiment Dash" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;margin:0;transform:none;min-height:28px!important;padding:3px 12px!important;border:1px solid rgba(210,153,34,.45);border-radius:999px;background:rgba(16,20,31,.92);box-shadow:0 0 18px rgba(210,153,34,.16);color:#ffd780;text-decoration:none;font-size:11px;font-weight:800;line-height:1;white-space:nowrap;">
            <span>🚀 Help take Public Sentiment Dash to the next level</span>
            <span style="display:inline-flex;align-items:center;justify-content:center;min-height:22px!important;padding:4px 10px!important;border-radius:999px;background:linear-gradient(180deg,#f4d17d,#d29922);color:#05070b;font-weight:900;">Donate Now</span>
          </a>
          <button
            class="site-tour-banner"
            id="site-tour-button"
            type="button"
            aria-label="Play the two-minute Public Sentiment Dash website tour"
            style="margin:0;transform:none;min-height:28px!important;padding:5px 15px!important;flex-shrink:0;"
          >
            <span aria-hidden="true">🎬</span>
            <span>Take a 2-Minute Website Tour</span>
          </button>
        </div>
        <div class="psd-ribbon-social-wrap">
          <div class="social-links">
            <span class="social-label psd-follow-us" aria-label="Follow us">
              <span aria-hidden="true" style="--follow-i:0">F</span><span aria-hidden="true" style="--follow-i:1">o</span><span aria-hidden="true" style="--follow-i:2">l</span><span aria-hidden="true" style="--follow-i:3">l</span><span aria-hidden="true" style="--follow-i:4">o</span><span aria-hidden="true" style="--follow-i:5">w</span><span class="psd-follow-space" aria-hidden="true">&nbsp;</span><span aria-hidden="true" style="--follow-i:6">u</span><span aria-hidden="true" style="--follow-i:7">s</span>
            </span>
            <a class="social-pill psd-social-brand psd-x-link" href="https://x.com/PublicSentDash" target="_blank" rel="noopener noreferrer" aria-label="Follow Public Sentiment Dash on X.com"><span class="psd-social-logo psd-x-logo" aria-hidden="true">X</span><span class="psd-social-text">X.com</span></a>
            <span class="social-pill linkedin psd-social-brand" aria-label="Public Sentiment Dash on LinkedIn"><span class="psd-social-logo psd-linkedin-logo" aria-hidden="true">in</span><span class="psd-social-text">LinkedIn</span></span>
          </div>
        </div>
        <div class="psd-ribbon-actions">
          <a href="watchlist.html" id="psd-ribbon-watchlist-link"${cachedMemberUI() ? "" : " hidden"}>My Watchlist</a>
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
    initializeMemberFeatureAccess();
    loadSiteStatus();
  }

  installTourClickFallback();

  /*
   * Keep the ribbon geometry stable when late-loading ribbon CSS or fonts
   * change the header after the first render. vote-widget.js still owns the
   * legacy compact-ribbon CSS, so it signals us after that CSS is installed.
   */
  function scheduleRibbonGeometryAlignment(){
    window.requestAnimationFrame(alignRibbonGeometry);
    window.setTimeout(alignRibbonGeometry, 60);
  }

  window.addEventListener("resize", scheduleRibbonGeometryAlignment);
  window.addEventListener("load", scheduleRibbonGeometryAlignment);
  window.addEventListener("psd:ribbon-layout-changed", scheduleRibbonGeometryAlignment);

  if(document.fonts && document.fonts.ready){
    document.fonts.ready.then(scheduleRibbonGeometryAlignment).catch(function(){});
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();

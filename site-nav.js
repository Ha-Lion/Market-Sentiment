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

  function currentFile(){
    const path = (window.location.pathname || "").split("/").pop();
    return path || "index.html";
  }

  function linkHtml(link, current){
    const isActive = link.href === current;
    return '<a href="' + link.href + '"' + (isActive ? ' class="active"' : '') + '>' + link.label + '</a>';
  }



  function injectDonationPositionFix(){
    if(document.getElementById("psd-donation-position-fix-css")) return;
    const style = document.createElement("style");
    style.id = "psd-donation-position-fix-css";
    style.textContent = `
      .psd-ad-banner{
        bottom:3px !important;
      }

      @media(max-width:1180px){
        .psd-ad-banner{
          bottom:auto !important;
        }
      }
    `;
    document.head.appendChild(style);
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
      <div class="header-pill">✨ Constantly learning & improving</div>
    </div>
    <nav class="nav" aria-label="Main navigation">
      ${linksOne}
      <span class="nav-row-break" aria-hidden="true"></span>
      ${linksTwo}
      <div class="social-links">
        <span class="social-label">Follow us</span>
        <span class="social-pill">X</span>
        <span class="social-pill linkedin">LinkedIn</span>
      </div>
    </nav>
  </header>`;
  }

  function boot(){
    render();
    injectDonationPositionFix();
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

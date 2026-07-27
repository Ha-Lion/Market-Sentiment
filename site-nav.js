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

  function currentFile(){
    const path = (window.location.pathname || "").split("/").pop();
    return path || "index.html";
  }

  function linkHtml(link, current){
    const isActive = link.href === current;
    return '<a href="' + link.href + '"' + (isActive ? ' class="active"' : '') + '>' + link.label + '</a>';
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
      <a href="${supportUrl}" target="_blank" rel="noopener" aria-label="Donate to support Public Sentiment Dash" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-top:8px;transform:translateY(7px);padding:5px 12px;border:1px solid rgba(210,153,34,.45);border-radius:999px;background:rgba(16,20,31,.92);box-shadow:0 0 18px rgba(210,153,34,.16);color:#ffd780;text-decoration:none;font-size:11px;font-weight:800;line-height:1;white-space:nowrap;">
        <span>🚀 Help take Public Sentiment Dash to the next level</span>
        <span style="display:inline-flex;align-items:center;justify-content:center;padding:5px 10px;border-radius:999px;background:linear-gradient(180deg,#f4d17d,#d29922);color:#05070b;font-weight:900;">Donate Now</span>
      </a>
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

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();

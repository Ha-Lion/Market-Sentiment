(function(){
  "use strict";

  const mainLinks = [
    { href: "dashboard.html", label: "📊 Interactive Dashboard" },
    { href: "sentiment-history.html", label: "📈 Historical Sentiment" },
    { href: "news-articles.html", label: "📰 News & Articles" },
    { href: "charts.html", label: "📈 Market Charts" },
    { href: "market-sentiment.html", label: "📘 Guides" },
    { href: "advertise.html", label: "💼 Business" },
    { href: "contact.html", label: "✉️ Contact" },
    { href: "about.html", label: "ℹ️ About" }
  ];

  const assetLinks = [
    { href: "crypto.html", label: "🪙 Crypto" },
    { href: "energy.html", label: "⚡ Energy" },
    { href: "precious-metals.html", label: "🥇 Metals" },
    { href: "indices.html", label: "📊 Indices" },
    { href: "policy-assets.html", label: "🏛️ Policy & Geo" },
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

  function injectNavCss(){
    if(document.getElementById("psd-shared-nav-css")) return;
    const style = document.createElement("style");
    style.id = "psd-shared-nav-css";
    style.textContent = `
      .header.psd-shared-header{
        display:grid !important;
        grid-template-columns:minmax(310px,390px) minmax(0,1fr) !important;
        align-items:center !important;
        gap:18px !important;
        min-height:142px !important;
        padding:10px 26px 10px !important;
      }

      .psd-shared-header .brand{
        align-self:center !important;
        min-width:0 !important;
      }

      .psd-shared-header .logo{
        width:112px !important;
        height:112px !important;
      }

      .psd-shared-header .brand-copy{
        min-width:0 !important;
      }

      .psd-shared-header .brand-stamp{
        font-size:12px !important;
        padding:7px 12px !important;
        white-space:normal !important;
      }

      .psd-nav-area{
        display:flex !important;
        flex-direction:column !important;
        align-items:flex-end !important;
        justify-content:center !important;
        gap:9px !important;
        min-width:0 !important;
        width:100% !important;
      }

      .psd-nav-pill-row{
        width:100% !important;
        display:flex !important;
        justify-content:center !important;
        pointer-events:none !important;
      }

      .psd-shared-header .header-pill{
        font-size:12px !important;
        padding:7px 14px !important;
        max-width:100% !important;
        transform:none !important;
      }

      .psd-shared-header .nav{
        width:100% !important;
        display:flex !important;
        flex-wrap:wrap !important;
        align-items:center !important;
        justify-content:flex-end !important;
        gap:7px 13px !important;
        transform:none !important;
        min-width:0 !important;
      }

      .psd-shared-header .nav-row-break{
        flex-basis:100% !important;
        height:0 !important;
      }

      .psd-shared-header .nav a{
        display:inline-flex !important;
        align-items:center !important;
        gap:5px !important;
        white-space:nowrap !important;
        font-size:12px !important;
        line-height:1.1 !important;
        padding:6px 8px !important;
      }

      .psd-shared-header .nav a::before{
        display:none !important;
        content:none !important;
      }

      .psd-shared-header .social-links{
        margin-left:8px !important;
        gap:7px !important;
        flex-wrap:nowrap !important;
      }

      .psd-shared-header .social-label{
        white-space:nowrap !important;
        font-size:12px !important;
      }

      .psd-shared-header .social-pill{
        font-size:12px !important;
        padding:6px 11px !important;
      }

      @media(max-width:1180px){
        .header.psd-shared-header{
          grid-template-columns:1fr !important;
          min-height:auto !important;
          padding:12px 18px !important;
        }
        .psd-nav-area,
        .psd-shared-header .nav{
          align-items:flex-start !important;
          justify-content:flex-start !important;
        }
        .psd-nav-pill-row{
          justify-content:flex-start !important;
        }
      }

      @media(max-width:760px){
        .psd-shared-header .logo{
          width:92px !important;
          height:92px !important;
        }
        .psd-shared-header .brand{
          align-items:center !important;
        }
        .psd-shared-header .nav{
          gap:7px 8px !important;
        }
        .psd-shared-header .nav a{
          font-size:11px !important;
          padding:6px 7px !important;
        }
        .psd-shared-header .social-links{
          flex-wrap:wrap !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function render(){
    const mount = document.getElementById("site-header");
    if(!mount) return;
    injectNavCss();
    const current = currentFile();
    const linksOne = mainLinks.map(link => linkHtml(link, current)).join("\n        ");
    const linksTwo = assetLinks.map(link => linkHtml(link, current)).join("\n        ");
    mount.outerHTML = `
  <header class="header psd-shared-header">
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

    <div class="psd-nav-area">
      <div class="psd-nav-pill-row">
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
    </div>
  </header>`;
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();

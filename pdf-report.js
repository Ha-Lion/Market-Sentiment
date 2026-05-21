/*
  Public Sentiment Dash PDF Report Engine v2
  Builds a clean PDF report instead of printing the live animated page.
*/
(function(){
  const PSD_PDF_VERSION = "v2";

  function q(selector, root=document){ return root.querySelector(selector); }
  function qa(selector, root=document){ return Array.from(root.querySelectorAll(selector)); }
  function txt(selector, root=document, fallback=""){
    const el = q(selector, root);
    return cleanText(el ? el.textContent : fallback);
  }
  function cleanText(value){ return String(value || "").replace(/\s+/g," ").trim(); }
  function esc(value){
    return String(value ?? "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }
  function safeHtml(value){ return value ? String(value) : ""; }
  function reportScore(value){
    const n = Number(String(value || "").replace(/[^0-9.]/g,""));
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 50;
  }
  function reportSentClass(value){
    return String(value || "neutral").toLowerCase().replace(/[^a-z]/g,"") || "neutral";
  }
  function reportSentColor(value){
    const v = reportSentClass(value);
    if(v === "bullish") return "#3fb950";
    if(v === "mixedbullish") return "#2dd4bf";
    if(v === "mixedbearish") return "#f59e0b";
    if(v === "bearish") return "#f85149";
    return "#58a6ff";
  }

  function wait(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

  async function waitForDashboardReady(){
    for(let i=0;i<20;i++){
      if(q("#snapshotCards .sentiment-card") && q("#skylineChart") && q("#radarChart") && q("#heatmapGrid") && q("#rankingList")) return;
      await wait(150);
    }
  }

  function svgHtml(selector){
    const svg = q(selector);
    if(!svg) return `<div class="psd-empty">Chart unavailable</div>`;
    const clone = svg.cloneNode(true);
    clone.removeAttribute("id");
    clone.setAttribute("width", "100%");
    clone.setAttribute("height", "100%");
    clone.style.width = "100%";
    clone.style.height = "100%";
    return clone.outerHTML;
  }

  function getMetric(card, label){
    const row = qa(".metric-line", card).find(x => cleanText(x.textContent).toLowerCase().startsWith(label.toLowerCase()));
    if(!row) return "--";
    const spans = qa("span", row);
    return cleanText(spans[1] ? spans[1].textContent : row.textContent.replace(label, "")) || "--";
  }

  function collectCards(){
    return qa("#snapshotCards .sentiment-card").slice(0,5).map((card, idx) => {
      const spark = q("svg.sparkline", card);
      const sparkClone = spark ? spark.cloneNode(true) : null;
      if(sparkClone){
        sparkClone.removeAttribute("id");
        sparkClone.setAttribute("width", "100%");
        sparkClone.setAttribute("height", "42");
      }
      return {
        name: txt(".market-name", card, `Market ${idx+1}`),
        sentiment: txt(".sentiment-badge", card, "Neutral"),
        psi: txt(".psi-big", card, "--"),
        user: getMetric(card, "User"),
        technical: getMetric(card, "Technical"),
        headlines: getMetric(card, "Headlines"),
        spark: sparkClone ? sparkClone.outerHTML : ""
      };
    });
  }

  function collectRanking(){
    const rows = qa("#rankingList .rank-item");
    return rows.slice(0,6).map(row => {
      const num = txt(".rank-num", row, "");
      const title = txt(".rank-title", row, "");
      const meta = txt(".rank-meta", row, "");
      const score = txt(".rank-score", row, "");
      return {num,title,meta,score};
    });
  }

  function heatmapHtml(){
    const heatmap = q("#heatmapGrid");
    if(!heatmap) return `<div class="psd-empty">Heatwave unavailable</div>`;
    const clone = heatmap.cloneNode(true);
    clone.removeAttribute("id");
    qa("[style]", clone).forEach(el => {
      const style = el.getAttribute("style") || "";
      el.setAttribute("style", style.replace(/animation:[^;]+;?/gi, ""));
    });
    return clone.outerHTML;
  }

  function currentPeriodLabel(){
    const active = q("[data-period].active");
    return active ? cleanText(active.textContent) : "Daily";
  }

  function buildCardHtml(cards){
    return cards.map(card => `
      <article class="psd-card psd-sent-${reportSentClass(card.sentiment)}">
        <div class="psd-card-top">
          <div class="psd-card-name">${esc(card.name)}</div>
          <div class="psd-card-badge">${esc(card.sentiment)}</div>
        </div>
        <div class="psd-card-mid">
          <div class="psd-psi-box" style="--psi:${reportScore(card.psi)};--accent:${reportSentColor(card.sentiment)}"><strong>${esc(card.psi)}</strong><span>PSI / 100</span></div>
          <div class="psd-metrics">
            <div><span>User</span><b>${esc(card.user)}</b></div>
            <div><span>Technical</span><b>${esc(card.technical)}</b></div>
            <div><span>Headlines</span><b>${esc(card.headlines)}</b></div>
          </div>
        </div>
        <div class="psd-spark">${safeHtml(card.spark)}</div>
      </article>
    `).join("");
  }

  function buildRankingHtml(rows){
    if(!rows.length) return `<div class="psd-empty">Ranking unavailable</div>`;
    return rows.map(row => `
      <div class="psd-rank-row">
        <div class="psd-rank-num">${esc(row.num)}</div>
        <div class="psd-rank-main"><b>${esc(row.title)}</b><span>${esc(row.meta)}</span></div>
        <div class="psd-rank-score">${esc(row.score)}</div>
      </div>
    `).join("");
  }

  function reportCss(){
    return `
      @page{size:letter landscape;margin:.22in;}
      *{box-sizing:border-box;}
      html,body{margin:0;padding:0;background:#05070b;color:#e6edf3;font-family:Inter,Segoe UI,Arial,sans-serif;}
      body{font-size:12px;line-height:1.35;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .psd-print-toolbar{position:fixed;top:10px;right:10px;z-index:9999;display:flex;gap:8px;font-family:Arial,sans-serif;}
      .psd-print-toolbar button{border:0;border-radius:999px;padding:9px 14px;font-weight:900;cursor:pointer;background:#d29922;color:#05070b;box-shadow:0 8px 24px rgba(0,0,0,.28);}
      .psd-report{width:100%;}
      .psd-page{height:7.38in;break-after:page;page-break-after:always;overflow:hidden;display:flex;flex-direction:column;gap:10px;padding:0;background:
        radial-gradient(circle at top left,rgba(210,153,34,.17),transparent 3.1in),
        radial-gradient(circle at top right,rgba(88,166,255,.14),transparent 3.0in),
        linear-gradient(180deg,#0a0f18,#05070b);}
      .psd-page:last-child{break-after:auto;page-break-after:auto;}
      .psd-report-header{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;border:1px solid rgba(210,153,34,.38);border-radius:18px;padding:10px 12px;background:linear-gradient(90deg,rgba(13,17,23,.98),rgba(17,24,33,.96));box-shadow:0 12px 34px rgba(0,0,0,.28);}
      .psd-logo{width:48px;height:48px;object-fit:contain;border-radius:12px;box-shadow:0 0 20px rgba(210,153,34,.22);}
      .psd-title-block h1{font-size:24px;line-height:1.05;margin:0 0 4px;color:#ffffff;letter-spacing:-.02em;}
      .psd-title-block .psd-chip{display:inline-flex;border:1px solid rgba(210,153,34,.55);border-radius:999px;padding:4px 9px;background:rgba(210,153,34,.16);color:#ffd780;font-size:10px;font-weight:900;margin-bottom:5px;}
      .psd-title-block p{margin:0;color:#c9d1d9;font-size:11px;}
      .psd-ribbon{border:1px solid rgba(210,153,34,.48);border-radius:999px;padding:7px 11px;color:#ffd780;background:rgba(210,153,34,.12);font-size:11px;font-weight:900;white-space:nowrap;box-shadow:0 0 18px rgba(210,153,34,.13);}
      .psd-ad{border:1px solid rgba(210,153,34,.34);border-radius:999px;padding:7px 12px;text-align:center;background:linear-gradient(90deg,rgba(210,153,34,.16),rgba(88,166,255,.10));color:#ffffff;font-weight:850;font-size:11px;}
      .psd-description{border:1px solid rgba(88,166,255,.20);border-radius:16px;padding:10px 12px;background:rgba(13,17,23,.94);color:#e6edf3;}
      .psd-description p{margin:0 0 5px;font-size:12px;}.psd-description p:last-child{margin-bottom:0;color:#c9d1d9;font-size:11px;}
      .psd-card-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;flex:1;align-items:stretch;}
      .psd-card{position:relative;border:1px solid rgba(88,166,255,.18);border-radius:18px;padding:10px;background:radial-gradient(circle at top right,rgba(210,153,34,.12),transparent 1.15in),linear-gradient(180deg,#111821,#0b111a);display:flex;flex-direction:column;min-width:0;overflow:hidden;box-shadow:0 18px 35px rgba(0,0,0,.30);}
      .psd-card:before{content:"";position:absolute;inset:0;border-radius:18px;background:linear-gradient(135deg,rgba(210,153,34,.24),transparent 42%,rgba(88,166,255,.16));pointer-events:none;}
      .psd-card-top,.psd-card-mid,.psd-spark{position:relative;z-index:1;}
      .psd-card-top{display:flex;justify-content:space-between;gap:6px;align-items:flex-start;margin-bottom:8px;}
      .psd-card-name{font-weight:900;color:#ffffff;font-size:12px;line-height:1.15;max-width:58%;}
      .psd-card-badge{font-size:9px;font-weight:900;border:1px solid rgba(255,255,255,.12);background:rgba(88,166,255,.12);color:#d8ebff;border-radius:999px;padding:4px 6px;white-space:nowrap;}
      .psd-sent-bullish .psd-card-badge{background:rgba(63,185,80,.16);border-color:rgba(63,185,80,.38);color:#baf7c5;}
      .psd-sent-mixedbullish .psd-card-badge{background:rgba(45,212,191,.16);border-color:rgba(45,212,191,.38);color:#b8fff6;}
      .psd-sent-mixedbearish .psd-card-badge{background:rgba(245,158,11,.16);border-color:rgba(245,158,11,.38);color:#ffd8a8;}
      .psd-sent-bearish .psd-card-badge{background:rgba(248,81,73,.16);border-color:rgba(248,81,73,.38);color:#ffaaa6;}
      .psd-card-mid{display:grid;grid-template-columns:66px 1fr;gap:8px;align-items:center;}
      .psd-psi-box{height:66px;width:66px;border-radius:50%;display:grid;place-items:center;text-align:center;background:conic-gradient(var(--accent) calc(var(--psi)*1%),#26313f 0);color:#fff;box-shadow:0 0 26px color-mix(in srgb,var(--accent) 35%,transparent);}
      .psd-psi-box:before{content:"";position:absolute;width:46px;height:46px;border-radius:50%;background:#0d1117;border:1px solid rgba(255,255,255,.07);}
      .psd-psi-box strong,.psd-psi-box span{position:relative;z-index:1;display:block;}.psd-psi-box strong{font-size:18px;line-height:1;}.psd-psi-box span{font-size:7px;color:#c9d1d9;font-weight:850;margin-top:2px;}
      .psd-metrics{display:grid;gap:4px;min-width:0;}
      .psd-metrics div{display:flex;justify-content:space-between;gap:5px;border-bottom:1px solid rgba(255,255,255,.06);padding-bottom:3px;font-size:9.5px;}
      .psd-metrics span{color:#8b949e;}.psd-metrics b{color:#ffffff;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .psd-spark{margin-top:auto;height:44px;opacity:.95;}.psd-spark svg{width:100%;height:44px;display:block;}
      .psd-chart-grid{display:grid;grid-template-columns:1.16fr .84fr;gap:10px;flex:1;min-height:0;}
      .psd-section{border:1px solid rgba(88,166,255,.18);border-radius:18px;background:linear-gradient(180deg,rgba(17,24,33,.96),rgba(9,14,22,.98));padding:10px;display:flex;flex-direction:column;min-height:0;overflow:hidden;box-shadow:0 16px 36px rgba(0,0,0,.28);}
      .psd-section h2{margin:0 0 3px;font-size:17px;color:#ffffff;letter-spacing:-.01em;}
      .psd-section-note{margin:0 0 8px;color:#c9d1d9;font-size:10.5px;line-height:1.35;}
      .psd-chart-box{border:1px solid rgba(255,255,255,.07);border-radius:14px;background:radial-gradient(circle at top right,rgba(210,153,34,.10),transparent 1.8in),linear-gradient(180deg,#101826,#090e16);overflow:hidden;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:5px;}
      .psd-chart-box svg{width:100%;height:100%;display:block;max-width:100%;max-height:100%;}
      .psd-page-label{font-size:10px;color:#8b949e;font-weight:900;text-align:right;margin-top:-4px;}
      .psd-heat-rank-grid{display:grid;grid-template-columns:1.48fr .52fr;gap:10px;flex:1;min-height:0;}
      .psd-heat-legend{display:flex;flex-wrap:wrap;gap:5px;margin:2px 0 7px;}
      .psd-heat-legend span{display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:3px 6px;background:rgba(17,24,33,.78);color:#e6edf3;font-size:8.5px;font-weight:900;}
      .psd-heat-legend i{width:8px;height:8px;border-radius:50%;display:inline-block;box-shadow:0 0 10px currentColor;}
      .heatmap{display:grid!important;gap:5px!important;margin-top:4px!important;}
      .heat-row{display:grid!important;grid-template-columns:1.18in repeat(12,minmax(0,1fr))!important;gap:4px!important;align-items:center!important;}
      .heat-name{color:#ffffff!important;font-size:9.2px!important;font-weight:900!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
      .heat-head{color:#c9d1d9!important;font-size:8px!important;font-weight:900!important;text-align:center!important;}
      .heat-cell{height:21px!important;border-radius:7px!important;font-size:8.2px!important;font-weight:900!important;display:grid!important;place-items:center!important;color:#fff!important;text-shadow:0 1px 2px rgba(0,0,0,.35)!important;box-shadow:inset 0 0 12px rgba(255,215,128,.12),0 0 12px rgba(0,0,0,.12)!important;animation:none!important;border:1px solid rgba(255,255,255,.10)!important;}
      .heat-cell:before{display:none!important;}
      .preview-note{margin-top:7px!important;border:1px solid rgba(210,153,34,.26)!important;background:rgba(210,153,34,.10)!important;color:#f4d17d!important;padding:7px 9px!important;border-radius:12px!important;font-size:9px!important;line-height:1.28!important;}
      .psd-rank-list{display:grid;gap:6px;overflow:hidden;}
      .psd-rank-row{display:grid;grid-template-columns:24px 1fr 30px;gap:7px;align-items:center;border:1px solid rgba(255,255,255,.08);border-radius:13px;padding:7px;background:rgba(13,17,23,.72);}
      .psd-rank-num{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:rgba(210,153,34,.18);color:#ffd780;font-weight:900;font-size:10px;}
      .psd-rank-main{min-width:0;}.psd-rank-main b{display:block;color:#ffffff;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.psd-rank-main span{display:block;color:#c9d1d9;font-size:8.7px;line-height:1.25;margin-top:1px;}
      .psd-rank-score{font-size:15px;font-weight:900;color:#58a6ff;text-align:right;}
      .psd-footer{border-top:1px solid rgba(255,255,255,.10);padding-top:7px;color:#c9d1d9;font-size:9.5px;line-height:1.35;}
      .psd-footer-links{font-size:9px;color:#e6edf3;margin-bottom:5px;font-weight:850;}
      .psd-footer p{margin:3px 0 0;}.psd-empty{color:#8b949e;font-weight:900;padding:20px;text-align:center;}
      @media print{.psd-print-toolbar{display:none!important;} body{-webkit-print-color-adjust:exact;print-color-adjust:exact;} .psd-page{height:7.38in;} }
    `;
  }

  function buildDashboardReport(){
    const cards = collectCards();
    const ranking = collectRanking();
    const skyline = svgHtml("#skylineChart");
    const radar = svgHtml("#radarChart");
    const heat = heatmapHtml();
    const period = currentPeriodLabel();
    const chip = txt(".page-chip", document, "Interactive Dashboard");
    const title = txt(".lab-hero h1", document, document.title || "Interactive Market Sentiment Dashboard");
    const main = txt(".lab-hero-main", document, "Compare up to 5 markets using PSI, user sentiment, technical direction, headline strength, skyline trends, radar comparison, heatwave pressure, and strength ranking.");
    const small = txt(".lab-small", document, "Focused on selected-market sentiment. PSI uses instrument headlines; user sentiment falls back to technical direction when direct votes are unavailable.");
    const ribbon = txt(".header-pill", document, "Constantly learning & improving");
    const ad = txt("#psdAdvertiseBanner", document, "Partner with Public Sentiment Dash — advertising, investor, and business opportunities in market sentiment.");
    const footerLinks = qa(".footer-links a").map(a => cleanText(a.textContent)).filter(Boolean).join("  •  ");
    const disclaimer = txt(".legal", document, "Disclaimer: Public Sentiment Dash is for informational and educational purposes only. It is not financial advice, investment advice, trading advice, or a recommendation to buy or sell any asset.");
    const copyright = qa(".footer p").map(p => cleanText(p.textContent)).find(t => t.includes("©")) || "© 2026 Public Sentiment Dash. All rights reserved.";

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${esc(document.baseURI)}">
  <title>${esc(title)} — PDF Report</title>
  <style>${reportCss()}</style>
</head>
<body>
  <div class="psd-print-toolbar"><button onclick="window.print()">Print / Save PDF</button><button onclick="window.close()">Close</button></div>
  <main class="psd-report">
    <section class="psd-page">
      <header class="psd-report-header">
        <img class="psd-logo" src="logo.png" alt="Public Sentiment Dash Logo">
        <div class="psd-title-block">
          <div class="psd-chip">${esc(chip)}</div>
          <h1>${esc(title)}</h1>
          <p>Public Sentiment Dash • ${esc(period)} Report • ${esc(new Date().toLocaleString())}</p>
        </div>
        <div class="psd-ribbon">${esc(ribbon)}</div>
      </header>
      <div class="psd-ad">📣 ${esc(ad.replace("📣", ""))}</div>
      <section class="psd-description"><p>${esc(main)}</p><p>${esc(small)}</p></section>
      <section class="psd-card-grid">${buildCardHtml(cards)}</section>
      <div class="psd-page-label">Page 1 / 3 • Summary</div>
    </section>

    <section class="psd-page">
      <div class="psd-chart-grid">
        <section class="psd-section">
          <h2>Sentiment Skyline</h2>
          <p class="psd-section-note">Multi-market PSI movement with end-point labels and ${esc(period)} values.</p>
          <div class="psd-chart-box">${skyline}</div>
        </section>
        <section class="psd-section">
          <h2>Radar Comparison</h2>
          <p class="psd-section-note">Axes compare PSI, user bias, headline strength, technical direction, and stability.</p>
          <div class="psd-chart-box">${radar}</div>
        </section>
      </div>
      <div class="psd-page-label">Page 2 / 3 • Charts</div>
    </section>

    <section class="psd-page">
      <div class="psd-heat-rank-grid">
        <section class="psd-section">
          <h2>Sentiment Heatwave</h2>
          <p class="psd-section-note">Recent PSI-style pressure matrix for the selected markets.</p>
          <div class="psd-heat-legend">
            <span><i style="background:#ef4444"></i>0–30 Bearish</span>
            <span><i style="background:#facc15"></i>31–44 Mixed Bearish</span>
            <span><i style="background:#3b82f6"></i>45–55 Neutral</span>
            <span><i style="background:#2dd4bf"></i>56–69 Mixed Bullish</span>
            <span><i style="background:#16a34a"></i>70–100 Bullish</span>
          </div>
          ${heat}
        </section>
        <section class="psd-section">
          <h2>Strength Ranking</h2>
          <p class="psd-section-note">Simple ranked read of selected markets.</p>
          <div class="psd-rank-list">${buildRankingHtml(ranking)}</div>
        </section>
      </div>
      <footer class="psd-footer">
        <div class="psd-footer-links">${esc(footerLinks)}</div>
        <p><b>Disclaimer:</b> ${esc(disclaimer.replace(/^Disclaimer:\s*/i,""))}</p>
        <p>${esc(copyright)}</p>
      </footer>
      <div class="psd-page-label">Page 3 / 3 • Heatwave, Ranking, Disclaimer</div>
    </section>
  </main>
</body>
</html>`;
  }

  function buildGenericReport(){
    const title = document.title || "Public Sentiment Dash";
    const main = q("main") ? cleanText(q("main").textContent).slice(0, 4500) : cleanText(document.body.textContent).slice(0, 4500);
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} — PDF Report</title><style>${reportCss()} .psd-page{height:auto;min-height:7.28in}.psd-generic{white-space:pre-wrap;font-size:12px;line-height:1.5;border:1px solid #d7dde6;border-radius:14px;padding:14px;background:#fff;}</style></head><body><div class="psd-print-toolbar"><button onclick="window.print()">Print / Save PDF</button><button onclick="window.close()">Close</button></div><main class="psd-report"><section class="psd-page"><header class="psd-report-header"><img class="psd-logo" src="logo.png"><div class="psd-title-block"><div class="psd-chip">Public Sentiment Dash</div><h1>${esc(title)}</h1><p>${esc(new Date().toLocaleString())}</p></div><div class="psd-ribbon">PDF Report</div></header><div class="psd-generic">${esc(main)}</div></section></main></body></html>`;
  }

  function openReportWindow(html){
    const win = window.open("", "_blank");
    if(!win){
      alert("Popup blocked. Please allow popups for this site and try again.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      try{ win.focus(); win.print(); }catch(error){ console.warn("PDF print failed", error); }
    }, 900);
  }

  async function psdOpenPdfReport(){
    try{
      const isDashboard = /dashboard\.html$/i.test(window.location.pathname) || !!q("#snapshotCards");
      if(isDashboard){
        await waitForDashboardReady();
        openReportWindow(buildDashboardReport());
      }else{
        openReportWindow(buildGenericReport());
      }
    }catch(error){
      console.error("PSD PDF report failed", error);
      alert("PDF report failed to prepare. Please refresh the page and try again.");
    }
  }

  window.psdOpenPdfReport = psdOpenPdfReport;
  window.PSD_PDF_REPORT_VERSION = PSD_PDF_VERSION;
})();

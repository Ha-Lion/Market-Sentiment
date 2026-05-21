/*
  Public Sentiment Dash PDF Report Engine v1
  Builds a clean PDF report instead of printing the live animated page.
*/
(function(){
  const PSD_PDF_VERSION = "v1";

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
      <article class="psd-card">
        <div class="psd-card-top">
          <div class="psd-card-name">${esc(card.name)}</div>
          <div class="psd-card-badge">${esc(card.sentiment)}</div>
        </div>
        <div class="psd-card-mid">
          <div class="psd-psi-box"><strong>${esc(card.psi)}</strong><span>PSI / 100</span></div>
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
      @page{size:letter landscape;margin:.28in;}
      *{box-sizing:border-box;}
      html,body{margin:0;padding:0;background:#ffffff;color:#111827;font-family:Inter,Segoe UI,Arial,sans-serif;}
      body{font-size:12px;line-height:1.35;}
      .psd-print-toolbar{position:fixed;top:10px;right:10px;z-index:9999;display:flex;gap:8px;font-family:Arial,sans-serif;}
      .psd-print-toolbar button{border:0;border-radius:999px;padding:9px 14px;font-weight:800;cursor:pointer;background:#d29922;color:#05070b;box-shadow:0 8px 24px rgba(0,0,0,.18);}
      .psd-report{width:100%;}
      .psd-page{height:7.28in;break-after:page;page-break-after:always;overflow:hidden;display:flex;flex-direction:column;gap:10px;padding:0;}
      .psd-page:last-child{break-after:auto;page-break-after:auto;}
      .psd-report-header{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;border:1px solid #d7dde6;border-radius:14px;padding:10px 12px;background:linear-gradient(90deg,#fff8e8,#eef6ff);}
      .psd-logo{width:46px;height:46px;object-fit:contain;border-radius:10px;}
      .psd-title-block h1{font-size:24px;line-height:1.05;margin:0 0 4px;color:#05070b;letter-spacing:-.02em;}
      .psd-title-block .psd-chip{display:inline-flex;border:1px solid #d29922;border-radius:999px;padding:4px 9px;background:#fff7df;color:#8a5a00;font-size:10px;font-weight:900;margin-bottom:5px;}
      .psd-title-block p{margin:0;color:#374151;font-size:11px;}
      .psd-ribbon{border:1px solid #d29922;border-radius:999px;padding:7px 11px;color:#8a5a00;background:#fff7df;font-size:11px;font-weight:900;white-space:nowrap;}
      .psd-ad{border:1px solid #e7c36c;border-radius:999px;padding:7px 12px;text-align:center;background:#fff7df;color:#3b2a00;font-weight:800;font-size:11px;}
      .psd-description{border:1px solid #d7dde6;border-radius:14px;padding:10px 12px;background:#f8fafc;color:#1f2937;}
      .psd-description p{margin:0 0 5px;font-size:12px;}.psd-description p:last-child{margin-bottom:0;color:#4b5563;font-size:11px;}
      .psd-card-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;flex:1;align-items:stretch;}
      .psd-card{border:1px solid #d7dde6;border-radius:14px;padding:10px;background:linear-gradient(180deg,#ffffff,#f8fafc);display:flex;flex-direction:column;min-width:0;overflow:hidden;}
      .psd-card-top{display:flex;justify-content:space-between;gap:6px;align-items:flex-start;margin-bottom:8px;}
      .psd-card-name{font-weight:900;color:#111827;font-size:12px;line-height:1.15;max-width:58%;}
      .psd-card-badge{font-size:9px;font-weight:900;border:1px solid #d29922;background:#fff7df;color:#8a5a00;border-radius:999px;padding:4px 6px;white-space:nowrap;}
      .psd-card-mid{display:grid;grid-template-columns:62px 1fr;gap:8px;align-items:center;}
      .psd-psi-box{height:62px;width:62px;border-radius:50%;display:grid;place-items:center;text-align:center;background:#111827;color:#fff;border:5px solid #d29922;}
      .psd-psi-box strong{font-size:18px;line-height:1;}.psd-psi-box span{display:block;font-size:7px;color:#d1d5db;font-weight:800;margin-top:2px;}
      .psd-metrics{display:grid;gap:4px;min-width:0;}
      .psd-metrics div{display:flex;justify-content:space-between;gap:5px;border-bottom:1px solid #e5e7eb;padding-bottom:3px;font-size:9.5px;}
      .psd-metrics span{color:#6b7280;}.psd-metrics b{color:#111827;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .psd-spark{margin-top:auto;height:44px;}.psd-spark svg{width:100%;height:44px;display:block;}
      .psd-chart-grid{display:grid;grid-template-columns:1.14fr .86fr;gap:10px;flex:1;min-height:0;}
      .psd-section{border:1px solid #d7dde6;border-radius:14px;background:#ffffff;padding:10px;display:flex;flex-direction:column;min-height:0;overflow:hidden;}
      .psd-section h2{margin:0 0 3px;font-size:17px;color:#111827;letter-spacing:-.01em;}
      .psd-section-note{margin:0 0 8px;color:#4b5563;font-size:10.5px;line-height:1.35;}
      .psd-chart-box{border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;overflow:hidden;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:4px;}
      .psd-chart-box svg{width:100%;height:100%;display:block;max-width:100%;max-height:100%;}
      .psd-page-label{font-size:10px;color:#6b7280;font-weight:800;text-align:right;margin-top:-4px;}
      .psd-heat-rank-grid{display:grid;grid-template-columns:1.48fr .52fr;gap:10px;flex:1;min-height:0;}
      .psd-heat-legend{display:flex;flex-wrap:wrap;gap:5px;margin:2px 0 7px;}
      .psd-heat-legend span{display:inline-flex;align-items:center;gap:4px;border:1px solid #e5e7eb;border-radius:999px;padding:3px 6px;background:#f8fafc;color:#374151;font-size:8.5px;font-weight:800;}
      .psd-heat-legend i{width:8px;height:8px;border-radius:50%;display:inline-block;}
      .heatmap{display:grid!important;gap:5px!important;margin-top:4px!important;}
      .heat-row{display:grid!important;grid-template-columns:1.18in repeat(12,minmax(0,1fr))!important;gap:4px!important;align-items:center!important;}
      .heat-name{color:#111827!important;font-size:9.2px!important;font-weight:900!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
      .heat-head{color:#6b7280!important;font-size:8px!important;font-weight:900!important;text-align:center!important;}
      .heat-cell{height:21px!important;border-radius:6px!important;font-size:8.2px!important;font-weight:900!important;display:grid!important;place-items:center!important;color:#fff!important;text-shadow:none!important;box-shadow:none!important;animation:none!important;}
      .heat-cell:before{display:none!important;}
      .preview-note{margin-top:7px!important;border:1px solid #e7c36c!important;background:#fff7df!important;color:#6b4e00!important;padding:7px 9px!important;border-radius:10px!important;font-size:9px!important;line-height:1.28!important;}
      .psd-rank-list{display:grid;gap:6px;overflow:hidden;}
      .psd-rank-row{display:grid;grid-template-columns:24px 1fr 28px;gap:7px;align-items:center;border:1px solid #e5e7eb;border-radius:11px;padding:7px;background:#f8fafc;}
      .psd-rank-num{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#fff7df;color:#8a5a00;font-weight:900;font-size:10px;}
      .psd-rank-main{min-width:0;}.psd-rank-main b{display:block;color:#111827;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.psd-rank-main span{display:block;color:#4b5563;font-size:8.7px;line-height:1.25;margin-top:1px;}
      .psd-rank-score{font-size:14px;font-weight:900;color:#111827;text-align:right;}
      .psd-footer{border-top:1px solid #d7dde6;padding-top:7px;color:#4b5563;font-size:9.5px;line-height:1.35;}
      .psd-footer-links{font-size:9px;color:#374151;margin-bottom:5px;font-weight:800;}
      .psd-footer p{margin:3px 0 0;}.psd-empty{color:#6b7280;font-weight:800;padding:20px;text-align:center;}
      @media print{.psd-print-toolbar{display:none!important;} body{-webkit-print-color-adjust:exact;print-color-adjust:exact;} .psd-page{height:7.28in;} }
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

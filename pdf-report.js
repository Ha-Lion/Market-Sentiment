/*
  Public Sentiment Dash - PDF Report Engine v16
  Method: live-section capture -> 3-page landscape PDF.
  Keeps the PDF visually close to the actual page and reduces future maintenance.
*/
(function(){
  const PSD_PDF_VERSION = "17";
  const PSD_SITE_LABEL = "publicsentimentdash.com";
  const PSD_CAPTURE_WIDTH = 1600;
  const PSD_CAPTURE_HEIGHT = 1131; // A4 landscape ratio
  const PSD_CAPTURE_SCALE = 3;
  const PSD_EXPORT_IMAGE_TYPE = "PNG";

  function qs(selector, root=document){ return root.querySelector(selector); }
  function qsa(selector, root=document){ return Array.from(root.querySelectorAll(selector)); }

  function safeText(value){
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function pageName(){
    const path = window.location.pathname.toLowerCase();

    if(path === "/" || path.endsWith("/index.html") || path.endsWith("index.html")) return "Home Page";
    if(path.endsWith("/dashboard.html") || path.endsWith("dashboard.html")) return "Interactive Dashboard";
    if(path.endsWith("/sentiment-history.html") || path.endsWith("sentiment-history.html")) return "Historical Sentiment";
    if(path.endsWith("/news-articles.html") || path.endsWith("news-articles.html")) return "News & Articles";

    const active = qs(".nav a.active");
    if(active && safeText(active.textContent)) return safeText(active.textContent);

    const chip = qs(".page-chip");
    if(chip && safeText(chip.textContent)) return safeText(chip.textContent);

    const h1 = qs("h1");
    if(h1 && safeText(h1.textContent)) return safeText(h1.textContent);

    return safeText(document.title || "Public Sentiment Dash").replace(/Public Sentiment Dash|—|-/g, "").trim() || "Report";
  }

  function fileName(){
    const name = pageName().replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();
    return `${PSD_SITE_LABEL} - ${name || "Report"}.pdf`;
  }

  function loadScript(id, src){
    return new Promise((resolve, reject) => {
      if(document.getElementById(id)){
        const existing = document.getElementById(id);
        if(existing.getAttribute("data-loaded") === "1") return resolve();
        existing.addEventListener("load", () => resolve(), { once:true });
        existing.addEventListener("error", () => reject(new Error("Failed to load " + src)), { once:true });
        return;
      }

      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = true;
      script.onload = () => { script.setAttribute("data-loaded", "1"); resolve(); };
      script.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(script);
    });
  }

  async function ensureLibraries(){
    if(typeof window.html2canvas !== "function"){
      await loadScript("psdHtml2CanvasLib", "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");
    }

    if(!window.jspdf || !window.jspdf.jsPDF){
      await loadScript("psdJsPdfLib", "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
    }
  }

  function wait(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

  async function waitForFontsAndImages(root){
    try{
      if(document.fonts && document.fonts.ready) await document.fonts.ready;
    }catch(e){}

    const images = qsa("img", root);
    await Promise.all(images.map(img => new Promise(resolve => {
      if(img.complete) return resolve();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      setTimeout(resolve, 2500);
    })));
  }

  function addStyleOnce(){
    if(document.getElementById("psdPdfCaptureStyle")) return;

    const style = document.createElement("style");
    style.id = "psdPdfCaptureStyle";
    style.textContent = `
      #psdPdfCaptureRoot{
        position:absolute;
        left:-6000px;
        top:0;
        width:${PSD_CAPTURE_WIDTH}px;
        z-index:-1;
        pointer-events:none;
        opacity:1;
        font-family:Inter,Segoe UI,Arial,sans-serif;
      }
      #psdPdfCaptureRoot,
      #psdPdfCaptureRoot *{
        animation:none!important;
        transition:none!important;
        caret-color:transparent!important;
      }
      #psdPdfCaptureRoot .psd-capture-page{
        width:${PSD_CAPTURE_WIDTH}px;
        height:${PSD_CAPTURE_HEIGHT}px;
        overflow:hidden;
        box-sizing:border-box;
        padding:28px;
        color:#e6edf3;
        background:
          radial-gradient(circle at top left, rgba(210,153,34,.18), transparent 440px),
          radial-gradient(circle at top right, rgba(88,166,255,.14), transparent 430px),
          linear-gradient(180deg,#070a10 0%,#05070b 100%);
      }
      #psdPdfCaptureRoot .psd-capture-page + .psd-capture-page{margin-top:30px}
      #psdPdfCaptureRoot .psd-page-title{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:18px;
        margin:0 0 14px;
        padding:10px 14px;
        border:1px solid rgba(210,153,34,.28);
        border-radius:18px;
        background:rgba(13,17,23,.94);
        box-shadow:0 12px 28px rgba(0,0,0,.22);
      }
      #psdPdfCaptureRoot .psd-page-title strong{font-size:15px;color:#ffd780;letter-spacing:.01em;white-space:nowrap}
      #psdPdfCaptureRoot .psd-page-title span{font-size:11.5px;color:#c9d1d9;font-weight:700;text-align:right;white-space:nowrap}
      #psdPdfCaptureRoot .header{
        position:relative!important;
        top:auto!important;
        width:100%!important;
        margin:0 0 14px!important;
        border:1px solid rgba(210,153,34,.18)!important;
        border-radius:22px!important;
        box-shadow:0 16px 34px rgba(0,0,0,.24)!important;
        background:rgba(6,9,15,.96)!important;
      }
      #psdPdfCaptureRoot .header .nav a,
      #psdPdfCaptureRoot .header .social-pill{font-size:13px!important}
      #psdPdfCaptureRoot .logo{width:64px!important;height:64px!important}
      #psdPdfCaptureRoot #psdAdvertiseBanner,
      #psdPdfCaptureRoot .psd-ad-banner{
        max-width:none!important;
        margin:0 0 14px!important;
        border-radius:999px!important;
        box-shadow:0 10px 26px rgba(0,0,0,.20)!important;
      }
      #psdPdfCaptureRoot .lab-hero{
        margin:0 0 14px!important;
        padding:18px 20px!important;
        border-radius:20px!important;
      }
      #psdPdfCaptureRoot .lab-hero h1{font-size:38px!important;white-space:nowrap!important;margin-bottom:8px!important}
      #psdPdfCaptureRoot .lab-hero-main{font-size:14px!important;line-height:1.42!important;max-width:1350px!important}
      #psdPdfCaptureRoot .lab-small{font-size:12px!important;line-height:1.38!important;max-width:1350px!important;margin-bottom:0!important}
      #psdPdfCaptureRoot .lab-controls{display:none!important}
      #psdPdfCaptureRoot .lab-card-grid{
        display:grid!important;
        grid-template-columns:repeat(5,minmax(0,1fr))!important;
        gap:13px!important;
        margin:0!important;
      }
      #psdPdfCaptureRoot .sentiment-card{
        min-height:220px!important;
        padding:16px!important;
        border-radius:20px!important;
        box-shadow:0 15px 34px rgba(0,0,0,.30)!important;
      }
      #psdPdfCaptureRoot .market-name{font-size:14px!important}
      #psdPdfCaptureRoot .sentiment-badge{font-size:10px!important;padding:5px 8px!important}
      #psdPdfCaptureRoot .gauge-row{grid-template-columns:96px 1fr!important;gap:10px!important}
      #psdPdfCaptureRoot .mini-gauge{width:96px!important;height:96px!important}
      #psdPdfCaptureRoot .mini-gauge-inner{width:68px!important;height:68px!important}
      #psdPdfCaptureRoot .psi-big{font-size:25px!important}
      #psdPdfCaptureRoot .metric-line{font-size:11px!important;padding-bottom:5px!important}
      #psdPdfCaptureRoot .sparkline{height:48px!important;margin-top:12px!important}
      #psdPdfCaptureRoot .chart-grid{
        display:grid!important;
        grid-template-columns:minmax(0,1.45fr) minmax(365px,.55fr)!important;
        gap:18px!important;
        margin:0!important;
      }
      #psdPdfCaptureRoot .panel,
      #psdPdfCaptureRoot .lab-panel{
        border-radius:22px!important;
        padding:18px!important;
        margin:0!important;
        box-shadow:0 16px 34px rgba(0,0,0,.28)!important;
        background:radial-gradient(circle at top right,rgba(210,153,34,.16),transparent 14rem),linear-gradient(180deg,#101826,#0d131d)!important;
      }
      #psdPdfCaptureRoot .panel h2,
      #psdPdfCaptureRoot .lab-panel h2{font-size:23px!important;margin-bottom:6px!important;color:#fff!important}
      #psdPdfCaptureRoot .panel-kicker{font-size:12px!important;line-height:1.38!important;color:#c9d1d9!important}
      #psdPdfCaptureRoot .pill-row{display:none!important}
      #psdPdfCaptureRoot .skyline-wrap,
      #psdPdfCaptureRoot .radar-wrap{height:690px!important;border-radius:20px!important}
      #psdPdfCaptureRoot #skylineChart,
      #psdPdfCaptureRoot #radarChart{height:100%!important;max-height:none!important}
      #psdPdfCaptureRoot .preview-note{font-size:11px!important;line-height:1.35!important;margin-top:10px!important;padding:10px 12px!important}
      #psdPdfCaptureRoot .radar-legend span{font-size:10px!important;padding:5px 8px!important}
      #psdPdfCaptureRoot .heat-legend{gap:7px!important;margin:8px 0!important}
      #psdPdfCaptureRoot .heat-legend span{font-size:10px!important;padding:5px 8px!important}
      #psdPdfCaptureRoot .heatmap{gap:8px!important;margin-top:12px!important}
      #psdPdfCaptureRoot .heat-row{grid-template-columns:162px repeat(12,minmax(0,1fr))!important;gap:6px!important}
      #psdPdfCaptureRoot .heat-name{font-size:12px!important}
      #psdPdfCaptureRoot .heat-head{font-size:10px!important}
      #psdPdfCaptureRoot .heat-cell{height:31px!important;font-size:10px!important;border-radius:8px!important}
      #psdPdfCaptureRoot .ranking-list{gap:8px!important}
      #psdPdfCaptureRoot .rank-item{padding:10px!important;border-radius:14px!important;grid-template-columns:30px minmax(0,1fr) auto!important;gap:10px!important}
      #psdPdfCaptureRoot .rank-num{width:26px!important;height:26px!important;font-size:11px!important}
      #psdPdfCaptureRoot .rank-title{font-size:13px!important}
      #psdPdfCaptureRoot .rank-meta{font-size:10.5px!important;line-height:1.25!important}
      #psdPdfCaptureRoot .rank-score{font-size:17px!important}
      #psdPdfCaptureRoot .footer{
        margin:14px 0 0!important;
        padding:14px 0 0!important;
        border-top:1px solid rgba(210,153,34,.18)!important;
        font-size:11px!important;
      }
      #psdPdfCaptureRoot .footer-links{gap:9px!important;margin-bottom:8px!important}
      #psdPdfCaptureRoot .footer-links a{font-size:11px!important;padding:3px 4px!important}
      #psdPdfCaptureRoot .legal{font-size:11px!important;line-height:1.34!important;padding:9px 11px!important;margin-top:8px!important;border-radius:12px!important}
      #psdPdfCaptureRoot .footer p{font-size:10.5px!important;margin:7px 0 0!important;line-height:1.25!important}

      /* PDF capture fixes: live SVG lines use draw animations; disable animation must also reset dash offsets. */
      #psdPdfCaptureRoot .skyline-line,
      #psdPdfCaptureRoot .spark-path,
      #psdPdfCaptureRoot svg path,
      #psdPdfCaptureRoot svg polyline{
        stroke-dasharray:none!important;
        stroke-dashoffset:0!important;
        opacity:1!important;
        visibility:visible!important;
      }
      #psdPdfCaptureRoot .skyline-line{stroke-width:4.8!important;filter:drop-shadow(0 0 8px currentColor)!important}
      #psdPdfCaptureRoot .spark-path{stroke-width:3.2!important;filter:drop-shadow(0 0 5px currentColor)!important}
      #psdPdfCaptureRoot .radar-poly{opacity:.62!important;visibility:visible!important}
      #psdPdfCaptureRoot .radar-wrap text,
      #psdPdfCaptureRoot .skyline-wrap text{
        opacity:1!important;
        fill:#e6edf3!important;
      }
      #psdPdfCaptureRoot .chart-watermark{opacity:.16!important;color:rgba(255,255,255,.16)!important}
      #psdPdfCaptureRoot .psd-final-page{
        display:flex!important;
        flex-direction:column!important;
      }
      #psdPdfCaptureRoot .psd-final-page > .chart-grid{
        flex:1 1 auto!important;
        min-height:0!important;
      }
      #psdPdfCaptureRoot .psd-pdf-footer{
        margin-top:auto!important;
        padding:11px 13px!important;
        border:1px solid rgba(210,153,34,.24)!important;
        border-radius:14px!important;
        background:rgba(13,17,23,.94)!important;
        box-shadow:0 10px 24px rgba(0,0,0,.22)!important;
      }
      #psdPdfCaptureRoot .psd-pdf-footer .footer-links{
        gap:10px!important;
        margin-bottom:7px!important;
      }
      #psdPdfCaptureRoot .psd-pdf-footer .footer-links a{
        color:#d8dee9!important;
        font-size:11.5px!important;
        font-weight:700!important;
      }
      #psdPdfCaptureRoot .psd-pdf-footer .legal{
        color:#f0d59a!important;
        background:rgba(248,81,73,.08)!important;
        border-color:rgba(248,81,73,.24)!important;
      }

      /* Historical Sentiment PDF support */
      #psdPdfCaptureRoot .page{
        max-width:none!important;
        width:100%!important;
        margin:0!important;
        padding:0!important;
      }
      #psdPdfCaptureRoot .history-dashboard-hero{
        display:block!important;
        margin:0 0 12px!important;
        padding:16px 18px!important;
        border-radius:20px!important;
        background:rgba(13,17,23,.94)!important;
      }
      #psdPdfCaptureRoot .history-dashboard-hero h1{
        font-size:34px!important;
        line-height:1.06!important;
        margin:0 0 8px!important;
        white-space:nowrap!important;
      }
      #psdPdfCaptureRoot .history-kicker{
        margin-bottom:8px!important;
        padding:6px 11px!important;
        font-size:11px!important;
      }
      #psdPdfCaptureRoot .history-lead{
        font-size:13px!important;
        line-height:1.38!important;
        max-width:1380px!important;
      }
      #psdPdfCaptureRoot .dash-stage-shell{
        margin:0!important;
        padding:8px!important;
        border-radius:24px!important;
        box-shadow:0 18px 42px rgba(0,0,0,.30)!important;
      }
      #psdPdfCaptureRoot .dash-stage{
        height:640px!important;
        min-height:0!important;
        aspect-ratio:auto!important;
        border-radius:20px!important;
      }
      #psdPdfCaptureRoot .dash-layout{
        position:absolute!important;
        inset:20px!important;
        grid-template-columns:132px repeat(24,minmax(0,1fr))!important;
        grid-template-rows:1fr 1fr 1fr!important;
        gap:12px!important;
      }
      #psdPdfCaptureRoot .dash-side{
        padding-top:120px!important;
        gap:7px!important;
      }
      #psdPdfCaptureRoot .side-pill{
        height:31px!important;
        font-size:9.5px!important;
      }
      #psdPdfCaptureRoot .side-note{
        font-size:8.5px!important;
      }
      #psdPdfCaptureRoot .dash-card{
        border-radius:10px!important;
      }
      #psdPdfCaptureRoot .card-head{
        height:30px!important;
        padding:0 11px!important;
      }
      #psdPdfCaptureRoot .card-title{
        font-size:11px!important;
      }
      #psdPdfCaptureRoot .card-icons,
      #psdPdfCaptureRoot .mini-tabs,
      #psdPdfCaptureRoot .chart-legend,
      #psdPdfCaptureRoot .driver-meta,
      #psdPdfCaptureRoot .bias-legend{
        font-size:8.5px!important;
      }
      #psdPdfCaptureRoot .card-body{
        inset:30px 10px 10px 10px!important;
      }
      #psdPdfCaptureRoot .bias-body{
        inset:54px 10px 10px 10px!important;
      }
      #psdPdfCaptureRoot .metric-big{
        top:38px!important;
        left:12px!important;
        font-size:28px!important;
      }
      #psdPdfCaptureRoot .metric-caption{
        top:47px!important;
        left:86px!important;
        font-size:8.5px!important;
      }
      #psdPdfCaptureRoot .driver-list{
        inset:36px 11px 10px 11px!important;
        gap:5px!important;
      }
      #psdPdfCaptureRoot .driver-item{
        font-size:8.5px!important;
        line-height:1.18!important;
        gap:6px!important;
        padding-bottom:3px!important;
      }
      #psdPdfCaptureRoot .driver-badge{
        font-size:7px!important;
        padding:1px 5px!important;
      }
      #psdPdfCaptureRoot .stats-strip{
        display:grid!important;
        grid-template-columns:repeat(6,minmax(0,1fr))!important;
        gap:12px!important;
        margin:0 0 14px!important;
      }
      #psdPdfCaptureRoot .stat-tile{
        border-radius:14px!important;
        padding:12px!important;
        min-height:92px!important;
      }
      #psdPdfCaptureRoot .stat-label{font-size:11px!important;margin-bottom:5px!important}
      #psdPdfCaptureRoot .stat-value{font-size:22px!important}
      #psdPdfCaptureRoot .stat-note{font-size:10px!important;line-height:1.25!important}
      #psdPdfCaptureRoot .section.panel{
        padding:18px!important;
        border-radius:22px!important;
        margin:0!important;
      }
      #psdPdfCaptureRoot .section.panel h2{
        font-size:25px!important;
        margin-bottom:6px!important;
      }
      #psdPdfCaptureRoot .section.panel .muted{
        font-size:12px!important;
        line-height:1.35!important;
        margin-bottom:10px!important;
      }
      #psdPdfCaptureRoot .history-table-wrap{
        margin-top:8px!important;
        border-radius:16px!important;
      }
      #psdPdfCaptureRoot .history-table{
        font-size:11px!important;
      }
      #psdPdfCaptureRoot .history-table th,
      #psdPdfCaptureRoot .history-table td{
        padding:8px 10px!important;
      }
      #psdPdfCaptureRoot .bias-pill{
        font-size:9px!important;
        padding:3px 7px!important;
      }
      #psdPdfCaptureRoot .psd-history-record-page{
        display:flex!important;
        flex-direction:column!important;
      }
      #psdPdfCaptureRoot .psd-history-page1 .header{
        display:none!important;
      }
      #psdPdfCaptureRoot .psd-history-page1 .psd-page-title,
      #psdPdfCaptureRoot .psd-history-record-page .psd-page-title{
        min-height:42px!important;
        padding:8px 13px!important;
        margin-bottom:12px!important;
      }
      #psdPdfCaptureRoot .psd-history-page1 .psd-page-title strong,
      #psdPdfCaptureRoot .psd-history-record-page .psd-page-title strong{
        font-size:13px!important;
      }
      #psdPdfCaptureRoot .psd-history-page1 .psd-page-title span,
      #psdPdfCaptureRoot .psd-history-record-page .psd-page-title span{
        font-size:10.5px!important;
      }
      #psdPdfCaptureRoot .psd-history-page1 #psdAdvertiseBanner,
      #psdPdfCaptureRoot .psd-history-page1 .psd-ad-banner{
        margin:0 0 12px!important;
        min-height:34px!important;
        padding:9px 13px!important;
        font-size:12px!important;
      }
      #psdPdfCaptureRoot .psd-history-page1 .history-dashboard-hero{
        margin:0 0 12px!important;
        padding:14px 17px!important;
      }
      #psdPdfCaptureRoot .psd-history-page1 .history-dashboard-hero h1{
        font-size:31px!important;
      }
      #psdPdfCaptureRoot .psd-history-page1 .history-lead{
        font-size:12.5px!important;
      }
      #psdPdfCaptureRoot .psd-history-page1 .dash-stage-shell{
        padding:8px!important;
      }
      #psdPdfCaptureRoot .psd-history-page1 .dash-stage{
        height:790px!important;
      }
      #psdPdfCaptureRoot .psd-history-page1 .dash-layout{
        inset:22px!important;
        gap:13px!important;
      }
      #psdPdfCaptureRoot .psd-history-record-page .section.panel{
        flex:1 1 auto!important;
        min-height:0!important;
        overflow:hidden!important;
      }
      #psdPdfCaptureRoot .psd-history-record-page .history-table-wrap{
        max-height:650px!important;
        overflow:hidden!important;
      }
      #psdPdfCaptureRoot .psd-history-record-page .history-table{
        font-size:10.5px!important;
      }
      #psdPdfCaptureRoot .psd-history-record-page .history-table th,
      #psdPdfCaptureRoot .psd-history-record-page .history-table td{
        padding:7px 9px!important;
      }
      #psdPdfCaptureRoot .psd-history-record-page .psd-pdf-footer{
        margin-top:12px!important;
        flex:0 0 auto!important;
      }

      /* Home page PDF support */
      #psdPdfCaptureRoot .psd-home-page .header{
        display:none!important;
      }
      #psdPdfCaptureRoot .psd-home-page #psdAdvertiseBanner,
      #psdPdfCaptureRoot .psd-home-page .psd-ad-banner{
        margin:0 0 14px!important;
        min-height:36px!important;
        padding:9px 14px!important;
        font-size:12px!important;
      }
      #psdPdfCaptureRoot .home-layout{
        display:block!important;
        width:100%!important;
      }
      #psdPdfCaptureRoot .hero{
        display:grid!important;
        grid-template-columns:minmax(0,1.25fr) minmax(360px,.75fr)!important;
        gap:18px!important;
        margin:0!important;
      }
      #psdPdfCaptureRoot .hero-copy{
        padding:22px!important;
        min-height:0!important;
      }
      #psdPdfCaptureRoot .hero-copy h1{
        font-size:42px!important;
        line-height:1.06!important;
        margin-bottom:12px!important;
      }
      #psdPdfCaptureRoot .hero-copy p{
        font-size:13.5px!important;
        line-height:1.48!important;
        margin:0 0 10px!important;
      }
      #psdPdfCaptureRoot .hero-points{
        display:grid!important;
        grid-template-columns:repeat(3,minmax(0,1fr))!important;
        gap:10px!important;
        margin-top:14px!important;
      }
      #psdPdfCaptureRoot .hero-point{
        padding:12px!important;
        border-radius:14px!important;
      }
      #psdPdfCaptureRoot .hero-point strong{
        font-size:13px!important;
        margin-bottom:5px!important;
      }
      #psdPdfCaptureRoot .hero-point span{
        font-size:11.5px!important;
        line-height:1.35!important;
      }
      #psdPdfCaptureRoot .score-panel{
        padding:20px!important;
      }
      #psdPdfCaptureRoot .score-ring{
        width:210px!important;
        height:210px!important;
        margin:7px auto 13px!important;
      }
      #psdPdfCaptureRoot .score-inner{
        width:156px!important;
        height:156px!important;
      }
      #psdPdfCaptureRoot .score-number{
        font-size:48px!important;
      }
      #psdPdfCaptureRoot .score-word{
        font-size:17px!important;
      }
      #psdPdfCaptureRoot .score-desc{
        font-size:12px!important;
        line-height:1.4!important;
      }
      #psdPdfCaptureRoot .psd-home-page2{
        display:grid!important;
        grid-template-rows:auto 1fr!important;
      }
      #psdPdfCaptureRoot .psd-home-combo{
        display:grid!important;
        grid-template-columns:320px minmax(0,1fr)!important;
        gap:16px!important;
        min-height:0!important;
      }
      #psdPdfCaptureRoot .instrument-rail{
        position:relative!important;
        top:auto!important;
        padding:14px!important;
        margin:0!important;
        height:100%!important;
        overflow:hidden!important;
      }
      #psdPdfCaptureRoot .instrument-rail h2{
        font-size:18px!important;
        margin-bottom:5px!important;
      }
      #psdPdfCaptureRoot .instrument-rail .muted{
        font-size:11px!important;
        line-height:1.35!important;
        margin-bottom:8px!important;
      }
      #psdPdfCaptureRoot .rail-waterfall{
        height:820px!important;
        margin-top:8px!important;
      }
      #psdPdfCaptureRoot .rail-track{
        transform:none!important;
        animation:none!important;
        gap:6px!important;
      }
      #psdPdfCaptureRoot .rail-item{
        padding:6px 8px!important;
        border-radius:11px!important;
        grid-template-columns:24px minmax(0,1fr) auto!important;
        gap:7px!important;
      }
      #psdPdfCaptureRoot .rail-icon{
        width:21px!important;
        height:21px!important;
        font-size:12px!important;
      }
      #psdPdfCaptureRoot .rail-name{
        font-size:11px!important;
      }
      #psdPdfCaptureRoot .rail-sub,
      #psdPdfCaptureRoot .rail-state{
        font-size:9px!important;
      }
      #psdPdfCaptureRoot .psd-home-main-stack{
        display:grid!important;
        gap:14px!important;
        min-height:0!important;
      }
      #psdPdfCaptureRoot .sources-layout{
        display:grid!important;
        grid-template-columns:280px minmax(0,1fr)!important;
        gap:16px!important;
      }
      #psdPdfCaptureRoot .sources-layout h2{
        font-size:24px!important;
      }
      #psdPdfCaptureRoot .sources-layout p{
        font-size:12px!important;
        line-height:1.42!important;
      }
      #psdPdfCaptureRoot .sources-waterfall{
        height:370px!important;
        min-height:370px!important;
      }
      #psdPdfCaptureRoot .waterfall-track{
        transform:none!important;
        animation:none!important;
        gap:8px!important;
      }
      #psdPdfCaptureRoot .source-chip{
        min-height:42px!important;
        padding:8px 10px!important;
        border-radius:12px!important;
      }
      #psdPdfCaptureRoot .source-chip img{
        width:20px!important;
        height:20px!important;
      }
      #psdPdfCaptureRoot .source-chip-name{
        font-size:12px!important;
      }
      #psdPdfCaptureRoot .summary-lines{
        gap:8px!important;
      }
      #psdPdfCaptureRoot .summary-line{
        padding:10px 12px!important;
        font-size:12px!important;
        line-height:1.35!important;
      }
      #psdPdfCaptureRoot .focus-grid{
        display:grid!important;
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:10px!important;
      }
      #psdPdfCaptureRoot .focus-card{
        min-height:116px!important;
      }
      #psdPdfCaptureRoot .mini-card{
        padding:12px!important;
        border-radius:13px!important;
      }
      #psdPdfCaptureRoot .mini-title{
        font-size:13px!important;
        margin-bottom:6px!important;
      }
      #psdPdfCaptureRoot .mini-meta,
      #psdPdfCaptureRoot .mini-headline,
      #psdPdfCaptureRoot .focus-open{
        font-size:10.5px!important;
        line-height:1.3!important;
      }
      #psdPdfCaptureRoot .action-grid{
        display:grid!important;
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:10px!important;
        margin-top:10px!important;
      }
      #psdPdfCaptureRoot .action-card{
        padding:14px!important;
        border-radius:14px!important;
      }
      #psdPdfCaptureRoot .action-label{
        font-size:9.5px!important;
        padding:5px 8px!important;
        margin-bottom:8px!important;
      }
      #psdPdfCaptureRoot .action-card h3{
        font-size:17px!important;
        margin-bottom:6px!important;
      }
      #psdPdfCaptureRoot .action-card p{
        font-size:11px!important;
        line-height:1.34!important;
        margin-bottom:8px!important;
      }
      #psdPdfCaptureRoot .action-cta{
        font-size:11px!important;
      }

      /* Home PDF v11 requested layout */
      #psdPdfCaptureRoot .psd-home-page1,
      #psdPdfCaptureRoot .psd-home-page2,
      #psdPdfCaptureRoot .psd-home-page3{
        display:flex!important;
        flex-direction:column!important;
      }
      #psdPdfCaptureRoot .psd-home-page1 .header,
      #psdPdfCaptureRoot .psd-home-page3 .header{
        display:grid!important;
        grid-template-columns:auto 1fr auto!important;
        padding:10px 18px!important;
        margin:0 0 12px!important;
        min-height:88px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1 .header .nav,
      #psdPdfCaptureRoot .psd-home-page3 .header .nav{
        gap:7px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1 .header .nav a,
      #psdPdfCaptureRoot .psd-home-page3 .header .nav a{
        font-size:12px!important;
        padding:5px 6px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1 .brand-stamp,
      #psdPdfCaptureRoot .psd-home-page3 .brand-stamp{
        font-size:11px!important;
        padding:7px 11px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1 .site-subtitle,
      #psdPdfCaptureRoot .psd-home-page3 .site-subtitle{
        font-size:10.5px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1 .header-pill,
      #psdPdfCaptureRoot .psd-home-page3 .header-pill{
        font-size:11px!important;
        padding:7px 11px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1 #psdAdvertiseBanner,
      #psdPdfCaptureRoot .psd-home-page1 .psd-ad-banner,
      #psdPdfCaptureRoot .psd-home-page3 #psdAdvertiseBanner,
      #psdPdfCaptureRoot .psd-home-page3 .psd-ad-banner{
        margin:0 0 12px!important;
        min-height:34px!important;
        padding:9px 14px!important;
        font-size:12px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1 .hero{
        grid-template-columns:minmax(0,1.25fr) minmax(340px,.75fr)!important;
        gap:15px!important;
        flex:1 1 auto!important;
        min-height:0!important;
        align-items:stretch!important;
      }
      #psdPdfCaptureRoot .psd-home-page1-main{
        display:grid!important;
        grid-template-columns:270px minmax(0,1fr)!important;
        gap:14px!important;
        flex:1 1 auto!important;
        min-height:0!important;
        overflow:hidden!important;
      }
      #psdPdfCaptureRoot .psd-home-page1-main .instrument-rail{
        height:auto!important;
        min-height:0!important;
        padding:12px!important;
        overflow:hidden!important;
      }
      #psdPdfCaptureRoot .psd-home-page1-main .instrument-rail .page-chip{
        font-size:10px!important;
        padding:6px 9px!important;
        margin-bottom:7px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1-main .instrument-rail h2{
        font-size:17px!important;
        margin-bottom:4px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1-main .instrument-rail .muted{
        font-size:10px!important;
        line-height:1.25!important;
        margin:0 0 6px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1-main .rail-waterfall{
        height:650px!important;
        margin-top:6px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1-main .rail-track{
        gap:5px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1-main .rail-item{
        padding:5px 7px!important;
        border-radius:10px!important;
        grid-template-columns:22px minmax(0,1fr) auto!important;
        gap:6px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1-main .rail-icon{
        width:20px!important;
        height:20px!important;
        font-size:11px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1-main .rail-name{
        font-size:10px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1-main .rail-sub,
      #psdPdfCaptureRoot .psd-home-page1-main .rail-state{
        font-size:8.5px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1-right{
        display:flex!important;
        flex-direction:column!important;
        min-height:0!important;
        overflow:hidden!important;
      }
      #psdPdfCaptureRoot .psd-home-page1 .hero-copy{
        padding:19px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1 .hero-copy h1{
        font-size:38px!important;
        line-height:1.06!important;
        margin-bottom:10px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1 .hero-copy p{
        font-size:12.8px!important;
        line-height:1.42!important;
      }
      #psdPdfCaptureRoot .psd-home-page1 .hero-points{
        gap:9px!important;
        margin-top:12px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1 .score-panel{
        padding:18px!important;
      }
      #psdPdfCaptureRoot .psd-home-page1 .score-panel{
        display:flex!important;
        flex-direction:column!important;
        justify-content:center!important;
        align-items:center!important;
        min-height:0!important;
      }
      #psdPdfCaptureRoot .psd-home-page1 .score-ring{
        width:300px!important;
        height:300px!important;
        margin:10px auto 16px!important;
        background:transparent!important;
        box-shadow:none!important;
      }
      #psdPdfCaptureRoot .psd-home-page1 .score-inner{
        width:220px!important;
        height:220px!important;
      }
      #psdPdfCaptureRoot .psd-home-score-svg{
        width:300px!important;
        height:300px!important;
        display:block!important;
        overflow:visible!important;
      }
      #psdPdfCaptureRoot .psd-home-score-svg text{
        font-family:Inter,Segoe UI,Arial,sans-serif!important;
        fill:#e6edf3!important;
        opacity:1!important;
      }
      #psdPdfCaptureRoot .psd-home-widget-row{
        display:flex!important;
        align-items:center!important;
        gap:14px!important;
        margin:12px 0 0!important;
      }
      #psdPdfCaptureRoot .psd-home-widget-row .psd-widget-print-sample{
        width:62px!important;
        height:86px!important;
        border-radius:18px!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        justify-content:center!important;
        gap:4px!important;
        border:1px solid rgba(210,153,34,.45)!important;
        background:linear-gradient(180deg,rgba(210,153,34,.22),rgba(13,17,23,.96))!important;
        color:#ffd780!important;
        box-shadow:0 0 24px rgba(210,153,34,.18)!important;
        font-family:Inter,Segoe UI,Arial,sans-serif!important;
      }
      #psdPdfCaptureRoot .psd-home-widget-row .psd-widget-icon{
        font-size:21px!important;
        line-height:1!important;
      }
      #psdPdfCaptureRoot .psd-home-widget-row .psd-widget-text{
        font-size:12px!important;
        line-height:1.05!important;
        font-weight:700!important;
        text-align:center!important;
        color:#ffe7a8!important;
      }
      #psdPdfCaptureRoot .psd-home-page1 .psd-pdf-footer,
      #psdPdfCaptureRoot .psd-home-page2 .psd-pdf-footer,
      #psdPdfCaptureRoot .psd-home-page3 .psd-pdf-footer{
        margin-top:auto!important;
        flex:0 0 auto!important;
      }
      #psdPdfCaptureRoot .psd-home-page2 .psd-home-page2-stack{
        display:grid!important;
        grid-template-columns:1fr!important;
        gap:14px!important;
        flex:1 1 auto!important;
        min-height:0!important;
      }
      #psdPdfCaptureRoot .psd-home-page2 .section.panel{
        margin:0!important;
        overflow:hidden!important;
      }
      #psdPdfCaptureRoot .psd-home-page2 .summary-line{
        font-size:13px!important;
        line-height:1.42!important;
        padding:12px 14px!important;
      }
      #psdPdfCaptureRoot .psd-home-page2 .focus-grid{
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
      }
      #psdPdfCaptureRoot .psd-home-page3 .section.panel{
        flex:1 1 auto!important;
        min-height:0!important;
        margin:0!important;
      }
      #psdPdfCaptureRoot .psd-home-page3 .action-grid{
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:11px!important;
      }




      /* News & Articles PDF support */
      #psdPdfCaptureRoot .psd-news-page{
        display:flex!important;
        flex-direction:column!important;
      }
      #psdPdfCaptureRoot .psd-news-page .header{
        flex:0 0 auto!important;
      }
      #psdPdfCaptureRoot .psd-news-page1 .panel:first-of-type,
      #psdPdfCaptureRoot .psd-news-hero{
        margin:0 0 14px!important;
        padding:20px 22px!important;
        border-radius:22px!important;
        background:radial-gradient(circle at top right,rgba(210,153,34,.16),transparent 14rem),linear-gradient(180deg,#101826,#0d131d)!important;
        box-shadow:0 16px 34px rgba(0,0,0,.28)!important;
      }
      #psdPdfCaptureRoot .psd-news-page1 .psd-news-hero h1,
      #psdPdfCaptureRoot .psd-news-page1 .psd-news-hero h2,
      #psdPdfCaptureRoot .psd-news-page1 .panel:first-of-type h1,
      #psdPdfCaptureRoot .psd-news-page1 .panel:first-of-type h2{
        font-size:34px!important;
        line-height:1.08!important;
        margin:0 0 8px!important;
        color:#fff!important;
      }
      #psdPdfCaptureRoot .psd-news-page1 .psd-news-hero p,
      #psdPdfCaptureRoot .psd-news-page1 .panel:first-of-type p{
        font-size:12.5px!important;
        line-height:1.4!important;
        margin:0 0 8px!important;
      }
      #psdPdfCaptureRoot .psd-news-page1 input,
      #psdPdfCaptureRoot .psd-news-page1 select,
      #psdPdfCaptureRoot .psd-news-page1 button,
      #psdPdfCaptureRoot .psd-news-page1 .search-actions,
      #psdPdfCaptureRoot .psd-news-page1 .filters,
      #psdPdfCaptureRoot .psd-news-page1 .filter-actions{
        display:none!important;
      }
      #psdPdfCaptureRoot .psd-news-top-title{
        color:#ffd780;
        font-size:16px;
        font-weight:800;
        margin:0 0 10px;
      }
      #psdPdfCaptureRoot .psd-news-top-grid{
        display:grid!important;
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:13px!important;
        margin:0 0 14px!important;
      }
      #psdPdfCaptureRoot .psd-news-top-grid > *{
        min-height:205px!important;
        max-height:245px!important;
        overflow:hidden!important;
        border-radius:18px!important;
        background:radial-gradient(circle at top right,rgba(210,153,34,.14),transparent 12rem),linear-gradient(180deg,#111821,#0d131d)!important;
        border:1px solid rgba(210,153,34,.18)!important;
        box-shadow:0 14px 32px rgba(0,0,0,.25)!important;
      }
      #psdPdfCaptureRoot .psd-news-top-grid h2,
      #psdPdfCaptureRoot .psd-news-top-grid h3,
      #psdPdfCaptureRoot .psd-news-top-grid h4{
        font-size:18px!important;
        line-height:1.22!important;
        margin:6px 0!important;
        color:#fff!important;
      }
      #psdPdfCaptureRoot .psd-news-top-grid p,
      #psdPdfCaptureRoot .psd-news-top-grid div,
      #psdPdfCaptureRoot .psd-news-top-grid span,
      #psdPdfCaptureRoot .psd-news-top-grid a{
        font-size:11px!important;
        line-height:1.28!important;
      }

      #psdPdfCaptureRoot .psd-news-top-grid .headline-card{
        display:flex!important;
        flex-direction:column!important;
        padding:15px!important;
        min-height:230px!important;
        max-height:260px!important;
      }
      #psdPdfCaptureRoot .psd-news-top-grid .headline-source-row{
        margin-bottom:9px!important;
        gap:8px!important;
      }
      #psdPdfCaptureRoot .psd-news-top-grid .headline-source-icon{
        width:20px!important;
        height:20px!important;
      }
      #psdPdfCaptureRoot .psd-news-top-grid .headline-source-name{
        font-size:12px!important;
      }
      #psdPdfCaptureRoot .psd-news-top-grid .headline-top{
        gap:5px!important;
      }
      #psdPdfCaptureRoot .psd-news-top-grid .tag,
      #psdPdfCaptureRoot .psd-news-top-grid .impact-tag,
      #psdPdfCaptureRoot .psd-news-top-grid .tech-tag{
        font-size:9.5px!important;
        padding:4px 7px!important;
      }
      #psdPdfCaptureRoot .psd-news-top-grid .headline-title{
        font-size:16px!important;
        line-height:1.30!important;
        margin:5px 0!important;
      }
      #psdPdfCaptureRoot .psd-news-top-grid .headline-meta{
        font-size:10px!important;
        line-height:1.35!important;
      }
      #psdPdfCaptureRoot .psd-news-top-grid .headline-open{
        font-size:10.5px!important;
      }

      #psdPdfCaptureRoot .psd-news-widget-row{
        margin-top:auto!important;
        align-self:flex-start!important;
      }
      #psdPdfCaptureRoot .psd-news-ad-page .psd-news-ad-fill,
      #psdPdfCaptureRoot .psd-news-footer-page .psd-news-ad-fill{
        flex:1 1 auto!important;
        min-height:0!important;
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        border:1px dashed rgba(210,153,34,.22)!important;
        border-radius:22px!important;
        background:radial-gradient(circle at center,rgba(210,153,34,.10),transparent 360px),rgba(13,17,23,.35)!important;
        color:#c9d1d9!important;
        font-size:18px!important;
        font-weight:700!important;
        text-align:center!important;
      }
      #psdPdfCaptureRoot .psd-news-footer-page .psd-pdf-footer{
        margin-top:auto!important;
      }

    `;
    document.head.appendChild(style);
  }

  function cloneElement(selectorOrEl){
    const el = typeof selectorOrEl === "string" ? qs(selectorOrEl) : selectorOrEl;
    if(!el) return null;

    const clone = el.cloneNode(true);

    // Preserve live canvas charts. cloneNode does not copy drawn canvas pixels.
    const originalCanvases = qsa("canvas", el);
    const clonedCanvases = qsa("canvas", clone);
    originalCanvases.forEach((canvas, idx) => {
      const target = clonedCanvases[idx];
      if(!target) return;
      try{
        const rect = canvas.getBoundingClientRect();
        const img = document.createElement("img");
        img.src = canvas.toDataURL("image/png");
        img.className = canvas.className || "";
        img.alt = canvas.getAttribute("aria-label") || "Chart";
        img.style.display = "block";
        img.style.width = rect.width ? rect.width + "px" : "100%";
        img.style.height = rect.height ? rect.height + "px" : "100%";
        img.style.maxWidth = "100%";
        img.style.objectFit = "fill";
        target.replaceWith(img);
      }catch(error){
        console.warn("PDF canvas capture skipped", error);
      }
    });

    clone.removeAttribute("id");
    qsa("[id]", clone).forEach(x => x.removeAttribute("id"));
    qsa("script", clone).forEach(x => x.remove());
    return clone;
  }

  function sectionTitle(text, sub){
    const bar = document.createElement("div");
    bar.className = "psd-page-title";
    const reportTitle = `${PSD_SITE_LABEL} - ${pageName()}`;
    const sectionLabel = [text, sub].filter(Boolean).join(" • ");
    bar.innerHTML = `<strong>${reportTitle}</strong><span>${sectionLabel}</span>`;
    return bar;
  }

  function createPage(title, sub){
    const page = document.createElement("div");
    page.className = "psd-capture-page";
    page.appendChild(sectionTitle(title, sub));
    return page;
  }

  function buildDashboardPages(root){
    const now = new Date().toLocaleString();

    const page1 = createPage("Summary", `Generated ${now}`);
    [".header", "#psdAdvertiseBanner", ".lab-hero", "#snapshotCards"].forEach(sel => {
      const clone = cloneElement(sel);
      if(clone) page1.appendChild(clone);
    });

    const grids = qsa(".chart-grid");

    const page2 = createPage("Charts", "Sentiment Skyline + Radar Comparison");
    const grid1 = cloneElement(grids[0]);
    if(grid1) page2.appendChild(grid1);

    const page3 = createPage("Heatwave & Ranking", "Sentiment Heatwave + Strength Ranking + Disclaimer");
    page3.classList.add("psd-final-page");
    const grid2 = cloneElement(grids[1]);
    if(grid2) page3.appendChild(grid2);
    const footer = cloneElement(".footer");
    if(footer){
      footer.classList.add("psd-pdf-footer");
      page3.appendChild(footer);
    }

    root.appendChild(page1);
    root.appendChild(page2);
    root.appendChild(page3);
  }

  function buildHistoricalPages(root){
    const now = new Date().toLocaleString();

    const page1 = createPage("Historical Sentiment", `Generated ${now}`);
    page1.classList.add("psd-history-page1");
    ["#psdAdvertiseBanner", ".history-dashboard-hero", ".dash-stage-shell"].forEach(sel => {
      const clone = cloneElement(sel);
      if(clone) page1.appendChild(clone);
    });

    const page2 = createPage("Historical Sentiment", "Stats + Filtered Historical Records + Disclaimer");
    page2.classList.add("psd-history-record-page");
    [".stats-strip", ".section.panel"].forEach(sel => {
      const clone = cloneElement(sel);
      if(clone){
        if(clone.matches && clone.matches(".section.panel")){
          const rows = qsa("tbody tr", clone);
          rows.forEach((row, idx) => { if(idx > 11) row.remove(); });
        }
        page2.appendChild(clone);
      }
    });
    const footer = cloneElement(".footer");
    if(footer){
      footer.classList.add("psd-pdf-footer");
      page2.appendChild(footer);
    }

    root.appendChild(page1);
    root.appendChild(page2);
  }




  function enhanceHomeHeroClone(heroClone){
    if(!heroClone) return heroClone;

    const scoreText = safeText(qs("#scoreNumber")?.textContent || "50");
    const score = Math.max(0, Math.min(100, parseInt(scoreText, 10) || 50));
    const label = safeText(qs("#scoreWord")?.textContent || "Mixed/Neutral");
    const color = score >= 70 ? "#3fb950" : score <= 30 ? "#f85149" : "#d29922";
    const radius = 112;
    const stroke = 24;
    const circumference = 2 * Math.PI * radius;
    const dash = (score / 100) * circumference;

    const ring = qs(".score-ring", heroClone);
    if(ring){
      ring.innerHTML = `
        <svg class="psd-home-score-svg" viewBox="0 0 300 300" role="img" aria-label="Global Public Sentiment Index ${score}">
          <defs>
            <filter id="psdScoreGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur"></feGaussianBlur>
              <feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge>
            </filter>
          </defs>
          <circle cx="150" cy="150" r="${radius}" fill="#0d1117" stroke="rgba(255,255,255,.12)" stroke-width="${stroke}"></circle>
          <circle cx="150" cy="150" r="${radius}" fill="none" stroke="#26313f" stroke-width="${stroke}" stroke-linecap="round"></circle>
          <circle cx="150" cy="150" r="${radius}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
            stroke-dasharray="${dash} ${circumference - dash}" transform="rotate(-90 150 150)" filter="url(#psdScoreGlow)"></circle>
          <circle cx="150" cy="150" r="76" fill="#0d1117" stroke="rgba(255,255,255,.14)" stroke-width="2"></circle>
          <text x="150" y="142" text-anchor="middle" font-size="58" font-weight="800">${score}</text>
          <text x="150" y="174" text-anchor="middle" font-size="19" font-weight="700" fill="${color}">${label}</text>
        </svg>
      `;
    }

    return heroClone;
  }

  function buildHomeWidgetSamples(){
    const row = document.createElement("div");
    row.className = "psd-home-widget-row";
    row.innerHTML = `
      <div class="psd-widget-print-sample" aria-label="Vote widget sample">
        <span class="psd-widget-icon">↕</span>
        <span class="psd-widget-text">Vote<br>Here</span>
      </div>
      <div class="psd-widget-print-sample" aria-label="PDF widget sample">
        <span class="psd-widget-icon">📄</span>
        <span class="psd-widget-text">Save<br>PDF</span>
      </div>
    `;
    return row;
  }

  function buildHomePages(root){
    const now = new Date().toLocaleString();
    const sections = qsa(".section.panel");

    const page1 = createPage("Home", `Generated ${now}`);
    page1.classList.add("psd-home-page", "psd-home-page1");
    [".header", "#psdAdvertiseBanner"].forEach(sel => {
      const clone = cloneElement(sel);
      if(clone) page1.appendChild(clone);
    });
    const page1Main = document.createElement("div");
    page1Main.className = "psd-home-page1-main";

    const railClone = cloneElement(".instrument-rail");
    if(railClone) page1Main.appendChild(railClone);

    const page1Right = document.createElement("div");
    page1Right.className = "psd-home-page1-right";
    const heroClone = enhanceHomeHeroClone(cloneElement(".hero"));
    if(heroClone) page1Right.appendChild(heroClone);
    page1Right.appendChild(buildHomeWidgetSamples());
    page1Main.appendChild(page1Right);
    page1.appendChild(page1Main);

    const footer1 = cloneElement(".footer");
    if(footer1){
      footer1.classList.add("psd-pdf-footer");
      page1.appendChild(footer1);
    }

    const page2 = createPage("Home", "Daily Public Sentiment Brief + Market Focus Today");
    page2.classList.add("psd-home-page", "psd-home-page2");
    const stack2 = document.createElement("div");
    stack2.className = "psd-home-page2-stack";
    [sections[1], sections[2]].forEach(el => {
      const clone = cloneElement(el);
      if(clone) stack2.appendChild(clone);
    });
    page2.appendChild(stack2);
    const footer2 = cloneElement(".footer");
    if(footer2){
      footer2.classList.add("psd-pdf-footer");
      page2.appendChild(footer2);
    }

    const page3 = createPage("Home", "Explore the Site");
    page3.classList.add("psd-home-page", "psd-home-page3", "psd-final-page");
    [".header", "#psdAdvertiseBanner"].forEach(sel => {
      const clone = cloneElement(sel);
      if(clone) page3.appendChild(clone);
    });
    const explore = cloneElement(sections[3]);
    if(explore) page3.appendChild(explore);
    const footer3 = cloneElement(".footer");
    if(footer3){
      footer3.classList.add("psd-pdf-footer");
      page3.appendChild(footer3);
    }

    root.appendChild(page1);
    root.appendChild(page2);
    root.appendChild(page3);
  }


  function newsHeroClone(){
    const candidates = [
      ".news-hero",
      ".articles-hero",
      ".search-panel",
      ".news-search-panel",
      "main .panel"
    ];

    for(const sel of candidates){
      const el = qs(sel);
      if(el) return cloneElement(el);
    }
    return null;
  }

  function newsArticleCards(){
    const selectors = [
      ".headline-card",
      ".news-card",
      ".article-card",
      ".article-tile",
      ".article-item",
      ".feed-card",
      "[data-article-card]"
    ];

    for(const sel of selectors){
      const cards = qsa(sel).filter(el => !el.closest(".header") && !el.closest(".footer") && !el.closest("#psdVoteWidget") && !el.closest("#psdPdfWidget"));
      if(cards.length) return cards;
    }

    const feed = qs("#headlineList") || qs(".headline-list") || qs("#articlesGrid") || qs("#articleGrid") || qs("#newsGrid") || qs("#articleFeed") || qs("#newsFeed") || qs(".articles-grid") || qs(".news-grid") || qs(".article-feed") || qs(".published-feed");
    if(feed) return Array.from(feed.children).filter(el => el && el.nodeType === 1);

    const panels = qsa("main .panel, main .card, main .dynamic-card").filter(el => !el.closest(".header") && !el.closest(".footer"));
    return panels.slice(1);
  }

  function buildNewsTopGrid(){
    const wrap = document.createElement("div");
    const title = document.createElement("div");
    title.className = "psd-news-top-title";
    title.textContent = "Top News Boxes";
    wrap.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "psd-news-top-grid";
    newsArticleCards().slice(0,4).forEach(card => {
      const clone = cloneElement(card);
      if(clone) grid.appendChild(clone);
    });

    if(!grid.children.length){
      const empty = document.createElement("div");
      empty.className = "panel";
      empty.innerHTML = "<h2>Top news boxes</h2><p>News cards will appear here after the page feed loads.</p>";
      grid.appendChild(empty);
    }

    wrap.appendChild(grid);
    return wrap;
  }

  function buildNewsPages(root){
    const now = new Date().toLocaleString();

    const page1 = createPage("News & Articles", `Generated ${now}`);
    page1.classList.add("psd-news-page", "psd-news-page1");
    [".header", "#psdAdvertiseBanner"].forEach(sel => {
      const clone = cloneElement(sel);
      if(clone) page1.appendChild(clone);
    });
    const hero = newsHeroClone();
    if(hero){
      hero.classList.add("psd-news-hero");
      page1.appendChild(hero);
    }
    page1.appendChild(buildNewsTopGrid());
    const widgets = buildHomeWidgetSamples();
    widgets.classList.add("psd-news-widget-row");
    page1.appendChild(widgets);

    const page2 = createPage("News & Articles", "Advertising");
    page2.classList.add("psd-news-page", "psd-news-ad-page");
    const ad2 = cloneElement("#psdAdvertiseBanner");
    if(ad2) page2.appendChild(ad2);
    const fill2 = document.createElement("div");
    fill2.className = "psd-news-ad-fill";
    fill2.textContent = "Advertising / Business Opportunities";
    page2.appendChild(fill2);

    const page3 = createPage("News & Articles", "Advertising + Disclaimer");
    page3.classList.add("psd-news-page", "psd-news-footer-page");
    const ad3 = cloneElement("#psdAdvertiseBanner");
    if(ad3) page3.appendChild(ad3);
    const fill3 = document.createElement("div");
    fill3.className = "psd-news-ad-fill";
    fill3.textContent = "Advertising / Business Opportunities";
    page3.appendChild(fill3);
    const footer = cloneElement(".footer");
    if(footer){
      footer.classList.add("psd-pdf-footer");
      page3.appendChild(footer);
    }

    root.appendChild(page1);
    root.appendChild(page2);
    root.appendChild(page3);
  }

  function buildGenericPages(root){
    const now = new Date().toLocaleString();
    const page = createPage("Report", `Generated ${now}`);
    [".header", "#psdAdvertiseBanner", "main", ".footer"].forEach(sel => {
      const clone = cloneElement(sel);
      if(clone) page.appendChild(clone);
    });
    root.appendChild(page);
  }

  function createCaptureRoot(){
    const old = document.getElementById("psdPdfCaptureRoot");
    if(old) old.remove();

    addStyleOnce();

    const root = document.createElement("div");
    root.id = "psdPdfCaptureRoot";
    document.body.appendChild(root);

    const path = window.location.pathname.toLowerCase();
    if(path === "/" || path.endsWith("/index.html") || path.endsWith("index.html") || qs(".home-layout")){
      buildHomePages(root);
    }else if(path.endsWith("/dashboard.html") || path.endsWith("dashboard.html") || qs("#snapshotCards")){
      buildDashboardPages(root);
    }else if(path.endsWith("/sentiment-history.html") || path.endsWith("sentiment-history.html") || qs(".dash-stage-shell") || qs("#historyRows")){
      buildHistoricalPages(root);
    }else if(path.endsWith("/news-articles.html") || path.endsWith("news-articles.html") || qs(".news-card") || qs(".article-card") || qs("#articlesGrid") || qs("#newsGrid")){
      buildNewsPages(root);
    }else{
      buildGenericPages(root);
    }

    return root;
  }

  async function canvasForPage(page){
    await waitForFontsAndImages(page);
    await wait(250);

    return await window.html2canvas(page, {
      backgroundColor:null,
      scale:PSD_CAPTURE_SCALE,
      useCORS:true,
      allowTaint:false,
      logging:false,
      imageTimeout:15000,
      windowWidth:PSD_CAPTURE_WIDTH,
      windowHeight:PSD_CAPTURE_HEIGHT,
      scrollX:0,
      scrollY:0,
      ignoreElements:(el) => el && (el.id === "psdVoteWidget" || el.id === "psdPdfWidget")
    });
  }

  async function waitForNewsCardsReady(){
    const path = window.location.pathname.toLowerCase();
    const isNews = path.endsWith("/news-articles.html") || path.endsWith("news-articles.html");
    if(!isNews) return;

    const start = Date.now();
    while(Date.now() - start < 7000){
      const cards = qsa("#headlineList .headline-card, .headline-list .headline-card, .headline-card");
      if(cards.length >= 4) return;
      await wait(250);
    }
  }

  async function savePdfFromCapture(){
    await ensureLibraries();
    await waitForNewsCardsReady();

    const root = createCaptureRoot();
    const pages = qsa(".psd-capture-page", root);
    if(!pages.length) throw new Error("No PDF pages were created.");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation:"landscape", unit:"pt", format:"a4", compress:true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    for(let i=0;i<pages.length;i++){
      const canvas = await canvasForPage(pages[i]);
      const img = canvas.toDataURL("image/png");
      if(i > 0) pdf.addPage("a4", "landscape");
      pdf.addImage(img, "PNG", 0, 0, pageW, pageH, undefined, "FAST");
    }

    root.remove();
    pdf.save(fileName());
  }

  async function psdOpenPdfReport(){
    await savePdfFromCapture();
  }

  window.psdOpenPdfReport = psdOpenPdfReport;
  window.PSD_PDF_REPORT_VERSION = PSD_PDF_VERSION;
})();

/*
  Public Sentiment Dash - PDF Report Engine v6
  Method: live-section capture -> 3-page landscape PDF.
  Keeps the PDF visually close to the actual page and reduces future maintenance.
*/
(function(){
  const PSD_PDF_VERSION = "6";
  const PSD_SITE_LABEL = "publicsentimentdash.com";
  const PSD_CAPTURE_WIDTH = 1600;
  const PSD_CAPTURE_HEIGHT = 1131; // A4 landscape ratio

  function qs(selector, root=document){ return root.querySelector(selector); }
  function qsa(selector, root=document){ return Array.from(root.querySelectorAll(selector)); }

  function safeText(value){
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function pageName(){
    const chip = qs(".page-chip");
    if(chip && safeText(chip.textContent)) return safeText(chip.textContent);

    const active = qs(".nav a.active");
    if(active && safeText(active.textContent)) return safeText(active.textContent);

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
    `;
    document.head.appendChild(style);
  }

  function cloneElement(selectorOrEl){
    const el = typeof selectorOrEl === "string" ? qs(selectorOrEl) : selectorOrEl;
    if(!el) return null;
    const clone = el.cloneNode(true);
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
    if(path.endsWith("/dashboard.html") || path.endsWith("dashboard.html") || qs("#snapshotCards")){
      buildDashboardPages(root);
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
      scale:2,
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

  async function savePdfFromCapture(){
    await ensureLibraries();

    const root = createCaptureRoot();
    const pages = qsa(".psd-capture-page", root);
    if(!pages.length) throw new Error("No PDF pages were created.");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation:"landscape", unit:"pt", format:"a4", compress:true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    for(let i=0;i<pages.length;i++){
      const canvas = await canvasForPage(pages[i]);
      const img = canvas.toDataURL("image/jpeg", 0.94);
      if(i > 0) pdf.addPage("a4", "landscape");
      pdf.addImage(img, "JPEG", 0, 0, pageW, pageH, undefined, "FAST");
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

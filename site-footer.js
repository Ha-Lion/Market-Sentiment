(function(){
  "use strict";

  const links = [
    ["dashboard.html","Interactive Dashboard"],
    ["sentiment-history.html","Historical Sentiment"],
    ["news-articles.html","News & Articles"],
    ["charts.html","Market Charts"],
    ["market-sentiment.html","Guides"],
    ["advertise.html","Business Opportunities"],
    ["contact.html","Get in Touch"],
    ["about.html","About"],
    ["privacy.html","Privacy"],
    ["terms.html","Terms"],
    ["disclaimer.html","Disclaimer"]
  ];

  function currentFile(){
    return (location.pathname.split("/").pop() || "index.html").toLowerCase();
  }

  function render(){
    const mount=document.getElementById("site-footer");
    if(!mount)return;
    const current=currentFile();
    const nav=links.map(([href,label])=>
      `<a href="${href}"${href===current?' class="active" aria-current="page"':''}>${label}</a>`
    ).join("");
    mount.outerHTML=`<footer class="footer psd-shared-footer">
      <nav class="footer-links" aria-label="Footer navigation">${nav}</nav>
      <div class="legal"><strong>Legal & Disclaimer:</strong> Public Sentiment Dash is operated by PublicSentimentDash, LLC. Content is provided for informational and educational purposes only and does not constitute financial, investment, trading, tax, or legal advice, or a recommendation to buy, sell, hold, or trade any asset.</div>
      <p class="psd-copyright">© ${new Date().getFullYear()} PublicSentimentDash, LLC. All rights reserved. Operated by PublicSentimentDash, LLC.</p>
    </footer>`;
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",render,{once:true});
  else render();
})();

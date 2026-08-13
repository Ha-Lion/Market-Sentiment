(function(){
  "use strict";
  const STORAGE_KEY="psd-site-theme";

  function savedTheme(){
    try{return localStorage.getItem(STORAGE_KEY)==="dark"?"dark":"light"}catch(_error){return"light"}
  }

  function applyTheme(theme,save){
    const dark=theme==="dark";
    document.body.classList.toggle("dark-mode",dark);
    document.body.classList.toggle("light-mode",!dark);
    document.documentElement.dataset.theme=dark?"dark":"light";
    document.documentElement.style.colorScheme=dark?"dark":"light";
    const button=document.getElementById("psd-theme-toggle");
    if(button){
      button.setAttribute("aria-pressed",String(dark));
      button.innerHTML=dark?'<span aria-hidden="true">☀</span><span>Light mode</span>':'<span aria-hidden="true">☾</span><span>Dark mode</span>';
    }
    if(save)try{localStorage.setItem(STORAGE_KEY,dark?"dark":"light")}catch(_error){}
    window.dispatchEvent(new CustomEvent("psd-theme-change",{detail:{theme:dark?"dark":"light"}}));
  }

  function installRibbonControl(){
    const nav=document.querySelector(".psd-shared-header .nav");
    if(!nav||document.getElementById("psd-theme-toggle"))return false;
    const button=document.createElement("button");
    button.id="psd-theme-toggle";
    button.className="psd-theme-toggle";
    button.type="button";
    button.setAttribute("aria-label","Switch website color theme");
    const social=nav.querySelector(".psd-ribbon-social-wrap");
    nav.insertBefore(button,social||null);
    button.addEventListener("click",()=>applyTheme(document.body.classList.contains("dark-mode")?"light":"dark",true));
    applyTheme(savedTheme(),false);
    return true;
  }

  function start(){
    applyTheme(savedTheme(),false);
    if(installRibbonControl())return;
    const observer=new MutationObserver(()=>{if(installRibbonControl())observer.disconnect()});
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();

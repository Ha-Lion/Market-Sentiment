(() => {
  "use strict";

  const MOBILE = "(max-width: 768px)";

  function isMobile(){
    return window.matchMedia(MOBILE).matches;
  }

  function getLayer(){
    return document.getElementById("historyLayer");
  }

  function getRibbon(){
    return document.querySelector(".psd-mobile-clean-header");
  }

  function activateFlow(){
    if(!isMobile()) return;

    const layer = getLayer();
    if(!layer || !layer.classList.contains("open")) return;

    const ribbon = getRibbon();

    /*
      Put Historical View directly under the mobile ribbon.
      It then becomes part of normal document scrolling.
    */
    if(ribbon && layer.previousElementSibling !== ribbon){
      ribbon.insertAdjacentElement("afterend", layer);
    }

    document.documentElement.classList.add(
      "psd-history-flow-open"
    );

    document.body.classList.add(
      "psd-history-flow-open"
    );

    /*
      Never lock normal vertical page scrolling.
    */
    document.documentElement.style.overflowY = "auto";
    document.body.style.overflow = "";
    document.body.style.overflowY = "auto";

    /*
      Open with ribbon + top of Historical View visible.
    */
    if(ribbon){
      requestAnimationFrame(() => {
        ribbon.scrollIntoView({
          behavior:"auto",
          block:"start"
        });
      });
    }
  }

  function deactivateFlow(){
    document.documentElement.classList.remove(
      "psd-history-flow-open"
    );

    document.body.classList.remove(
      "psd-history-flow-open"
    );

    document.documentElement.style.overflowY = "";
    document.body.style.overflow = "";
    document.body.style.overflowY = "";
  }

  function watch(){
    const layer = getLayer();

    if(!layer){
      setTimeout(watch, 100);
      return;
    }

    const observer = new MutationObserver(() => {
      if(layer.classList.contains("open")){
        activateFlow();
      }else{
        deactivateFlow();
      }
    });

    observer.observe(layer, {
      attributes:true,
      attributeFilter:["class"]
    });

    if(layer.classList.contains("open")){
      activateFlow();
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener(
      "DOMContentLoaded",
      watch,
      {once:true}
    );
  }else{
    watch();
  }

})();

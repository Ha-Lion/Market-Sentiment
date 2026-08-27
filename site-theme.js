(function(){
  "use strict";

  /*
   * Production theme controller.
   * Theme state only — it must never create, move, resize, or rearrange
   * anything inside the shared ribbon.
   */
  const STORAGE_KEY = "psd-theme";

  function savedTheme(){
    try{
      return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
    }catch(error){
      return "light";
    }
  }

  function applyTheme(theme, save){
    const dark = theme === "dark";
    document.body.classList.toggle("dark-mode", dark);
    document.body.classList.toggle("light-mode", !dark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";

    if(save){
      try{ localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light"); }catch(error){}
    }

    window.dispatchEvent(new CustomEvent("psd-theme-change", {
      detail:{ theme: dark ? "dark" : "light" }
    }));
  }

  function toggleTheme(){
    const next = document.body.classList.contains("dark-mode") ? "light" : "dark";
    applyTheme(next, true);
    return next;
  }

  window.PSDTheme = Object.freeze({
    savedTheme,
    applyTheme,
    toggleTheme
  });

  /* defer-loaded on shared pages, so body already exists in normal use. */
  if(document.body) applyTheme(savedTheme(), false);
  else document.addEventListener("DOMContentLoaded", function(){
    applyTheme(savedTheme(), false);
  }, {once:true});
})();

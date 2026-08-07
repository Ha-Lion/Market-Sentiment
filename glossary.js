/* Public Sentiment Dash — shared glossary/help system
   One definition source for every page. Use: data-glossary="psi" */
(function () {
  "use strict";

  const DEFINITIONS = {
    "market-close": {
      title: "Market Close",
      text: "The instrument's recorded closing market price for that period."
    },
    "psi": {
      title: "Public Sentiment Index (PSI)",
      text: "A 0–100 score showing the overall public sentiment for the selected market. Higher values are more bullish; lower values are more bearish."
    },
    "aligned-periods": {
      title: "Aligned Periods",
      text: "The number of dates where both market-price and sentiment data are available, allowing a direct comparison."
    },
    "change-correlation": {
      title: "Change Correlation",
      text: "Shows how closely changes in sentiment and changes in market price moved together. +1 means strongly together, 0 means little relationship, and −1 means strongly opposite."
    },
    "technical-direction": {
      title: "Technical Direction",
      text: "A simplified reading of price trend and technical indicators, shown as bullish, bearish, mixed, or neutral."
    },
    "user-sentiment": {
      title: "User Sentiment",
      text: "The voting bias submitted by users. It is separate from the Public Sentiment Index."
    },
    "headline-strength": {
      title: "Headline Strength",
      text: "A summary measure of how strongly recent relevant headlines lean bullish or bearish."
    },
    "stability": {
      title: "Sentiment Stability",
      text: "Shows how steady sentiment has been. Higher stability means fewer or smaller recent changes in the sentiment reading."
    },
    "source-votes": {
      title: "Source Votes",
      text: "A count or summary of sentiment signals contributed by the dashboard's monitored information sources."
    },
    "correlation": {
      title: "Correlation",
      text: "A measure from −1 to +1 describing how closely two sets of changes move together. Correlation does not prove that one causes the other."
    }
  };

  const STYLE_ID = "psd-glossary-styles";
  const POPOVER_ID = "psdGlossaryPopover";
  let activeButton = null;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .psd-glossary-info{display:inline-grid;place-items:center;width:16px;height:16px;margin-left:5px;padding:0;border:1px solid #64748b;border-radius:50%;background:#18202e;color:#b9c7db;font:700 10px/1 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;vertical-align:1px;transition:.15s ease}
      .psd-glossary-info:hover,.psd-glossary-info:focus-visible,.psd-glossary-info[aria-expanded="true"]{border-color:#60a5fa;background:#1d4ed8;color:#fff;outline:none}
      .psd-glossary-popover{position:fixed;z-index:100000;width:min(300px,calc(100vw - 24px));padding:12px 14px;border:1px solid #334155;border-radius:10px;background:#111827;color:#cbd5e1;box-shadow:0 14px 40px rgba(0,0,0,.45);font:400 12px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
      .psd-glossary-popover[hidden]{display:none}
      .psd-glossary-title{margin:0 20px 5px 0;color:#f8fafc;font-size:13px;font-weight:750}
      .psd-glossary-text{margin:0}
      .psd-glossary-close{position:absolute;right:8px;top:6px;border:0;background:transparent;color:#94a3b8;font-size:18px;line-height:1;cursor:pointer}
      .psd-glossary-close:hover{color:#fff}
    `;
    document.head.appendChild(style);
  }

  function getPopover() {
    let popover = document.getElementById(POPOVER_ID);
    if (popover) return popover;
    popover = document.createElement("div");
    popover.id = POPOVER_ID;
    popover.className = "psd-glossary-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-live", "polite");
    popover.hidden = true;
    popover.innerHTML = '<button class="psd-glossary-close" type="button" aria-label="Close explanation">×</button><div class="psd-glossary-title"></div><p class="psd-glossary-text"></p>';
    document.body.appendChild(popover);
    popover.querySelector(".psd-glossary-close").addEventListener("click", closePopover);
    return popover;
  }

  function closePopover() {
    const popover = document.getElementById(POPOVER_ID);
    if (popover) popover.hidden = true;
    if (activeButton) activeButton.setAttribute("aria-expanded", "false");
    activeButton = null;
  }

  function positionPopover(popover, button) {
    const rect = button.getBoundingClientRect();
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    const gap = 8;
    let left = Math.min(rect.left, window.innerWidth - width - 12);
    left = Math.max(12, left);
    let top = rect.bottom + gap;
    if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - height - gap);
    popover.style.left = left + "px";
    popover.style.top = top + "px";
  }

  function openPopover(button, key) {
    const definition = DEFINITIONS[key];
    if (!definition) return;
    const popover = getPopover();
    if (activeButton && activeButton !== button) activeButton.setAttribute("aria-expanded", "false");
    activeButton = button;
    button.setAttribute("aria-expanded", "true");
    popover.querySelector(".psd-glossary-title").textContent = definition.title;
    popover.querySelector(".psd-glossary-text").textContent = definition.text;
    popover.hidden = false;
    positionPopover(popover, button);
  }

  function decorate(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-glossary]").forEach(function (target) {
      if (target.querySelector(":scope > .psd-glossary-info")) return;
      const key = target.getAttribute("data-glossary");
      const definition = DEFINITIONS[key];
      if (!definition) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "psd-glossary-info";
      button.textContent = "i";
      button.setAttribute("aria-label", "What does " + definition.title + " mean?");
      button.setAttribute("aria-expanded", "false");
      button.dataset.glossaryKey = key;
      target.appendChild(button);
    });
  }

  document.addEventListener("click", function (event) {
    const button = event.target.closest(".psd-glossary-info");
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      if (activeButton === button) closePopover();
      else openPopover(button, button.dataset.glossaryKey);
      return;
    }
    const popover = document.getElementById(POPOVER_ID);
    if (popover && !popover.hidden && !event.target.closest("#" + POPOVER_ID)) closePopover();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closePopover();
  });

  window.addEventListener("resize", closePopover);
  window.addEventListener("scroll", closePopover, true);

  function init() {
    injectStyles();
    decorate(document);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.PSDGlossary = Object.freeze({ definitions: DEFINITIONS, refresh: decorate });
})();

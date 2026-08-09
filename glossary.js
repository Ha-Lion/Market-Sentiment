/* Public Sentiment Dash — shared glossary/help system
   One definition source for every page. Use: data-glossary="psi" */
(function () {
  "use strict";

  const DEFINITIONS = {
    "sentiment-market-chart": {
      title: "Sentiment vs. Market Price",
      text: "Compares the selected market's price movement with its Public Sentiment Index over the same dates. The two lines use separate scales so their direction and turning points can be compared."
    },
    "sentiment-skyline": {
      title: "Sentiment Skyline",
      text: "Shows how the Public Sentiment Index changed over time for the selected markets. Each colored line represents one market."
    },
    "radar-comparison": {
      title: "Radar Comparison",
      text: "Compares selected markets across PSI, user sentiment, headline strength, technical direction, and stability. A larger shape means stronger readings across more factors."
    },
    "sentiment-heatwave": {
      title: "Sentiment Heatwave",
      text: "A color map of recent PSI-style readings. Red indicates more bearish sentiment, blue is near neutral, and green indicates more bullish sentiment."
    },
    "strength-ranking": {
      title: "Strength Ranking",
      text: "Ranks the selected markets by their sentiment score for the active time period. A higher position means a stronger bullish sentiment reading, not a recommendation to buy."
    },
    "sentiment-cloud": {
      title: "24H Sentiment Cloud",
      text: "A visual view of recent intraday sentiment movement. The latest level, change, and range summarize how the sentiment reading moved during the displayed period."
    },
    "sentiment-lens": {
      title: "Sentiment Lens & Histogram",
      text: "A longer-period view of sentiment distribution and movement. The accompanying figures summarize average sentiment, total change, and volatility."
    },
    "news-summary": {
      title: "News & Article Summary",
      text: "Summarizes the amount, direction, and concentration of relevant article activity for the selected instrument, including pressure, source bias, neutrality, and theme strength."
    },
    "confluence-radar": {
      title: "Signal Confluence Radar",
      text: "Combines Trend, Momentum, Narrative, Alignment, and Stability into one comparison view. It shows how the signals relate; it is not a price forecast."
    },
    "formula-version": {
      title: "Formula",
      text: "Identifies the calculation version used by the dashboard's sentiment engine. It helps verify which scoring method produced the displayed reading."
    },
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
    "headline-count": {
      title: "Headline Count",
      text: "The number of relevant headlines currently included for that market or instrument."
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
    },
    "sentiment-rating": {
      title: "Sentiment Rating",
      text: "A simple label—such as Bullish, Neutral, or Bearish—derived from the current sentiment score."
    },
    "current-sentiment": {
      title: "Now",
      text: "The latest available sentiment reading for the selected instrument."
    },
    "sentiment-change": {
      title: "Sentiment Change",
      text: "The difference between the first and latest sentiment reading in the displayed period. Positive means sentiment rose; negative means it fell."
    },
    "sentiment-range": {
      title: "Sentiment Range",
      text: "The lowest and highest sentiment readings recorded within the displayed period."
    },
    "sentiment-average": {
      title: "Average (Avg)",
      text: "The average sentiment reading across the displayed period."
    },
    "sentiment-volatility": {
      title: "Sentiment Volatility (Vol)",
      text: "A simple measure of how much sentiment changed between readings. Higher values mean more movement and less stability."
    },
    "pressure": {
      title: "Pressure",
      text: "A simplified read of whether current news and sentiment pressure is leaning bullish, bearish, or balanced."
    },
    "article-load": {
      title: "Article Load",
      text: "The number of relevant article signals associated with the selected instrument."
    },
    "intensity": {
      title: "Intensity",
      text: "A 0–100 estimate of how concentrated or active the current article flow is. Higher values mean heavier information activity."
    },
    "source-bias": {
      title: "Source Bias",
      text: "The directional bias currently represented by the dashboard's source or user-sentiment input for the selected instrument."
    },
    "neutrality": {
      title: "Neutrality",
      text: "How balanced the current signal is between bullish and bearish pressure. Higher values mean the reading is closer to neutral."
    },
    "theme-score": {
      title: "Theme Score",
      text: "A 0–100 relative strength reading for a current market narrative or theme. It is a comparison aid, not a probability forecast."
    },
    "trend": {
      title: "Trend",
      text: "A 0–100 directional-strength reading based on the recent sentiment path. Higher values indicate stronger upward direction."
    },
    "momentum": {
      title: "Momentum",
      text: "A 0–100 measure of the recent rate and direction of change. Higher values indicate stronger positive momentum."
    },
    "narrative": {
      title: "Narrative",
      text: "A 0–100 measure of headline participation and narrative activity around the selected instrument."
    },
    "alignment": {
      title: "Alignment",
      text: "A 0–100 measure of agreement between user sentiment and technical direction. Higher values mean the signals agree more closely."
    },
    "ai-confluence": {
      title: "Signal Confluence",
      text: "A combined view of Trend, Momentum, Narrative, Alignment, and Stability. It summarizes agreement between signals; it is not an AI price prediction."
    },
    "signal-sync": {
      title: "Signal Sync",
      text: "A 0–100 summary of how well selected signal factors agree with one another. Higher values mean greater agreement."
    },
    "next-read": {
      title: "Next Read",
      text: "A simple interpretation of the recent sentiment path: continuing, cooling, or stable. It is not a forecast of market price."
    },
    "neural-read": {
      title: "Neural Read",
      text: "A 0–100 composite of momentum and narrative activity used as a visual comparison signal. It is not a machine-learning price prediction."
    },
    "risk-bias": {
      title: "Risk-On / Risk-Off",
      text: "A broad label describing whether the combined sentiment reading currently leans risk-seeking, risk-avoiding, or balanced."
    },
    "global-psi": {
      title: "Global PSI",
      text: "The Public Sentiment Index calculated from the dashboard's global market narrative. It uses the same 0–100 sentiment scale as other PSI readings."
    },
    "us-psi": {
      title: "U.S. PSI",
      text: "A 0–100 Public Sentiment Index focused on major U.S. markets, rates, indexes, and U.S.-focused financial headlines."
    },
    "instrument-psi": {
      title: "Instrument PSI",
      text: "The 0–100 Public Sentiment Index calculated specifically for the selected instrument from its relevant PSI headline set."
    },
    "relevant-headline-count": {
      title: "Relevant Headline Count",
      text: "The number of headlines that matched the selected market or instrument after relevance filtering."
    },
    "headline-impact": {
      title: "Headline Impact",
      text: "Indicates that a headline contains stronger potentially market-moving terms. It is not a rating of the source's quality or credibility."
    },
    "weekly-change": {
      title: "1W Change",
      text: "The change in sentiment compared with approximately one week earlier."
    },
    "monthly-change": {
      title: "1M Change",
      text: "The change in sentiment compared with approximately one month earlier."
    },
    "bull-bear-count": {
      title: "Bull / Bear",
      text: "The number of bullish readings compared with bearish readings in the selected period."
    },
    "record-count": {
      title: "Records",
      text: "The number of saved sentiment observations included in the selected view or calculation."
    },
    "sentiment-bias": {
      title: "Bias",
      text: "A simplified directional label describing whether the selected sentiment reading leans bullish, bearish, or neutral."
    },
    "historical-move": {
      title: "Move",
      text: "The change in the sentiment reading from the prior comparable saved period."
    },
    "hourly-pulse": {
      title: "Hourly Sentiment Pulse",
      text: "Shows how sentiment readings changed through recent hourly observations."
    },
    "global-us-flow": {
      title: "Global vs. U.S. Flow",
      text: "Compares the movement of Global PSI and U.S. PSI over the same time periods."
    },
    "global-us-divergence": {
      title: "Global vs. U.S. Divergence",
      text: "Shows the difference between Global PSI and U.S. PSI. A larger gap means the two sentiment views are moving further apart."
    },
    "global-bias-mix": {
      title: "Global Bias Mix",
      text: "Summarizes how saved global sentiment observations are distributed across bullish, neutral, and bearish readings."
    },
    "source-vote-impact": {
      title: "Source Votes and Impact",
      text: "Source votes summarize filtered public narrative from monitored sources. Impact flags stronger market-moving language; it does not grade source quality."
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
      .psd-glossary-info{display:inline-grid;place-items:center;width:16px;height:16px;margin-left:5px;padding:0;border:1px solid #64748b;border-radius:50%;background:#18202e;color:#ef4444;font:700 10px/1 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;vertical-align:1px;transition:.15s ease}
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
    const targets = [];
    if (scope.nodeType === 1 && scope.matches("[data-glossary]")) targets.push(scope);
    if (scope.querySelectorAll) targets.push.apply(targets, scope.querySelectorAll("[data-glossary]"));
    targets.forEach(function (target) {
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
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) decorate(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.PSDGlossary = Object.freeze({ definitions: DEFINITIONS, refresh: decorate });
})();

(function () {
  "use strict";

  if (window.PSDAnalytics) return;

  const ALLOWED_EVENTS = new Set([
    "page_view",
    "session_start",
    "navigation_click",
    "feature_click",
    "form_submit",
    "instrument_vote"
  ]);

  let visitorType = "guest";
  let memberStatusResolved = false;
  let pageViewSent = false;
  const recentEvents = new Map();

  function cleanName(value, fallback) {
    return String(value || fallback || "unknown")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[^a-zA-Z0-9 /_|:.,+\-()]/g, "")
      .slice(0, 140) || fallback || "unknown";
  }

  function cleanPath(value) {
    try {
      const url = new URL(value || window.location.href, window.location.origin);
      if (url.origin !== window.location.origin) {
        return "/" + url.hostname.slice(0, 120);
      }
      return (url.pathname || "/").slice(0, 160);
    } catch (_error) {
      return (window.location.pathname || "/").slice(0, 160);
    }
  }

  function cleanDestination(value) {
    try {
      const url = new URL(value || "/", window.location.origin);
      if (url.origin === window.location.origin) {
        return (url.pathname || "/").slice(0, 140);
      }
      return ("External: " + url.hostname).slice(0, 140);
    } catch (_error) {
      return "Navigation";
    }
  }

  function doNotTrackEnabled() {
    return navigator.doNotTrack === "1" || window.doNotTrack === "1";
  }

  function regionGroup() {
    let zone = "";
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (_error) {}

    if (/^(America|Atlantic)\//.test(zone)) return "Americas";
    if (/^Europe\//.test(zone)) return "Europe";
    if (/^(Australia|Pacific|Indian|Antarctica)\//.test(zone)) return "Asia-Pacific";
    if (/^Africa\//.test(zone)) return "Middle East & Africa";

    if (/^Asia\//.test(zone)) {
      if (/(Jerusalem|Gaza|Hebron|Amman|Beirut|Damascus|Baghdad|Riyadh|Kuwait|Qatar|Bahrain|Dubai|Muscat|Aden|Tehran)/.test(zone)) {
        return "Middle East & Africa";
      }
      return "Asia-Pacific";
    }

    return "Unknown";
  }

  function deviceType() {
    const ua = navigator.userAgent || "";
    const width = Math.min(
      window.screen && window.screen.width ? window.screen.width : window.innerWidth,
      window.screen && window.screen.height ? window.screen.height : window.innerHeight
    );

    if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
      return "Tablet";
    }
    if ((navigator.userAgentData && navigator.userAgentData.mobile) || /Mobi|iPhone|Android/i.test(ua) || width < 700) {
      return "Mobile";
    }
    return "Desktop";
  }

  function sourceCategory() {
    const stored = sessionStorage.getItem("psd_traffic_source");
    if (stored) return stored;

    let category = "Direct";
    try {
      if (document.referrer) {
        const referrer = new URL(document.referrer);
        const host = referrer.hostname.toLowerCase();
        if (referrer.origin === window.location.origin) {
          category = "Internal";
        } else if (/(google|bing|yahoo|duckduckgo|baidu|yandex)\./.test(host)) {
          category = "Search";
        } else if (/(x\.com|twitter\.com|linkedin\.com|facebook\.com|instagram\.com|reddit\.com|youtube\.com|tiktok\.com)/.test(host)) {
          category = "Social";
        } else {
          category = "Other";
        }
      }
    } catch (_error) {
      category = "Other";
    }

    try {
      sessionStorage.setItem("psd_traffic_source", category);
    } catch (_error) {}
    return category;
  }

  function featureFromEvent(eventName, params) {
    params = params || {};

    if (eventName === "instrument_vote") {
      const instrument = cleanName(params.instrument, "Unknown instrument");
      const vote = cleanName(params.vote, "Unknown vote");
      return instrument + " | " + vote;
    }

    if (eventName === "navigation_click") {
      return cleanDestination(params.destination || "/");
    }

    return cleanName(
      params.feature_name || params.form_name || params.destination,
      ""
    );
  }

  async function send(eventName, params) {
    if (doNotTrackEnabled()) return;
    if (!window.psdSupabase || !ALLOWED_EVENTS.has(eventName)) return;

    const pagePath = cleanPath(window.location.href);
    const featureName = featureFromEvent(eventName, params);

    const dedupeKey = [
      visitorType,
      pagePath,
      eventName,
      featureName
    ].join("|");

    const now = Date.now();
    if (recentEvents.has(dedupeKey) && now - recentEvents.get(dedupeKey) < 1200) {
      return;
    }
    recentEvents.set(dedupeKey, now);

    try {
      await window.psdSupabase.rpc("ms_record_usage_event_v2", {
        p_page_path: pagePath,
        p_event_name: eventName,
        p_feature_name: featureName,
        p_region_group: regionGroup(),
        p_device_type: deviceType(),
        p_traffic_source: sourceCategory()
      });
    } catch (_error) {
      // Measurement must never interfere with the website.
    }
  }

  function track(eventName, params) {
    if (!ALLOWED_EVENTS.has(eventName)) return;
    send(eventName, params || {});
  }

  function sendInitialEvents() {
    if (pageViewSent) return;
    pageViewSent = true;

    let sessionStarted = false;
    try {
      sessionStarted = sessionStorage.getItem("psd_session_started") === "true";
      if (!sessionStarted) {
        sessionStorage.setItem("psd_session_started", "true");
      }
    } catch (_error) {}

    if (!sessionStarted) {
      track("session_start", {});
    }
    track("page_view", {});
  }

  function featureLabel(element) {
    return cleanName(
      element.getAttribute("data-analytics-label") ||
      element.getAttribute("aria-label") ||
      element.id ||
      element.name ||
      element.textContent ||
      element.tagName,
      "feature"
    );
  }

  function installTracking() {
    document.addEventListener("click", function (event) {
      const target = event.target.closest("a,button,[role='button']");
      if (!target) return;

      if (target.tagName === "A") {
        track("navigation_click", {
          destination: target.getAttribute("href") || "/"
        });
      } else {
        track("feature_click", {
          feature_name: featureLabel(target)
        });
      }
    }, { passive: true });

    document.addEventListener("submit", function (event) {
      const form = event.target;
      if (!form || form.tagName !== "FORM") return;

      track("form_submit", {
        form_name: cleanName(
          form.getAttribute("aria-label") ||
          form.id ||
          form.name ||
          "form",
          "form"
        )
      });
    }, { passive: true });
  }

  function flushQueue() {
    const queue = Array.isArray(window.PSD_ANALYTICS_QUEUE)
      ? window.PSD_ANALYTICS_QUEUE.splice(0)
      : [];

    queue.forEach(function (item) {
      if (item && item.event) {
        track(item.event, item.params || {});
      }
    });
  }

  window.addEventListener("psd-member-status-change", function (event) {
    visitorType =
      event.detail && event.detail.visitor_type === "member"
        ? "member"
        : "guest";
    memberStatusResolved = true;
    sendInitialEvents();
  });

  window.PSDAnalytics = {
    track: track,
    getVisitorType: function () {
      return visitorType;
    },
    getPrivacyContext: function () {
      return {
        region_group: regionGroup(),
        device_type: deviceType(),
        traffic_source: sourceCategory()
      };
    }
  };

  installTracking();
  flushQueue();

  window.setTimeout(function () {
    if (!memberStatusResolved) visitorType = "guest";
    sendInitialEvents();
  }, 900);
})();

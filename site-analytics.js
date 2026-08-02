(function () {
  "use strict";

  if (window.PSDAnalytics) return;

  let visitorType = "guest";
  let memberStatusResolved = false;
  let pageViewSent = false;
  const recentEvents = new Map();

  function cleanName(value, fallback) {
    return String(value || fallback || "unknown")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[^a-zA-Z0-9 _.-]/g, "")
      .slice(0, 100) || fallback || "unknown";
  }

  function cleanPath(value) {
    try {
      const url = new URL(value || window.location.href, window.location.origin);
      if (url.origin !== window.location.origin) return url.hostname.slice(0, 100);
      return (url.pathname || "/").slice(0, 160);
    } catch (_error) {
      return (window.location.pathname || "/").slice(0, 160);
    }
  }

  function doNotTrackEnabled() {
    return navigator.doNotTrack === "1" || window.doNotTrack === "1";
  }

  async function send(eventName, params) {
    if (doNotTrackEnabled()) return;
    if (!window.psdSupabase) return;

    const pagePath = cleanPath(window.location.href);
    const featureName = cleanName(
      params && (params.feature_name || params.form_name || params.destination),
      ""
    );

    const dedupeKey = [
      visitorType,
      pagePath,
      eventName,
      featureName
    ].join("|");

    const now = Date.now();
    if (recentEvents.has(dedupeKey) && now - recentEvents.get(dedupeKey) < 1500) {
      return;
    }
    recentEvents.set(dedupeKey, now);

    try {
      await window.psdSupabase.rpc("ms_record_usage_event", {
        p_visitor_type: visitorType,
        p_page_path: pagePath,
        p_event_name: eventName,
        p_feature_name: featureName
      });
    } catch (_error) {
      // Analytics must never interfere with the website.
    }
  }

  function track(eventName, params) {
    if (!["page_view", "navigation_click", "feature_click", "form_submit"].includes(eventName)) {
      return;
    }
    send(eventName, params || {});
  }

  function sendPageView() {
    if (pageViewSent) return;
    pageViewSent = true;
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

  window.addEventListener("psd-member-status-change", function (event) {
    visitorType =
      event.detail && event.detail.visitor_type === "member"
        ? "member"
        : "guest";
    memberStatusResolved = true;
    sendPageView();
  });

  window.PSDAnalytics = {
    track: track,
    getVisitorType: function () {
      return visitorType;
    }
  };

  installTracking();

  window.setTimeout(function () {
    if (!memberStatusResolved) visitorType = "guest";
    sendPageView();
  }, 900);
})();

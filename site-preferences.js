(function () {
  "use strict";

  if (window.PSDPreferencesRuntime) return;

  const client = window.psdSupabase;
  if (!client) return;

  function injectStyles() {
    if (document.getElementById("psd-preferences-runtime-styles")) return;

    const style = document.createElement("style");
    style.id = "psd-preferences-runtime-styles";
    style.textContent = `
      body.psd-compact-mode .panel,
      body.psd-compact-mode .card,
      body.psd-compact-mode .dynamic-card{
        padding-top:14px !important;
        padding-bottom:14px !important;
      }
      body.psd-compact-mode .grid-2,
      body.psd-compact-mode .grid-3{
        gap:10px !important;
      }
    `;
    document.head.appendChild(style);
  }

  function applyTimeframe(timeframe) {
    const allowed = ["daily", "weekly", "monthly"];
    const selected = allowed.includes(timeframe) ? timeframe : "daily";

    document.documentElement.dataset.defaultTimeframe = selected;
    sessionStorage.setItem("psd_default_timeframe", selected);

    window.setTimeout(function () {
      const control =
        document.querySelector('[data-period="' + selected + '"]') ||
        document.querySelector('[data-timeframe="' + selected + '"]');

      if (control && !control.classList.contains("active")) {
        try { control.click(); } catch (_error) {}
      }
    }, 450);
  }

  async function apply() {
    const sessionResult = await client.auth.getSession();
    const session = sessionResult.data && sessionResult.data.session;

    if (!session) {
      document.body.classList.remove("psd-compact-mode");
      applyTimeframe("daily");
      window.PSDUserPreferences = {
        default_timeframe: "daily",
        compact_mode: false,
        watchlist: []
      };
      return;
    }

    const userId = session.user.id;

    const results = await Promise.all([
      client
        .from("user_preferences")
        .select("default_timeframe,compact_mode")
        .eq("user_id", userId)
        .single(),
      client
        .from("watchlists")
        .select("id")
        .eq("user_id", userId)
        .eq("is_default", true)
        .limit(1)
        .maybeSingle()
    ]);

    const preferences = results[0].data || {
      default_timeframe: "daily",
      compact_mode: false
    };

    let watchlist = [];
    const watchlistId = results[1].data && results[1].data.id;

    if (watchlistId) {
      const items = await client
        .from("watchlist_items")
        .select("instrument,display_order")
        .eq("watchlist_id", watchlistId)
        .order("display_order", { ascending: true });

      watchlist = (items.data || []).map(function (item) {
        return item.instrument;
      });
    }

    document.body.classList.toggle(
      "psd-compact-mode",
      Boolean(preferences.compact_mode)
    );
    applyTimeframe(preferences.default_timeframe);

    window.PSDUserPreferences = {
      default_timeframe: preferences.default_timeframe || "daily",
      compact_mode: Boolean(preferences.compact_mode),
      watchlist: watchlist
    };

    window.dispatchEvent(new CustomEvent("psd-preferences-ready", {
      detail: window.PSDUserPreferences
    }));
  }

  injectStyles();
  window.PSDPreferencesRuntime = { apply: apply };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      apply().catch(function () {});
    });
  } else {
    apply().catch(function () {});
  }

  window.addEventListener("psd-preferences-updated", function () {
    apply().catch(function () {});
  });

  window.addEventListener("psd-member-status-change", function () {
    apply().catch(function () {});
  });
})();

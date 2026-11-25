(function () {
  "use strict";

  const PSD_SUPABASE_URL = "https://api-contabo.publicsentimentdash.com";
  const PSD_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzk1NDk3Mjk2LCJleHAiOjE5NTMxNzcyOTZ9.sVPqK_NvCWUsQcV3eA-QE9lgLsfqsZBRVYDIMD7S1co";
  const REMEMBER_KEY = "psd_remember_session";

  if (window.psdSupabase && window.__PSD_SUPABASE_CLIENT_READY__) {
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("Supabase library did not load.");
    return;
  }

  function rememberEnabled() {
    return localStorage.getItem(REMEMBER_KEY) !== "false";
  }

  function selectedStorage() {
    return rememberEnabled() ? localStorage : sessionStorage;
  }

  function otherStorage() {
    return rememberEnabled() ? sessionStorage : localStorage;
  }

  function isAuthStorageKey(key) {
    return Boolean(key && (key.includes("auth-token") || key.startsWith("sb-")));
  }

  // Only downloaded, rebuildable data caches may be evicted for an auth write.
  function isRebuildableCache(key) {
    return /^psd-economic-history-v\d+:/.test(key) ||
      key === "psd-economic-calendar-current-week-v2-uk-values" ||
      key === "psd-news-archive-public-meta-v2";
  }

  function isQuotaError(error) {
    return error && (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22 || error.code === 1014);
  }

  function writeAuthStorage(storage, key, value) {
    try {
      storage.setItem(key, value);
      return;
    } catch (error) {
      if (!isQuotaError(error)) throw error;
    }

    const candidates = [];
    for (let i = 0; i < storage.length; i += 1) {
      const candidate = storage.key(i);
      if (candidate && candidate !== key && isRebuildableCache(candidate)) {
        candidates.push({ key: candidate, size: (storage.getItem(candidate) || "").length });
      }
    }
    candidates.sort(function (a, b) { return b.size - a.size; });

    for (const candidate of candidates) {
      storage.removeItem(candidate.key);
      try {
        storage.setItem(key, value);
        return;
      } catch (error) {
        if (!isQuotaError(error)) throw error;
      }
    }

    const error = new Error("Browser storage is full. Free some site storage or try signing in without Remember me.");
    error.name = "QuotaExceededError";
    throw error;
  }

  function migrateAuthStorage(target) {
    const from = target === sessionStorage ? localStorage : sessionStorage;
    const keys = [];

    for (let index = 0; index < from.length; index += 1) {
      const key = from.key(index);
      if (isAuthStorageKey(key)) keys.push(key);
    }

    keys.forEach(function (key) {
      const value = from.getItem(key);
      if (value !== null) writeAuthStorage(target, key, value);
      from.removeItem(key);
    });
  }

  /* Make the selected remember-me location authoritative before Supabase reads it. */
  try {
    migrateAuthStorage(selectedStorage());
  } catch (error) {
    if (!isQuotaError(error)) throw error;
    console.warn("PSD auth storage migration could not finish; existing stored data was preserved.");
  }

  const adaptiveStorage = {
    getItem: function (key) {
      return selectedStorage().getItem(key);
    },
    setItem: function (key, value) {
      writeAuthStorage(selectedStorage(), key, value);
      otherStorage().removeItem(key);
    },
    removeItem: function (key) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  };

  window.PSDSupabaseConfig = {
    url: PSD_SUPABASE_URL,
    anonKey: PSD_SUPABASE_ANON_KEY
  };

  window.PSDAuthStorage = {
    isRemembered: rememberEnabled,
    setRemembered: function (remember) {
      writeAuthStorage(localStorage, REMEMBER_KEY, remember ? "true" : "false");
      migrateAuthStorage(remember ? localStorage : sessionStorage);
    },
    useSessionOnly: function () {
      writeAuthStorage(localStorage, REMEMBER_KEY, "false");
      migrateAuthStorage(sessionStorage);
    },
    usePersistentSession: function () {
      writeAuthStorage(localStorage, REMEMBER_KEY, "true");
      migrateAuthStorage(localStorage);
    }
  };

  window.psdSupabase = window.supabase.createClient(
    PSD_SUPABASE_URL,
    PSD_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: adaptiveStorage
      }
    }
  );
  window.__PSD_SUPABASE_CLIENT_READY__ = true;

  function loadScript(src, id) {
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  }

  function publishMemberStatus(session) {
    window.dispatchEvent(new CustomEvent("psd-member-status-change", {
      detail: {
        visitor_type: session ? "member" : "guest"
      }
    }));
  }

  loadScript("site-analytics.js?v=8", "psd-site-analytics-script");

  window.psdSupabase.auth.getSession().then(function (result) {
    publishMemberStatus(result.data && result.data.session ? result.data.session : null);
  });

  window.psdSupabase.auth.onAuthStateChange(function (_event, session) {
    // Account and analytics listeners may call Supabase. Run them after the auth callback releases its lock.
    setTimeout(function () {
      publishMemberStatus(session || null);
    }, 0);
  });
})();

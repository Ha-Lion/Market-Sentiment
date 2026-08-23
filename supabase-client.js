(function () {
  "use strict";

  const PSD_SUPABASE_URL = "https://fupexuonvzakoguucglk.supabase.co";
  const PSD_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1cGV4dW9udnpha29ndXVjZ2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUzNTQsImV4cCI6MjA5MzQ4MTM1NH0.YZF4SBqvDTSOyHDOf_TVhpBXDm0FEma74u32Bdryfjg";
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

  function migrateAuthStorage(target) {
    const from = target === sessionStorage ? localStorage : sessionStorage;
    const keys = [];

    for (let index = 0; index < from.length; index += 1) {
      const key = from.key(index);
      if (isAuthStorageKey(key)) keys.push(key);
    }

    keys.forEach(function (key) {
      const value = from.getItem(key);
      if (value !== null) target.setItem(key, value);
      from.removeItem(key);
    });
  }

  /* Make the selected remember-me location authoritative before Supabase reads it. */
  migrateAuthStorage(selectedStorage());

  const adaptiveStorage = {
    getItem: function (key) {
      return selectedStorage().getItem(key);
    },
    setItem: function (key, value) {
      selectedStorage().setItem(key, value);
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
      localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
      migrateAuthStorage(remember ? localStorage : sessionStorage);
    },
    useSessionOnly: function () {
      localStorage.setItem(REMEMBER_KEY, "false");
      migrateAuthStorage(sessionStorage);
    },
    usePersistentSession: function () {
      localStorage.setItem(REMEMBER_KEY, "true");
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
    publishMemberStatus(session || null);
  });
})();

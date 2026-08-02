(function () {
  "use strict";

  const PSD_SUPABASE_URL = "https://fupexuonvzakoguucglk.supabase.co";
  const PSD_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1cGV4dW9udnpha29ndXVjZ2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUzNTQsImV4cCI6MjA5MzQ4MTM1NH0.YZF4SBqvDTSOyHDOf_TVhpBXDm0FEma74u32Bdryfjg";
  const MEMBER_KEY = "psd_member_status";

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("Supabase library did not load.");
    return;
  }

  window.psdSupabase = window.supabase.createClient(
    PSD_SUPABASE_URL,
    PSD_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  function loadAnalytics(){
    if(document.getElementById("psd-site-analytics-script")) return;
    const script = document.createElement("script");
    script.id = "psd-site-analytics-script";
    script.src = "site-analytics.js?v=2";
    script.defer = true;
    document.head.appendChild(script);
  }

  function updateMemberStatus(session){
    const visitorType = session ? "member" : "guest";
    localStorage.setItem(MEMBER_KEY, visitorType);
    window.dispatchEvent(new CustomEvent("psd-member-status-change", {
      detail: { visitor_type: visitorType }
    }));
  }

  loadAnalytics();
  window.psdSupabase.auth.getSession().then(function(result){
    updateMemberStatus(result.data && result.data.session ? result.data.session : null);
  });

  window.psdSupabase.auth.onAuthStateChange(function(_event, session){
    updateMemberStatus(session || null);
  });
})();

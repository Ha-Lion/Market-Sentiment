(function () {
  "use strict";

  const PSD_SUPABASE_URL = "https://fupexuonvzakoguucglk.supabase.co";
  const PSD_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1cGV4dW9udnpha29ndXVjZ2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUzNTQsImV4cCI6MjA5MzQ4MTM1NH0.YZF4SBqvDTSOyHDOf_TVhpBXDm0FEma74u32Bdryfjg";

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
})();

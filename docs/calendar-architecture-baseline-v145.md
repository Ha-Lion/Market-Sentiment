# Economic Calendar Architecture — Frozen Baseline

Frozen on 2026-10-19.

- Supabase integration View: `public.econ_calendar_integration_v1`
- Production Edge Function: `economic-calendar-feed` v145
- Deployed code SHA-256: `7fb2d6f1d7b919cc4f13562b9d386cb5d9ba72444371d38a2459f9ee18f0018a`
- Registered official events: 898 across US, UK and AU.
- Live October feed validation: HTTP 200, 438 events; 409 matched registered events, with zero Actual, Previous, and Revised mismatches against the integration View.
- Verified first-release data and historical latest-vintage data remain distinguished.
- External provider-only events and forecast handling are preserved. Forecast provider selection and individual indicator corrections are deferred.
- Website HTML was not modified in the foundation phase.

Change control: Keep this baseline. Before modifying source-selection rules, deploy changes as a new version, verify values and performance, and maintain rollback to the prior deployment.

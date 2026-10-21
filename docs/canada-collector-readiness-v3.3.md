# Canada collector readiness V3.3

Audit: 64 Canadian indicator records, 23 active indicators, zero canonical collector flags.

Source families: Statistics Canada WDS, Bank of Canada, Finance Canada, OECD CLI, CFTC Legacy Canadian-dollar futures, CMHC, and event-only official announcements.

Blocked on source permissions: indicators 19,20,22,23,52. Blocked on unannounced individual events: 54,55. Historical-only discontinued: 41. Source correction approvals: 15 and 53.

The existing economic-history-official-ca job handles selected historical series but is NOT a canonical collector for all 64 indicators. The 2026-10-21 attempt to create a separate collector-readiness service failed with the Supabase project function-count limit; no existing function was changed.

Activation exit checks: allowed license, exact native metric, rate limit, registered executable adapter, first-published Actual and source Previous, schedule, transaction/rollback proof, and a live source-to-website canary. Do not activate blocked sources, infer figures, or treat HTTP 200 HTML error page as valid WDS JSON.

Preserve existing US/UK/AU events, the canonical view and production feed. No collector flags changed during this handoff.

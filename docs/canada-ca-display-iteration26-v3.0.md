# Canada Iteration 26 V3.0 - CA-only website display

This draft patch changes calendar rows, settings, export display formatter, and watchlist labels to show CA.

Supabase view and catalog already represent Canadian country as CA, and the live feed's sampled Canada events also used CA.

Only Canada-facing display strings are changed; the underlying country_code keys, numeric values, filters, and US/UK/AU mapping are unchanged.

Changes are isolated to a draft PR. Do not merge until private-browser tests during Iteration 27.

Run: node qa/ca-display-contract-b26-v3.0.mjs

This is not collector activation or approval for blocked publisher sources.

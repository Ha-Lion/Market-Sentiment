-- UK labour provider composite metrics archival job (append-only, provenance-qualified)

WITH reports AS(
 SELECT s.fetched_at, j.e AS item,
   (j.e->>'date')::timestamptz AS released_at
 FROM public.economic_calendar_snapshots s
 CROSS JOIN LATERAL jsonb_array_elements(s.events) j(e)
 WHERE s.snapshot_key='priority_21d'
   AND s.provider_error IS NULL
   AND j.e->>'country_code'='GB'
   AND j.e->>'source'='FinanceCalendar'
   AND j.e->>'event'~*'^UK Labour Market Report'
   AND j.e->>'actual'~'[0-9]+([.][0-9]+)?[[:space:]]*%'
   AND (j.e->>'date')::timestamptz<=now()
   AND (j.e->>'date')::timestamptz>=now()-interval '10 days'
),
components AS(
 SELECT r.*,
    to_char((r.released_at AT TIME ZONE 'UTC')-interval '2 months','YYYY-MM') AS reference_period,
    (regexp_match(item->>'actual','unemployment[[:space:]]+(?:rate[[:space:]]+)?([0-9]+(?:[.][0-9]+)?)[[:space:]]*%','i'))[1] unemp,
    (regexp_match(item->>'actual','employment[[:space:]]+rate[[:space:]]+([0-9]+(?:[.][0-9]+)?)[[:space:]]*%','i'))[1] employment,
    (regexp_match(item->>'actual','(?:earnings[[:space:]]*)?(?:ex[- ]bonus(?:es)?|regular[[:space:]]+pay(?:[[:space:]]+growth)?)[[:space:]]*[+]?([0-9]+(?:[.][0-9]+)?)[[:space:]]*%','i'))[1] regular,
    (regexp_match(item->>'actual','(?:incl(?:uding)?[[:space:]]+bonus(?:es)?|total[[:space:]]+(?:pay|earnings))[[:space:]]*[+]?([0-9]+(?:[.][0-9]+)?)[[:space:]]*%','i'))[1] total
 FROM reports r
),
metric_rows AS(
 SELECT c.released_at::date AS published_on,c.reference_period,
    c.item->>'source_url' source_url,c.item,c.fetched_at,
    z.indicator_id,z.metric,z.series_id,z.raw_actual::numeric AS numeric_actual
 FROM components c
 CROSS JOIN LATERAL(
  VALUES('uk_ons_b4_08','unemployment_rate_3m','MGSX',c.unemp),
        ('uk_ons_b4_47','employment_rate_3m','LF24',c.employment),
        ('uk_ons_b4_06','awe_regular_pay_yoy_3m','KAI9',c.regular),
        ('uk_ons_b4_05','awe_total_pay_yoy_3m','KAC3',c.total)
 ) z(indicator_id,metric,series_id,raw_actual)
 WHERE z.raw_actual IS NOT NULL
    AND c.item->>'source_url' LIKE 'https://www.financecalendar.com/%'
)
INSERT INTO public.econ_uk_publisher_release_archive
(indicator_id,published_on,reference_period,source_url,unit,numeric_actual,numeric_previous,source_kind,verification_state,metadata)
SELECT m.indicator_id,m.published_on,m.reference_period,m.source_url,'percent',m.numeric_actual,
  (SELECT a.numeric_actual FROM public.econ_uk_publisher_release_archive a
   WHERE a.indicator_id=m.indicator_id AND a.published_on<m.published_on
    AND a.metadata->>'metric'=m.metric
    AND a.source_kind IN ('ons_labour_original_bulletin_metric_v1','financecalendar_uk_labour_compound_v1')
   ORDER BY a.published_on DESC,
     CASE WHEN a.source_kind='ons_labour_original_bulletin_metric_v1' THEN 0 ELSE 1 END
   LIMIT 1),
 'financecalendar_uk_labour_compound_v1','third_party_reported_unverified',
 jsonb_build_object('metric',m.metric,'series_code',m.series_id,
 'source_provider','FinanceCalendar','publisher_first_print_verified',false,
 'actual_provenance','FinanceCalendar release narrative parsed; NOT independently first-print verified',
 'previous_provenance','Most recent archived same-metric publisher report where present',
 'source_snapshot_at',m.fetched_at,'source_raw_actual',m.item->>'actual',
 'source_raw_previous',m.item->>'previous',
 'source_raw_forecast',m.item->>'forecast',
 'source_original_event_id',m.item->>'id','source_history_untouched',true)
FROM metric_rows m
JOIN public.econ_indicators i ON i.id=m.indicator_id AND i.country='UK' AND i.active=true
ON CONFLICT DO NOTHING;

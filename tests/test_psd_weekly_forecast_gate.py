import importlib.util
import json
import tempfile
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("forecast_gate",ROOT/"scripts/psd_weekly_forecast_gate.py")
import sys
sys.path.insert(0,str(ROOT/"scripts"))
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class WeeklyForecastGateTests(unittest.TestCase):
    def test_sunday_targets_fourth_upcoming_week(self):
        self.assertEqual(tuple(map(str,mod.fourth_upcoming_week(date(2026,10,25)))),
                         ("2026-11-16","2026-11-22"))
    def test_monday_targets_fourth_upcoming_week(self):
        self.assertEqual(tuple(map(str,mod.fourth_upcoming_week(date(2026,10,26)))),
                         ("2026-11-16","2026-11-22"))
    def test_missing_output_fails_closed(self):
        with tempfile.TemporaryDirectory() as p:
            base=Path(p)
            with self.assertRaises(ValueError):
                mod.build(base,base/"feed.json",reference=date(2026,11,1))
            self.assertFalse((base/"feed.json").exists())
    def test_stale_output_fails_closed(self):
        with tempfile.TemporaryDirectory() as p:
            base=Path(p)
            raw={"schema":"psd-calendar-lab-research/1","version":"V2.3",
                "production":False,"certified_28_day_accuracy":False,
                "created_utc":"2026-10-01T00:00:00Z",
                "forecast_week":{"monday":"2026-11-16","sunday":"2026-11-22"},
                "events":[{"event_id":"x","country":"US","indicator":"Synthetic only",
                           "release_at_utc":"2026-11-17T13:30:00Z",
                           "status":"WITHHELD","psd_forecast":None}]}
            (base/"psd_calendar_lab_feed_v2_3.json").write_text(json.dumps(raw))
            with self.assertRaises(ValueError):
                mod.build(base,base/"feed.json",reference=date(2026,11,1))
            self.assertFalse((base/"feed.json").exists())
if __name__=="__main__":
    unittest.main()

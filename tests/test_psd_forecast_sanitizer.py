#!/usr/bin/env python3
"""Read-only synthetic contract tests for the PSD Kaggle research sanitizer."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts/psd_publish_kaggle_lab.py"
spec = importlib.util.spec_from_file_location("psd_publish_kaggle_lab", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def payload():
    events = []
    for i in range(24):
        forecast = None if i >= 18 else {
            "value": (0 if i == 0 else i + .25),
            "status": "EXPERIMENTAL", "unit": "percent MoM",
            "method": "Synthetic baseline"
        }
        events.append({
            "event_id": f"fixture-{i}", "country": ["US", "UK", "CA", "AU", "JP"][i % 5],
            "indicator": f"Fixture indicator {i}", "release_at_utc": f"2026-11-{17+i//8}T13:30:00Z",
            "status": "RESEARCH_ONLY" if i < 18 else "WITHHELD",
            "psd_forecast": forecast,
            "review_reason": "SOURCE_MAPPING" if i >= 18 else ""
        })
    return {"schema": "psd-calendar-lab-research/1", "version":"V2.3",
            "production":False, "certified_28_day_accuracy":False,
            "forecast_week":{"monday":"2026-11-16","sunday":"2026-11-22"},
            "events":events,"source_private_key":"SHOULD_NEVER_LEAK"}

class TestSanitizer(unittest.TestCase):
    def assert_invalid(self, mutator):
        data = payload()
        mutator(data)
        with self.assertRaises((ValueError, TypeError)):
            module.validate(data)

    def test_valid_batch_and_privacy(self):
        out = module.validate(payload())
        self.assertEqual(len(out["events"]),24)
        self.assertEqual(sum(x["psd_forecast"] is not None for x in out["events"]),18)
        self.assertEqual(sum(x["psd_forecast"] is None for x in out["events"]),6)
        self.assertEqual(len({x["event_id"] for x in out["events"]}),24)
        self.assertTrue(out["lab_isolated"])
        self.assertIs(out["production"],False)
        self.assertIs(out["certified_28_day_accuracy"],False)
        self.assertNotIn("SHOULD_NEVER_LEAK",json.dumps(out))
        self.assertNotIn("source_private_key",json.dumps(out))
        self.assertTrue(any(e["psd_forecast"] is not None and e["psd_forecast"]["value"] == 0 for e in out["events"]))

    def test_reject_production_or_fake_accuracy(self):
        self.assert_invalid(lambda p:p.update(production=True))
        self.assert_invalid(lambda p:p.update(certified_28_day_accuracy=True))

    def test_reject_wrong_week(self):
        self.assert_invalid(lambda p:p["forecast_week"].update(monday="2026-11-17"))
        self.assert_invalid(lambda p:p["events"][0].update(release_at_utc="2026-11-29T13:30:00Z"))
        self.assert_invalid(lambda p:p["events"][0].update(release_at_utc="2026-11-18T13:30:00"))

    def test_reject_duplicate_or_unsupported_indicator(self):
        self.assert_invalid(lambda p:p["events"][1].update(event_id=p["events"][0]["event_id"]))
        self.assert_invalid(lambda p:p["events"][0].update(country="XX"))
        self.assert_invalid(lambda p:p["events"][0].update(indicator=""))

    def test_reject_fabricated_withheld_and_invalid_number(self):
        self.assert_invalid(lambda p:p["events"][20].update(psd_forecast={
            "value":1,"unit":"%","method":"fake","status":"EXPERIMENTAL"}))
        self.assert_invalid(lambda p:p["events"][0]["psd_forecast"].update(value=float("nan")))
        self.assert_invalid(lambda p:p["events"][0]["psd_forecast"].update(value=True))

if __name__ == "__main__":
    unittest.main()

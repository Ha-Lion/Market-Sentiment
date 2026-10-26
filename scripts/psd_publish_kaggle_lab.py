#!/usr/bin/env python3
"""Publish a sanitized research-only Kaggle forecast JSON for the public GitHub LAB.

Input: a privately downloaded Kaggle dataset folder.
Output: one strictly validated lab JSON; no raw history or Kaggle credentials.
"""
import argparse
import json
import math
import re
from datetime import date, datetime, timezone
from pathlib import Path


def validate(payload):
    if (not isinstance(payload, dict)
            or payload.get("schema") != "psd-calendar-lab-research/1"
            or not re.fullmatch(r"V\d+\.\d+(?:\.\d+)?", str(payload.get("version", "")))
            or payload.get("production") is not False
            or payload.get("certified_28_day_accuracy") is not False):
        raise ValueError("Not a nonproduction experimental forecast feed")
    week = payload.get("forecast_week", {})
    if not isinstance(week, dict):
        raise ValueError("Missing forecast week")
    monday, sunday = week.get("monday"), week.get("sunday")
    try:
        monday_d = date.fromisoformat(monday)
        sunday_d = date.fromisoformat(sunday)
    except (TypeError, ValueError) as e:
        raise ValueError("Invalid week dates") from e
    if monday_d.weekday() != 0 or (sunday_d - monday_d).days != 6:
        raise ValueError("Forecast week must be Monday through Sunday")
    events = payload.get("events")
    if not isinstance(events, list) or not (1 <= len(events) <= 1500):
        raise ValueError("Invalid event count")
    seen = set()
    safe_events = []
    for event in events:
        if not isinstance(event, dict):
            raise ValueError("Malformed event")
        event_id = event.get("event_id")
        country = event.get("country")
        indicator = event.get("indicator")
        status = event.get("status")
        stamp = event.get("release_at_utc")
        if (not isinstance(event_id, str) or not (1 <= len(event_id) <= 130)
                or event_id in seen
                or country not in {"US", "UK", "CA", "AU", "JP"}
                or not isinstance(indicator, str) or not (1 <= len(indicator.strip()) <= 250)
                or status not in {"RESEARCH_ONLY", "WITHHELD"}
                or not isinstance(stamp, str)):
            raise ValueError("Invalid identity / indicator / status")
        seen.add(event_id)
        try:
            parsed = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                raise ValueError("Release timestamp requires timezone")
            stamp_utc = parsed.astimezone(timezone.utc)
        except (TypeError, ValueError) as e:
            raise ValueError("Invalid event timestamp") from e
        if not monday_d <= stamp_utc.date() <= sunday_d:
            raise ValueError("Release timestamp outside forecast week")

        forecast = event.get("psd_forecast")
        safe_forecast = None
        if status == "RESEARCH_ONLY":
            if not isinstance(forecast, dict) or forecast.get("status") != "EXPERIMENTAL":
                raise ValueError("Research events require explicitly experimental forecast")
            value, unit, method = forecast.get("value"), forecast.get("unit"), forecast.get("method")
            if (type(value) not in (int, float) or not math.isfinite(value)
                    or not isinstance(unit, str) or not (1 <= len(unit.strip()) <= 90)
                    or not isinstance(method, str) or not (1 <= len(method.strip()) <= 100)):
                raise ValueError("Invalid forecast value, unit or model")
            safe_forecast = {"value": value, "unit": unit, "method": method, "status": "EXPERIMENTAL"}
        elif forecast is not None:
            raise ValueError("Withheld event has an unexpected forecast")
        safe_events.append({
            "event_id": event_id, "country": country,
            "indicator": indicator.strip(),
            "release_at_utc": stamp_utc.isoformat(),
            "psd_forecast": safe_forecast,
            "status": status,
            "review_reason": str(event.get("review_reason") or "")[:120] if status == "WITHHELD" else ""
        })
    safe_events.sort(key=lambda e: (e["release_at_utc"], e["country"], e["indicator"]))
    return {
        "schema": "psd-calendar-lab-research/1",
        "version": payload["version"],
        "forecast_week": {"monday": monday, "sunday": sunday},
        "production": False,
        "certified_28_day_accuracy": False,
        "lab_isolated": True,
        "source": "PSD Kaggle — sanitized experimental predictions only",
        "note": "LAB ONLY. Event dates unverified. Historical research is not proven 28-day-ahead accuracy.",
        "events": safe_events
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    files = list(args.dataset_dir.rglob("psd_calendar_lab_feed_v*.json"))
    if not files:
        raise SystemExit("No PSD calendar feed JSON in private Kaggle dataset")
    candidates = []
    for path in files:
        if path.stat().st_size > 3 * 1024 * 1024:
            raise SystemExit("Input file exceeds limit")
        payload = json.loads(path.read_text(encoding="utf-8"))
        sanitized = validate(payload)
        created = str(payload.get("created_utc", ""))
        candidates.append((created, path.name, sanitized))
    _, source_name, payload = max(candidates, key=lambda c: (c[0], c[1]))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    count = sum(e["psd_forecast"] is not None for e in payload["events"])
    print("Research feed staged:", source_name, len(payload["events"]), "events;", count, "experimental")
    print("Public sanitized forecast values ONLY; no keys, raw history, or private snapshots.")


if __name__ == "__main__":
    main()

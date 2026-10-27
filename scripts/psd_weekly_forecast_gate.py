#!/usr/bin/env python3
"""Validate a Kaggle research output before isolated PSD Lab ingestion.

No database credentials. Only cleans and emits a small research-only JSON.
The notebook must actually produce an output for the requested fourth week:
this script NEVER reuses a stale private dataset.
"""
import argparse
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from psd_publish_kaggle_lab import validate

MAX_BYTES = 3 * 1024 * 1024

def fourth_upcoming_week(reference: date) -> tuple[date, date]:
    """Week 1 starts on the next Monday, or today when already Monday."""
    next_monday = reference + timedelta(days=(7-reference.weekday()) % 7)
    monday = next_monday + timedelta(days=21)
    return monday, monday + timedelta(days=6)

def build(folder: Path, output: Path, *, reference: date) -> dict:
    monday, sunday = fourth_upcoming_week(reference)
    if not folder.is_dir():
        raise ValueError("Kaggle notebook output directory missing")
    candidates = sorted(folder.rglob("psd_calendar_lab_feed_v*.json"))
    if not candidates:
        raise ValueError("Kaggle notebook did not emit a PSD forecast JSON")
    good = []
    for path in candidates:
        if path.stat().st_size > MAX_BYTES:
            raise ValueError("Kaggle research feed exceeds 3 MB")
        data = json.loads(path.read_text(encoding="utf-8"))
        result = validate(data)
        week = result["forecast_week"]
        if week["monday"] != monday.isoformat() or week["sunday"] != sunday.isoformat():
            continue
        # Never treat a previous saved dataset as freshly generated.
        created = data.get("created_utc") or data.get("generated_at_utc")
        if not isinstance(created, str):
            raise ValueError("Forecast output missing generation timestamp")
        stamp = datetime.fromisoformat(created.replace("Z","+00:00"))
        if stamp.tzinfo is None:
            raise ValueError("Timestamp must be timezone-aware")
        if not reference - timedelta(days=1) <= stamp.astimezone(timezone.utc).date() <= reference + timedelta(days=1):
            raise ValueError("Forecast is stale; do not reuse a previous run")
        good.append((stamp, result))
    if not good:
        raise ValueError(f"No Kaggle output for expected fourth-week {monday}–{sunday}")
    payload = max(good, key=lambda x:x[0])[1]
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
    predicted = sum(e["psd_forecast"] is not None for e in payload["events"])
    print(f"Validated private Kaggle output: week {monday}–{sunday}, "
          f"{len(payload['events'])} events, {predicted} experimental, "
          f"{len(payload['events']) - predicted} withheld")
    return payload

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--reference-date",type=date.fromisoformat,
                        default=datetime.now(timezone.utc).date())
    args=parser.parse_args()
    build(args.output_dir,args.output,reference=args.reference_date)

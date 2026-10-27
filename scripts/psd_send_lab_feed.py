#!/usr/bin/env python3
"""Transfer only strict Kaggle research forecasts via short-lived GitHub OIDC.
No Supabase service-role token in GitHub or browser; signed identity is checked
by the dedicated Lab ingestion Edge Function before a Lab-only insert."""
import argparse
import json
import os
from pathlib import Path
import urllib.parse
import urllib.request
import urllib.error

AUDIENCE = "psd-economic-calendar-lab-ingest-v1"
TARGET = "https://fupexuonvzakoguucglk.supabase.co/functions/v1/psd-kaggle-lab-ingest"

def deliver(path):
    source = Path(path)
    if source.stat().st_size > 250_000:
        raise ValueError("Research transfer too large")
    payload = source.read_bytes()
    env = os.environ
    base = env.get("ACTIONS_ID_TOKEN_REQUEST_URL")
    secret = env.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    if not base or not secret or env.get("GITHUB_REPOSITORY") != "Ha-Lion/Market-Sentiment":
        raise RuntimeError("GitHub hosted OIDC environment required")
    request = urllib.request.Request(
        base + "&audience=" + urllib.parse.quote(AUDIENCE),
        headers={"Authorization": "Bearer " + secret})
    with urllib.request.urlopen(request, timeout=20) as response:
        token = json.load(response)["value"]
    if not isinstance(token,str) or len(token) < 50:
        raise RuntimeError("Invalid short-lived GitHub identity")
    transfer = urllib.request.Request(
        TARGET, data=payload, method="POST",
        headers={"Authorization":"Bearer "+token,
                 "Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(transfer, timeout=60) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Lab endpoint rejected transfer: HTTP {error.code}") from None
    if result.get("ok") is not True:
        raise RuntimeError("Lab ingestion not acknowledged")
    print("Lab ingestion:", {k:result.get(k) for k in
          ("event_count","forecast_count","withheld_count","duplicate","batch_hash")})
    return result

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--file",required=True)
    args=parser.parse_args()
    deliver(args.file)

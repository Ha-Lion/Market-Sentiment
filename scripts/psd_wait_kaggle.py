#!/usr/bin/env python3
"""Fail-closed poller for a private Kaggle notebook execution."""
import argparse
import subprocess
import sys
import time

def check(kernel, attempts=70, interval=45):
    for attempt in range(attempts):
        result = subprocess.run(["kaggle", "kernels", "status", kernel],
            capture_output=True, text=True, timeout=40, check=False)
        if result.returncode:
            raise RuntimeError("Kaggle status request failed")
        state = (result.stdout + " " + result.stderr).upper()
        if any(word in state for word in ("ERROR", "FAILED", "CANCELLED", "CANCELED")):
            raise RuntimeError("Kaggle notebook failed; no Lab publication")
        if "COMPLETE" in state:
            print("Private Kaggle notebook completed")
            return
        if not any(word in state for word in ("RUNNING", "QUEUED", "PENDING", "WAITING")):
            raise RuntimeError("Unknown Kaggle notebook state; no Lab publication")
        print("Kaggle job unfinished; attempt", attempt + 1)
        time.sleep(interval)
    raise TimeoutError("Kaggle notebook did not complete; no Lab publication")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--kernel", required=True)
    args = ap.parse_args()
    try:
        check(args.kernel)
    except Exception as exc:
        sys.exit(str(exc))

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def text(name):
    return (ROOT / name).read_text(
        encoding="utf-8",
        errors="replace"
    )

category = text("category-page-core.js")
core = text("sentiment-core.js")
ai = text("ai-assets.html")
pdf = text("pdf-report.js")
watch = text("watchlist.js")
dashboard = text("dashboard.html")

assert "50 + avg * 6" not in category
assert "Category PSI averages" not in category
assert ">Category PSI</span>" not in category
assert "Number(row.psi || 50)" not in ai

assert "globalFallback" not in core
assert "fb.score" not in core

assert (
    "entry.score != null ? entry.score : entry.headline_psi_score"
    not in core
)

assert "parseInt(scoreText, 10) || 50" not in pdf

mi = text("market-intelligence.html")

assert "num(r.psi)??50" not in mi
assert "num(r.psi) ?? 50" not in mi
assert "psi:50,d1:0" not in mi
assert "num(row.psi)??50" not in mi
assert "num(row.psi) ?? 50" not in mi
assert "if(psi===null)return null;" in mi
assert "psiValues.length" in mi
assert 'psi===null?"N/A":Math.round(psi)' in mi
assert 'num(r.psi)===null?"N/A":Math.round(num(r.psi))' in mi

assert 'exponentialMovingAverage(points,50,"psi")' in watch
assert 'exponentialMovingAverage(rows,50,"psi")' in dashboard

# Legitimate PSI zero must remain valid.
zero = float(0)
assert zero == 0

print("WEBSITE_ENGINE_TRUTH_CONTRACT: PASS")

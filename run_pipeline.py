"""
run_pipeline.py — single-command regeneration of every artifact.

This script regenerates every artifact in this repository from raw federal
data downloads in a single command.

SEQUENCE:
  1. Verify all 5 raw data files exist in data/raw/.
     (Raw downloads are a one-time setup step; the pipeline does NOT
     auto-download mid-run to avoid surprising the user with a 1.13 GB
     NPPES fetch. See README "Setup" for raw-data acquisition.)
  2. python python/01_load_data.py            — load raw CSVs into database.db
  3. python python/01b_data_quality_checks.py — 27 validation checks
  4. Execute sql/q01..q08 in order against database.db
     (q05 creates v_equity_gap_index VIEW; q06/q07/q08 read from it)
  5. python python/03_statistical_analysis.py — Pearson, OLS, bootstrap, outliers
  6. python python/02_visualize.py            — 5 visualizations

Exit codes:
  0 — every step exit-0; database row counts match expected
  1 — any step failed (stops on first failure with a clear pointer)

Wall time on a 2024 MacBook Pro: ~10-15s end-to-end (after raw data is in place).
"""

from __future__ import annotations

import logging
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

# =============================================================================
# Paths
# =============================================================================
PROJECT_ROOT = Path(__file__).resolve().parent
DB_PATH      = PROJECT_ROOT / "database.db"
DATA_RAW     = PROJECT_ROOT / "data" / "raw"
SQL_DIR      = PROJECT_ROOT / "sql"
PYTHON_DIR   = PROJECT_ROOT / "python"
VENV_PYTHON  = PROJECT_ROOT / "venv" / "bin" / "python"

# =============================================================================
# What we expect
# =============================================================================
REQUIRED_RAW = [
    "places_county_ms_2025.csv",
    "svi_county_ms_2022.csv",
    "cms_nppes_ms_primary_care_2026-05.csv",
    "census_acs_county_population_ms_2022.csv",
    "census_zcta_county_crosswalk_ms_2020.csv",
]

EXPECTED_ROW_COUNTS = {
    "counties":              82,
    "data_sources":           5,
    "taxonomies":             6,
    "measures":              40,
    "zcta_county_crosswalk": 771,
    "health_indicators":   6_560,
    "social_vulnerability":  82,
    "providers":           6_404,
    "provider_capacity":     492,
}

# =============================================================================
# Logging
# =============================================================================
logger = logging.getLogger("pipeline")

def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-5s  %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout,
    )

def banner(text: str, ch: str = "=") -> None:
    print(ch * 78)
    print(text)
    print(ch * 78)

# =============================================================================
# Helpers
# =============================================================================
def python_interpreter() -> str:
    """Prefer the project venv's python; fall back to current interpreter."""
    if VENV_PYTHON.exists():
        return str(VENV_PYTHON)
    return sys.executable

def verify_raw_data() -> bool:
    """Step 1 — confirm all 5 raw CSVs are present, or print clear remediation."""
    missing = [f for f in REQUIRED_RAW if not (DATA_RAW / f).exists()]
    if not missing:
        logger.info(f"verified all {len(REQUIRED_RAW)} raw CSVs present "
                    f"in {DATA_RAW.relative_to(PROJECT_ROOT)}/")
        return True
    logger.error("REQUIRED RAW DATA FILES MISSING from data/raw/:")
    for f in missing:
        logger.error(f"  - {f}")
    logger.error("")
    logger.error("Pipeline cannot run without these. Two ways to obtain them:")
    logger.error("  (a) Use the bundled raw files from the submission ZIP")
    logger.error("      (data/raw/ should already be populated when you unzip).")
    logger.error("  (b) Re-download from the URLs in DECISIONS.md (D-006..D-010).")
    logger.error("")
    logger.error("Pipeline does not auto-download mid-run to avoid surprising you")
    logger.error("with a 1.13 GB NPPES fetch. See README 'Setup' for details.")
    return False

def run_step(name: str, cmd: list[str], stdin_path: Path | None = None
             ) -> tuple[bool, float, int]:
    """Run a subprocess step. Logs start/end + duration. Returns (ok, secs, rc)."""
    logger.info(f"--- START: {name}")
    logger.info(f"    cmd:   {' '.join(map(str, cmd))}"
                + (f"  < {stdin_path.relative_to(PROJECT_ROOT)}" if stdin_path else ""))
    t0 = time.time()
    stdin = open(stdin_path) if stdin_path else None
    try:
        result = subprocess.run(cmd, stdin=stdin, check=False)
    finally:
        if stdin:
            stdin.close()
    duration = time.time() - t0
    ok = (result.returncode == 0)
    status = "OK" if ok else f"FAIL (exit {result.returncode})"
    logger.info(f"--- END:   {name}  [{duration:.2f}s, {status}]")
    return ok, duration, result.returncode

def print_db_row_counts() -> bool:
    """Sanity check: every table's row count matches EXPECTED_ROW_COUNTS."""
    if not DB_PATH.exists():
        logger.error(f"database.db not found: {DB_PATH}")
        return False
    conn = sqlite3.connect(str(DB_PATH))
    try:
        print()
        print("Final database row counts:")
        all_ok = True
        for table, expected in EXPECTED_ROW_COUNTS.items():
            actual = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            ok = (actual == expected)
            if not ok:
                all_ok = False
            mark = "OK" if ok else "MISMATCH"
            print(f"  {table:<25s} {actual:>10,d}  expected {expected:>5,d}  [{mark}]")
        return all_ok
    finally:
        conn.close()

# =============================================================================
# Main
# =============================================================================
def main() -> int:
    configure_logging()
    t_total_start = time.time()
    banner("Mississippi Health Equity Gap Index — full pipeline regeneration")

    # --- Step 1: verify raw data ---
    if not verify_raw_data():
        return 1

    py = python_interpreter()

    # --- Build the step list ---
    steps: list[tuple[str, list[str], Path | None]] = [
        ("loader (python/01_load_data.py)",
            [py, str(PYTHON_DIR / "01_load_data.py")], None),
        ("data quality checks (python/01b_data_quality_checks.py)",
            [py, str(PYTHON_DIR / "01b_data_quality_checks.py")], None),
    ]
    # SQL files in numeric order (q01..q08). q05 must run before q06/q07/q08
    # because q05 creates the v_equity_gap_index VIEW they read from. The
    # numeric prefix on filenames guarantees that ordering naturally.
    for sf in sorted(SQL_DIR.glob("q*.sql")):
        steps.append((f"SQL: {sf.name}", ["sqlite3", str(DB_PATH)], sf))
    steps.append(("statistical analysis (python/03_statistical_analysis.py)",
                  [py, str(PYTHON_DIR / "03_statistical_analysis.py")], None))
    steps.append(("visualizations (python/02_visualize.py)",
                  [py, str(PYTHON_DIR / "02_visualize.py")], None))

    # --- Execute, stop on first failure ---
    summary: list[tuple[str, float, int]] = []
    for name, cmd, stdin_path in steps:
        ok, dur, rc = run_step(name, cmd, stdin_path=stdin_path)
        summary.append((name, dur, rc))
        if not ok:
            print()
            banner(f"!!! PIPELINE FAILED at step: {name}", ch="!")
            print(f"Step exited with return code {rc}.")
            print("Investigate the failed step's output above; subsequent steps did NOT run.")
            return 1

    # --- Final summary ---
    total = time.time() - t_total_start
    print()
    banner("PIPELINE SUCCEEDED")
    print(f"{'STEP':<55s}{'DURATION':>14s}{'STATUS':>9s}")
    print("-" * 78)
    for name, dur, _rc in summary:
        print(f"{name:<55s}{dur:>13.2f}s{'OK':>9s}")
    print("-" * 78)
    print(f"{'TOTAL':<55s}{total:>13.2f}s")

    # --- DB sanity check ---
    if not print_db_row_counts():
        print()
        banner("!!! Row-count sanity check FAILED", ch="!")
        return 1

    print()
    banner("All artifacts regenerated. Database is loaded; visualizations are fresh.")
    return 0

if __name__ == "__main__":
    sys.exit(main())

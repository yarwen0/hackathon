"""
03_statistical_analysis.py — Statistical validation of the EGI

Four analyses run against the loaded database.db:

  1. PEARSON CORRELATION MATRIX (4x4)
     Correlations among burden_component, capacity_component,
     vulnerability_component, egi_score. Detects double-counting risk
     between components (D-016 flagged burden + vulnerability as the most
     likely pair to correlate strongly).

  2. OLS REGRESSION
     egi_score ~ pcp_per_10k + rpl_themes + is_rural + is_delta
     Tests which structural predictors are statistically associated with
     EGI. Coefficients + p-values + R^2 printed and saved.

  3. BOOTSTRAP CONFIDENCE INTERVALS for top-10 EGI scores
     For each top-10 county, resample its 10 per-measure normalized burden
     scores 1,000 times with replacement; recompute burden component and
     EGI per resample. 95% percentile CI per county tells us whether the
     ranking could plausibly flip under random measure selection.

  4. OUTLIER DETECTION
     z-score of egi_score across 82 counties; flag |z| > 2 as statistical
     outliers. Identifies counties materially different from the state
     distribution.

Inputs:
  database.db                                 (loader)
  v_equity_gap_index                          (sql/q05_equity_gap_index.sql)

Outputs:
  stdout                                      summary report
  visualizations/correlation_heatmap.png      seaborn heatmap
  data/processed/ols_regression_summary.txt   full statsmodels .summary()
  data/processed/bootstrap_ci_top10.csv       county, egi, ci_lo, ci_hi
  data/processed/outliers.txt                 |z|>2 county list

Exit codes:
  0 — all 4 analyses ran cleanly
  1 — any analysis failed (logs the traceback, no partial artifacts left)
"""

from __future__ import annotations

import logging
import sqlite3
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import statsmodels.api as sm
from scipy.stats import zscore

# =============================================================================
# Paths + constants
# =============================================================================
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH      = PROJECT_ROOT / "database.db"
VIZ_DIR      = PROJECT_ROOT / "visualizations"
PROC_DIR     = PROJECT_ROOT / "data" / "processed"

HEATMAP_PNG  = VIZ_DIR  / "correlation_heatmap.png"
OLS_TXT      = PROC_DIR / "ols_regression_summary.txt"
BOOT_CSV     = PROC_DIR / "bootstrap_ci_top10.csv"
OUTLIERS_TXT = PROC_DIR / "outliers.txt"

BOOTSTRAP_N      = 1_000
BOOTSTRAP_SEED   = 42
OUTLIER_Z_THRESH = 2.0

# =============================================================================
# Logging
# =============================================================================
logger = logging.getLogger("stats")

def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-5s  %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout,
    )

# =============================================================================
# Database access
# =============================================================================
def connect() -> sqlite3.Connection:
    """Open SQLite + enable FKs (defensive; we only read here)."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def load_master_df(conn) -> pd.DataFrame:
    """One row per county: EGI + components + pcp_per_10k + rpl_themes +
    is_delta + is_rural. The single dataframe used by analyses 1, 2, 4."""
    return pd.read_sql("""
        WITH per_county AS (
            SELECT c.fips, c.population,
                   COALESCE(SUM(pc.provider_count), 0) AS total_providers,
                   1.0 * COALESCE(SUM(pc.provider_count),0) * 10000.0 / c.population AS pcp_per_10k
            FROM counties c
            LEFT JOIN provider_capacity pc ON pc.fips = c.fips
            GROUP BY c.fips, c.population
        )
        SELECT v.fips, v.county_name, v.region, v.population,
               v.burden_component, v.capacity_component, v.vulnerability_component,
               v.egi_score, v.egi_rank,
               p.pcp_per_10k, p.total_providers,
               sv.rpl_themes,
               c.is_delta, c.is_rural
        FROM v_equity_gap_index v
        JOIN per_county         p  USING (fips)
        JOIN social_vulnerability sv USING (fips)
        JOIN counties            c  USING (fips)
        ORDER BY v.egi_rank
    """, conn)

def load_burden_normalized_wide(conn) -> pd.DataFrame:
    """Per-county per-measure normalized burden scores (wide: fips x measure_id).
    These are the same scores q05 averages to produce burden_component;
    we need them for the bootstrap (analysis 3)."""
    long = pd.read_sql("""
        WITH latest AS (
            SELECT measure_id, MAX(year) AS y FROM health_indicators GROUP BY measure_id
        ),
        burden_raw AS (
            SELECT hi.fips, hi.measure_id, m.polarity * hi.data_value AS pv
            FROM health_indicators hi
            JOIN measures m USING (measure_id)
            JOIN latest l   ON l.measure_id = hi.measure_id AND l.y = hi.year
            WHERE m.is_in_burden_composite = 1
              AND hi.data_value_type       = 'Age-adjusted prevalence'
              AND hi.data_value IS NOT NULL
        )
        SELECT
            fips,
            measure_id,
            100.0 * (pv - MIN(pv) OVER (PARTITION BY measure_id))
                  / NULLIF(MAX(pv) OVER (PARTITION BY measure_id)
                         - MIN(pv) OVER (PARTITION BY measure_id), 0)
                AS normalized_score
        FROM burden_raw
    """, conn)
    return long.pivot(index='fips', columns='measure_id', values='normalized_score')

# =============================================================================
# Analyses
# =============================================================================
def analysis_1_correlation(df: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    """Pearson correlation matrix among 3 components + EGI; render heatmap."""
    logger.info("=== ANALYSIS 1: Pearson correlation matrix ===")
    cols = ['burden_component', 'capacity_component', 'vulnerability_component', 'egi_score']
    corr = df[cols].corr(method='pearson')

    # Heatmap
    VIZ_DIR.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(7, 6))
    sns.heatmap(corr, annot=True, fmt=".3f", cmap='coolwarm', center=0,
                vmin=-1, vmax=1, square=True,
                cbar_kws={'label': 'Pearson r'}, ax=ax)
    ax.set_title('Pearson correlations: EGI components and composite\n(82 Mississippi counties)',
                 fontsize=11)
    plt.tight_layout()
    fig.savefig(HEATMAP_PNG, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    logger.info(f"  saved heatmap: {HEATMAP_PNG.relative_to(PROJECT_ROOT)}")

    # Find strongest non-self pair excluding EGI (which is by construction correlated
    # with all components since it's their weighted sum)
    components_only = corr.loc[cols[:3], cols[:3]].copy()
    np.fill_diagonal(components_only.values, np.nan)
    flat = components_only.unstack().dropna()
    strongest_pair = flat.idxmax()
    strongest_r    = flat.max()
    headline = (f"strongest component-pair correlation: {strongest_pair[0]} vs "
                f"{strongest_pair[1]} = r={strongest_r:.3f}")
    logger.info(f"  {headline}")
    if strongest_r > 0.7:
        logger.info("  WARNING: strong correlation (>0.7) suggests partial double-counting")
    elif strongest_r > 0.5:
        logger.info("  moderate correlation; components share signal but not redundant")
    else:
        logger.info("  components are largely independent")

    return corr, headline

def analysis_2_ols(df: pd.DataFrame) -> tuple[object, str]:
    """OLS: egi_score ~ pcp_per_10k + rpl_themes + is_rural + is_delta."""
    logger.info("=== ANALYSIS 2: OLS regression ===")
    y = df['egi_score']
    X = df[['pcp_per_10k', 'rpl_themes', 'is_rural', 'is_delta']].astype(float)
    X = sm.add_constant(X)
    model = sm.OLS(y, X).fit()

    PROC_DIR.mkdir(parents=True, exist_ok=True)
    OLS_TXT.write_text(str(model.summary()))
    logger.info(f"  saved OLS summary: {OLS_TXT.relative_to(PROJECT_ROOT)}")

    sig_vars = [v for v, p in model.pvalues.items() if v != 'const' and p < 0.05]
    headline = f"R^2={model.rsquared:.3f}; significant at p<0.05: {sig_vars or 'none'}"
    logger.info(f"  {headline}")
    return model, headline

def analysis_3_bootstrap(master: pd.DataFrame, burden_wide: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    """Bootstrap CI for top-10 county EGI scores. Resamples 10 burden
    measures with replacement; recomputes burden_component and EGI."""
    logger.info(f"=== ANALYSIS 3: Bootstrap CI (n={BOOTSTRAP_N}, seed={BOOTSTRAP_SEED}) ===")
    rng = np.random.default_rng(BOOTSTRAP_SEED)
    top10 = master[master.egi_rank <= 10].copy().sort_values('egi_rank')
    rows = []
    for _, row in top10.iterrows():
        scores = burden_wide.loc[row.fips].dropna().values
        k = len(scores)
        # Vectorized: draw all bootstrap samples at once
        samples = rng.choice(scores, size=(BOOTSTRAP_N, k), replace=True)
        burden_samples = samples.mean(axis=1)
        # EGI = (burden + capacity + vulnerability) / 3   (D-016 equal thirds)
        egi_samples = (burden_samples + row.capacity_component + row.vulnerability_component) / 3.0
        ci_lo, ci_hi = np.percentile(egi_samples, [2.5, 97.5])
        rows.append({
            'fips': row.fips,
            'county_name': row.county_name,
            'egi_rank': int(row.egi_rank),
            'egi_score': round(row.egi_score, 2),
            'ci_lo': round(ci_lo, 2),
            'ci_hi': round(ci_hi, 2),
            'ci_width': round(ci_hi - ci_lo, 2),
        })
    out = pd.DataFrame(rows)
    PROC_DIR.mkdir(parents=True, exist_ok=True)
    out.to_csv(BOOT_CSV, index=False)
    logger.info(f"  saved bootstrap CIs: {BOOT_CSV.relative_to(PROJECT_ROOT)}")

    # Rank-flip risk: are any adjacent counties' CIs overlapping in a way
    # that could plausibly flip the ordering?
    flip_risk = []
    for i in range(len(out) - 1):
        higher = out.iloc[i]   # better EGI rank (lower number, higher score)
        lower  = out.iloc[i+1]
        if lower['ci_hi'] > higher['ci_lo']:
            flip_risk.append(f"#{higher.egi_rank} {higher.county_name} <-> "
                             f"#{lower.egi_rank} {lower.county_name}")
    headline = (f"max CI width = {out.ci_width.max():.2f} EGI points; "
                f"potential rank-flip pairs in top-10: {len(flip_risk)}")
    logger.info(f"  {headline}")
    if flip_risk:
        for pair in flip_risk:
            logger.info(f"    overlap: {pair}")
    return out, headline

def analysis_4_outliers(df: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    """Flag counties with |z| > 2 on egi_score."""
    logger.info(f"=== ANALYSIS 4: Outlier detection (|z| > {OUTLIER_Z_THRESH}) ===")
    df = df.copy()
    df['egi_zscore'] = zscore(df['egi_score'])
    out = df.loc[df.egi_zscore.abs() > OUTLIER_Z_THRESH,
                 ['fips', 'county_name', 'region', 'egi_score', 'egi_rank', 'egi_zscore']]
    out = out.sort_values('egi_zscore', ascending=False)

    PROC_DIR.mkdir(parents=True, exist_ok=True)
    lines = ["EGI statistical outliers (|z| > 2 across the 82 MS counties)",
             "=" * 72,
             f"{'fips':<8}{'county':<22}{'region':<10}{'egi_score':>11}{'rank':>6}{'z':>9}"]
    for _, r in out.iterrows():
        lines.append(f"{r.fips:<8}{r.county_name:<22}{r.region:<10}"
                     f"{r.egi_score:>11.2f}{r.egi_rank:>6}{r.egi_zscore:>9.2f}")
    if out.empty:
        lines.append("(none)")
    OUTLIERS_TXT.write_text("\n".join(lines) + "\n")
    logger.info(f"  saved outliers: {OUTLIERS_TXT.relative_to(PROJECT_ROOT)}")

    headline = f"{len(out)} outlier counties (|z| > {OUTLIER_Z_THRESH})"
    logger.info(f"  {headline}")
    if not out.empty:
        for _, r in out.iterrows():
            logger.info(f"    {r.county_name:<22} egi={r.egi_score:.2f}  z={r.egi_zscore:+.2f}")
    return out, headline

# =============================================================================
# Main
# =============================================================================
def main() -> int:
    configure_logging()
    logger.info("=== 03_statistical_analysis.py starting ===")
    if not DB_PATH.exists():
        logger.error(f"database not found: {DB_PATH}")
        return 1

    conn = connect()
    try:
        master      = load_master_df(conn)
        burden_wide = load_burden_normalized_wide(conn)
        logger.info(f"loaded master: {len(master)} counties; burden_wide: "
                    f"{burden_wide.shape[0]} counties x {burden_wide.shape[1]} measures")

        corr, hl1     = analysis_1_correlation(master)
        ols,  hl2     = analysis_2_ols(master)
        boot, hl3     = analysis_3_bootstrap(master, burden_wide)
        outliers, hl4 = analysis_4_outliers(master)

        # Final summary table to stdout
        print()
        print("=" * 78)
        print("PHASE 3.5 STATISTICAL ANALYSIS — HEADLINE FINDINGS")
        print("=" * 78)
        for n, hl in [(1, hl1), (2, hl2), (3, hl3), (4, hl4)]:
            print(f"  Analysis {n}:  {hl}")
        print("=" * 78)
        print("Artifacts:")
        print(f"  {HEATMAP_PNG.relative_to(PROJECT_ROOT)}")
        print(f"  {OLS_TXT.relative_to(PROJECT_ROOT)}")
        print(f"  {BOOT_CSV.relative_to(PROJECT_ROOT)}")
        print(f"  {OUTLIERS_TXT.relative_to(PROJECT_ROOT)}")
        print("=" * 78)
        return 0
    except Exception:
        logger.exception("analysis failed")
        return 1
    finally:
        conn.close()

if __name__ == "__main__":
    sys.exit(main())

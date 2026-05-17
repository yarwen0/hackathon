"""
02_visualize.py — 5 visualizations for the EGI project.

V1 (HEADLINE): Interactive Plotly choropleth of MS 82 counties shaded by
                egi_score with hover tooltips + Issaquena callout.
                Outputs HTML (interactive) + PNG (slide-ready).
V2: Top-10 stacked horizontal bar chart — component contributions sum to EGI.
V3: 2x5 small multiples drivers grid — one subplot per top-10 county with
    driver_profile annotation (per QUESTIONS.md transparency note).
V4: 82-county burden vs capacity scatter colored by vulnerability;
    Issaquena gets a prominent star marker and bold label.
V5: Convenience copy of the full EGI ranking CSV into visualizations/.

Inputs:
  database.db (v_equity_gap_index from sql/q05)
  data/processed/q05_full_egi_ranking.csv (for V5 copy)
  data/raw/geojson_us_counties_fips.json (cached on first run from Plotly's
                                          public sample geojson)

Outputs:
  visualizations/mississippi_egi_map.html      (V1 interactive)
  visualizations/mississippi_egi_map.png       (V1 static)
  visualizations/top10_bar.png                 (V2)
  visualizations/drivers_grid.png              (V3)
  visualizations/burden_capacity_scatter.png   (V4)
  visualizations/full_ranking.csv              (V5)

Exit codes:
  0 — all 5 visualizations rendered cleanly
  1 — any failure (logged with traceback)
"""

from __future__ import annotations

import json
import logging
import shutil
import sqlite3
import sys
import urllib.request
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import plotly.graph_objects as go

# =============================================================================
# Paths + constants
# =============================================================================
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH      = PROJECT_ROOT / "database.db"
DATA_RAW     = PROJECT_ROOT / "data" / "raw"
PROC_DIR     = PROJECT_ROOT / "data" / "processed"
VIZ_DIR      = PROJECT_ROOT / "visualizations"

GEOJSON_URL   = ("https://raw.githubusercontent.com/plotly/datasets/"
                 "master/geojson-counties-fips.json")
GEOJSON_LOCAL = DATA_RAW / "geojson_us_counties_fips.json"

MAP_HTML       = VIZ_DIR / "mississippi_egi_map.html"
MAP_PNG        = VIZ_DIR / "mississippi_egi_map.png"
TOP10_BAR_PNG  = VIZ_DIR / "top10_bar.png"
DRIVERS_PNG    = VIZ_DIR / "drivers_grid.png"
SCATTER_PNG    = VIZ_DIR / "burden_capacity_scatter.png"
RANKING_CSV    = VIZ_DIR / "full_ranking.csv"
FULL_CSV_SRC   = PROC_DIR / "q05_full_egi_ranking.csv"

# Consistent component palette across V2/V3
COLOR_BURDEN        = "#d62728"   # red — burden
COLOR_CAPACITY      = "#1f77b4"   # blue — capacity
COLOR_VULNERABILITY = "#9467bd"   # purple — vulnerability

# Consistent matplotlib rcParams for all charts
plt.rcParams.update({
    "font.family":      "DejaVu Sans",
    "axes.facecolor":   "white",
    "figure.facecolor": "white",
    "savefig.facecolor":"white",
    "axes.edgecolor":   "#333333",
    "axes.labelcolor":  "#333333",
    "xtick.color":      "#333333",
    "ytick.color":      "#333333",
    "axes.titleweight": "bold",
})

# =============================================================================
# Logging
# =============================================================================
logger = logging.getLogger("viz")

def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-5s  %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout,
    )

# =============================================================================
# Data loaders
# =============================================================================
def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def load_egi(conn) -> pd.DataFrame:
    """All 82 counties from v_equity_gap_index (single source of truth)."""
    return pd.read_sql(
        "SELECT * FROM v_equity_gap_index ORDER BY egi_rank",
        conn, dtype={"fips": str},
    )

def derive_top10_with_driver_profile(egi: pd.DataFrame) -> pd.DataFrame:
    """Extract top-10 + compute dominant_component + driver_profile (matches q06)."""
    t = egi[egi.egi_rank <= 10].copy().sort_values("egi_rank")
    comp_cols = ["burden_component", "capacity_component", "vulnerability_component"]
    comp_labels = {"burden_component": "Burden",
                   "capacity_component": "Capacity",
                   "vulnerability_component": "Vulnerability"}
    t["dominant_component"] = t[comp_cols].idxmax(axis=1).map(comp_labels)
    t["max_component"]      = t[comp_cols].max(axis=1)
    # Second-largest: sort each row descending, take index 1
    t["second_max_component"] = t[comp_cols].apply(lambda r: r.nlargest(2).iloc[1], axis=1)
    t["gap"] = t.max_component - t.second_max_component
    def _profile(gap):
        if gap > 30: return "single-component dominant"
        if gap > 15: return "one component leading"
        return "multi-component"
    t["driver_profile"] = t.gap.apply(_profile)
    return t

# =============================================================================
# Geojson sourcing
# =============================================================================
def get_or_download_geojson() -> dict | None:
    """Return the FIPS-keyed county geojson dict; cache to data/raw/ on
    first download. Returns None if download fails (caller decides what
    to do — we log + skip V1 PNG/HTML rather than crash the whole script)."""
    if GEOJSON_LOCAL.exists():
        logger.info(f"using cached geojson: {GEOJSON_LOCAL.relative_to(PROJECT_ROOT)}")
        with open(GEOJSON_LOCAL) as f:
            return json.load(f)
    logger.info(f"downloading geojson from {GEOJSON_URL}")
    try:
        with urllib.request.urlopen(GEOJSON_URL, timeout=30) as r:
            data = json.load(r)
        DATA_RAW.mkdir(parents=True, exist_ok=True)
        with open(GEOJSON_LOCAL, "w") as f:
            json.dump(data, f)
        logger.info(f"cached geojson ({GEOJSON_LOCAL.stat().st_size:,} bytes) "
                    f"to {GEOJSON_LOCAL.relative_to(PROJECT_ROOT)}")
        return data
    except Exception as e:
        logger.error(f"geojson download failed: {e}")
        logger.error("V1 choropleth will be skipped. Future work: bundle the "
                     "Census TIGER county shapefile and use geopandas.")
        return None

# =============================================================================
# V1 — Interactive Plotly choropleth
# =============================================================================
def visualize_choropleth(egi: pd.DataFrame, geojson: dict | None) -> bool:
    """V1 — Plotly choropleth with continuous EGI color scale + top-10
    border overlay + corner annotation. Saves HTML + PNG."""
    logger.info("=== V1: Plotly choropleth ===")
    if geojson is None:
        logger.warning("V1 skipped: no geojson")
        return False
    VIZ_DIR.mkdir(parents=True, exist_ok=True)

    fig = go.Figure()

    # Main trace: all 82 MS counties colored by EGI (RdYlGn_r: green=low, red=high).
    fig.add_trace(go.Choropleth(
        geojson=geojson,
        locations=egi.fips,
        z=egi.egi_score,
        colorscale="RdYlGn_r",
        zmin=0, zmax=100,
        marker_line_color="white",
        marker_line_width=0.5,
        colorbar=dict(title="EGI score", thickness=15, len=0.7),
        customdata=egi[["county_name", "egi_rank",
                        "burden_component", "capacity_component",
                        "vulnerability_component"]].values,
        hovertemplate=(
            "<b>%{customdata[0]}</b><br>"
            "EGI rank: #%{customdata[1]}<br>"
            "EGI score: %{z:.2f}<br>"
            "Burden: %{customdata[2]:.2f}<br>"
            "Capacity: %{customdata[3]:.2f}<br>"
            "Vulnerability: %{customdata[4]:.2f}"
            "<extra></extra>"
        ),
        name="EGI",
    ))

    # Overlay: top-10 with thick black border (transparent fill).
    top10 = egi[egi.egi_rank <= 10]
    fig.add_trace(go.Choropleth(
        geojson=geojson,
        locations=top10.fips,
        z=[1] * len(top10),
        colorscale=[[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0)"]],
        showscale=False,
        marker_line_color="black",
        marker_line_width=2.2,
        hoverinfo="skip",
        name="Top 10",
    ))

    # Zoom to MS bounding box
    fig.update_geos(
        scope="usa",
        visible=False,
        showsubunits=True,
        center=dict(lat=32.7, lon=-89.7),
        projection_scale=8,
    )

    fig.update_layout(
        title=dict(
            text=("<b>Mississippi Health Equity Gap Index by County</b><br>"
                  "<sup>82 counties · 3-component composite (burden + capacity + vulnerability) · "
                  "Higher = more underserved</sup>"),
            x=0.5, xanchor="center",
            font=dict(size=18),
        ),
        annotations=[
            dict(
                xref="paper", yref="paper", x=0.02, y=0.97,
                showarrow=False, align="left",
                text=("<b>#1: Issaquena County</b><br>"
                      "EGI 87.35 · pop 1,206<br>"
                      "Federally-designated HPSA"),
                bgcolor="rgba(255,255,255,0.92)",
                bordercolor="#d62728", borderwidth=1.5,
                font=dict(size=11, color="#222"),
            ),
            dict(
                xref="paper", yref="paper", x=0.98, y=0.02,
                showarrow=False, align="right",
                text=("Top 10 outlined in <b>black</b>"),
                font=dict(size=9, color="#555"),
            ),
        ],
        margin=dict(l=10, r=10, t=80, b=10),
        height=820,
    )

    fig.write_html(MAP_HTML)
    logger.info(f"  saved {MAP_HTML.relative_to(PROJECT_ROOT)} ({MAP_HTML.stat().st_size:,} bytes)")
    try:
        fig.write_image(MAP_PNG, width=1500, height=950, scale=2)
        logger.info(f"  saved {MAP_PNG.relative_to(PROJECT_ROOT)} ({MAP_PNG.stat().st_size:,} bytes)")
    except Exception as e:
        logger.error(f"  PNG export failed: {e}")
        return False
    return True

# =============================================================================
# V2 — Top-10 stacked horizontal bar chart
# =============================================================================
def visualize_top10_bar(top10: pd.DataFrame) -> bool:
    """V2 — Weighted-contribution stacked bar chart. Each segment = component
    contribution to EGI (= component / 3); segments sum to the EGI score."""
    logger.info("=== V2: top-10 stacked bar ===")
    df = top10.sort_values("egi_rank", ascending=False)   # rank 1 ends up on top
    fig, ax = plt.subplots(figsize=(12, 7.5))
    y = np.arange(len(df))
    b = df.burden_component.values        / 3.0
    c = df.capacity_component.values      / 3.0
    v = df.vulnerability_component.values / 3.0
    ax.barh(y, b,                color=COLOR_BURDEN,        label="Burden × 1/3")
    ax.barh(y, c, left=b,        color=COLOR_CAPACITY,      label="Capacity × 1/3")
    ax.barh(y, v, left=b + c,    color=COLOR_VULNERABILITY, label="Vulnerability × 1/3")
    for i, e in enumerate(df.egi_score.values):
        ax.text(e + 0.7, i, f"{e:.2f}", va="center", fontsize=9, color="#222")
    ax.set_yticks(y)
    ax.set_yticklabels([f"#{r}  {n.replace(' County','')}"
                        for r, n in zip(df.egi_rank, df.county_name)],
                       fontsize=10)
    ax.set_xlabel("EGI score  (0–100, higher = more underserved)", fontsize=11)
    ax.set_xlim(0, 100)
    ax.set_title("Top 10 Most Underserved Mississippi Counties — EGI Component Breakdown",
                 fontsize=13)
    ax.legend(loc="lower right", fontsize=9, framealpha=0.95)
    ax.grid(axis="x", alpha=0.25)
    plt.tight_layout()
    fig.savefig(TOP10_BAR_PNG, dpi=150)
    plt.close(fig)
    logger.info(f"  saved {TOP10_BAR_PNG.relative_to(PROJECT_ROOT)} "
                f"({TOP10_BAR_PNG.stat().st_size:,} bytes)")
    return True

# =============================================================================
# V3 — 2×5 small multiples drivers grid
# =============================================================================
def visualize_drivers_grid(top10: pd.DataFrame) -> bool:
    """V3 — 2x5 small multiples: one subplot per top-10 county; 3 bars
    (burden/capacity/vulnerability) per subplot; driver_profile annotated
    bottom-right per subplot to make D-019/QUESTIONS.md transparency visible."""
    logger.info("=== V3: drivers grid ===")
    df = top10.sort_values("egi_rank")
    fig, axes = plt.subplots(2, 5, figsize=(16, 7), sharey=True)
    labels = ["Burden", "Capacity", "Vulnerability"]
    colors = [COLOR_BURDEN, COLOR_CAPACITY, COLOR_VULNERABILITY]
    for ax, (_, row) in zip(axes.flat, df.iterrows()):
        vals = [row.burden_component, row.capacity_component, row.vulnerability_component]
        ax.bar(labels, vals, color=colors, edgecolor="black", linewidth=0.5)
        ax.set_title(f"#{row.egi_rank}  {row.county_name.replace(' County','')}\nEGI {row.egi_score:.1f}",
                     fontsize=10)
        ax.set_ylim(0, 108)
        ax.tick_params(axis="x", labelsize=8)
        ax.tick_params(axis="y", labelsize=8)
        ax.text(0.97, 0.04, row.driver_profile,
                transform=ax.transAxes, ha="right", va="bottom",
                fontsize=7, style="italic", color="#444", alpha=0.85,
                bbox=dict(boxstyle="round,pad=0.25", fc="white",
                          ec="#999", lw=0.5, alpha=0.8))
    axes[0, 0].set_ylabel("Component score (0–100)")
    axes[1, 0].set_ylabel("Component score (0–100)")
    fig.suptitle("Component Profile per Top-10 County\n"
                 "Burden / Capacity / Vulnerability (each min-max normalized 0–100; higher = worse)",
                 fontsize=13)
    plt.tight_layout()
    fig.savefig(DRIVERS_PNG, dpi=150)
    plt.close(fig)
    logger.info(f"  saved {DRIVERS_PNG.relative_to(PROJECT_ROOT)} "
                f"({DRIVERS_PNG.stat().st_size:,} bytes)")
    return True

# =============================================================================
# V4 — Burden vs Capacity scatter, colored by Vulnerability
# =============================================================================
def visualize_burden_capacity_scatter(egi: pd.DataFrame) -> bool:
    """V4 — All 82 counties; viridis color by vulnerability; danger-zone
    shading in the both-above-median quadrant; top-10 labeled with
    Issaquena highlighted via gold star + bold label."""
    logger.info("=== V4: burden vs capacity scatter ===")
    fig, ax = plt.subplots(figsize=(12, 9))
    sc = ax.scatter(
        egi.burden_component, egi.capacity_component,
        c=egi.vulnerability_component, cmap="viridis",
        s=70, edgecolor="black", linewidth=0.4, alpha=0.85,
        vmin=0, vmax=100,
    )
    cbar = plt.colorbar(sc, ax=ax)
    cbar.set_label("Vulnerability component  (0–100)", fontsize=10)

    # Danger zone: both above median
    med_b = egi.burden_component.median()
    med_c = egi.capacity_component.median()
    max_b = egi.burden_component.max() + 4
    max_c = egi.capacity_component.max() + 4
    min_b = egi.burden_component.min() - 4
    min_c = egi.capacity_component.min() - 4
    ax.axvline(med_b, color="gray", linestyle="--", alpha=0.45, linewidth=1)
    ax.axhline(med_c, color="gray", linestyle="--", alpha=0.45, linewidth=1)
    ax.fill_betweenx([med_c, max_c], med_b, max_b, color="red", alpha=0.06, zorder=0)
    ax.text(max_b - 0.5, max_c - 0.5,
            "DANGER ZONE\n(burden & capacity both above median)",
            fontsize=8.5, style="italic", color="#7d0a0a",
            ha="right", va="top", alpha=0.85)

    # Top-10 labels (Issaquena bolder/larger)
    top10 = egi[egi.egi_rank <= 10]
    for _, row in top10.iterrows():
        is_issaquena = row.county_name == "Issaquena County"
        ax.annotate(
            row.county_name.replace(" County", ""),
            xy=(row.burden_component, row.capacity_component),
            xytext=(8, 6), textcoords="offset points",
            fontsize=11 if is_issaquena else 9,
            fontweight="bold" if is_issaquena else "normal",
            color="#222",
        )

    # Issaquena star marker overlay
    iss = egi[egi.county_name == "Issaquena County"].iloc[0]
    ax.scatter(iss.burden_component, iss.capacity_component,
               marker="*", s=380, color="gold",
               edgecolor="black", linewidth=1.5, zorder=10)

    ax.set_xlim(min_b, max_b)
    ax.set_ylim(min_c, max_c)
    ax.set_xlabel("Burden component  (0–100, higher = more disease + worse access)",
                  fontsize=11)
    ax.set_ylabel("Capacity component  (0–100, higher = scarcer providers)", fontsize=11)
    ax.set_title("Mississippi Counties: Burden vs Capacity, Colored by Vulnerability\n"
                 "82 counties · top-10 EGI labeled · Issaquena (★) is #1 EGI",
                 fontsize=13)
    ax.grid(alpha=0.2)
    plt.tight_layout()
    fig.savefig(SCATTER_PNG, dpi=150)
    plt.close(fig)
    logger.info(f"  saved {SCATTER_PNG.relative_to(PROJECT_ROOT)} "
                f"({SCATTER_PNG.stat().st_size:,} bytes)")
    return True

# =============================================================================
# V5 — Convenience copy of full ranking CSV
# =============================================================================
def copy_full_ranking_csv() -> bool:
    """V5 — Copy the q05 full EGI ranking CSV into visualizations/ for
    'all viz in one folder' convenience."""
    logger.info("=== V5: copy full ranking CSV ===")
    if not FULL_CSV_SRC.exists():
        logger.error(f"missing source CSV: {FULL_CSV_SRC}")
        return False
    VIZ_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy(FULL_CSV_SRC, RANKING_CSV)
    logger.info(f"  copied {FULL_CSV_SRC.relative_to(PROJECT_ROOT)} "
                f"-> {RANKING_CSV.relative_to(PROJECT_ROOT)}")
    return True

# =============================================================================
# Main
# =============================================================================
def main() -> int:
    configure_logging()
    logger.info("=== 02_visualize.py starting ===")
    if not DB_PATH.exists():
        logger.error(f"database.db not found: {DB_PATH}")
        return 1
    VIZ_DIR.mkdir(parents=True, exist_ok=True)

    conn = connect()
    try:
        egi = load_egi(conn)
        top10 = derive_top10_with_driver_profile(egi)
        logger.info(f"loaded {len(egi)} counties; top10 with driver_profile derived")

        geojson = get_or_download_geojson()

        results = {
            "V1 choropleth":            visualize_choropleth(egi, geojson),
            "V2 top10 bar":             visualize_top10_bar(top10),
            "V3 drivers grid":          visualize_drivers_grid(top10),
            "V4 burden-capacity scatter": visualize_burden_capacity_scatter(egi),
            "V5 full ranking CSV":      copy_full_ranking_csv(),
        }

        # Summary
        print()
        print("=" * 70)
        print("PHASE 4 VISUALIZATIONS — SUMMARY")
        print("=" * 70)
        for name, ok in results.items():
            mark = "OK  " if ok else "FAIL"
            print(f"  [{mark}]  {name}")
        print("=" * 70)
        for path in [MAP_HTML, MAP_PNG, TOP10_BAR_PNG, DRIVERS_PNG, SCATTER_PNG, RANKING_CSV]:
            if path.exists():
                rel = str(path.relative_to(PROJECT_ROOT))
                print(f"  {rel:60s}  {path.stat().st_size:>10,d} bytes")
        print("=" * 70)
        return 0 if all(results.values()) else 1
    except Exception:
        logger.exception("visualization failed")
        return 1
    finally:
        conn.close()

if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env bash
# Build public/data/airspace.geojson from the FAA NASR Class_Airspace shapefile, and
# public/data/airports.json (for search) from the NASR airport list.
#
# Usage: scripts/build-airspace.sh [path/to/28DaySubscription_Effective_YYYY-MM-DD]
# With no argument, uses the newest 28DaySubscription_Effective_* folder in the repo root.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$REPO_ROOT/public/data"

# Optional region to export as "minLon minLat maxLon maxLat", e.g. "-123.2 36.4 -120.8 38.6"
# for the SF Bay Area. Empty means the whole country.
REGION_BBOX="${REGION_BBOX:-}"

# The FAA draws arcs with a point every few meters. Simplifying to about 2 m (in degrees)
# makes the file about 15 times smaller without any visible difference.
SIMPLIFY_DEGREES="0.00002"

# Only the fields we use. UPPER_DESC says whether the ceiling is included (TI) or not (TNI).
FIELDS="IDENT,NAME,CLASS,LOWER_VAL,LOWER_CODE,UPPER_VAL,UPPER_CODE,UPPER_DESC"

# Class B, C and D only. Features marked EXCLUSION are kept and drawn like any other: the
# FAA cuts an excluded area (like San Diego's VFR corridor) out of the main shapes at every
# altitude, and these features put the airspace back above and below it.
WHERE="CLASS IN ('B','C','D')"


# Find the NASR cycle folder.
if [[ $# -ge 1 ]]; then
    NASR_DIR="$1"
else
    # "|| true": with no folders, ls fails, which would otherwise end the script silently.
    NASR_DIR="$(ls -d "$REPO_ROOT"/28DaySubscription_Effective_*/ 2>/dev/null | sort | tail -n 1 || true)"
    if [[ -z "$NASR_DIR" ]]; then
        echo "No NASR cycle folder found in $REPO_ROOT." >&2
        echo "Download one first, e.g.: scripts/fetch-nasr.sh $(node "$REPO_ROOT/scripts/nasr-cycle.js")" >&2
        exit 1
    fi
fi
NASR_DIR="${NASR_DIR%/}"
SHAPEFILE="$NASR_DIR/Additional_Data/Shape_Files/Class_Airspace.shp"

if [[ ! -f "$SHAPEFILE" ]]; then
    echo "Shapefile not found: $SHAPEFILE" >&2
    exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# The airport list for search: CSV_Data/APT_BASE.csv from fetch-nasr.sh, or inside the
# CSV zip that comes with the full subscription download.
APT_CSV="$NASR_DIR/CSV_Data/APT_BASE.csv"
if [[ ! -f "$APT_CSV" ]]; then
    CSV_ZIP="$(ls "$NASR_DIR"/CSV_Data/*_CSV.zip 2>/dev/null | head -n 1 || true)"
    if [[ -n "$CSV_ZIP" ]] && unzip -q -o "$CSV_ZIP" APT_BASE.csv -d "$TMP_DIR"; then
        APT_CSV="$TMP_DIR/APT_BASE.csv"
    else
        echo "Airport list not found: $APT_CSV" >&2
        echo "Download the cycle with scripts/fetch-nasr.sh, which gets both files." >&2
        exit 1
    fi
fi

# The effective date comes from the folder name, e.g. 28DaySubscription_Effective_2026-10-29.
CYCLE_DATE="$(basename "$NASR_DIR" | sed -n 's/^28DaySubscription_Effective_\([0-9-]*\)$/\1/p')"
if [[ -z "$CYCLE_DATE" ]]; then
    echo "Can't read the effective date from folder name: $(basename "$NASR_DIR")" >&2
    exit 1
fi


# Use ogr2ogr from PATH (e.g. Homebrew GDAL), or the copy bundled with QGIS.
QGIS_BIN="/Applications/QGIS.app/Contents/MacOS"
if command -v ogr2ogr >/dev/null 2>&1; then
    OGR2OGR="ogr2ogr"
elif [[ -x "$QGIS_BIN/ogr2ogr" ]]; then
    OGR2OGR="$QGIS_BIN/ogr2ogr"
    # The bundled copy needs to be told where its coordinate system database is.
    export PROJ_DATA="/Applications/QGIS.app/Contents/Resources/qgis/proj"
else
    echo "ogr2ogr not found. Install GDAL (brew install gdal) or QGIS." >&2
    exit 1
fi


mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/airspace.geojson"

# ogr2ogr writes the raw export here, then resolve-overlaps.js writes the final file.
RAW_FILE="$TMP_DIR/airspace-raw.geojson"

echo "Cycle:  $CYCLE_DATE"
echo "Input:  $SHAPEFILE"
echo "Output: $OUT_FILE"

# The FAA data is NAD83. -a_srs labels it WGS84 without converting: the two differ by about
# 1 to 2 m in the US, far less than the airspace boundaries' own precision, and GDAL has no
# single exact conversion between them.
# RFC7946=YES writes standard GeoJSON with consistent polygon winding.
# -dim XY drops the unused z values from the shapefile's 3D polygons.
REGION_ARGS=()
if [[ -n "$REGION_BBOX" ]]; then
    REGION_ARGS=(-spat $REGION_BBOX)
fi

"$OGR2OGR" -f GeoJSON "$RAW_FILE" "$SHAPEFILE" \
    -a_srs EPSG:4326 \
    ${REGION_ARGS[@]+"${REGION_ARGS[@]}"} \
    -where "$WHERE" \
    -simplify "$SIMPLIFY_DEGREES" \
    -select "$FIELDS" \
    -dim XY \
    -nln airspace \
    -lco RFC7946=YES \
    -lco COORDINATE_PRECISION=6

# Cut overlapping volumes so each point in space belongs to one airspace.
# Stops the build if a Class D overlap has no rule in scripts/airspace-rules.json.
node "$REPO_ROOT/scripts/resolve-overlaps.js" "$RAW_FILE" "$OUT_FILE"

# Test known points from charts and legal descriptions (scripts/airspace-checks.json).
node "$REPO_ROOT/scripts/check-airspace.js" "$OUT_FILE"

# The public-use airport list for the search box.
node "$REPO_ROOT/scripts/build-airports.js" "$APT_CSV" "$OUT_DIR/airports.json"

# Mode C veil: 30 NM around the airports in scripts/mode-c-veil.json (14 CFR 91 Appendix D).
node "$REPO_ROOT/scripts/build-mode-c-veil.js" "$APT_CSV" "$OUT_DIR/mode-c-veil.geojson"

# Record which cycle the data is from, so the site can show it.
printf '{\n    "effective": "%s"\n}\n' "$CYCLE_DATE" > "$OUT_DIR/cycle.json"

echo "Done: $(du -h "$OUT_FILE" | cut -f1)"

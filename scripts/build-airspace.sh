#!/usr/bin/env bash
# Build public/data/airspace.geojson from the FAA NASR Class_Airspace shapefile.
#
# Usage: scripts/build-airspace.sh [path/to/28DaySubscription_Effective_YYYY-MM-DD]
# With no argument, uses the newest 28DaySubscription_Effective_* folder in the repo root.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$REPO_ROOT/public/data"

# Region to export (lon/lat): SF Bay Area, Monterey, Modesto and Napa.
REGION_BBOX="-123.2 36.4 -120.8 38.6"

# Only the fields we use. UPPER_DESC says whether the ceiling is included (TI) or not (TNI).
FIELDS="IDENT,NAME,CLASS,LOWER_VAL,LOWER_CODE,UPPER_VAL,UPPER_CODE,UPPER_DESC"

# Class B, C and D only. Exclusion features are carve-outs from other airspace
# (San Diego Class B, King Salmon Class D), which a solid volume can't show yet.
WHERE="CLASS IN ('B','C','D') AND EXCLUSION = '0'"


# Find the NASR cycle folder.
if [[ $# -ge 1 ]]; then
    NASR_DIR="$1"
else
    NASR_DIR="$(ls -d "$REPO_ROOT"/28DaySubscription_Effective_*/ 2>/dev/null | sort | tail -n 1)"
fi
NASR_DIR="${NASR_DIR%/}"
SHAPEFILE="$NASR_DIR/Additional_Data/Shape_Files/Class_Airspace.shp"

if [[ ! -f "$SHAPEFILE" ]]; then
    echo "Shapefile not found: $SHAPEFILE" >&2
    exit 1
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
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
RAW_FILE="$TMP_DIR/airspace-raw.geojson"

echo "Cycle:  $CYCLE_DATE"
echo "Input:  $SHAPEFILE"
echo "Output: $OUT_FILE"

# The FAA data is NAD83. -a_srs labels it WGS84 without converting: the two differ by about
# 1 to 2 m in the US, far less than the airspace boundaries' own precision, and GDAL has no
# single exact conversion between them.
# RFC7946=YES writes standard GeoJSON with consistent polygon winding.
# -dim XY drops the unused z values from the shapefile's 3D polygons.
"$OGR2OGR" -f GeoJSON "$RAW_FILE" "$SHAPEFILE" \
    -a_srs EPSG:4326 \
    -spat $REGION_BBOX \
    -where "$WHERE" \
    -select "$FIELDS" \
    -dim XY \
    -nln airspace \
    -lco RFC7946=YES \
    -lco COORDINATE_PRECISION=6

# Cut overlapping volumes so each point in space belongs to one airspace.
# Stops the build if a Class D overlap has no rule in scripts/airspace-rules.json.
node "$REPO_ROOT/scripts/resolve-overlaps.js" "$RAW_FILE" "$OUT_FILE"

# Record which cycle the data is from, so the site can show it.
printf '{\n    "effective": "%s"\n}\n' "$CYCLE_DATE" > "$OUT_DIR/cycle.json"

echo "Done: $(du -h "$OUT_FILE" | cut -f1)"

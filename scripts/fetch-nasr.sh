#!/usr/bin/env bash
# Download the Class Airspace shapefile and the airport list for one NASR cycle from the FAA.
#
# Usage: scripts/fetch-nasr.sh YYYY-MM-DD [output root]
#
# Writes into <output root>/28DaySubscription_Effective_YYYY-MM-DD/, in the same layout as the
# full subscription download, so build-airspace.sh works either way:
#   Additional_Data/Shape_Files/Class_Airspace.*
#   CSV_Data/APT_BASE.csv
# The output root defaults to the repo root. Exits with an error if the cycle isn't posted yet.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CYCLE_DATE="${1:-}"
OUT_ROOT="${2:-$REPO_ROOT}"

if [[ ! "$CYCLE_DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    echo "Usage: scripts/fetch-nasr.sh YYYY-MM-DD [output root]" >&2
    exit 1
fi

# Only the Class Airspace shapefile (about 150 MB), not the whole subscription.
URL="https://nfdc.faa.gov/webContent/28DaySub/$CYCLE_DATE/class_airspace_shape_files.zip"
NASR_DIR="$OUT_ROOT/28DaySubscription_Effective_$CYCLE_DATE"
SHAPE_DIR="$NASR_DIR/Additional_Data/Shape_Files"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Downloading $URL"
if ! curl --fail --silent --show-error --location --retry 3 --max-time 600 -o "$TMP_DIR/class.zip" "$URL"; then
    echo "Couldn't download the $CYCLE_DATE cycle. It may not be posted yet." >&2
    exit 1
fi

unzip -q "$TMP_DIR/class.zip" -d "$TMP_DIR/unzipped"

for ext in shp shx dbf prj; do
    if [[ ! -f "$TMP_DIR/unzipped/Shape_Files/Class_Airspace.$ext" ]]; then
        echo "The download is missing Class_Airspace.$ext." >&2
        exit 1
    fi
done

mkdir -p "$SHAPE_DIR"
mv "$TMP_DIR"/unzipped/Shape_Files/Class_Airspace.* "$SHAPE_DIR/"
echo "Saved to $SHAPE_DIR"

# The airport list (about 8 MB). Its file name uses dates like 29_Oct_2026.
CSV_DATE="$(node -e '
    const [y, m, d] = process.argv[1].split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    console.log(`${d}_${months[Number(m) - 1]}_${y}`);
' "$CYCLE_DATE")"
APT_URL="https://nfdc.faa.gov/webContent/28DaySub/extra/${CSV_DATE}_APT_CSV.zip"
CSV_DIR="$NASR_DIR/CSV_Data"

echo "Downloading $APT_URL"
if ! curl --fail --silent --show-error --location --retry 3 --max-time 600 -o "$TMP_DIR/apt.zip" "$APT_URL"; then
    echo "Couldn't download the $CYCLE_DATE airport list. It may not be posted yet." >&2
    exit 1
fi

mkdir -p "$CSV_DIR"
if ! unzip -q -o "$TMP_DIR/apt.zip" APT_BASE.csv -d "$CSV_DIR"; then
    echo "The airport download is missing APT_BASE.csv." >&2
    exit 1
fi
echo "Saved to $CSV_DIR/APT_BASE.csv"

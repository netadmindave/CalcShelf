#!/bin/sh
# Builds the CalcShelf Solver for the TI-Nspire, TI-89 / TI-92 Plus / Voyage 200 and TI-84 Plus, tests them,
# and copies the calculator files to TI-Apps/ at the top of the repo.
# Needs node, python3 with lupa and tivars (pip install lupa tivars), and luna on PATH or in this folder.
set -e
HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$HERE/../.." && pwd); OUT="$HERE/out"; DEST="$ROOT/TI-Apps"
node "$HERE/build.js"
python3 "$HERE/test_solver.py"
rm -rf "$OUT/ti84" "$OUT/ti89"
node "$HERE/ti.js"
python3 "$HERE/ti84pack.py"
python3 "$HERE/check84.py"
mkdir -p "$DEST/TI-Nspire" "$DEST/TI-89" "$DEST/TI-84"
rm -f "$DEST/TI-89/"*.89p "$DEST/TI-84/"*.8xp "$DEST/"*.zip
cp "$OUT/CalcShelf-Solver.tns" "$DEST/TI-Nspire/"
cp "$OUT/ti89/"*.89p "$DEST/TI-89/"
cp "$OUT/ti84/"*.8xp "$DEST/TI-84/"
( cd "$DEST/TI-89" && zip -q -X "$DEST/CalcShelf-Solver-TI89.zip" *.89p )
( cd "$DEST/TI-84" && zip -q -X "$DEST/CalcShelf-Solver-TI84.zip" *.8xp )
echo "TI-Apps: $(ls "$DEST/TI-89" | wc -l) TI-89 files, $(ls "$DEST/TI-84" | wc -l) TI-84 files, 1 TI-Nspire file"

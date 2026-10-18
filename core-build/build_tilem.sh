#!/bin/bash
# Builds the TilEm 2 core (TI-73/81/82/83/83+/84+/85/86) + Graph89 wabbit helpers to WebAssembly.
J=${J:-$HOME/w/src/graph89/app/src/main/jni}
B=$(cd "$(dirname "$0")" && pwd)
OUT=$B/obj; mkdir -p $OUT
CC="python3 -m ziglang cc -target wasm32-wasi"
TL=$J/tilem-2.0; CA=$J/libticalcs2-1.1.7; FI=$J/libtifiles2-1.1.5; CO=$J/libticonv-1.1.3; CB=$J/libticables2-1.3.3
INC="-I$B/shim -I$B/tz80 -I$TL -I$TL/emu -I$TL/gui -I$FI/src -I$CO/src -I$CA/src -I$CB/src -I$J/wrapper"
COMMON="-include glib_extra.h -include stdlib.h -include string.h -O2 -DHAVE_CONFIG_H -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS -D_WASI_EMULATED_MMAN -w -fno-strict-aliasing -Werror=implicit-function-declaration -Wno-error=int-conversion -Wno-error=incompatible-pointer-types -Wno-error=implicit-int"
EMU="emu/calcs.c emu/z80.c emu/state.c emu/rom.c emu/flash.c emu/link.c emu/keypad.c emu/lcd.c emu/cert.c emu/md5.c emu/timers.c emu/monolcd.c emu/graylcd.c emu/grayimage.c emu/graycolor.c"
for m in x7 x1 x2 x3 xp xs x4 xz xn x5 x6; do EMU="$EMU emu/$m/${m}_init.c emu/$m/${m}_io.c emu/$m/${m}_memory.c emu/$m/${m}_subcore.c"; done
GUI="gui/memory.c gui/link.c gui/emucore.c gui/tool.c gui/ti81prg.c"
WR="wabbitvar.c wabbitlink.c bootimage.c"
fail=0; objs=""
comp() { local p=$1 d=$2; shift 2; local list=$1; shift
  for s in $list; do
    o=$OUT/${p}_$(echo $s | tr '/' '_' ).o; objs="$objs $o"
    src=$d/$s; [ -f $B/overlay/$p/$s ] && src=$B/overlay/$p/$s
    if [ ! -f $o ] || [ $src -nt $o ] || [ -n "$FORCE" ]; then
      $CC $COMMON $INC "$@" -c $src -o $o 2>>$B/errors_tilem.log || { echo "FAIL $p $s"; fail=1; }
    fi
  done; }
: > $B/errors_tilem.log
comp tilem $TL "$EMU $GUI"
comp wrap $J/wrapper "$WR"
comp shimx $B "shim/glib_extra.c"
for s in $B/tz80/*.c; do [ -f "$s" ] && comp tz80 $B/tz80 "$(basename $s)"; done
# shared libti* + glib shim objects from the TiEmu build
for p in conv files calcs cables shim wasm_tigroup; do objs="$objs $(ls $OUT/${p}_*.o | tr '\n' ' ')"; done
echo "$objs" > $B/objs_tilem.txt
exit $fail

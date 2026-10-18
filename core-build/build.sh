#!/bin/bash
# Builds the TiEmu core + libti* + wrapper to WebAssembly (wasm32-wasi) using zig cc.
J=${J:-$HOME/w/src/graph89/app/src/main/jni}
B=$(cd "$(dirname "$0")" && pwd)
OUT=$B/obj; mkdir -p $OUT
CC="python3 -m ziglang cc -target wasm32-wasi"
T=$J/tiemu-3.03; CA=$J/libticalcs2-1.1.7; FI=$J/libtifiles2-1.1.5; CO=$J/libticonv-1.1.3; CB=$J/libticables2-1.3.3
INC="-I$B/shim -I$B/wasm -I$T/src -I$T/src/core/ti_hw -I$T/src/core/ti_sw -I$T/src/core/uae -I$T/src/core -I$T/src/core/dbg -I$T/src/misc -I$T/src/gui -I$FI/src -I$CO/src -I$CA/src -I$CB/src -I$J/wrapper"
COMMON="-include stdlib.h -include string.h -O2 -DHAVE_CONFIG_H -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS -D_WASI_EMULATED_MMAN -w -Werror=implicit-function-declaration -fno-strict-aliasing -Werror=implicit-function-declaration -Wno-error=int-conversion -Wno-error=incompatible-pointer-types -Wno-error=implicit-int"
DEFS_TIEMU="-DDEBUGGER -DNO_GDB -DNO_SOUND"
DEFS_CB="-DNO_CABLE_BLK -DNO_CABLE_GRY -DNO_CABLE_PAR -DNO_CABLE_SLV -DNO_CABLE_VTI -DNO_CABLE_TIE"
TIEMU_SRC="src/core/uae/readcpu.c src/core/uae/cpudefs.c src/core/uae/missing.c src/core/uae/xmalloc.c src/core/uae/cpustbl.c src/core/uae/fpp.c src/core/uae/cpuemu.c src/core/uae/newcpu.c src/core/error.c src/core/engine.c src/core/images.c src/core/interface.c src/core/state.c src/core/type2str.c src/core/hwpm.c src/core/ti_hw/dbus.c src/core/ti_hw/flash.c src/core/ti_hw/gscales.c src/core/ti_hw/hw.c src/core/ti_hw/hwprot.c src/core/ti_hw/kbd.c src/core/ti_hw/m68k.c src/core/ti_hw/mem.c src/core/ti_hw/mem89.c src/core/ti_hw/mem89tm.c src/core/ti_hw/mem92.c src/core/ti_hw/mem92p.c src/core/ti_hw/memv2.c src/core/ti_hw/ports.c src/core/ti_hw/rtc_hw3.c src/core/ti_hw/tichars.c src/core/ti_sw/er_codes.c src/core/ti_sw/handles.c src/core/ti_sw/iodefs.c src/core/ti_sw/mem_map.c src/core/ti_sw/registers.c src/core/ti_sw/romcalls.c src/core/ti_sw/timem.c src/core/ti_sw/vat.c src/core/dbg/bkpts.c src/core/dbg/debug.c src/core/dbg/disasm.c src/core/dbg/fpudasm.c src/core/dbg/gdbcall.c src/misc/tie_error.c"
CO_SRC="src/ticonv.c src/charset.c src/filename.c src/tokens.c"
FI_SRC="src/comments.c src/error.c src/files8x.c src/files9x.c src/filesnsp.c src/filesxx.c src/filetypes.c src/grouped.c src/intelhex.c src/logging.c src/misc.c src/rwfile.c src/tifiles.c src/type2str.c src/types73.c src/types82.c src/types83.c src/types83p.c src/types84p.c src/types85.c src/types86.c src/types89.c src/types89t.c src/types92.c src/types92p.c src/typesv2.c src/typesnsp.c src/typesxx.c src/ve_fp.c"
CA_SRC="src/backup.c src/calc_00.c src/calc_xx.c src/calc_73.c src/calc_82.c src/calc_83.c src/calc_85.c src/calc_86.c src/calc_89.c src/calc_92.c src/calc_84p.c src/calc_89t.c src/calc_nsp.c src/clock.c src/cmd73.c src/cmd82.c src/cmd85.c src/cmd89.c src/cmd92.c src/dusb_cmd.c src/nsp_cmd.c src/dirlist.c src/error.c src/keys73.c src/keys83.c src/keys83p.c src/keys86.c src/keys89.c src/keys92p.c src/logging.c src/dbus_pkt.c src/dusb_rpkt.c src/dusb_vpkt.c src/nsp_rpkt.c src/nsp_vpkt.c src/probe.c src/romdump.c src/ticalcs.c src/tikeys.c src/type2str.c src/update.c"
CB_SRC="src/data_log.c src/detect.c src/error.c src/ioports.c src/link_nul.c src/link_xxx.c src/log_dbus.c src/log_dusb.c src/log_hex.c src/log_nsp.c src/hex2dbus.c src/hex2dusb.c src/hex2nsp.c src/logging.c src/probe.c src/ticables.c src/type2str.c src/none.c"
fail=0; objs=""
comp() { # prefix dir srclist extra-flags
  local p=$1 d=$2; shift 2; local list=$1; shift
  for s in $list; do
    o=$OUT/${p}_$(echo $s | tr '/' '_' ).o; objs="$objs $o"
    src=$d/$s; [ -f $B/overlay/$p/$s ] && src=$B/overlay/$p/$s
    if [ ! -f $o ] || [ $src -nt $o ] || [ -n "$FORCE" ]; then
      $CC $COMMON $INC "$@" -c $src -o $o 2>>$B/errors.log || { echo "FAIL $p $s"; fail=1; }
    fi
  done
}
: > $B/errors.log
comp tiemu $T "$TIEMU_SRC" $DEFS_TIEMU
comp conv $CO "$CO_SRC" -DTICONV_EXPORTS
comp files $FI "$FI_SRC" -DSTDC
comp calcs $CA "$CA_SRC"
comp cables $CB "$CB_SRC" $DEFS_CB
comp shim $B "shim/glib.c"
for s in $B/wasm/*.c; do [ -f "$s" ] && comp wasm $B/wasm "$(basename $s)" $DEFS_TIEMU; done
echo "$objs" > $B/objs.txt
exit $fail

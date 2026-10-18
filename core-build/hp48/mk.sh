#!/bin/bash
cd "$(dirname "$0")"
CC="python3 -m ziglang cc -target wasm32-wasi"; FL="-O2 -DNDEBUG -w -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_MMAN -D_WASI_EMULATED_PROCESS_CLOCKS -I. -Iwin32 -Icore -fno-strict-aliasing -Wno-incompatible-function-pointer-types $EXTRA"
for f in ${@:-engine fetch opcodes mops timer keyboard apple i28f160 lowbat display rpl}; do src=core/$f.c; [ -f $f.c ] && src=$f.c; $CC $FL -c $src -o obj/$f.o 2>&1 | grep -E "error" | head -8 | sed "s/^/$f: /" & done; wait

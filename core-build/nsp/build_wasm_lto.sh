#!/bin/bash
# Build Firebird (TI-Nspire) core -> nspire.wasm with zig. Run patch_core.py first.
set -e
B=$(cd "$(dirname "$0")" && pwd); O=$B/wobj_lto; mkdir -p $O
CC="python3 -m ziglang cc -target wasm32-wasi"; CXX="python3 -m ziglang c++ -target wasm32-wasi"
FL="-O3 -flto -DNO_TRANSLATION -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS -D_WASI_EMULATED_MMAN -mexception-handling -mllvm -wasm-enable-sjlj -mllvm -wasm-use-legacy-eh=false -I$B -I$B/core -w"
CS="armsnippets_loader casplus des disasm interrupt lcd link mem misc mmu schedule serial sha256 usb usblink asmcode"
XS="arm_interpreter coproc cpu emu flash thumb_interpreter usblink_queue keypad cx2 usb_cx2 usblink_cx2 fieldparser"
for s in $CS; do o=$O/$s.o; if [ ! -f $o ] || [ $B/core/$s.c -nt $o ]; then $CC -std=gnu11 $FL -c $B/core/$s.c -o $o & fi; done; wait
for s in $XS; do o=$O/$s.o; F2="$FL"; [ $s = emu ] && F2="${FL/-flto /}"; if [ ! -f $o ] || [ $B/core/$s.cpp -nt $o ]; then $CXX -std=c++14 -fno-exceptions $F2 -c $B/core/$s.cpp -o $o & fi; done; wait
$CC -std=gnu11 $FL -c $B/wasm/os-wasm.c -o $O/os-wasm.o
$CXX -std=c++14 -fno-exceptions $FL -c $B/wasm/nsdebug.cpp -o $O/nsdebug.o
$CXX -std=c++14 -fno-exceptions $FL -c $B/gifstub.cpp -o $O/gifstub.o
$CXX -std=c++14 -fno-exceptions $FL -c $B/wasm/nspire.cpp -o $O/nspire.o
printf '\t.globl __c_longjmp\n\t.tagtype __c_longjmp i32\n__c_longjmp:\n' > $O/tag.s; $CC -mexception-handling -c $O/tag.s -o $O/tag.o
$CXX -mexec-model=reactor -O3 -flto -s -mexception-handling -mllvm -wasm-enable-sjlj -mllvm -wasm-use-legacy-eh=false -o $B/nspire_lto.wasm $O/*.o -lwasi-emulated-signal -lwasi-emulated-process-clocks -lwasi-emulated-mman \
  -Wl,--initial-memory=33554432 -Wl,--max-memory=1073741824 -Wl,--growable-table 2>&1 | grep -v "^warning" || true
ls -la $B/nspire_lto.wasm

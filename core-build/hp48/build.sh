#!/bin/bash
# Build the Emu48 core (HP 48SX/48GX/49G/49g+) to WebAssembly with zig: hp48.wasm
set -e; cd "$(dirname "$0")"; mkdir -p obj
# Emu48 core sources: app/src/main/cpp/core from https://github.com/dgis/emu48android (tested at 0e5908b)
[ -d core ] || cp -r "${EMU48:-../emu48android}/app/src/main/cpp/core" core
./mk.sh engine fetch opcodes mops timer keyboard apple i28f160 lowbat display rpl host
python3 -m ziglang cc -target wasm32-wasi -mexec-model=reactor -O2 -s -o hp48.wasm obj/*.o \
  -lwasi-emulated-signal -lwasi-emulated-mman -lwasi-emulated-process-clocks -Wl,--initial-memory=33554432
ls -la hp48.wasm

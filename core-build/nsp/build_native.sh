#!/bin/bash
set -e
F=${FB:-../firebird}; O=$(dirname $0)/nobj
FL="-O2 -DNO_TRANSLATION -I$F -I$F/core -w"
for s in armsnippets_loader casplus des disasm gdbstub interrupt lcd link mem misc mmu schedule serial sha256 usb usblink asmcode os/os-linux; do o=$O/$(basename $s).o; [ -f $o ] || gcc -std=gnu11 $FL -c $F/core/$s.c -o $o & done; wait
for s in arm_interpreter coproc cpu debug emu flash thumb_interpreter usblink_queue keypad cx2 usb_cx2 usblink_cx2 fieldparser; do o=$O/$s.o; [ -f $o ] || g++ -std=c++14 $FL -c $F/core/$s.cpp -o $o & done; wait
g++ -std=c++14 $FL -c nstest.cpp -o $O/nstest.o; g++ -std=c++14 $FL -c gifstub.cpp -o $O/gifstub.o
g++ -o nstest $O/*.o -lz -lpthread

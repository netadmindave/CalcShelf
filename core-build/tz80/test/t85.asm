; Test ROM for TI-85/86 hardware: fills RAM (LCD at FC00) with a pattern,
; inverts it while DOWN is held, shows a checker while ENTER is held.
	org 0
	di
	ld sp,0
	ld a,3Ch
	out (0),a
	ld a,18h
	out (2),a
	ld a,0Bh
	out (3),a
main:
	ld e,0F0h
	ld a,0FEh
	out (1),a
	nop
	nop
	in a,(1)
	bit 0,a
	jr nz,nodown
	ld e,0Fh
nodown:
	ld a,0FDh
	out (1),a
	nop
	nop
	in a,(1)
	bit 0,a
	jr nz,noenter
	ld e,0AAh
noenter:
	ld hl,8000h
	ld bc,8000h
fill:
	ld (hl),e
	inc hl
	dec bc
	ld a,b
	or c
	jr nz,fill
	jr main

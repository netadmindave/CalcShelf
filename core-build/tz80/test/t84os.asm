; Minimal "OS" page 0 for TI-83+/84+ hardware: draws a pattern on the T6A04 LCD,
; inverted while DOWN is held. Boot code enters at 0053h when 0056h holds 5A A5.
	org 0
	jp start
	ds 53h-$,0FFh
	jp start
	db 5Ah,0A5h
	ds 100h-$,0FFh
start:
	di
	ld sp,0
	ld a,1          ; 8-bit mode
	call lcdcmd
	ld a,3          ; display on
	call lcdcmd
	ld a,0F0h       ; contrast
	call lcdcmd
	ld a,7          ; Y (column) auto increment
	call lcdcmd
main:
	ld e,0F0h
	ld a,0FFh
	out (1),a
	ld a,0FEh
	out (1),a
	nop
	nop
	in a,(1)
	bit 0,a
	jr nz,nodown
	ld e,0Fh
nodown:
	ld d,80h        ; row command 80h..BFh
row:
	ld a,d
	call lcdcmd
	ld a,20h        ; column 0
	call lcdcmd
	ld b,12
col:
	call wait
	ld a,e
	out (11h),a
	djnz col
	inc d
	ld a,d
	cp 0C0h
	jr nz,row
	jr main
lcdcmd:
	call wait
	out (10h),a
	ret
wait:
	push bc
	ld b,40
w1:	djnz w1
	pop bc
	ret

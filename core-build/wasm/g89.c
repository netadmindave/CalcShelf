/*
 * TI-89 Touch — WebAssembly entry points for the TiEmu core.
 * Derived from Graph89's tiemuwrapper.c (C) 2012-2013 Dritan Hashorva and
 * TiEmu (C) 2000-2006 Corvazier, Liévin, Blache, Kofler. GPL-3.0-or-later.
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <time.h>
#include <glib.h>
#include "ti68k_def.h"
#include "ti68k_int.h"
#include "ti68k_err.h"
#include "kbd.h"
#include "gscales.h"
#include "m68k.h"
#include "romcalls.h"

#define EXPORT(n) __attribute__((export_name(n)))
#define IMPORT(n) __attribute__((import_module("env"), import_name(n)))

IMPORT("on_file_received") void js_on_file_received(const char *src, const char *dst);

extern char *TMP_DIR;
extern int enable_grayscale;
extern uint32_t lcd_planes[];
extern uint8_t *lcd_planebufs[];
extern int lcd_changed;
extern int ngc;
extern volatile int lcd_flag;
extern int g89_log_level;
int sync_clock(void);
int engine_num_cycles_per_loop(void);

/* Graph89 wrappercommon globals still referenced by the core */
const uint8_t g89_shift_table[] = {0x80, 0x40, 0x20, 0x10, 0x8, 0x4, 0x2, 0x1};
uint32_t g89_crc_table[256];

#define W (tihw.lcd_w)
#define H (tihw.lcd_h)
static uint8_t frame[LCDMEM_W * LCDMEM_H];   /* 8-bit intensity, 0 = background, 255 = darkest */
static uint8_t planes_acc[LCDMEM_W * LCDMEM_H];
static char strbuf[4096];
static int loaded = 0;

void wasm_file_received(const char *src, const char *dst) { js_on_file_received(src, dst); }

EXPORT("g89_strbuf") char *g89_strbuf(void) { return strbuf; }
EXPORT("g89_frame") uint8_t *g89_frame(void) { return frame; }
EXPORT("g89_set_log") void g89_set_log(int lvl) { g89_log_level = lvl; }
EXPORT("g89_alloc") void *g89_alloc(int n) { return malloc(n); }
EXPORT("g89_free") void g89_free(void *p) { free(p); }

/* Convert an OS upgrade (.89u/.v2u/.9xu) or a ROM dump into a TiEmu .img */
EXPORT("g89_install") int g89_install(const char *src, const char *dst, int is_rom)
{
	int dummy = 0;
	if (is_rom) return ti68k_convert_rom_to_image(src, dst, &dummy);
	return ti68k_convert_tib_to_image(src, dst, -1, &dummy);
}

EXPORT("g89_load") int g89_load(const char *img, int grayscale)
{
	int err;
	if (loaded) { ti68k_exit(); loaded = 0; }
	if (!TMP_DIR) TMP_DIR = strdup("/tmp");
	enable_grayscale = grayscale;
	ti68k_config_load_default();
	if ((err = ti68k_load_image(img))) return err;
	if ((err = ti68k_init())) return err;
	err = ti68k_reset();
	if (enable_grayscale) {
		lcd_planes[0] = tihw.lcd_adr;
		lcd_planebufs[0] = &tihw.ram[tihw.lcd_adr];
		ngc = 1; lcd_changed = 1;
	}
	loaded = 1;
	return err;
}

EXPORT("g89_reset") int g89_reset(void)
{
	int r = ti68k_reset();
	if (enable_grayscale) { lcd_planes[0] = tihw.lcd_adr; lcd_planebufs[0] = &tihw.ram[tihw.lcd_adr]; ngc = 1; lcd_changed = 1; }
	return r;
}

EXPORT("g89_calc_type") int g89_calc_type(void) { return tihw.calc_type; }
EXPORT("g89_lcd_w") int g89_lcd_w(void) { return tihw.lcd_w; }
EXPORT("g89_lcd_h") int g89_lcd_h(void) { return tihw.lcd_h; }
EXPORT("g89_hw_type") int g89_hw_type(void) { return tihw.hw_type; }
EXPORT("g89_rom_version") const char *g89_rom_version(void) { return tihw.rom_version; }
EXPORT("g89_cycles_per_30ms") int g89_cycles_per_30ms(void) { return engine_num_cycles_per_loop(); }

/* Wake the calculator (equivalent to pressing ON when off) */
EXPORT("g89_turn_on") void g89_turn_on(void) { hw_m68k_irq(6); }

/* Run n 68000 instructions (cycles/4). Returns non-zero on breakpoint. */
EXPORT("g89_run") int g89_run(int instructions) { return hw_m68k_run(instructions); }

EXPORT("g89_key") void g89_key(int key, int pressed) { ti68k_kbd_set_key(key, pressed); }
EXPORT("g89_key_queue") void g89_key_queue(int code) { KeyBufferPush(code); }
/* Type a string in the TI charset (Latin-1-ish). Returns 0 if the buffer was busy. */
EXPORT("g89_type") int g89_type(const char *s) { return ti68k_kbd_push_chars(s); }

EXPORT("g89_save_state") int g89_save_state(const char *f) { return tihw.ram ? ti68k_state_save(f) : -1; }
EXPORT("g89_load_state") int g89_load_state(const char *f) { return ti68k_state_load(f); }
EXPORT("g89_send_file") int g89_send_file(const char *f) { return ti68k_linkport_send_file(f); }
EXPORT("g89_sync_clock") int g89_sync_clock(void) { return sync_clock(); }

EXPORT("g89_error_text") const char *g89_error_text(int code)
{
	char *msg = NULL;
	ti68k_error_get(code, &msg);
	snprintf(strbuf, sizeof strbuf, "%s", msg ? msg : "unknown error");
	free(msg);
	return strbuf;
}

/* ---- screen ---- */
#define NGS 16
static const int gp_seq[9][8] = {
	{ -1 }, { 0, -1 }, { -1 }, { 0, 0, 1, -1 }, { -1 }, { -1 }, { -1 },
	{ 2, 0, 1, 0, 1, 0, -1 }, { 1, 0, 2, 0, 0, 1, 0, -1 },
};

/* Returns bit0: screen on, bit1: busy indicator, bit2: frame changed. contrast in bits 8..15 */
EXPORT("g89_screen") int g89_screen(void)
{
	static uint32_t lastcrc = 0;
	int flags = 0, i, j, k;
	if (!loaded || !tihw.ram) return 0;
	tihw.lcd_ptr = (char *)&tihw.ram[tihw.lcd_adr];
	uint8_t *lcd = (uint8_t *)tihw.lcd_ptr;
	if (tihw.on_off) flags |= 1;
	if (lcd[(H - 1) * LCDMEM_W / 8 + W / 8 - 1] & 0x01) flags |= 2;

	if (!tihw.on_off) {
		memset(frame, 0, sizeof frame);
	} else if (!enable_grayscale || ngc <= 1) {
		for (j = 0; j < H; j++)
			for (i = 0; i < W / 8; i++) {
				uint8_t c = lcd[j * LCDMEM_W / 8 + i];
				for (k = 0; k < 8; k++) frame[j * W + i * 8 + k] = (c & (0x80 >> k)) ? 255 : 0;
			}
		if (enable_grayscale) { lcd_flag = 0; if (tihw.hw_type >= HW2) lcd_hook_hw2(TRUE); }
	} else {
		int np = 0;
		memset(planes_acc, 0, sizeof planes_acc);
		for (int l = 0; l < 8; l++) {
			int pp = gp_seq[ngc][l];
			if (pp == -1) break;
			np++;
			uint8_t *bm = lcd_planebufs[pp];
			if (!bm) continue;
			for (j = 0; j < LCDMEM_H; j++)
				for (i = 0; i < LCDMEM_W / 8; i++, bm++)
					for (k = 0; k < 8; k++)
						if (*bm & (0x80 >> k)) planes_acc[j * LCDMEM_W + i * 8 + k]++;
		}
		if (np == 0) np = 1;
		for (j = 0; j < H; j++)
			for (i = 0; i < W; i++)
				frame[j * W + i] = (uint8_t)(planes_acc[j * LCDMEM_W + i] * 255 / np);
		lcd_flag = 0;
		if (tihw.hw_type >= HW2) lcd_hook_hw2(TRUE);
	}
	uint32_t crc = 2166136261u;
	for (i = 0; i < W * H; i++) crc = (crc ^ frame[i]) * 16777619u;
	if (crc != lastcrc) { flags |= 4; lastcrc = crc; }
	flags |= (tihw.contrast & 0xff) << 8;
	return flags;
}

/* Patch the OS serial-number romcall exactly as Graph89 does, so the calc has a stable ID. */
EXPORT("g89_patch_id") void g89_patch_id(const char *num, const char *vernum)
{
	uint32_t addr;
	{
		romcalls_get_symbol_address(0x2A1, &addr);
		addr -= tihw.rom_base; addr &= tihw.rom_size - 1;
		uint8_t *r = tihw.rom;
		r[addr+0] = 0x41; r[addr+1] = 0xFA; r[addr+2] = 0x00; r[addr+3] = 0x04; r[addr+4] = 0x4E; r[addr+5] = 0x75;
		for (int i = 0; i < 10; i++) r[addr+6+i] = num[i];
		r[addr+16] = 0;
	}
	romcalls_get_symbol_address(0x16d, &addr);
	addr -= tihw.rom_base; addr &= tihw.rom_size - 1;
	int v = strtol(vernum, NULL, 16);
	tihw.rom[addr+0] = 0x30; tihw.rom[addr+1] = 0x3C; tihw.rom[addr+2] = v >> 8; tihw.rom[addr+3] = v & 0xff;
	tihw.rom[addr+4] = 0x4E; tihw.rom[addr+5] = 0x75;
}


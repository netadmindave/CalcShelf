/*
 * CAS Touch — WebAssembly entry points for the TilEm 2 core (Z80 TI calculators:
 * TI-81, 82, 83, 83 Plus (SE), 84 Plus (SE), 85, 86).
 * Derived from Graph89's tilemwrapper.c (C) 2012-2013 Dritan Hashorva,
 * TilEm (C) 2001-2012 Benjamin Moody et al., Wabbitemu boot images. GPL-3.0-or-later.
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <glib.h>
#include <ticalcs.h>
#include <tilem.h>
#include <scancodes.h>
#include "gui.h"
#include "emucore.h"
#include "wabbit.h"

#define EXPORT(n) __attribute__((export_name(n)))

static TilemCalcEmulator *emu = NULL;
static TilemGrayLCD *glcd = NULL;
static TilemLCDBuffer *lcdbuf = NULL;
static uint8_t frame[128 * 64];
static char strbuf[1024];
static char rom_path[256] = "/data/calc.rom";

/* symbols Graph89's copy of the TilEm GUI code expects */
uint32_t g89_crc_table[256];
const uint8_t g89_shift_table[] = {0x80, 0x40, 0x20, 0x10, 0x8, 0x4, 0x2, 0x1};
void tilem_calc_emulator_lock(TilemCalcEmulator *e) { (void)e; }
void tilem_calc_emulator_unlock(TilemCalcEmulator *e) { (void)e; }
void tilem_calc_emulator_release_queued_key(TilemCalcEmulator *e) { (void)e; }

static void nop() {}

static void emu_free(void)
{
	if (glcd) { tilem_gray_lcd_free(glcd); glcd = NULL; }
	if (lcdbuf) { tilem_lcd_buffer_free(lcdbuf); lcdbuf = NULL; }
	if (emu) {
		if (emu->calc) tilem_calc_free(emu->calc);
		if (emu->task_queue) g_queue_free(emu->task_queue);
		free(emu->link_update);
		g_timer_destroy(emu->timer);
		free(emu);
		emu = NULL;
	}
}

static int emu_new(char model)
{
	static int libs = 0;
	emu_free();
	if (!libs) { ticables_library_init(); tifiles_library_init(); ticalcs_library_init(); libs = 1; }
	emu = g_new0(TilemCalcEmulator, 1);
	CalcUpdate *u = g_new0(CalcUpdate, 1);
	u->start = u->stop = u->refresh = u->pbar = u->label = (void *)&nop;
	emu->link_update = u;
	emu->ext_cable_in = emu->ext_cable_out = -1;
	emu->task_queue = g_queue_new();
	emu->calc_mutex = g_mutex_new();
	emu->calc_wakeup_cond = g_cond_new();
	emu->task_finished_cond = g_cond_new();
	emu->timer = g_timer_new();
	emu->limit_speed = FALSE;
	emu->calc = tilem_calc_new(model);
	if (!emu->calc) { emu_free(); return -1; }
	lcdbuf = tilem_lcd_buffer_new();
	glcd = tilem_gray_lcd_new(emu->calc, 4, 200);
	return 0;
}

EXPORT("tz_strbuf") char *tz_strbuf(void) { return strbuf; }
EXPORT("tz_frame") uint8_t *tz_frame(void) { return frame; }
EXPORT("tz_alloc") void *tz_alloc(int n) { return malloc(n); }
EXPORT("tz_free") void tz_free(void *p) { free(p); }

/* Model letter TilEm would pick for a ROM image (file at path), or 0. */
EXPORT("tz_guess_model") int tz_guess_model(const char *path)
{
	FILE *f = fopen(path, "rb");
	if (!f) return 0;
	char c = tilem_guess_rom_type(f);
	fclose(f);
	return c;
}

extern byte ti84pse_boot_image_1[], ti84p_boot_image_1[], ti83pse_boot_image_1[], ti83p_boot_image_1[], boot_image_2[];
extern int boot_image_84_size, boot_image_83_size, boot_image_2_start, boot_image_2_size;
extern LINK_ERR forceload_os(TilemCalc *calc, TIFILE_t *tifile);
extern LINK_ERR forceload_app(TilemCalc *calc, TIFILE_t *tifile);
extern void calc_erase_certificate(unsigned char *mem, int size);

/* Build a ROM image from a TI OS upgrade file (.8xu) using the free BootFree boot code
 * (as Wabbitemu and Graph89 do). Only the Flash models (83+, 83+SE, 84+, 84+SE). */
EXPORT("tz_rom_from_os") int tz_rom_from_os(const char *os_path, const char *dst, int model)
{
	if (emu_new((char)model)) return -1;
	TilemCalc *c = emu->calc;
	int rs = c->hw.romsize;
	memset(c->mem, 0xFF, rs);
	byte *boot = NULL; int bsz = 0;
	switch (model) {
	case TILEM_CALC_TI84P_SE: boot = ti84pse_boot_image_1; bsz = boot_image_84_size; break;
	case TILEM_CALC_TI84P: boot = ti84p_boot_image_1; bsz = boot_image_84_size; break;
	case TILEM_CALC_TI83P_SE: boot = ti83pse_boot_image_1; bsz = boot_image_83_size; break;
	case TILEM_CALC_TI83P: boot = ti83p_boot_image_1; bsz = boot_image_83_size; break;
	default: return -1;
	}
	memcpy(c->mem + rs - 0x4000, boot, bsz);
	memcpy(c->mem + rs - 0x4000 + boot_image_2_start, boot_image_2, boot_image_2_size);
	TIFILE_t *t = importvar(os_path, FALSE);
	if (!t || t->type != FLASH_TYPE) return -2;
	if (forceload_os(c, t) != LERR_SUCCESS) return -3;
	calc_erase_certificate(c->mem, rs);
	FILE *f = fopen(dst, "wb");
	if (!f) return -4;
	fwrite(c->mem, 1, rs, f);
	fclose(f);
	return 0;
}

/* Load a ROM image (file) for model and reset. Returns 0 on success. */
EXPORT("tz_load") int tz_load(const char *path, int model)
{
	if (emu_new((char)model)) return -1;
	strncpy(rom_path, path, sizeof rom_path - 1);
	return tilem_calc_load_ROM(emu->calc, path);
}

EXPORT("tz_model") int tz_model(void) { return emu ? emu->calc->hw.model_id : 0; }
EXPORT("tz_model_name") const char *tz_model_name(void) { return emu ? emu->calc->hw.desc : ""; }
EXPORT("tz_lcd_w") int tz_lcd_w(void) { return emu ? emu->calc->hw.lcdwidth : 0; }
EXPORT("tz_lcd_h") int tz_lcd_h(void) { return emu ? emu->calc->hw.lcdheight : 0; }
EXPORT("tz_rom_size") int tz_rom_size(void) { return emu ? emu->calc->hw.romsize : 0; }
EXPORT("tz_key_name") const char *tz_key_name(int sc)
{
	if (!emu || sc < 1 || sc > 64 || !emu->calc->hw.keynames || !emu->calc->hw.keynames[sc - 1]) return "";
	return emu->calc->hw.keynames[sc - 1];
}

EXPORT("tz_reset") void tz_reset(void) { if (emu) tilem_calc_reset(emu->calc); }

/* Run for `us` microseconds of calculator time. */
EXPORT("tz_run") void tz_run(int us)
{
	if (!emu) return;
	emu->calc->flash.unlock = TRUE;
	int rem = 0;
	emu->calc->z80.stop_mask = ~0u;
	while (us > 0) {
		int t = us > 10000 ? 10000 : us;
		tilem_z80_run_time(emu->calc, t, &rem);
		us -= t;
	}
}

EXPORT("tz_asleep") int tz_asleep(void)
{
	return emu && emu->calc->z80.halted && !emu->calc->z80.interrupts && !emu->calc->poweronhalt;
}

EXPORT("tz_key") void tz_key(int sc, int down)
{
	if (!emu) return;
	if (down) tilem_keypad_press_key(emu->calc, sc); else tilem_keypad_release_key(emu->calc, sc);
}

/* Turn the calculator on (press and release ON with emulated time in between). */
EXPORT("tz_turn_on") void tz_turn_on(void)
{
	if (!emu) return;
	tz_run(300000);
	tilem_keypad_press_key(emu->calc, TILEM_KEY_ON);
	tz_run(250000);
	tilem_keypad_release_key(emu->calc, TILEM_KEY_ON);
	tz_run(100000);
}

/* Render the LCD into frame[] as 0..255 darkness. Returns flags:
 * bit0 LCD on, bit2 frame changed. */
EXPORT("tz_screen") int tz_screen(void)
{
	static uint32_t lastcrc = 0;
	if (!emu) return 0;
	int w = emu->calc->hw.lcdwidth, h = emu->calc->hw.lcdheight, n = w * h, flags = 0;
	if (!emu->calc->lcd.active || tz_asleep()) {
		memset(frame, 0, n);
	} else {
		flags |= 1;
		tilem_gray_lcd_get_frame(glcd, lcdbuf);
		/* TilEm gray levels are 0..128 before contrast; apply the calculator's contrast the way TilEm does */
		int contrast = lcdbuf->contrast, cbase, cfact;
		if (contrast < 32) { cbase = 0; cfact = contrast * 8; }
		else { cbase = (contrast - 32) * 8; cfact = 255 - cbase; }
		if (lcdbuf->width != w || lcdbuf->height != h) { w = lcdbuf->width; h = lcdbuf->height; n = w * h; }
		for (int i = 0; i < n; i++) {
			int v = ((lcdbuf->data[i] * cfact) >> 7) + cbase;
			frame[i] = v > 255 ? 255 : v;
		}
	}
	uint32_t crc = 2166136261u;
	for (int i = 0; i < n; i++) crc = (crc ^ frame[i]) * 16777619u;
	if (crc != lastcrc) { flags |= 4; lastcrc = crc; }
	flags |= (lcdbuf && emu->calc->lcd.active ? (lcdbuf->contrast & 0xff) : 0) << 8;
	return flags;
}

/* Save ROM (with Flash archive) and RAM state to two files. */
EXPORT("tz_save_state") int tz_save_state(const char *rom, const char *sav)
{
	if (!emu) return -1;
	return tilem_calc_save_state(emu->calc, rom, sav);
}

EXPORT("tz_load_state") int tz_load_state(const char *sav)
{
	if (!emu) return -1;
	return tilem_calc_load_STATE(emu->calc, sav);
}

/* Send a variable / program / group / Flash app through the virtual link cable. */
EXPORT("tz_send_file") int tz_send_file(const char *path)
{
	if (!emu) return -1;
	int m = emu->calc->hw.model_id;
	TIFILE_t *t = importvar(path, SEND_CUR);
	if (t && t->type == FLASH_TYPE && t->flash && t->flash->type == FLASH_TYPE_APP &&
	    (m == TILEM_CALC_TI84P_SE || m == TILEM_CALC_TI84P || m == TILEM_CALC_TI83P_SE || m == TILEM_CALC_TI83P)) {
		int msize = emu->calc->hw.romsize + emu->calc->hw.ramsize + emu->calc->hw.lcdmemsize;
		char *backup = malloc(msize);
		memcpy(backup, emu->calc->mem, msize);
		if (forceload_app(emu->calc, t) == LERR_SUCCESS) { free(backup); return 0; }
		memcpy(emu->calc->mem, backup, msize);
		free(backup);
	}
	emu->limit_speed = FALSE;
	return tilem_link_send_file(emu, path, -1, TRUE, TRUE) != 0 ? -10 : 0;
}

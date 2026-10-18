/*
 * CAS Touch — WebAssembly glue for the Firebird TI-Nspire emulator core (GPL-3.0).
 * Files live in the in-memory WASI file system provided by JavaScript:
 *   boot1.img (boot ROM with keys), manuf.img, btldr.img, diags.img, instl.img, os.tcc2, snap.bin
 * The 132 MiB NAND flash stays in linear memory (ns_flash_*); JavaScript persists changed blocks.
 */
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <cstdarg>
#include <string>
#include "core/emu.h"
#include "core/flash.h"
#include "core/lcd.h"
#include "core/keypad.h"
#include "core/usblink_queue.h"
#include "core/debug.h"

#define EXPORT(n) __attribute__((export_name(n)))
extern "C" {
__attribute__((import_module("env"), import_name("ns_log"))) void js_log(const char *s, int len);
__attribute__((import_module("env"), import_name("ns_usb"))) void js_usb(int connected);
extern uint8_t *ns_flash_mem;
void *ns_big_alloc(size_t size);
void emu_run_slice(int ticks);
}

static char logbuf[1024];
void gui_debug_vprintf(const char *fmt, va_list ap) { int n = vsnprintf(logbuf, sizeof logbuf, fmt, ap); if (n > 0) js_log(logbuf, n < (int)sizeof logbuf ? n : (int)sizeof logbuf - 1); }
void gui_debug_printf(const char *fmt, ...) { va_list ap; va_start(ap, fmt); gui_debug_vprintf(fmt, ap); va_end(ap); }
void gui_status_printf(const char *fmt, ...) { va_list ap; va_start(ap, fmt); gui_debug_vprintf(fmt, ap); va_end(ap); }
void gui_perror(const char *msg) { gui_debug_printf("%s: error\n", msg); }
void gui_do_stuff(bool) {}
void gui_debugger_entered_or_left(bool) {}
void gui_debugger_request_input(debug_input_cb cb) { if (cb) cb("c"); }
void gui_putchar(char) {}
int gui_getchar() { return -1; }
void gui_set_busy(bool) {}
void gui_show_speed(double) {}
void gui_usblink_changed(bool s) { js_usb(s ? 1 : 0); }
void throttle_timer_off() {}
void throttle_timer_on() {}
void throttle_timer_wait(unsigned int) {}

static size_t flash_size = 0;
static uint16_t lcd_buf[320 * 240];
static int os_progress = -1;

extern "C" {
EXPORT("ns_alloc") void *ns_alloc(int n) { return n >= (1 << 20) ? ns_big_alloc(n) : malloc(n); }
EXPORT("ns_free") void ns_free(void *p, int n) { if (n < (1 << 20)) free(p); }
/* Build a fresh CX II flash from the dumped components; returns its size (0 = failed). */
EXPORT("ns_flash_create") int ns_flash_create(int with_diags)
{
    const char *pre[4] = { "manuf.img", "btldr.img", with_diags ? "diags.img" : nullptr, "instl.img" };
    uint8_t *data = nullptr;
    if (!flash_create_new(true, pre, 0x1C0, 0, true, &data, &flash_size)) return 0;
    ns_flash_mem = data;
    return (int) flash_size;
}
/* Use a flash image JavaScript has written into memory (from ns_alloc(132 MiB)). */
EXPORT("ns_flash_set") void ns_flash_set(uint8_t *p, int size) { ns_flash_mem = p; flash_size = size; }
EXPORT("ns_flash_ptr") uint8_t *ns_flash_ptr() { return ns_flash_mem; }
EXPORT("ns_flash_block_size") int ns_flash_block_size() { return nand.metrics.page_size << nand.metrics.log2_pages_per_block; }
EXPORT("ns_flash_blocks") int ns_flash_blocks() { return nand.metrics.num_pages >> nand.metrics.log2_pages_per_block; }
/* 1 when block i changed since the last ns_flash_clean(i) */
EXPORT("ns_flash_dirty") int ns_flash_dirty(int i) { return nand.nand_block_modified[i] ? 1 : 0; }
EXPORT("ns_flash_clean") void ns_flash_clean(int i) { nand.nand_block_modified[i] = false; }
EXPORT("ns_start") int ns_start(int from_snapshot)
{
    path_boot1 = "boot1.img"; path_flash = "mem:";
    debug_on_start = debug_on_warn = print_on_warn = false;
    if (!emu_start(0, 0, from_snapshot ? "snap.bin" : nullptr)) return 0;
    turbo_mode = true;
    return (int) product;
}
EXPORT("ns_run") void ns_run(int ticks) { emu_run_slice(ticks); }
EXPORT("ns_lcd") uint16_t *ns_lcd() { lcd_cx_draw_frame(lcd_buf); return lcd_buf; }
EXPORT("ns_key") void ns_key(int row, int col, int down) { keypad_set_key(row, col, down != 0); }
EXPORT("ns_on") void ns_on() { keypad_on_pressed(); }
EXPORT("ns_touch") void ns_touch(float x, float y, int contact, int down) { touchpad_set_state(x, y, contact != 0, down != 0); }
EXPORT("ns_suspend") int ns_suspend() { return emu_suspend("snap.bin") ? 1 : 0; }
EXPORT("ns_reset") void ns_reset() { cpu_events |= EVENT_RESET; }
static void progress_cb(int pct, void *) { os_progress = pct; }
EXPORT("ns_send_os") void ns_send_os() { os_progress = 0; usblink_queue_send_os("os.tcc2", progress_cb, nullptr); }
/* send a document (e.g. a .tns) to /documents on the calculator */
EXPORT("ns_send_file") void ns_send_file(const char *local, const char *remote) { os_progress = 0; usblink_queue_put_file(local, remote, progress_cb, nullptr); }
EXPORT("ns_progress") int ns_progress() { return os_progress; }
EXPORT("ns_queue") int ns_queue() { return (int) usblink_queue_size(); }
}

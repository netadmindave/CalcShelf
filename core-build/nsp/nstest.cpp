// Native test driver for Firebird (no JIT): create CX II flash, boot, measure speed, dump LCD.
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <cstdarg>
#include <chrono>
#include <string>
#include "core/emu.h"
#include "core/flash.h"
#include "core/lcd.h"
#include "core/keypad.h"
#include "core/schedule.h"
#include "core/usblink_queue.h"
#include "core/debug.h"

static double t_limit = 60;           // virtual seconds to run
static double send_os_at = -1;        // virtual second to send the OS
static std::string os_path;
static int ticks = 0;                 // 100 Hz virtual ticks
static auto t0 = std::chrono::steady_clock::now();
static int shot = 0;

static void save_lcd(const char *name) {
    static uint16_t fb[320 * 240];
    lcd_cx_draw_frame(fb);
    FILE *f = fopen(name, "wb"); fprintf(f, "P6 320 240 255\n");
    for (int i = 0; i < 320 * 240; i++) { uint16_t p = fb[i]; unsigned char rgb[3] = { (unsigned char)((p >> 11) << 3), (unsigned char)(((p >> 5) & 63) << 2), (unsigned char)((p & 31) << 3) }; fwrite(rgb, 3, 1, f); }
    fclose(f);
}
static void os_progress(int pct, void *) { static int last = -10; if (pct >= last + 10 || pct == 100) { printf("[OS send %d%%]\n", pct); last = pct; fflush(stdout); } }

void gui_do_stuff(bool) {
    ticks++;
    double vs = ticks / 100.0;
    if (send_os_at >= 0 && vs >= send_os_at) { send_os_at = -1; printf("[sending OS at %.1fs]\n", vs); usblink_queue_send_os(os_path, os_progress, nullptr); }
    if (ticks % 500 == 0) {               // every 5 virtual s
        double real = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
        char n[64]; snprintf(n, sizeof n, "shot_%03d.ppm", shot++); save_lcd(n);
        printf("[virt %.0fs real %.1fs speed %.2fx]\n", vs, real, vs / real); fflush(stdout);
    }
    if (vs >= t_limit) exiting = true;
}
void gui_debug_printf(const char *fmt, ...) { va_list ap; va_start(ap, fmt); vprintf(fmt, ap); va_end(ap); }
void gui_debug_vprintf(const char *fmt, va_list ap) { vprintf(fmt, ap); }
void gui_status_printf(const char *fmt, ...) { va_list ap; va_start(ap, fmt); vprintf(fmt, ap); va_end(ap); putchar('\n'); }
void gui_perror(const char *msg) { perror(msg); }
void gui_debugger_entered_or_left(bool) {}
void gui_debugger_request_input(debug_input_cb cb) { if (cb) { printf("[debugger: continuing]\n"); cb("c"); } }
void gui_putchar(char c) { (void)c; }
int gui_getchar() { return -1; }
void gui_set_busy(bool) {}
void gui_show_speed(double) {}
void gui_usblink_changed(bool s) { printf("[usblink %s]\n", s ? "connected" : "disconnected"); }
void throttle_timer_off() {}
void throttle_timer_on() {}
void throttle_timer_wait(unsigned int) {}

int main(int argc, char **argv) {
    if (argc > 1 && !strcmp(argv[1], "create")) {   // create manuf btldr diags instl out
        const char *pre[4] = { argv[2], argv[3], argv[4], argv[5] };
        uint8_t *data = nullptr; size_t size = 0;
        if (!flash_create_new(true, pre, 0x1C0, 0, true, &data, &size)) { fprintf(stderr, "flash_create_new failed\n"); return 1; }
        FILE *f = fopen(argv[6], "wb"); fwrite(data, 1, size, f); fclose(f);
        printf("flash %zu bytes\n", size); return 0;
    }
    // run boot1 flash seconds [os send_at]
    path_boot1 = argv[2]; path_flash = argv[3]; t_limit = atof(argv[4]);
    if (argc > 6) { os_path = argv[5]; send_os_at = atof(argv[6]); }
    debug_on_warn = false; print_on_warn = false;
    if (!emu_start(0, 0, nullptr)) { fprintf(stderr, "emu_start failed\n"); return 2; }
    printf("product %03x features %x\n", product, features);
    turbo_mode = true;
    t0 = std::chrono::steady_clock::now();
    emu_loop(false);
    if (argc > 7) { flash_save_changes(); printf("flash saved\n"); }
    return 0;
}

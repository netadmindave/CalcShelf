/* CAS Touch: the debugger and GDB stub are not available on the phone; faults just continue (like typing "c"). */
#include <cstdint>
#include "core/emu.h"
#include "core/debug.h"
#include "core/mmu.h"
#include "core/mem.h"
#include "core/gdbstub.h"
extern "C" void ns_log(const char *s);
void *virt_mem_ptr(uint32_t addr, uint32_t size) { return (void *)(intptr_t)phys_mem_ptr(mmu_translate(addr, false, NULL, NULL), size); }
void backtrace(uint32_t) {}
int process_debug_cmd(char *) { return 0; }
void debugger(enum DBG_REASON reason, uint32_t addr) { gui_debug_printf("[debugger entered: reason %d addr %08x, continuing]\n", (int) reason, addr); cpu_events &= ~EVENT_DEBUG_STEP; }
void rdebug_recv(void) {}
bool rdebug_bind(unsigned int) { return false; }
void rdebug_quit() {}
extern "C" {
bool gdb_connected = false;
bool gdbstub_init(unsigned int) { return false; }
void gdbstub_quit() {}
void gdbstub_reset(void) {}
void gdbstub_recv(void) {}
void gdbstub_debugger(enum DBG_REASON, uint32_t) {}
}

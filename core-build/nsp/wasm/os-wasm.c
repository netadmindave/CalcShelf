/* CAS Touch: Firebird OS layer for wasm32-wasi (no JIT, no mmap). GPL-3.0-or-later. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "core/mmu.h"
#include "core/os/os.h"
FILE *fopen_utf8(const char *filename, const char *mode) { return fopen(filename, mode); }
/* Big regions (RAM + flags, address cache, flash) are taken straight from memory.grow: exact pages,
   zero-filled, never returned (the emulator keeps them for its lifetime). */
void *ns_big_alloc(size_t size)
{
    size_t pages = (size + 65535) / 65536;
    int old = __builtin_wasm_memory_grow(0, pages);
    return old < 0 ? NULL : (void *)((size_t) old * 65536);
}
void *os_reserve(size_t size) { return size >= (1 << 20) ? ns_big_alloc(size) : calloc(1, size); }
void os_free(void *ptr, size_t size) { if (size < (1 << 20)) free(ptr); }
void *os_alloc_executable(size_t size) { (void) size; return NULL; }
void *os_map_cow(const char *filename, size_t size)
{
    FILE *f = fopen(filename, "rb"); if (!f) return NULL;
    void *p = malloc(size); if (!p) { fclose(f); return NULL; }
    size_t n = fread(p, 1, size, f); fclose(f);
    if (n != size) { free(p); return NULL; }
    return p;
}
void os_unmap_cow(void *addr, size_t size) { (void) size; free(addr); }
void addr_cache_init()
{
    if (addr_cache) return;
    addr_cache = ns_big_alloc(AC_NUM_ENTRIES * sizeof(ac_entry));
    if (!addr_cache) { fprintf(stderr, "addr_cache alloc failed\n"); abort(); }
    for (unsigned int i = 0; i < AC_NUM_ENTRIES; ++i) { AC_SET_ENTRY_INVALID(addr_cache[i], (i >> 1) << 10) }
}
void addr_cache_deinit() { /* kept for the lifetime of the module */ }

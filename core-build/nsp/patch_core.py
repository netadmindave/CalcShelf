#!/usr/bin/env python3
"""Copy Firebird's core and apply the CAS Touch WebAssembly patches (idempotent)."""
import os, re, shutil, sys
SRC = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('FB', '../firebird/core')
DST = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'core')
if os.path.exists(DST): shutil.rmtree(DST)
shutil.copytree(SRC, DST, ignore=shutil.ignore_patterns('tests', 'gif-h', 'firebird-send'))

def patch(name, old, new, count=1):
    p = os.path.join(DST, name); s = open(p).read()
    if old not in s: sys.exit('patch failed in %s: %r' % (name, old[:60]))
    s = s.replace(old, new, count); open(p, 'w').write(s)

# --- emu.cpp: snapshots as plain files (JS compresses them), no zlib; a sliced main loop
patch('emu.cpp', '#include <zlib.h>\n', '')
patch('emu.cpp', '''bool snapshot_read(const emu_snapshot *snapshot, void *dest, int size)
{
    return gzread((gzFile)snapshot->stream_handle, dest, size) == size;
}

bool snapshot_write(emu_snapshot *snapshot, const void *src, int size)
{
    return gzwrite((gzFile)snapshot->stream_handle, src, size) == size;
}''', '''bool snapshot_read(const emu_snapshot *snapshot, void *dest, int size)
{
    return (int)fread(dest, 1, size, (FILE*)snapshot->stream_handle) == size;
}

bool snapshot_write(emu_snapshot *snapshot, const void *src, int size)
{
    return (int)fwrite(src, 1, size, (FILE*)snapshot->stream_handle) == size;
}''')
s = open(os.path.join(DST, 'emu.cpp')).read()
# emu_start: open the snapshot as a plain FILE
s = s.replace('''        int dupfd = dup(fileno(fp));
        fclose(fp);
        fp = nullptr;

        // gzdopen takes ownership of the fd
        gzFile gzf = gzdopen(dupfd, "r");
        if(!gzf)
        {
            close(dupfd);
            return false;
        }

        emu_snapshot snapshot = {};''', '''        FILE *gzf = fp;
        emu_snapshot snapshot = {};''', 1)
s = s.replace('''                || gzread(gzf, &dummy, sizeof(dummy)) != 0
                || !gzeof(gzf))
        {
            gzclose(gzf);
            emu_cleanup();
            return false;
        }

        if(gzclose(gzf) != Z_OK)
        {
            emu_cleanup();
            return false;
        }''', '''                || fread(&dummy, 1, sizeof(dummy), gzf) != 0)
        {
            fclose(gzf);
            emu_cleanup();
            return false;
        }
        fclose(gzf);''', 1)
s = s.replace('''            gzclose(gzf);
            return false;
        }

        sched.items''', '''            fclose(gzf);
            return false;
        }

        sched.items''', 1)
# emu_suspend
m = re.search(r'bool emu_suspend\(const char \*file\)\n\{.*?\n\}\n', s, re.S)
if not m: sys.exit('emu_suspend not found')
body = m.group(0)
body = body.replace('''    int dupfd = dup(fileno(fp));
    fclose(fp);
    fp = nullptr;

    // gzdopen takes ownership of the fd
    gzFile gzf = gzdopen(dupfd, "wb");
    if(!gzf)
    {
        close(dupfd);
        return false;
    }
''', '''    FILE *gzf = fp;
''')
body = body.replace('gzclose(gzf)', 'fclose(gzf)').replace('== Z_OK', '== 0')
s = s.replace(m.group(0), body)
# a sliced loop: run until the throttle event has fired `ticks` times (10 ms of emulated time each)
s = s.replace('''void throttle_interval_event(int index)
{''', '''int emu_slice_ticks = -1; // >= 0: emu_run_slice is active and counts down 10 ms ticks
void throttle_interval_event(int index)
{
    if (emu_slice_ticks > 0 && --emu_slice_ticks == 0)
        exiting = true;''', 1)
s += '''
/* CAS Touch: run the emulation for `ticks` x 10 ms of emulated time, then return. */
extern "C" void emu_run_slice(int ticks)
{
    emu_slice_ticks = ticks;
    exiting = false;
    static bool first = true;
    if (first) {
        first = false;
        gdbstub_reset();
        addr_cache_flush();
        flush_translations();
        sched_update_next_event(0);
    }
    emu_setjmp(restart_after_exception);
    while (!exiting) {
        sched_process_pending_events();
        while (!exiting && cycle_count_delta < 0) {
            if (cpu_events & EVENT_RESET) {
                gui_status_printf("Reset");
                emu_reset();
                gdbstub_reset();
                addr_cache_flush();
                flush_translations();
                sched_update_next_event(0);
                continue;
            }
            if (cpu_events & EVENT_SLEEP) { cycle_count_delta = 0; break; }
            if (cpu_events & (EVENT_FIQ | EVENT_IRQ)) {
                if (arm.cpsr_low28 & 0x20) arm.reg[15] &= ~1; else arm.reg[15] &= ~3;
                if (cpu_events & EVENT_WAITING) arm.reg[15] += 4;
                arm.reg[15] += 4;
                cpu_exception((cpu_events & EVENT_FIQ) ? EX_FIQ : EX_IRQ);
            }
            cpu_events &= ~EVENT_WAITING;
            if (arm.cpsr_low28 & 0x20) cpu_thumb_loop(); else cpu_arm_loop();
        }
    }
    emu_slice_ticks = -1;
}
'''
open(os.path.join(DST, 'emu.cpp'), 'w').write(s)

# --- flash.cpp: "mem:" = a flash image already in memory (handed over by JavaScript)
patch('flash.cpp', '#include "flash.h"\n', '#include "flash.h"\nextern "C" { uint8_t *ns_flash_mem = nullptr; }\n')
patch('flash.cpp', '''bool flash_open(const char *filename) {
    bool large = false;''', '''bool flash_open(const char *filename) {
    bool large = false;
    if (ns_flash_mem && strcmp(filename, "mem:") == 0) {
        if (flash_file) { fclose(flash_file); flash_file = NULL; }
        return nand_initialize(true, filename);
    }''')
patch('flash.cpp', 'nand_data = (uint8_t*) os_map_cow(filename, large ? 132*1024*1024 : 33*1024*1024);',
      'nand_data = (ns_flash_mem && strcmp(filename, "mem:") == 0) ? ns_flash_mem : (uint8_t*) os_map_cow(filename, large ? 132*1024*1024 : 33*1024*1024);')
patch('flash.cpp', 'os_unmap_cow(nand_data, (nand.metrics.num_pages == 0x840) ? 132*1024*1024 : 33*1024*1024);',
      'if (nand_data != ns_flash_mem) os_unmap_cow(nand_data, (nand.metrics.num_pages == 0x840) ? 132*1024*1024 : 33*1024*1024);')

patch('flash.cpp', 'uint8_t *nand_data = *nand_data_ptr = (uint8_t*) malloc(*size);',
      'uint8_t *nand_data = *nand_data_ptr = (uint8_t*) ns_big_alloc(*size);')
patch('flash.cpp', 'extern "C" { uint8_t *ns_flash_mem = nullptr; }', 'extern "C" { uint8_t *ns_flash_mem = nullptr; void *ns_big_alloc(size_t size); }')
# --- single-threaded build: no locking needed
patch('cpu.cpp', '''    static std::mutex mut;
    std::lock_guard<std::mutex> lg(mut);
''', '')
# keypad.cpp: no locks in the single-threaded build
p = os.path.join(DST, 'keypad.cpp'); k = open(p).read()
k = k.replace('static std::recursive_mutex keypad_mut;', '').replace('std::lock_guard<std::recursive_mutex> lg(keypad_mut);', '')
open(p, 'w').write(k)
print('patched core in', DST)

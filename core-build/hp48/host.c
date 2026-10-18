/*
 * host.c — single-threaded WebAssembly host for the Emu48 core (HP 48SX/48GX/49G/49g+).
 *
 * Emu48 runs the CPU in a worker thread and drives its timers and display with
 * Windows multimedia timers. Here everything runs on one thread: time is virtual
 * (derived from CPU cycles while running, skipped ahead while the CPU sleeps),
 * timeSetEvent() callbacks are kept in a small queue and fired from the run loop,
 * and SetEvent(hEventShutdn) just raises a flag that the loop checks.
 *
 * Part of CAS Touch. GPL-2.0-or-later, like Emu48.
 */
#include "pch.h"
#include "Emu48.h"
#include "io.h"
#include "Opcodes.h"
#include "ops.h"
#include "i28f160.h"
#include <stdarg.h>
#include <time.h>
#include <sys/time.h>

#define EXPORT(n) __attribute__((export_name(#n)))

/* ------------------------------------------------------------------ globals normally in Emu48.c / files.c / others */
LPTSTR szAppName = "Emu48", szTopic = "Stack", szTitle = NULL;
CRITICAL_SECTION csGDILock, csLcdLock, csKeyLock, csIOLock, csT1Lock, csT2Lock, csTxdLock, csRecvLock, csSlowLock, csDbgLock;
INT nArgc = 1; LPCTSTR *ppArgv = NULL;
LARGE_INTEGER lFreq, lAppStart;
DWORD idDdeInst; UINT uCF_HpObj;
HANDLE hThread, hEventShutdn;
HINSTANCE hApp; HWND hWnd, hDlgDebug, hDlgFind, hDlgProfile, hDlgRplObjView;
HDC hWindowDC; HPALETTE hPalette, hOldPalette;
DWORD dwTColor = (DWORD)-1, dwTColorTol = 0; HRGN hRgn; HCURSOR hCursorArrow, hCursorHand;
UINT uWaveDevId; DWORD dwWakeupDelay = 200;
BOOL bAutoSave, bAutoSaveOnExit, bSaveDefConfirm, bStartupBackup, bAlwaysDisplayLog, bLoadObjectWarning, bShowTitle, bShowMenu, bAlwaysOnTop, bActFollowsMouse, bClientWinMove, bSingleInstance;

TCHAR szEmuDirectory[MAX_PATH], szRomDirectory[MAX_PATH], szCurrentDirectory[MAX_PATH], szCurrentKml[MAX_PATH], szBackupKml[MAX_PATH];
TCHAR szCurrentFilename[MAX_PATH], szBackupFilename[MAX_PATH], szBufferFilename[MAX_PATH], szPort2Filename[MAX_PATH];
BOOL bDocumentAvail = FALSE; BYTE cCurrentRomType = 0; UINT nCurrentClass = 0;
LPBYTE Port0, Port1, Port2, pbyRom; BOOL bRomWriteable = TRUE; DWORD dwRomSize;
LPBYTE pbyRomDirtyPage; DWORD dwRomDirtyPageSize; WORD wRomCrc; BOOL bRomCrcCorrection;
LPBYTE pbyPort2; BOOL bPort2Writeable, bPort2IsShared; DWORD dwPort2Size, dwPort2Mask; WORD wPort2Crc; BOOL bBackup;
INT nMacroState = MACRO_OFF, nMacroTimeout; BOOL bMacroRealSpeed; DWORD dwMacroMinDelay;
TCHAR szUdpServer[1024]; WORD wUdpPort;


DWORD dwKMLColor[64];

/* ------------------------------------------------------------------ virtual time */
static ULONGLONG vt_us = 0;          /* virtual microseconds since start */
static DWORD cyc_hz = 2015232;       /* CPU cycles per second (dwT2Cycles * 16384) */
static int ev_shutdn = 0;            /* hEventShutdn signalled */

typedef struct { UINT id; ULONGLONG due, period; LPTIMECALLBACK cb; DWORD_PTR user; } VTIMER;
#define NTIMERS 8
static VTIMER timers[NTIMERS];
static UINT next_tid = 1;

void wasm_log(const char *fmt, ...) { (void)fmt; }

BOOL QueryPerformanceFrequency(PLARGE_INTEGER l) { l->QuadPart = 1000000; return TRUE; }
BOOL QueryPerformanceCounter(PLARGE_INTEGER l) { l->QuadPart = vt_us; return TRUE; }
DWORD timeGetTime(void) { return (DWORD)(vt_us / 1000); }
DWORD GetTickCount(void) { return (DWORD)(vt_us / 1000); }
MMRESULT timeGetDevCaps(LPTIMECAPS ptc, UINT cbtc) { ptc->wPeriodMin = 1; ptc->wPeriodMax = 1000000; return 0; }
MMRESULT timeBeginPeriod(UINT u) { return 0; }
MMRESULT timeEndPeriod(UINT u) { return 0; }
MMRESULT timeSetEvent(UINT uDelay, UINT uRes, LPTIMECALLBACK cb, DWORD_PTR user, UINT flags) {
    for (int i = 0; i < NTIMERS; i++) if (!timers[i].id) {
        timers[i].id = next_tid++; if (!next_tid) next_tid = 1;
        timers[i].due = vt_us + (ULONGLONG)uDelay * 1000;
        timers[i].period = (flags & TIME_PERIODIC) ? (ULONGLONG)uDelay * 1000 : 0;
        timers[i].cb = cb; timers[i].user = user;
        return timers[i].id;
    }
    return 0;
}
MMRESULT timeKillEvent(UINT id) { for (int i = 0; i < NTIMERS; i++) if (timers[i].id == id) timers[i].id = 0; return 0; }
static ULONGLONG next_due(void) { ULONGLONG d = ~0ULL; for (int i = 0; i < NTIMERS; i++) if (timers[i].id && timers[i].due < d) d = timers[i].due; return d; }
static void fire_timers(void) {
    for (int n = 0; n < 4; n++) {
        int any = 0;
        for (int i = 0; i < NTIMERS; i++) {
            VTIMER t = timers[i];
            if (!t.id || t.due > vt_us) continue;
            any = 1;
            if (t.period) timers[i].due += t.period; else timers[i].id = 0;
            t.cb(t.id, 0, t.user, 0, 0);
        }
        if (!any) break;
    }
}

/* local time = phone time passed in from JS at start (ms since epoch, minutes east of UTC) + virtual time */
static double base_ms = 0; static int tz_min = 0;
EXPORT(hp_set_clock) void hp_set_clock(double ms, int tzmin) { base_ms = ms - (double)vt_us / 1000.0; tz_min = tzmin; }
static void fill_time(SYSTEMTIME *st, int local) {
    double ms = base_ms + (double)vt_us / 1000.0 + (local ? tz_min * 60000.0 : 0);
    time_t s = (time_t)(ms / 1000.0); struct tm tm; gmtime_r(&s, &tm);
    st->wYear = tm.tm_year + 1900; st->wMonth = tm.tm_mon + 1; st->wDayOfWeek = tm.tm_wday; st->wDay = tm.tm_mday;
    st->wHour = tm.tm_hour; st->wMinute = tm.tm_min; st->wSecond = tm.tm_sec; st->wMilliseconds = (WORD)((long long)ms % 1000);
}
void GetLocalTime(LPSYSTEMTIME st) { fill_time(st, 1); }
void GetSystemTime(LPSYSTEMTIME st) { fill_time(st, 0); }

/* ------------------------------------------------------------------ thread / event / sync primitives */
static int dummy_handle;
HANDLE CreateEvent(LPVOID a, BOOL m, BOOL i, LPCTSTR n) { return (HANDLE)&dummy_handle; }
BOOL SetEvent(HANDLE h) { if (h == hEventShutdn) ev_shutdn = 1; return TRUE; }
BOOL ResetEvent(HANDLE h) { if (h == hEventShutdn) ev_shutdn = 0; return TRUE; }
DWORD WaitForSingleObject(HANDLE h, DWORD ms) { return WAIT_TIMEOUT; }
HANDLE CreateThread(LPSECURITY_ATTRIBUTES a, SIZE_T s, LPTHREAD_START_ROUTINE f, LPVOID p, DWORD fl, LPDWORD id) { return NULL; }
BOOL CloseHandle(HANDLE h) { return TRUE; }
void Sleep(int ms) {}
void InitializeCriticalSection(CRITICAL_SECTION *c) {}
void DeleteCriticalSection(CRITICAL_SECTION *c) {}
void EnterCriticalSection(CRITICAL_SECTION *c) {}
void LeaveCriticalSection(CRITICAL_SECTION *c) {}
BOOL GetSystemPowerStatus(LPSYSTEM_POWER_STATUS s) { memset(s, 0, sizeof *s); s->ACLineStatus = AC_LINE_ONLINE; s->BatteryFlag = 1; return TRUE; }

/* ------------------------------------------------------------------ GDI: just enough for display.c's LCD DIB */
static BYTE lcd_dib[144 * 80];
HDC CreateCompatibleDC(HDC h) { return (HDC)&dummy_handle; }
HBITMAP CreateDIBSection(HDC h, CONST BITMAPINFO *bi, UINT u, VOID **bits, HANDLE s, DWORD o) { *bits = lcd_dib; return (HBITMAP)&dummy_handle; }
HGDIOBJ SelectObject(HDC h, HGDIOBJ o) { return o; }
BOOL DeleteObject(HGDIOBJ o) { return TRUE; }
BOOL DeleteDC(HDC h) { return TRUE; }
HPALETTE SelectPalette(HDC h, HPALETTE p, BOOL b) { return p; }
UINT RealizePalette(HDC h) { return 0; }
UINT SetDIBColorTable(HDC h, UINT a, UINT b, CONST RGBQUAD *c) { return b; }
BOOL StretchBlt(HDC a, int b, int c, int d, int e, HDC f, int g, int h, int i, int j, DWORD k) { return TRUE; }
BOOL BitBlt(HDC a, int b, int c, int d, int e, HDC f, int g, int h, DWORD i) { return TRUE; }
BOOL GdiFlush(void) { return TRUE; }
BOOL SetWindowOrgEx(HDC h, int x, int y, LPPOINT p) { return TRUE; }
BOOL InvalidateRect(HWND h, CONST RECT *r, BOOL b) { return TRUE; }
BOOL SetWindowPos(HWND a, HWND b, int c, int d, int e, int f, UINT g) { return TRUE; }
BOOL GetWindowRect(HWND h, LPRECT r) { memset(r, 0, sizeof *r); return TRUE; }
BOOL GetClientRect(HWND h, LPRECT r) { memset(r, 0, sizeof *r); return TRUE; }
BOOL AdjustWindowRect(LPRECT r, DWORD s, BOOL m) { return TRUE; }
LONG GetWindowLong(HWND h, int i) { return 0; }
HMENU GetMenu(HWND h) { return NULL; }

/* ------------------------------------------------------------------ things the core calls that this host doesn't need */
VOID DrawAnnunciator(UINT nId, BOOL bOn) {}
VOID KeyMacroRecord(BOOL bPress, UINT out, UINT in) {}
LRESULT OnToolMacroStop(VOID) { return 0; }
VOID IrPrinter(BYTE c) {}
VOID SoundBeep(DWORD dwFrequency, DWORD dwDuration) {}
VOID SoundOut(CHIPSET *w, WORD wOut) {}
VOID SoundBeep2(DWORD f, DWORD d) {}
BOOL CommOpen(LPTSTR a, LPTSTR b) { return FALSE; }
VOID CommClose(VOID) {}
BOOL CommIsOpen(VOID) { return FALSE; }
VOID CommSetBaud(VOID) {}
BOOL UpdateUSRQ(VOID) { return FALSE; }
VOID CommTxBRK(VOID) {}
VOID CommTransmit(VOID) {}
VOID CommReceive(VOID) {}
VOID DisableDebugger(VOID) {}
BOOL CheckBreakpoint(DWORD dwAddr, DWORD wRange, UINT nType) { return FALSE; }
VOID NotifyDebugger(INT nType) {}
VOID LoadBreakpointList(HANDLE hFile) {}
VOID SetWindowTitle(LPCTSTR s) {}
VOID SetWindowPathTitle(LPCTSTR s) {}
int MessageBox(HANDLE h, LPCTSTR t, LPCTSTR c, int u) { return IDOK; }
VOID ReloadButtons(BYTE *Keys, UINT nSize) {}
BOOL CheckForBeepPatch(VOID) { return FALSE; }

/* ------------------------------------------------------------------ ROM, ports, document */
static WORD CrcNib(WORD crc, BYTE n) { return UpCRC(crc, n); }
BOOL CrcRom(WORD *pwChk) {           /* fingerprint of the ROM (as in files.c) */
    DWORD dwCount, dwFileSize; DWORD *pdwData; WORD wChk = 0;
    if (pbyRom == NULL) { *pwChk = 0; return TRUE; }
    pdwData = (DWORD *)pbyRom; dwFileSize = dwRomSize;
    for (dwCount = 0; dwCount < dwFileSize / sizeof(*pdwData); ++dwCount) wChk += (WORD)*pdwData++;
    (void)CrcNib; *pwChk = wChk; return TRUE;
}
BOOL MapPort2(LPCTSTR f) { return FALSE; }
VOID UnmapPort2(VOID) {}

static DWORD rom_file_size = 0;
EXPORT(hp_alloc) void *hp_alloc(DWORD n) { return malloc(n); }
EXPORT(hp_free) void hp_free(void *p) { free(p); }

/* the ROM image: JS allocates rom_file_size*2 bytes (room for unpacking), writes the file at the start, calls hp_rom */
EXPORT(hp_rom) int hp_rom(LPBYTE buf, DWORD fileSize, int type, int cls) {
    DWORD first = *(DWORD *)buf;
    cCurrentRomType = (BYTE)type; nCurrentClass = cls;
    pbyRom = buf; rom_file_size = fileSize; dwRomSize = fileSize;
    if ((first & 0xF0F0F0F0) != 0) {           /* packed: two nibbles per byte -> unpack in place from the end */
        LPBYTE src = buf + fileSize, dst = buf + fileSize * 2;
        dwRomSize = fileSize * 2;
        while (src != dst && src > buf) { BYTE v = *(--src); *(--dst) = v >> 4; *(--dst) = v & 0xF; }
    }
    if (type == 'X' || type == 'Q') {
        dwRomDirtyPageSize = dwRomSize / ROMPAGESIZE;
        pbyRomDirtyPage = (LPBYTE)calloc(dwRomDirtyPageSize, 1);
    }
    switch (type) {
        case 'S': dwT2Cycles = dwSXCycles; break;
        case 'Q': dwT2Cycles = dwGPCycles; break;
        case '2': dwT2Cycles = dwG2Cycles; break;
        default: dwT2Cycles = dwGXCycles; break;
    }
    cyc_hz = dwT2Cycles * 16384;
    return (int)dwRomSize;
}
EXPORT(hp_rom_ptr) LPBYTE hp_rom_ptr(void) { return pbyRom; }
EXPORT(hp_rom_size) DWORD hp_rom_size(void) { return dwRomSize; }
EXPORT(hp_rom_dirty) int hp_rom_dirty(int clear) {   /* number of changed 2K-nibble pages since the last call */
    int n = 0; if (!pbyRomDirtyPage) return 0;
    for (DWORD i = 0; i < dwRomDirtyPageSize; i++) if (pbyRomDirtyPage[i]) { n++; if (clear) pbyRomDirtyPage[i] = 0; }
    return n;
}

static void init_display(void) {
    static int done = 0;
    if (!done) {
        done = 1;
        /* contrast palette: index = contrast level, value = "on" colour; the app recolours anyway */
        for (int i = 0; i < 32; i++) dwKMLColor[i] = 0x000000; for (int i = 32; i < 64; i++) dwKMLColor[i] = 0xFFFFFF;
        CreateLcdBitmap();
    }
}

static void enter_run(void) {          /* the state-entry part of Emu48's WorkerThread */
    Chipset.cards_status &= ~(PORT2_PRESENT | PORT2_WRITE);
    if (pbyPort2 || Port2) { Chipset.cards_status |= PORT2_PRESENT; if (bPort2Writeable) Chipset.cards_status |= PORT2_WRITE; }
    if ((Chipset.IORam[CARDCTL] & ECDT) == 0 && (Chipset.IORam[TIMER2_CTRL] & RUN) != 0) {
        BOOL bNINT2 = Chipset.IORam[SRQ1] == 0 && (Chipset.IORam[SRQ2] & LSRQ) == 0;
        BOOL bNINT = (Chipset.IORam[CARDCTL] & SMP) == 0;
        bNINT2 = bNINT2 && (Chipset.cards_status & (P2W | P2C)) != P2C;
        bNINT = bNINT && (Chipset.cards_status & (P1W | P1C)) != P1C;
        IOBit(SRQ2, NINT2, bNINT2); IOBit(SRQ2, NINT, bNINT);
    }
    RomSwitch(Chipset.Bank_FF);
    UpdateContrast(Chipset.contrast);
    UpdateDisplayPointers(); UpdateMainDisplay(); UpdateMenuDisplay(); RefreshDisp0(); UpdateAnnunciators(0x3F);
    SetHP48Time();
    StartDisplay((BYTE)(((Chipset.IORam[LINECOUNT + 1] << 4) | Chipset.IORam[LINECOUNT]) & 0x3F));
    StartTimers();
    nState = nNextState = SM_RUN;
    PCHANGED;
}
static void leave_run(void) {
    if (nState != SM_RUN) return;
    StopDisplay(); StopTimers();
    nState = nNextState = SM_INVALID;
}

static void free_ports(void) {
    if (Port0) { free(Port0); Port0 = NULL; } if (Port1) { free(Port1); Port1 = NULL; } if (Port2) { free(Port2); Port2 = NULL; }
}

/* a fresh calculator (like File > New in Emu48) */
EXPORT(hp_new) int hp_new(void) {
    BYTE t = cCurrentRomType;
    if (!pbyRom) return 0;
    leave_run(); free_ports();
    ZeroMemory(&Chipset, sizeof(Chipset)); ZeroMemory(&RMap, sizeof(RMap)); ZeroMemory(&WMap, sizeof(WMap));
    Chipset.type = t; CrcRom(&Chipset.wRomCrc); wRomCrc = Chipset.wRomCrc;
    if (t == 'S') { Chipset.Port0Size = 32; Chipset.Port1Size = 128; Chipset.Port2Size = 0; Chipset.cards_status = 0x5; }
    if (t == 'G') { Chipset.Port0Size = 128; Chipset.Port1Size = 128; Chipset.Port2Size = 0; Chipset.cards_status = 0xA; }
    if (t == 'X' || t == '2' || t == 'Q') { Chipset.Port0Size = 256; Chipset.Port1Size = 128; Chipset.Port2Size = 128; Chipset.cards_status = 0xF; bPort2Writeable = TRUE; FlashInit(); }
    if (t == 'Q') Chipset.d0size = 16;
    Chipset.IORam[LPE] = RST;
    if (Chipset.Port0Size) Port0 = (LPBYTE)calloc(Chipset.Port0Size * 2048, 1);
    if (Chipset.Port1Size) Port1 = (LPBYTE)calloc(Chipset.Port1Size * 2048, 1);
    if (Chipset.Port2Size) Port2 = (LPBYTE)calloc(Chipset.Port2Size * 2048, 1);
    RomSwitch(0);
    bDocumentAvail = TRUE;
    init_display();
    nState = SM_INVALID;
    enter_run();
    return 1;
}

/* ------------------------------------------------------------------ state: Chipset + RAM ports (the flash ROM is saved separately by JS) */
#define STATE_MAGIC 0x34385343   /* "CS84" */
EXPORT(hp_state_size) DWORD hp_state_size(void) {
    return 16 + sizeof(Chipset) + (Chipset.Port0Size + Chipset.Port1Size + Chipset.Port2Size) * 2048 + 16;
}
EXPORT(hp_state_save) DWORD hp_state_save(LPBYTE out) {
    BOOL running = nState == SM_RUN; LPBYTE p = out;
    if (running) leave_run();            /* updates Chipset.t2 etc. */
    ((DWORD *)p)[0] = STATE_MAGIC; ((DWORD *)p)[1] = sizeof(Chipset); ((DWORD *)p)[2] = (DWORD)(vt_us & 0xFFFFFFFF); ((DWORD *)p)[3] = (DWORD)(vt_us >> 32); p += 16;
    memcpy(p, &Chipset, sizeof(Chipset)); p += sizeof(Chipset);
    if (Chipset.Port0Size) { memcpy(p, Port0, Chipset.Port0Size * 2048); p += Chipset.Port0Size * 2048; }
    if (Chipset.Port1Size) { memcpy(p, Port1, Chipset.Port1Size * 2048); p += Chipset.Port1Size * 2048; }
    if (Chipset.Port2Size) { memcpy(p, Port2, Chipset.Port2Size * 2048); p += Chipset.Port2Size * 2048; }
    if (running) enter_run();
    return (DWORD)(p - out);
}
EXPORT(hp_state_load) int hp_state_load(LPBYTE in, DWORD len) {
    LPBYTE p = in;
    if (len < 16 + sizeof(Chipset) || ((DWORD *)p)[0] != STATE_MAGIC || ((DWORD *)p)[1] != sizeof(Chipset)) return 0;
    if (((Chipset_t *)(p + 16))->type != cCurrentRomType) return 0;
    leave_run(); free_ports();
    vt_us = ((ULONGLONG)((DWORD *)p)[3] << 32) | ((DWORD *)p)[2]; p += 16;
    memcpy(&Chipset, p, sizeof(Chipset)); p += sizeof(Chipset);
    if (len < (DWORD)(p - in) + (Chipset.Port0Size + Chipset.Port1Size + Chipset.Port2Size) * 2048) return 0;
    FlashInit();
    if (Chipset.Port0Size) { Port0 = malloc(Chipset.Port0Size * 2048); memcpy(Port0, p, Chipset.Port0Size * 2048); p += Chipset.Port0Size * 2048; }
    if (Chipset.Port1Size) { Port1 = malloc(Chipset.Port1Size * 2048); memcpy(Port1, p, Chipset.Port1Size * 2048); p += Chipset.Port1Size * 2048; }
    if (Chipset.Port2Size) { Port2 = malloc(Chipset.Port2Size * 2048); memcpy(Port2, p, Chipset.Port2Size * 2048); p += Chipset.Port2Size * 2048; bPort2Writeable = TRUE; Chipset.cards_status = 0xF; }
    ZeroMemory(&RMap, sizeof(RMap)); ZeroMemory(&WMap, sizeof(WMap));
    RomSwitch(Chipset.Bank_FF);
    CrcRom(&wRomCrc);
    if (Chipset.wRomCrc != wRomCrc) { CpuReset(); Chipset.Shutdn = FALSE; Chipset.wRomCrc = wRomCrc; }
    bDocumentAvail = TRUE;
    init_display();
    enter_run();
    return 1;
}

/* ------------------------------------------------------------------ run loop */
static __inline VOID CheckDispHost(BOOL bSync) {
    if (disp == 0) return;
    if (bSync && GetLineCounter() != 0x3F && (Chipset.IORam[0x00] & 8)) return;
    if (disp & DISP_MAIN) UpdateMainDisplay();
    if (disp & DISP_MENUE) UpdateMenuDisplay();
    disp = 0;
}

static int sleeping = 0;            /* CPU in SHUTDN, waiting for a wake-up */
static DWORD lcd_serial = 0;        /* bumps when anything may have changed on screen */

/* run for up to `us` virtual microseconds; returns 1 if the CPU did work, 0 if it slept the whole time */
EXPORT(hp_run) int hp_run(DWORD us) {
    ULONGLONG end = vt_us + us; int busy = 0;
    if (nState != SM_RUN) return 0;
    while (vt_us < end) {
        fire_timers();
        if (sleeping) {
            if (!ev_shutdn) {
                ULONGLONG nd = next_due();
                vt_us = nd < end ? nd : end;
                continue;
            }
            ev_shutdn = 0; sleeping = 0;
            if (Chipset.bShutdnWake) { Chipset.bShutdnWake = FALSE; Chipset.Shutdn = FALSE; nOpcSlow = 0; }
            goto softint;
        }
        {   /* execute until an interrupt, the next timer, or ~1 ms */
            ULONGLONG lim = next_due(); if (lim > end) lim = end;
            DWORD c0 = Chipset.cycles, budget;
            ULONGLONG span = lim > vt_us ? lim - vt_us : 1;
            if (span > 1000) span = 1000;
            budget = (DWORD)(span * cyc_hz / 1000000) + 1;
            busy = 1;
            while (!bInterrupt) {
                EvalOpcode(FASTPTR(Chipset.pc));
                if (!bGrayscale) CheckDispHost(!Chipset.Shutdn);
                if ((DWORD)(Chipset.cycles - c0) >= budget) break;
            }
            vt_us += (ULONGLONG)(DWORD)(Chipset.cycles - c0) * 1000000 / cyc_hz;
            if (!bInterrupt) continue;
            bInterrupt = FALSE;
            if (Chipset.Shutdn) {
                if (!Chipset.SoftInt) { ev_shutdn = 0; sleeping = 1; lcd_serial++; continue; }
                Chipset.bShutdnWake = TRUE;
                if (Chipset.bShutdnWake) { Chipset.bShutdnWake = FALSE; Chipset.Shutdn = FALSE; nOpcSlow = 0; }
            }
        }
softint:
        if (Chipset.SoftInt) {
            Chipset.SoftInt = FALSE;
            if (Chipset.inte) { Chipset.inte = FALSE; rstkpush(Chipset.pc); Chipset.pc = 0xf; }
        }
        PCHANGED;
    }
    if (busy) lcd_serial++;
    return busy;
}

/* ------------------------------------------------------------------ keys, screen, misc */
EXPORT(hp_key) void hp_key(int out, int in, int press) { KeyboardEvent(press ? TRUE : FALSE, (UINT)out, (UINT)in); }
EXPORT(hp_lcd) LPBYTE hp_lcd(void) { if (nState == SM_RUN) { UpdateMainDisplay(); UpdateMenuDisplay(); RefreshDisp0(); } return lcd_dib; }
EXPORT(hp_lcd_rows) int hp_lcd_rows(void) { return (cCurrentRomType == 'Q' || cCurrentRomType == '2') ? 80 : 64; }
EXPORT(hp_lcd_on) int hp_lcd_on(void) { return (Chipset.IORam[BITOFFSET] & DON) != 0; }
EXPORT(hp_contrast) int hp_contrast(void) { return Chipset.contrast; }
EXPORT(hp_annun) int hp_annun(void) {
    BYTE c = (BYTE)(Chipset.IORam[ANNCTRL] | (Chipset.IORam[ANNCTRL + 1] << 4));
    if ((c & AON) == 0 || (Chipset.IORam[TIMER2_CTRL] & RUN) == 0) c = 0;
    return c & 0x3F;
}
EXPORT(hp_sleeping) int hp_sleeping(void) { return sleeping; }
EXPORT(hp_vtime) double hp_vtime(void) { return (double)vt_us; }
EXPORT(hp_serial) DWORD hp_serial(void) { return lcd_serial; }
EXPORT(hp_reset) void hp_reset(void) { leave_run(); CpuReset(); Chipset.Shutdn = FALSE; sleeping = 0; enter_run(); }
EXPORT(hp_cycles) DWORD hp_cycles(void) { return Chipset.cycles; }
EXPORT(hp_pc) DWORD hp_pc(void) { return Chipset.pc; }

/* put an object file (HP binary "HPHP48-x"/"HPHP49-x" or plain text) on stack level 1 — WriteStack() from files.c */
EXPORT(hp_load_object) int hp_load_object(LPBYTE lpBuf, DWORD dwSize) {
    /* lpBuf holds dwSize file bytes at lpBuf+dwSize; the first dwSize*2 bytes are free for unpacking */
    BOOL bBinary; DWORD dwAddress, i;
    BOOL running = nState == SM_RUN;
    bBinary = lpBuf[dwSize] == 'H' && lpBuf[dwSize + 1] == 'P' && lpBuf[dwSize + 2] == 'H' && lpBuf[dwSize + 3] == 'P' && lpBuf[dwSize + 4] == '4'
        && lpBuf[dwSize + 5] == ((cCurrentRomType == 'X' || cCurrentRomType == '2' || cCurrentRomType == 'Q') ? '9' : '8') && lpBuf[dwSize + 6] == '-';
    for (dwAddress = 0, i = 0; i < dwSize; i++) { BYTE b = lpBuf[i + dwSize]; lpBuf[dwAddress++] = b & 0xF; lpBuf[dwAddress++] = b >> 4; }
    dwSize = dwAddress;
    if (running) leave_run();
    if (bBinary) {
        dwSize = RPL_ObjectSize(lpBuf + 16, dwSize - 16);
        if (dwSize == BAD_OB) { if (running) enter_run(); return S_ERR_OBJECT; }
        dwAddress = RPL_CreateTemp(dwSize, TRUE);
        if (dwAddress == 0) { if (running) enter_run(); return S_ERR_BINARY; }
        Nwrite(lpBuf + 16, dwAddress, dwSize);
    } else {
        dwAddress = RPL_CreateTemp(dwSize + 10, TRUE);
        if (dwAddress == 0) { if (running) enter_run(); return S_ERR_ASCII; }
        Write5(dwAddress, 0x02A2C); Write5(dwAddress + 5, dwSize + 5); Nwrite(lpBuf, dwAddress + 10, dwSize);
    }
    RPL_Push(1, dwAddress);
    if (running) enter_run();
    return S_ERR_NO;
}

EXPORT(hp_init) void hp_init(void) {
    QueryPerformanceFrequency(&lFreq); QueryPerformanceCounter(&lAppStart);
    hEventShutdn = CreateEvent(NULL, FALSE, FALSE, NULL);
    hWindowDC = (HDC)&dummy_handle;
    nState = SM_INVALID; nNextState = SM_INVALID;
    bEnableSlow = FALSE;
}
VOID UpdatePatches(BOOL bPatch) {}
INT SendByteUdp(BYTE byData) { return 0; }
EXPORT(hp_boffset) int hp_boffset(void) { return Chipset.boffset & 3; }

#ifndef SHIM_GSTDIO_H
#define SHIM_GSTDIO_H
#include <glib.h>
#include <stdio.h>
#include <unistd.h>
#include <sys/stat.h>
#define g_fopen fopen
#define g_unlink unlink
#define g_remove remove
#define g_rename rename
#define g_mkdir(p,m) mkdir((p),(m))
#define g_chdir chdir
#define g_stat stat
#define g_lstat lstat
#define g_open open
typedef struct stat GStatBuf;
#endif

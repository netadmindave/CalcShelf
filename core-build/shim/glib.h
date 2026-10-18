/* Minimal GLib compatibility shim for building TiEmu/libti* to WebAssembly.
 * Part of TI-89 Touch (GPL-3.0). Implements only what the emulator core uses. */
#ifndef SHIM_GLIB_H
#define SHIM_GLIB_H
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <stdint.h>
#include <stddef.h>
#include <limits.h>
#ifdef __cplusplus
#define G_BEGIN_DECLS extern "C" {
#define G_END_DECLS }
#else
#define G_BEGIN_DECLS
#define G_END_DECLS
#endif
typedef char gchar; typedef unsigned char guchar; typedef int gint; typedef unsigned int guint;
typedef short gshort; typedef unsigned short gushort; typedef long glong; typedef unsigned long gulong;
typedef int8_t gint8; typedef uint8_t guint8; typedef int16_t gint16; typedef uint16_t guint16;
typedef int32_t gint32; typedef uint32_t guint32; typedef int64_t gint64; typedef uint64_t guint64;
typedef int gboolean; typedef void* gpointer; typedef const void* gconstpointer;
typedef size_t gsize; typedef ptrdiff_t gssize; typedef float gfloat; typedef double gdouble;
typedef uint16_t gunichar2; typedef uint32_t gunichar;
#ifndef TRUE
#define TRUE 1
#endif
#ifndef FALSE
#define FALSE 0
#endif
#define G_CONST_RETURN const
#define G_DIR_SEPARATOR '/'
#define G_DIR_SEPARATOR_S "/"
#define G_SEARCHPATH_SEPARATOR_S ":"
#define G_N_ELEMENTS(a) (sizeof(a)/sizeof((a)[0]))
#define GINT_TO_POINTER(i) ((gpointer)(intptr_t)(i))
#define GPOINTER_TO_INT(p) ((gint)(intptr_t)(p))
#define GUINT_TO_POINTER(i) ((gpointer)(uintptr_t)(i))
#define GPOINTER_TO_UINT(p) ((guint)(uintptr_t)(p))
#ifndef MIN
#define MIN(a,b) (((a)<(b))?(a):(b))
#endif
#ifndef MAX
#define MAX(a,b) (((a)>(b))?(a):(b))
#endif
#ifndef ABS
#define ABS(a) (((a)<0)?-(a):(a))
#endif
#define CLAMP(x,l,h) (((x)>(h))?(h):(((x)<(l))?(l):(x)))
#define G_GNUC_PRINTF(a,b) __attribute__((format(printf,a,b)))
#define G_GNUC_UNUSED __attribute__((unused))
#define G_INLINE_FUNC static inline
#define G_LIKELY(x) (x)
#define G_UNLIKELY(x) (x)
#define G_STMT_START do
#define G_STMT_END while(0)
#define G_LOCK_DEFINE(n) int g__lock_##n
#define G_LOCK_DEFINE_STATIC(n) static int g__lock_##n
#define G_LOCK(n) ((void)0)
#define G_UNLOCK(n) ((void)0)
#define G_PRIORITY_DEFAULT_IDLE 200
#define G_PRIORITY_DEFAULT 0
#define g_return_if_fail(e) do{ if(!(e)) return; }while(0)
#define g_return_val_if_fail(e,v) do{ if(!(e)) return (v); }while(0)
#define g_assert(e) ((void)0)
#define g_assert_not_reached() ((void)0)
/* memory */
#define g_malloc malloc
#define g_malloc0(n) calloc(1,(n))
#define g_realloc realloc
#define g_free free
#define g_new(T,n) ((T*)malloc(sizeof(T)*(n)))
#define g_new0(T,n) ((T*)calloc((n),sizeof(T)))
#define g_renew(T,p,n) ((T*)realloc((p),sizeof(T)*(n)))
#define g_memdup(p,n) g__memdup((p),(n))
gpointer g__memdup(gconstpointer p, guint n);
/* logging */
typedef enum { G_LOG_FLAG_RECURSION=1, G_LOG_FLAG_FATAL=2, G_LOG_LEVEL_ERROR=4, G_LOG_LEVEL_CRITICAL=8,
  G_LOG_LEVEL_WARNING=16, G_LOG_LEVEL_MESSAGE=32, G_LOG_LEVEL_INFO=64, G_LOG_LEVEL_DEBUG=128, G_LOG_LEVEL_MASK=~3 } GLogLevelFlags;
void g_logv(const gchar *domain, GLogLevelFlags lvl, const gchar *fmt, va_list ap);
void g_log(const gchar *domain, GLogLevelFlags lvl, const gchar *fmt, ...);
#define g_warning(...) g_log(NULL, G_LOG_LEVEL_WARNING, __VA_ARGS__)
#define g_message(...) g_log(NULL, G_LOG_LEVEL_MESSAGE, __VA_ARGS__)
#define g_critical(...) g_log(NULL, G_LOG_LEVEL_CRITICAL, __VA_ARGS__)
#define g_error(...) g_log(NULL, G_LOG_LEVEL_ERROR, __VA_ARGS__)
#define g_debug(...) g_log(NULL, G_LOG_LEVEL_DEBUG, __VA_ARGS__)
#define g_print printf
#define g_printf printf
#define g_fprintf fprintf
#define g_sprintf sprintf
#define g_snprintf snprintf
#define g_vsnprintf vsnprintf
/* strings */
gchar* g_strdup(const gchar *s);
gchar* g_strndup(const gchar *s, gsize n);
gchar* g_strdup_printf(const gchar *fmt, ...);
gchar* g_strdup_vprintf(const gchar *fmt, va_list ap);
gchar* g_strconcat(const gchar *s, ...);
gchar** g_strsplit(const gchar *s, const gchar *delim, gint max);
gchar** g_strsplit_set(const gchar *s, const gchar *delims, gint max);
void g_strfreev(gchar **v);
gint g_ascii_strcasecmp(const gchar *a, const gchar *b);
gint g_ascii_strncasecmp(const gchar *a, const gchar *b, gsize n);
#define g_strcasecmp g_ascii_strcasecmp
#define g_strncasecmp g_ascii_strncasecmp
gchar* g_strchomp(gchar *s);
gchar* g_strchug(gchar *s);
#define g_strstrip(s) g_strchomp(g_strchug(s))
gchar* g_ascii_strdown(const gchar *s, gssize len);
gchar* g_ascii_strup(const gchar *s, gssize len);
const gchar* g_basename(const gchar *f);
gchar* g_path_get_basename(const gchar *f);
gchar* g_path_get_dirname(const gchar *f);
gchar* g_build_filename(const gchar *first, ...);
const gchar* g_get_home_dir(void);
const gchar* g_get_tmp_dir(void);
gchar* g_get_current_dir(void);
/* charset */
typedef struct { int domain; int code; gchar *message; } GError;
void g_error_free(GError *e);
void g_clear_error(GError **e);
gchar* g_filename_from_utf8(const gchar *s, gssize len, gsize *r, gsize *w, GError **e);
gchar* g_filename_to_utf8(const gchar *s, gssize len, gsize *r, gsize *w, GError **e);
gchar* g_locale_to_utf8(const gchar *s, gssize len, gsize *r, gsize *w, GError **e);
gchar* g_locale_from_utf8(const gchar *s, gssize len, gsize *r, gsize *w, GError **e);
gboolean g_get_charset(const char **charset);
gboolean g_get_filename_charsets(const gchar ***charsets);
gunichar2* g_utf8_to_utf16(const gchar *s, glong len, glong *r, glong *w, GError **e);
gchar* g_utf16_to_utf8(const gunichar2 *s, glong len, glong *r, glong *w, GError **e);
/* files */
typedef enum { G_FILE_TEST_IS_REGULAR=1, G_FILE_TEST_IS_SYMLINK=2, G_FILE_TEST_IS_DIR=4, G_FILE_TEST_IS_EXECUTABLE=8, G_FILE_TEST_EXISTS=16 } GFileTest;
gboolean g_file_test(const gchar *f, GFileTest t);
typedef struct GDir GDir;
GDir* g_dir_open(const gchar *path, guint flags, GError **e);
const gchar* g_dir_read_name(GDir *d);
void g_dir_close(GDir *d);
/* lists */
typedef gint (*GCompareFunc)(gconstpointer a, gconstpointer b);
typedef gint (*GCompareDataFunc)(gconstpointer a, gconstpointer b, gpointer d);
typedef void (*GFunc)(gpointer data, gpointer user);
typedef void (*GDestroyNotify)(gpointer data);
typedef gboolean (*GSourceFunc)(gpointer data);
typedef struct _GList GList;
struct _GList { gpointer data; GList *next; GList *prev; };
GList* g_list_append(GList *l, gpointer d);
GList* g_list_prepend(GList *l, gpointer d);
GList* g_list_insert(GList *l, gpointer d, gint pos);
GList* g_list_remove(GList *l, gconstpointer d);
GList* g_list_delete_link(GList *l, GList *link);
GList* g_list_reverse(GList *l);
GList* g_list_nth(GList *l, guint n);
gpointer g_list_nth_data(GList *l, guint n);
GList* g_list_first(GList *l);
GList* g_list_last(GList *l);
GList* g_list_find(GList *l, gconstpointer d);
GList* g_list_find_custom(GList *l, gconstpointer d, GCompareFunc f);
guint g_list_length(GList *l);
void g_list_foreach(GList *l, GFunc f, gpointer u);
void g_list_free(GList *l);
GList* g_list_sort(GList *l, GCompareFunc f);
#define g_list_next(l) ((l) ? (l)->next : NULL)
#define g_list_previous(l) ((l) ? (l)->prev : NULL)
typedef struct _GSList GSList;
struct _GSList { gpointer data; GSList *next; };
/* N-ary trees */
typedef struct _GNode GNode;
struct _GNode { gpointer data; GNode *next; GNode *prev; GNode *parent; GNode *children; };
typedef enum { G_TRAVERSE_LEAVES=1, G_TRAVERSE_NON_LEAVES=2, G_TRAVERSE_ALL=3, G_TRAVERSE_MASK=3, G_TRAVERSE_LEAFS=1, G_TRAVERSE_NON_LEAFS=2 } GTraverseFlags;
typedef enum { G_IN_ORDER, G_PRE_ORDER, G_POST_ORDER, G_LEVEL_ORDER } GTraverseType;
typedef gboolean (*GNodeTraverseFunc)(GNode *node, gpointer data);
GNode* g_node_new(gpointer data);
GNode* g_node_append(GNode *parent, GNode *node);
#define g_node_append_data(p,d) g_node_append((p), g_node_new(d))
GNode* g_node_insert(GNode *parent, gint pos, GNode *node);
void g_node_destroy(GNode *root);
guint g_node_n_children(GNode *node);
GNode* g_node_nth_child(GNode *node, guint n);
void g_node_traverse(GNode *root, GTraverseType order, GTraverseFlags flags, gint max_depth, GNodeTraverseFunc func, gpointer data);
#define G_NODE_IS_LEAF(n) ((n)->children == NULL)
#define G_NODE_IS_ROOT(n) ((n)->parent == NULL && (n)->prev == NULL && (n)->next == NULL)
/* time */
typedef struct { glong tv_sec; glong tv_usec; } GTimeVal;
void g_get_current_time(GTimeVal *t);
void g_usleep(gulong us);
#endif
/* byte order (wasm32 is little-endian) */
#define G_LITTLE_ENDIAN 1234
#define G_BIG_ENDIAN 4321
#define G_BYTE_ORDER G_LITTLE_ENDIAN
#define GUINT16_SWAP_LE_BE(v) ((guint16)((((guint16)(v)) >> 8) | (((guint16)(v)) << 8)))
#define GUINT32_SWAP_LE_BE(v) ((guint32)__builtin_bswap32((guint32)(v)))
#define GUINT64_SWAP_LE_BE(v) ((guint64)__builtin_bswap64((guint64)(v)))
#define GUINT16_FROM_BE(v) GUINT16_SWAP_LE_BE(v)
#define GUINT16_TO_BE(v) GUINT16_SWAP_LE_BE(v)
#define GUINT32_FROM_BE(v) GUINT32_SWAP_LE_BE(v)
#define GUINT32_TO_BE(v) GUINT32_SWAP_LE_BE(v)
#define GUINT64_FROM_BE(v) GUINT64_SWAP_LE_BE(v)
#define GUINT64_TO_BE(v) GUINT64_SWAP_LE_BE(v)
#define GINT16_FROM_BE(v) ((gint16)GUINT16_SWAP_LE_BE(v))
#define GINT16_TO_BE(v) ((gint16)GUINT16_SWAP_LE_BE(v))
#define GINT32_FROM_BE(v) ((gint32)GUINT32_SWAP_LE_BE(v))
#define GINT32_TO_BE(v) ((gint32)GUINT32_SWAP_LE_BE(v))
#define GINT64_FROM_BE(v) ((gint64)GUINT64_SWAP_LE_BE(v))
#define GINT64_TO_BE(v) ((gint64)GUINT64_SWAP_LE_BE(v))
#define GUINT16_FROM_LE(v) ((guint16)(v))
#define GUINT16_TO_LE(v) ((guint16)(v))
#define GUINT32_FROM_LE(v) ((guint32)(v))
#define GUINT32_TO_LE(v) ((guint32)(v))
#define GUINT64_FROM_LE(v) ((guint64)(v))
#define GUINT64_TO_LE(v) ((guint64)(v))
#define GINT16_FROM_LE(v) ((gint16)(v))
#define GINT16_TO_LE(v) ((gint16)(v))
#define GINT32_FROM_LE(v) ((gint32)(v))
#define GINT32_TO_LE(v) ((gint32)(v))
#define GUINT_TO_BE(v) GUINT32_TO_BE(v)
#define GUINT_FROM_BE(v) GUINT32_FROM_BE(v)
#define GUINT_TO_LE(v) ((guint)(v))
#define GUINT_FROM_LE(v) ((guint)(v))

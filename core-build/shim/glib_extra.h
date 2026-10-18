/* Extra GLib stand-ins for the single-threaded TilEm WebAssembly build (TI-8x calculators).
 * Threads, mutexes and conditions are no-ops: everything runs on one thread. GPL-3.0-or-later. */
#ifndef SHIM_GLIB_EXTRA_H
#define SHIM_GLIB_EXTRA_H
#include <glib.h>
#include <ctype.h>
typedef struct { int dummy; } GMutex;
typedef struct { int dummy; } GCond;
typedef struct { int dummy; } GThread;
typedef struct { double start; } GTimer;
typedef struct { gpointer ptr_; } GStaticPrivate;
#define G_STATIC_PRIVATE_INIT { 0 }
typedef gpointer (*GThreadFunc)(gpointer);
GMutex *g_mutex_new(void); void g_mutex_free(GMutex *m);
#define g_mutex_lock(m) ((void)(m))
#define g_mutex_unlock(m) ((void)(m))
#define g_mutex_trylock(m) (TRUE)
GCond *g_cond_new(void); void g_cond_free(GCond *c);
#define g_cond_signal(c) ((void)(c))
#define g_cond_broadcast(c) ((void)(c))
#define g_cond_wait(c, m) ((void)(c))
GThread *g_thread_create(GThreadFunc f, gpointer d, gboolean joinable, GError **e);
gpointer g_thread_join(GThread *t);
GTimer *g_timer_new(void); void g_timer_destroy(GTimer *t); void g_timer_start(GTimer *t);
gdouble g_timer_elapsed(GTimer *t, gulong *us);
#define g_static_private_get(k) ((k)->ptr_)
#define g_static_private_set(k, v, f) ((k)->ptr_ = (v))
typedef struct { GList *head, *tail; guint length; } GQueue;
GQueue *g_queue_new(void); void g_queue_free(GQueue *q);
void g_queue_push_tail(GQueue *q, gpointer d); gpointer g_queue_pop_head(GQueue *q);
#define g_queue_is_empty(q) ((q)->head == NULL)
#define g_queue_peek_head(q) ((q)->head ? (q)->head->data : NULL)
#define g_try_malloc malloc
#define g_try_malloc0(n) calloc(1, (n))
#define g_slice_new(T) ((T *)malloc(sizeof(T)))
#define g_slice_new0(T) ((T *)calloc(1, sizeof(T)))
#define g_slice_free(T, p) free(p)
#define g_atomic_int_get(p) (*(p))
#define g_atomic_int_set(p, v) (*(p) = (v))
#define g_atomic_int_inc(p) ((*(p))++)
#define g_atomic_int_dec_and_test(p) (--(*(p)) == 0)
#define g_ascii_tolower(c) ((gchar)tolower((unsigned char)(c)))
#define g_ascii_toupper(c) ((gchar)toupper((unsigned char)(c)))
#define g_strerror strerror
typedef void *GIConv;
GIConv g_iconv_open(const gchar *to, const gchar *from);
gsize g_iconv(GIConv c, gchar **in, gsize *inl, gchar **out, gsize *outl);
gint g_iconv_close(GIConv c);
guint g_idle_add(GSourceFunc f, gpointer d);
guint g_idle_add_full(gint prio, GSourceFunc f, gpointer d, GDestroyNotify n);
guint g_timeout_add(guint ms, GSourceFunc f, gpointer d);
typedef guint32 GQuark;
GQuark g_quark_from_static_string(const gchar *s);
void g_set_error(GError **e, GQuark d, gint c, const gchar *fmt, ...);
gint g_file_error_from_errno(gint e);
#define G_FILE_ERROR g_quark_from_static_string("g-file-error")
gchar *g_filename_display_basename(const gchar *f);
GSList *g_slist_prepend(GSList *l, gpointer d);
GSList *g_slist_append(GSList *l, gpointer d);
GSList *g_slist_reverse(GSList *l);
guint g_slist_length(GSList *l);
void g_slist_free(GSList *l);
typedef struct { gchar *str; gsize len; gsize allocated_len; } GString;
GString *g_string_new(const gchar *init);
GString *g_string_append(GString *s, const gchar *t);
GString *g_string_append_c(GString *s, gchar c);
gchar *g_string_free(GString *s, gboolean free_segment);
#define g_utf8_next_char(p) ((p) + g__utf8_skip[*(const guchar *)(p)])
extern const gchar g__utf8_skip[256];
gunichar g_utf8_get_char(const gchar *p);
typedef enum { G_NORMALIZE_DEFAULT, G_NORMALIZE_NFD = 0, G_NORMALIZE_DEFAULT_COMPOSE, G_NORMALIZE_NFC = 1, G_NORMALIZE_ALL, G_NORMALIZE_NFKD = 2, G_NORMALIZE_ALL_COMPOSE, G_NORMALIZE_NFKC = 3 } GNormalizeMode;
gchar *g_utf8_normalize(const gchar *s, gssize len, GNormalizeMode m);
typedef struct { gchar *pat; } GPatternSpec;
GPatternSpec *g_pattern_spec_new(const gchar *p); void g_pattern_spec_free(GPatternSpec *p);
gboolean g_pattern_match(GPatternSpec *p, guint len, const gchar *s, const gchar *rev);
#define G_GNUC_NULL_TERMINATED __attribute__((__sentinel__))
#endif

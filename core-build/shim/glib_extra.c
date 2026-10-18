/* Implementations for glib_extra.h (single-threaded TilEm WebAssembly build). GPL-3.0-or-later. */
#include "glib_extra.h"
#include <time.h>
#include <errno.h>
static GMutex the_mutex; static GCond the_cond;
GMutex *g_mutex_new(void) { return &the_mutex; }
void g_mutex_free(GMutex *m) { (void)m; }
GCond *g_cond_new(void) { return &the_cond; }
void g_cond_free(GCond *c) { (void)c; }
GThread *g_thread_create(GThreadFunc f, gpointer d, gboolean j, GError **e) { (void)f; (void)d; (void)j; (void)e; return NULL; }
gpointer g_thread_join(GThread *t) { (void)t; return NULL; }
static double now_s(void) { struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts); return ts.tv_sec + ts.tv_nsec * 1e-9; }
GTimer *g_timer_new(void) { GTimer *t = malloc(sizeof *t); t->start = now_s(); return t; }
void g_timer_destroy(GTimer *t) { free(t); }
void g_timer_start(GTimer *t) { t->start = now_s(); }
gdouble g_timer_elapsed(GTimer *t, gulong *us) { double e = now_s() - t->start; if (us) *us = (gulong)((e - (long)e) * 1e6); return e; }
GQueue *g_queue_new(void) { return calloc(1, sizeof(GQueue)); }
void g_queue_free(GQueue *q) { if (!q) return; g_list_free(q->head); free(q); }
void g_queue_push_tail(GQueue *q, gpointer d) { GList *n = calloc(1, sizeof *n); n->data = d; n->prev = q->tail; if (q->tail) q->tail->next = n; else q->head = n; q->tail = n; q->length++; }
gpointer g_queue_pop_head(GQueue *q) { GList *n = q->head; if (!n) return NULL; gpointer d = n->data; q->head = n->next; if (q->head) q->head->prev = NULL; else q->tail = NULL; free(n); q->length--; return d; }
GIConv g_iconv_open(const gchar *to, const gchar *from) { (void)to; (void)from; return (GIConv)-1; }
gsize g_iconv(GIConv c, gchar **in, gsize *inl, gchar **out, gsize *outl) { (void)c; (void)in; (void)inl; (void)out; (void)outl; errno = EINVAL; return (gsize)-1; }
gint g_iconv_close(GIConv c) { (void)c; return 0; }
guint g_idle_add(GSourceFunc f, gpointer d) { (void)f; (void)d; return 0; }
guint g_idle_add_full(gint p, GSourceFunc f, gpointer d, GDestroyNotify n) { (void)p; (void)f; (void)d; (void)n; return 0; }
guint g_timeout_add(guint ms, GSourceFunc f, gpointer d) { (void)ms; (void)f; (void)d; return 0; }
GQuark g_quark_from_static_string(const gchar *s) { guint32 h = 5381; while (*s) h = h * 33 + (guchar)*s++; return h; }
void g_set_error(GError **e, GQuark d, gint c, const gchar *fmt, ...) {
	if (!e) return; va_list ap; va_start(ap, fmt); GError *x = malloc(sizeof *x); x->domain = d; x->code = c; x->message = g_strdup_vprintf(fmt, ap); va_end(ap); *e = x; }
gint g_file_error_from_errno(gint e) { return e; }
gchar *g_filename_display_basename(const gchar *f) { const char *b = strrchr(f, '/'); return g_strdup(b ? b + 1 : f); }
GSList *g_slist_prepend(GSList *l, gpointer d) { GSList *n = malloc(sizeof *n); n->data = d; n->next = l; return n; }
GSList *g_slist_append(GSList *l, gpointer d) { GSList *n = malloc(sizeof *n), *p = l; n->data = d; n->next = NULL; if (!l) return n; while (p->next) p = p->next; p->next = n; return l; }
GSList *g_slist_reverse(GSList *l) { GSList *r = NULL; while (l) { GSList *n = l->next; l->next = r; r = l; l = n; } return r; }
guint g_slist_length(GSList *l) { guint n = 0; for (; l; l = l->next) n++; return n; }
void g_slist_free(GSList *l) { while (l) { GSList *n = l->next; free(l); l = n; } }
GString *g_string_new(const gchar *init) { GString *s = malloc(sizeof *s); s->len = init ? strlen(init) : 0; s->allocated_len = s->len + 64; s->str = malloc(s->allocated_len); if (init) memcpy(s->str, init, s->len); s->str[s->len] = 0; return s; }
static void gs_grow(GString *s, gsize n) { if (s->len + n + 1 > s->allocated_len) { s->allocated_len = (s->len + n + 1) * 2; s->str = realloc(s->str, s->allocated_len); } }
GString *g_string_append(GString *s, const gchar *t) { gsize n = strlen(t); gs_grow(s, n); memcpy(s->str + s->len, t, n + 1); s->len += n; return s; }
GString *g_string_append_c(GString *s, gchar c) { gs_grow(s, 1); s->str[s->len++] = c; s->str[s->len] = 0; return s; }
gchar *g_string_free(GString *s, gboolean fs) { gchar *r = fs ? (free(s->str), NULL) : s->str; free(s); return r; }
const gchar g__utf8_skip[256] = {
 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
 2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2, 3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,5,5,5,5,6,6,1,1 };
gunichar g_utf8_get_char(const gchar *p) { const guchar *s = (const guchar *)p; int n = g__utf8_skip[*s]; gunichar c = n == 1 ? *s : *s & (0x7F >> n); for (int i = 1; i < n; i++) c = (c << 6) | (s[i] & 0x3F); return c; }
gchar *g_utf8_normalize(const gchar *s, gssize len, GNormalizeMode m) { (void)m; return len < 0 ? g_strdup(s) : g_strndup(s, len); }
GPatternSpec *g_pattern_spec_new(const gchar *p) { GPatternSpec *x = malloc(sizeof *x); x->pat = g_strdup(p); return x; }
void g_pattern_spec_free(GPatternSpec *p) { free(p->pat); free(p); }
static int wild(const char *p, const char *s) { if (!*p) return !*s; if (*p == '*') return wild(p + 1, s) || (*s && wild(p, s + 1)); if (*s && (*p == '?' || *p == *s)) return wild(p + 1, s + 1); return 0; }
gboolean g_pattern_match(GPatternSpec *p, guint len, const gchar *s, const gchar *rev) { (void)len; (void)rev; return wild(p->pat, s); }

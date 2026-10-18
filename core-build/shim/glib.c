/* Minimal GLib compatibility shim implementation (GPL-3.0, part of TI-89 Touch). */
#include <glib.h>
#include <ctype.h>
#include <dirent.h>
#include <sys/stat.h>
#include <sys/time.h>
#include <unistd.h>

int g89_log_level = 1;

gpointer g__memdup(gconstpointer p, guint n) { if (!p) return NULL; void *r = malloc(n); memcpy(r, p, n); return r; }

void g_logv(const gchar *domain, GLogLevelFlags lvl, const gchar *fmt, va_list ap)
{
	if (lvl > G_LOG_LEVEL_WARNING && g89_log_level < 2) return;
	if (domain) fprintf(stderr, "[%s] ", domain);
	vfprintf(stderr, fmt, ap);
	fputc('\n', stderr);
}
void g_log(const gchar *domain, GLogLevelFlags lvl, const gchar *fmt, ...)
{ va_list ap; va_start(ap, fmt); g_logv(domain, lvl, fmt, ap); va_end(ap); }

/* ---------- strings ---------- */
gchar* g_strdup(const gchar *s) { if (!s) return NULL; size_t n = strlen(s) + 1; gchar *r = malloc(n); memcpy(r, s, n); return r; }
gchar* g_strndup(const gchar *s, gsize n)
{ if (!s) return NULL; gchar *r = calloc(1, n + 1); size_t i; for (i = 0; i < n && s[i]; i++) r[i] = s[i]; return r; }
gchar* g_strdup_vprintf(const gchar *fmt, va_list ap)
{
	va_list c; va_copy(c, ap);
	int n = vsnprintf(NULL, 0, fmt, c); va_end(c);
	gchar *r = malloc(n + 1); vsnprintf(r, n + 1, fmt, ap); return r;
}
gchar* g_strdup_printf(const gchar *fmt, ...)
{ va_list ap; va_start(ap, fmt); gchar *r = g_strdup_vprintf(fmt, ap); va_end(ap); return r; }
gchar* g_strconcat(const gchar *s, ...)
{
	if (!s) return NULL;
	va_list ap; size_t len = strlen(s); const gchar *p;
	va_start(ap, s); while ((p = va_arg(ap, const gchar*))) len += strlen(p); va_end(ap);
	gchar *r = malloc(len + 1); strcpy(r, s);
	va_start(ap, s); while ((p = va_arg(ap, const gchar*))) strcat(r, p); va_end(ap);
	return r;
}
static gchar** split_impl(const gchar *s, const gchar *delim, gint max, int set)
{
	int cap = 8, n = 0; gchar **v = malloc(sizeof(gchar*) * cap);
	if (max < 1) max = INT_MAX;
	const gchar *start = s, *p = s; size_t dl = set ? 1 : strlen(delim);
	if (s && *s) {
		while (*p) {
			int hit = set ? (strchr(delim, *p) != NULL) : (dl && strncmp(p, delim, dl) == 0);
			if (hit && n < max - 1) {
				if (n + 2 >= cap) { cap *= 2; v = realloc(v, sizeof(gchar*) * cap); }
				v[n++] = g_strndup(start, p - start); p += dl; start = p;
			} else p++;
		}
		if (n + 2 >= cap) { cap *= 2; v = realloc(v, sizeof(gchar*) * cap); }
		v[n++] = g_strdup(start);
	}
	v[n] = NULL; return v;
}
gchar** g_strsplit(const gchar *s, const gchar *d, gint max) { return split_impl(s, d, max, 0); }
gchar** g_strsplit_set(const gchar *s, const gchar *d, gint max) { return split_impl(s, d, max, 1); }
void g_strfreev(gchar **v) { if (!v) return; for (gchar **p = v; *p; p++) free(*p); free(v); }
gint g_ascii_strcasecmp(const gchar *a, const gchar *b)
{ while (*a && *b) { int d = tolower((unsigned char)*a) - tolower((unsigned char)*b); if (d) return d; a++; b++; } return tolower((unsigned char)*a) - tolower((unsigned char)*b); }
gint g_ascii_strncasecmp(const gchar *a, const gchar *b, gsize n)
{ while (n && *a && *b) { int d = tolower((unsigned char)*a) - tolower((unsigned char)*b); if (d) return d; a++; b++; n--; } if (!n) return 0; return tolower((unsigned char)*a) - tolower((unsigned char)*b); }
gchar* g_strchomp(gchar *s) { if (!s) return s; size_t n = strlen(s); while (n && isspace((unsigned char)s[n-1])) s[--n] = 0; return s; }
gchar* g_strchug(gchar *s) { if (!s) return s; gchar *p = s; while (*p && isspace((unsigned char)*p)) p++; memmove(s, p, strlen(p) + 1); return s; }
gchar* g_ascii_strdown(const gchar *s, gssize len) { gchar *r = len < 0 ? g_strdup(s) : g_strndup(s, len); for (gchar *p = r; *p; p++) *p = tolower((unsigned char)*p); return r; }
gchar* g_ascii_strup(const gchar *s, gssize len) { gchar *r = len < 0 ? g_strdup(s) : g_strndup(s, len); for (gchar *p = r; *p; p++) *p = toupper((unsigned char)*p); return r; }
const gchar* g_basename(const gchar *f) { const gchar *p = strrchr(f, '/'); return p ? p + 1 : f; }
gchar* g_path_get_basename(const gchar *f) { return g_strdup(g_basename(f)); }
gchar* g_path_get_dirname(const gchar *f)
{ const gchar *p = strrchr(f, '/'); if (!p) return g_strdup("."); if (p == f) return g_strdup("/"); return g_strndup(f, p - f); }
gchar* g_build_filename(const gchar *first, ...)
{
	va_list ap; const gchar *p; size_t len = strlen(first) + 1;
	va_start(ap, first); while ((p = va_arg(ap, const gchar*))) len += strlen(p) + 1; va_end(ap);
	gchar *r = malloc(len + 1); strcpy(r, first);
	va_start(ap, first);
	while ((p = va_arg(ap, const gchar*))) {
		size_t l = strlen(r);
		if (l && r[l-1] != '/' && *p != '/') strcat(r, "/");
		strcat(r, p);
	}
	va_end(ap);
	return r;
}
const gchar* g_get_home_dir(void) { return "/home"; }
const gchar* g_get_tmp_dir(void) { return "/tmp"; }
gchar* g_get_current_dir(void) { char b[1024]; if (getcwd(b, sizeof b)) return g_strdup(b); return g_strdup("/"); }

/* ---------- charset: the TI libs only need ASCII-ish paths here ---------- */
void g_error_free(GError *e) { if (e) { free(e->message); free(e); } }
void g_clear_error(GError **e) { if (e && *e) { g_error_free(*e); *e = NULL; } }
static gchar* dup_len(const gchar *s, gssize len, gsize *r, gsize *w)
{ gsize n = len < 0 ? strlen(s) : (gsize)len; if (r) *r = n; if (w) *w = n; return g_strndup(s, n); }
gchar* g_filename_from_utf8(const gchar *s, gssize len, gsize *r, gsize *w, GError **e) { (void)e; return dup_len(s, len, r, w); }
gchar* g_filename_to_utf8(const gchar *s, gssize len, gsize *r, gsize *w, GError **e) { (void)e; return dup_len(s, len, r, w); }
gchar* g_locale_to_utf8(const gchar *s, gssize len, gsize *r, gsize *w, GError **e) { (void)e; return dup_len(s, len, r, w); }
gchar* g_locale_from_utf8(const gchar *s, gssize len, gsize *r, gsize *w, GError **e) { (void)e; return dup_len(s, len, r, w); }
gboolean g_get_charset(const char **cs) { if (cs) *cs = "UTF-8"; return TRUE; }
gboolean g_get_filename_charsets(const gchar ***cs) { static const gchar *u[] = { "UTF-8", NULL }; if (cs) *cs = u; return TRUE; }
gunichar2* g_utf8_to_utf16(const gchar *s, glong len, glong *r, glong *w, GError **e)
{
	(void)e; const unsigned char *p = (const unsigned char*)s; size_t n = len < 0 ? strlen(s) : (size_t)len;
	gunichar2 *out = malloc(sizeof(gunichar2) * (n * 2 + 1)); glong o = 0; size_t i = 0;
	while (i < n) {
		uint32_t c = p[i];
		if (c < 0x80) i++;
		else if ((c & 0xE0) == 0xC0 && i + 1 < n) { c = ((c & 0x1F) << 6) | (p[i+1] & 0x3F); i += 2; }
		else if ((c & 0xF0) == 0xE0 && i + 2 < n) { c = ((c & 0x0F) << 12) | ((p[i+1] & 0x3F) << 6) | (p[i+2] & 0x3F); i += 3; }
		else if ((c & 0xF8) == 0xF0 && i + 3 < n) { c = ((c & 0x07) << 18) | ((p[i+1] & 0x3F) << 12) | ((p[i+2] & 0x3F) << 6) | (p[i+3] & 0x3F); i += 4; }
		else { i++; c = '?'; }
		if (c >= 0x10000) { c -= 0x10000; out[o++] = 0xD800 | (c >> 10); out[o++] = 0xDC00 | (c & 0x3FF); }
		else out[o++] = (gunichar2)c;
	}
	out[o] = 0; if (r) *r = (glong)n; if (w) *w = o; return out;
}
gchar* g_utf16_to_utf8(const gunichar2 *s, glong len, glong *r, glong *w, GError **e)
{
	(void)e; glong n = 0; if (len < 0) { while (s[n]) n++; } else n = len;
	unsigned char *out = malloc(n * 4 + 1); glong o = 0;
	for (glong i = 0; i < n; i++) {
		uint32_t c = s[i];
		if (c >= 0xD800 && c < 0xDC00 && i + 1 < n) { c = 0x10000 + ((c - 0xD800) << 10) + (s[i+1] - 0xDC00); i++; }
		if (c < 0x80) out[o++] = c;
		else if (c < 0x800) { out[o++] = 0xC0 | (c >> 6); out[o++] = 0x80 | (c & 0x3F); }
		else if (c < 0x10000) { out[o++] = 0xE0 | (c >> 12); out[o++] = 0x80 | ((c >> 6) & 0x3F); out[o++] = 0x80 | (c & 0x3F); }
		else { out[o++] = 0xF0 | (c >> 18); out[o++] = 0x80 | ((c >> 12) & 0x3F); out[o++] = 0x80 | ((c >> 6) & 0x3F); out[o++] = 0x80 | (c & 0x3F); }
	}
	out[o] = 0; if (r) *r = n; if (w) *w = o; return (gchar*)out;
}

/* ---------- files ---------- */
gboolean g_file_test(const gchar *f, GFileTest t)
{
	struct stat st;
	if (stat(f, &st) != 0) return FALSE;
	if (t & G_FILE_TEST_EXISTS) return TRUE;
	if ((t & G_FILE_TEST_IS_REGULAR) && S_ISREG(st.st_mode)) return TRUE;
	if ((t & G_FILE_TEST_IS_DIR) && S_ISDIR(st.st_mode)) return TRUE;
	return FALSE;
}
struct GDir { DIR *d; };
GDir* g_dir_open(const gchar *path, guint flags, GError **e)
{ (void)flags; (void)e; DIR *d = opendir(path); if (!d) return NULL; GDir *g = malloc(sizeof *g); g->d = d; return g; }
const gchar* g_dir_read_name(GDir *g)
{ struct dirent *de; while ((de = readdir(g->d))) { if (strcmp(de->d_name, ".") && strcmp(de->d_name, "..")) return de->d_name; } return NULL; }
void g_dir_close(GDir *g) { if (g) { closedir(g->d); free(g); } }

/* ---------- GList ---------- */
GList* g_list_last(GList *l) { if (l) while (l->next) l = l->next; return l; }
GList* g_list_first(GList *l) { if (l) while (l->prev) l = l->prev; return l; }
GList* g_list_append(GList *l, gpointer d)
{ GList *n = calloc(1, sizeof *n); n->data = d; if (!l) return n; GList *t = g_list_last(l); t->next = n; n->prev = t; return l; }
GList* g_list_prepend(GList *l, gpointer d)
{ GList *n = calloc(1, sizeof *n); n->data = d; n->next = l; if (l) { n->prev = l->prev; if (l->prev) l->prev->next = n; l->prev = n; } return n; }
GList* g_list_nth(GList *l, guint n) { while (l && n--) l = l->next; return l; }
gpointer g_list_nth_data(GList *l, guint n) { l = g_list_nth(l, n); return l ? l->data : NULL; }
GList* g_list_insert(GList *l, gpointer d, gint pos)
{
	if (pos < 0) return g_list_append(l, d);
	if (pos == 0) return g_list_prepend(l, d);
	GList *t = g_list_nth(l, pos); if (!t) return g_list_append(l, d);
	GList *n = calloc(1, sizeof *n); n->data = d; n->prev = t->prev; n->next = t; t->prev->next = n; t->prev = n; return l;
}
GList* g_list_delete_link(GList *l, GList *link)
{
	if (!link) return l;
	if (link->prev) link->prev->next = link->next;
	if (link->next) link->next->prev = link->prev;
	if (link == l) l = link->next;
	free(link); return l;
}
GList* g_list_remove(GList *l, gconstpointer d)
{ for (GList *t = l; t; t = t->next) if (t->data == d) return g_list_delete_link(l, t); return l; }
GList* g_list_reverse(GList *l)
{ GList *last = NULL; while (l) { last = l; l = l->next; last->next = last->prev; last->prev = l; } return last; }
GList* g_list_find(GList *l, gconstpointer d) { for (; l; l = l->next) if (l->data == d) return l; return NULL; }
GList* g_list_find_custom(GList *l, gconstpointer d, GCompareFunc f) { for (; l; l = l->next) if (!f(l->data, d)) return l; return NULL; }
guint g_list_length(GList *l) { guint n = 0; for (; l; l = l->next) n++; return n; }
void g_list_foreach(GList *l, GFunc f, gpointer u) { while (l) { GList *nx = l->next; f(l->data, u); l = nx; } }
void g_list_free(GList *l) { while (l) { GList *nx = l->next; free(l); l = nx; } }
GList* g_list_sort(GList *l, GCompareFunc f)
{
	guint n = g_list_length(l); if (n < 2) return l;
	gpointer *a = malloc(sizeof(gpointer) * n); guint i = 0; GList *t;
	for (t = l; t; t = t->next) a[i++] = t->data;
	/* stable insertion sort, lists here are short */
	for (i = 1; i < n; i++) { gpointer k = a[i]; int j = (int)i - 1; while (j >= 0 && f(a[j], k) > 0) { a[j+1] = a[j]; j--; } a[j+1] = k; }
	for (i = 0, t = l; t; t = t->next) t->data = a[i++];
	free(a); return l;
}

/* ---------- GNode ---------- */
GNode* g_node_new(gpointer data) { GNode *n = calloc(1, sizeof *n); n->data = data; return n; }
GNode* g_node_insert(GNode *parent, gint pos, GNode *node)
{
	node->parent = parent;
	if (!parent->children) { parent->children = node; return node; }
	GNode *c = parent->children; GNode *last = NULL; gint i = 0;
	while (c && (pos < 0 || i < pos)) { last = c; c = c->next; i++; }
	if (!c) { last->next = node; node->prev = last; }
	else { node->next = c; node->prev = c->prev; if (c->prev) c->prev->next = node; else parent->children = node; c->prev = node; }
	return node;
}
GNode* g_node_append(GNode *parent, GNode *node) { return g_node_insert(parent, -1, node); }
static void node_free_rec(GNode *n) { while (n) { GNode *nx = n->next; node_free_rec(n->children); free(n); n = nx; } }
void g_node_destroy(GNode *root)
{
	if (!root) return;
	if (root->parent) {
		if (root->prev) root->prev->next = root->next; else root->parent->children = root->next;
		if (root->next) root->next->prev = root->prev;
	}
	node_free_rec(root->children); free(root);
}
guint g_node_n_children(GNode *node) { guint n = 0; for (GNode *c = node->children; c; c = c->next) n++; return n; }
GNode* g_node_nth_child(GNode *node, guint n) { GNode *c = node->children; while (c && n--) c = c->next; return c; }
static gboolean trav(GNode *n, GTraverseType order, GTraverseFlags flags, gint depth, GNodeTraverseFunc f, gpointer d)
{
	int leaf = n->children == NULL;
	int want = leaf ? (flags & G_TRAVERSE_LEAVES) : (flags & G_TRAVERSE_NON_LEAVES);
	if (order == G_PRE_ORDER || order == G_LEVEL_ORDER) { if (want && f(n, d)) return TRUE; }
	if (depth != 1) {
		GNode *c = n->children;
		if (order == G_IN_ORDER && c) {
			if (trav(c, order, flags, depth - 1, f, d)) return TRUE;
			if (want && f(n, d)) return TRUE;
			for (c = c->next; c; c = c->next) if (trav(c, order, flags, depth - 1, f, d)) return TRUE;
			return FALSE;
		}
		for (; c; c = c->next) if (trav(c, order, flags, depth - 1, f, d)) return TRUE;
	}
	if (order == G_POST_ORDER || (order == G_IN_ORDER)) { if (want && f(n, d)) return TRUE; }
	return FALSE;
}
void g_node_traverse(GNode *root, GTraverseType order, GTraverseFlags flags, gint max_depth, GNodeTraverseFunc func, gpointer data)
{ if (root) trav(root, order, flags, max_depth < 0 ? -1 : max_depth, func, data); }

/* ---------- time ---------- */
void g_get_current_time(GTimeVal *t) { struct timeval tv; gettimeofday(&tv, NULL); t->tv_sec = tv.tv_sec; t->tv_usec = tv.tv_usec; }
void g_usleep(gulong us) { (void)us; }

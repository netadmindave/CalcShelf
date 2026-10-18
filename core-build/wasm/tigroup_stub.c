/* TI-89 Touch: TiGroup (.tig, zip-based) archives are not supported in the wasm build (no zlib). */
#include <stdlib.h>
#include "tifiles.h"
#include "error.h"
TigContent* tifiles_content_create_tigroup(CalcModel model, int n) { (void)n; TigContent *c = calloc(1, sizeof(TigContent)); if (c) c->model = model; return c; }
int tifiles_content_delete_tigroup(TigContent *c) { free(c); return 0; }
int tifiles_file_read_tigroup(const char *f, TigContent *c) { (void)f; (void)c; return ERR_FILE_OPEN; }

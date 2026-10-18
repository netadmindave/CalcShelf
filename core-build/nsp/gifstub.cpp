#include "core/gif.h"
bool gif_single_frame(const char *) { return false; }
bool gif_start_recording(const char *, unsigned int) { return false; }
void gif_new_frame() {}
bool gif_stop_recording() { return false; }

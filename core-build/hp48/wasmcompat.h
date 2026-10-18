#pragma once
/* single-threaded WebAssembly build: thread primitives are plain ints */
typedef int sem_t;
typedef void AAsset; typedef void AAssetManager; typedef void *jobject; typedef void JNIEnv;
void wasm_log(const char *fmt, ...);
#include <limits.h>
#ifndef PATH_MAX
#define PATH_MAX 512
#endif

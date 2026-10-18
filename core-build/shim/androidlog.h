#ifndef ANDROID_LOG
#define ANDROID_LOG
#include <stdio.h>
extern int g89_log_level;
#define LOGD(...) do{ if(g89_log_level>=3){fprintf(stderr,__VA_ARGS__);fputc('\n',stderr);} }while(0)
#define LOGI(...) do{ if(g89_log_level>=2){fprintf(stderr,__VA_ARGS__);fputc('\n',stderr);} }while(0)
#define LOGW(...) do{ if(g89_log_level>=1){fprintf(stderr,__VA_ARGS__);fputc('\n',stderr);} }while(0)
#define LOGE(...) do{ fprintf(stderr,__VA_ARGS__);fputc('\n',stderr); }while(0)
#define LOGF(...) do{ fprintf(stderr,__VA_ARGS__);fputc('\n',stderr); }while(0)
#endif

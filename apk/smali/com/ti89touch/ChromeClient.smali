.class public Lcom/ti89touch/ChromeClient;
.super Landroid/webkit/WebChromeClient;
.source "ChromeClient.java"

# Opens the system file picker for <input type=file>.

.field private final act:Lcom/ti89touch/MainActivity;


.method public constructor <init>(Lcom/ti89touch/MainActivity;)V
    .registers 2
    invoke-direct {p0}, Landroid/webkit/WebChromeClient;-><init>()V
    iput-object p1, p0, Lcom/ti89touch/ChromeClient;->act:Lcom/ti89touch/MainActivity;
    return-void
.end method


.method public onShowFileChooser(Landroid/webkit/WebView;Landroid/webkit/ValueCallback;Landroid/webkit/WebChromeClient$FileChooserParams;)Z
    .registers 9

    iget-object v0, p0, Lcom/ti89touch/ChromeClient;->act:Lcom/ti89touch/MainActivity;
    iget-object v1, v0, Lcom/ti89touch/MainActivity;->fileCb:Landroid/webkit/ValueCallback;
    if-eqz v1, :cond_nocb
    const/4 v2, 0x0
    invoke-interface {v1, v2}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
    :cond_nocb
    iput-object p2, v0, Lcom/ti89touch/MainActivity;->fileCb:Landroid/webkit/ValueCallback;

    new-instance v1, Landroid/content/Intent;
    const-string v2, "android.intent.action.GET_CONTENT"
    invoke-direct {v1, v2}, Landroid/content/Intent;-><init>(Ljava/lang/String;)V
    const-string v2, "android.intent.category.OPENABLE"
    invoke-virtual {v1, v2}, Landroid/content/Intent;->addCategory(Ljava/lang/String;)Landroid/content/Intent;
    const-string v2, "*/*"
    invoke-virtual {v1, v2}, Landroid/content/Intent;->setType(Ljava/lang/String;)Landroid/content/Intent;

    invoke-virtual {p3}, Landroid/webkit/WebChromeClient$FileChooserParams;->getMode()I
    move-result v2
    const/4 v3, 0x1
    if-ne v2, v3, :cond_single
    const-string v2, "android.intent.extra.ALLOW_MULTIPLE"
    invoke-virtual {v1, v2, v3}, Landroid/content/Intent;->putExtra(Ljava/lang/String;Z)Landroid/content/Intent;
    :cond_single

    :try_start_0
    const/16 v2, 0x2a
    invoke-virtual {v0, v1, v2}, Lcom/ti89touch/MainActivity;->startActivityForResult(Landroid/content/Intent;I)V
    :try_end_0
    .catch Landroid/content/ActivityNotFoundException; {:try_start_0 .. :try_end_0} :catch_0

    const/4 v0, 0x1
    return v0

    :catch_0
    const/4 v1, 0x0
    iput-object v1, v0, Lcom/ti89touch/MainActivity;->fileCb:Landroid/webkit/ValueCallback;
    const/4 v0, 0x0
    return v0
.end method

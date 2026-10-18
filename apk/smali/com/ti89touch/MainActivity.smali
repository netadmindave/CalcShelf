.class public Lcom/ti89touch/MainActivity;
.super Landroid/app/Activity;
.source "MainActivity.java"

# TI-89 Touch Android shell (GPL-3.0-or-later): hosts the web app in a WebView.

.field public web:Landroid/webkit/WebView;
.field public fileCb:Landroid/webkit/ValueCallback;


.method public constructor <init>()V
    .registers 1
    invoke-direct {p0}, Landroid/app/Activity;-><init>()V
    return-void
.end method


.method protected onCreate(Landroid/os/Bundle;)V
    .registers 7

    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    new-instance v0, Landroid/webkit/WebView;
    invoke-direct {v0, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V
    iput-object v0, p0, Lcom/ti89touch/MainActivity;->web:Landroid/webkit/WebView;

    invoke-virtual {v0}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
    move-result-object v1
    const/4 v2, 0x1
    const/4 v3, 0x0
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V
    invoke-virtual {v1, v3}, Landroid/webkit/WebSettings;->setAllowFileAccess(Z)V
    invoke-virtual {v1, v3}, Landroid/webkit/WebSettings;->setAllowContentAccess(Z)V
    invoke-virtual {v1, v3}, Landroid/webkit/WebSettings;->setSupportZoom(Z)V
    invoke-virtual {v1, v3}, Landroid/webkit/WebSettings;->setBuiltInZoomControls(Z)V
    const/16 v4, 0x64
    invoke-virtual {v1, v4}, Landroid/webkit/WebSettings;->setTextZoom(I)V

    invoke-virtual {v0, v3}, Landroid/webkit/WebView;->setBackgroundColor(I)V
    invoke-virtual {v0, v3}, Landroid/webkit/WebView;->setHapticFeedbackEnabled(Z)V
    invoke-virtual {v0, v3}, Landroid/webkit/WebView;->setLongClickable(Z)V
    const/4 v4, 0x2
    invoke-virtual {v0, v4}, Landroid/webkit/WebView;->setOverScrollMode(I)V

    new-instance v1, Lcom/ti89touch/AssetClient;
    invoke-direct {v1, p0}, Lcom/ti89touch/AssetClient;-><init>(Lcom/ti89touch/MainActivity;)V
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setWebViewClient(Landroid/webkit/WebViewClient;)V

    new-instance v1, Lcom/ti89touch/ChromeClient;
    invoke-direct {v1, p0}, Lcom/ti89touch/ChromeClient;-><init>(Lcom/ti89touch/MainActivity;)V
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setWebChromeClient(Landroid/webkit/WebChromeClient;)V

    new-instance v1, Lcom/ti89touch/Bridge;
    invoke-direct {v1, p0}, Lcom/ti89touch/Bridge;-><init>(Lcom/ti89touch/MainActivity;)V
    const-string v2, "TiBridge"
    invoke-virtual {v0, v1, v2}, Landroid/webkit/WebView;->addJavascriptInterface(Ljava/lang/Object;Ljava/lang/String;)V

    invoke-virtual {p0, v0}, Lcom/ti89touch/MainActivity;->setContentView(Landroid/view/View;)V

    const-string v1, "https://appassets.androidplatform.net/www/index.html"
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V
    return-void
.end method


.method public onBackPressed()V
    .registers 4
    iget-object v0, p0, Lcom/ti89touch/MainActivity;->web:Landroid/webkit/WebView;
    const-string v1, "(window.onAndroidBack ? window.onAndroidBack() : (window.TiBridge.exitApp(), false))"
    const/4 v2, 0x0
    invoke-virtual {v0, v1, v2}, Landroid/webkit/WebView;->evaluateJavascript(Ljava/lang/String;Landroid/webkit/ValueCallback;)V
    return-void
.end method


.method protected onPause()V
    .registers 4
    iget-object v0, p0, Lcom/ti89touch/MainActivity;->web:Landroid/webkit/WebView;
    if-eqz v0, :cond_skip
    const-string v1, "window.onAndroidPause && window.onAndroidPause()"
    const/4 v2, 0x0
    invoke-virtual {v0, v1, v2}, Landroid/webkit/WebView;->evaluateJavascript(Ljava/lang/String;Landroid/webkit/ValueCallback;)V
    :cond_skip
    invoke-super {p0}, Landroid/app/Activity;->onPause()V
    return-void
.end method


.method protected onActivityResult(IILandroid/content/Intent;)V
    .registers 10

    iget-object v0, p0, Lcom/ti89touch/MainActivity;->fileCb:Landroid/webkit/ValueCallback;
    if-eqz v0, :cond_done

    const/4 v1, 0x0
    const/4 v2, -0x1
    if-ne p2, v2, :cond_deliver
    if-eqz p3, :cond_deliver

    invoke-virtual {p3}, Landroid/content/Intent;->getClipData()Landroid/content/ClipData;
    move-result-object v2
    if-eqz v2, :cond_single

    invoke-virtual {v2}, Landroid/content/ClipData;->getItemCount()I
    move-result v3
    new-array v1, v3, [Landroid/net/Uri;
    const/4 v4, 0x0
    :loop
    if-ge v4, v3, :cond_deliver
    invoke-virtual {v2, v4}, Landroid/content/ClipData;->getItemAt(I)Landroid/content/ClipData$Item;
    move-result-object v5
    invoke-virtual {v5}, Landroid/content/ClipData$Item;->getUri()Landroid/net/Uri;
    move-result-object v5
    aput-object v5, v1, v4
    add-int/lit8 v4, v4, 0x1
    goto :loop

    :cond_single
    invoke-virtual {p3}, Landroid/content/Intent;->getData()Landroid/net/Uri;
    move-result-object v2
    if-eqz v2, :cond_deliver
    const/4 v3, 0x1
    new-array v1, v3, [Landroid/net/Uri;
    const/4 v3, 0x0
    aput-object v2, v1, v3

    :cond_deliver
    invoke-interface {v0, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
    const/4 v0, 0x0
    iput-object v0, p0, Lcom/ti89touch/MainActivity;->fileCb:Landroid/webkit/ValueCallback;

    :cond_done
    invoke-super {p0, p1, p2, p3}, Landroid/app/Activity;->onActivityResult(IILandroid/content/Intent;)V
    return-void
.end method

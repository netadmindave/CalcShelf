.class public Lcom/ti89touch/AssetClient;
.super Landroid/webkit/WebViewClient;
.source "AssetClient.java"

# Serves assets/ at https://appassets.androidplatform.net/ so the page gets a secure origin.

.field private final act:Lcom/ti89touch/MainActivity;


.method public constructor <init>(Lcom/ti89touch/MainActivity;)V
    .registers 2
    invoke-direct {p0}, Landroid/webkit/WebViewClient;-><init>()V
    iput-object p1, p0, Lcom/ti89touch/AssetClient;->act:Lcom/ti89touch/MainActivity;
    return-void
.end method


.method static mime(Ljava/lang/String;)Ljava/lang/String;
    .registers 2
    const-string v0, ".html"
    invoke-virtual {p0, v0}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v0
    if-eqz v0, :next_0
    const-string v0, "text/html"
    return-object v0
    :next_0
    const-string v0, ".js"
    invoke-virtual {p0, v0}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v0
    if-eqz v0, :next_1
    const-string v0, "application/javascript"
    return-object v0
    :next_1
    const-string v0, ".css"
    invoke-virtual {p0, v0}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v0
    if-eqz v0, :next_2
    const-string v0, "text/css"
    return-object v0
    :next_2
    const-string v0, ".wasm"
    invoke-virtual {p0, v0}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v0
    if-eqz v0, :next_3
    const-string v0, "application/wasm"
    return-object v0
    :next_3
    const-string v0, ".json"
    invoke-virtual {p0, v0}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v0
    if-eqz v0, :next_4
    const-string v0, "application/json"
    return-object v0
    :next_4
    const-string v0, ".png"
    invoke-virtual {p0, v0}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v0
    if-eqz v0, :next_5
    const-string v0, "image/png"
    return-object v0
    :next_5
    const-string v0, ".woff2"
    invoke-virtual {p0, v0}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v0
    if-eqz v0, :next_6
    const-string v0, "font/woff2"
    return-object v0
    :next_6
    const-string v0, ".webmanifest"
    invoke-virtual {p0, v0}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v0
    if-eqz v0, :next_7
    const-string v0, "application/manifest+json"
    return-object v0
    :next_7
    const-string v0, ".svg"
    invoke-virtual {p0, v0}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v0
    if-eqz v0, :next_8
    const-string v0, "image/svg+xml"
    return-object v0
    :next_8
    const-string v0, ".txt"
    invoke-virtual {p0, v0}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v0
    if-eqz v0, :next_9
    const-string v0, "text/plain"
    return-object v0
    :next_9
    const-string v0, "application/octet-stream"
    return-object v0
.end method


.method public shouldInterceptRequest(Landroid/webkit/WebView;Landroid/webkit/WebResourceRequest;)Landroid/webkit/WebResourceResponse;
    .registers 9
    invoke-interface {p2}, Landroid/webkit/WebResourceRequest;->getUrl()Landroid/net/Uri;
    move-result-object v0
    invoke-virtual {v0}, Landroid/net/Uri;->getHost()Ljava/lang/String;
    move-result-object v1
    const-string v2, "appassets.androidplatform.net"
    invoke-virtual {v2, v1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v1
    if-nez v1, :cond_ours
    const/4 v0, 0x0
    return-object v0

    :cond_ours
    invoke-virtual {v0}, Landroid/net/Uri;->getPath()Ljava/lang/String;
    move-result-object v1
    const/4 v2, 0x1
    invoke-virtual {v1, v2}, Ljava/lang/String;->substring(I)Ljava/lang/String;
    move-result-object v1
    invoke-static {v1}, Lcom/ti89touch/AssetClient;->mime(Ljava/lang/String;)Ljava/lang/String;
    move-result-object v2

    :try_start_0
    iget-object v3, p0, Lcom/ti89touch/AssetClient;->act:Lcom/ti89touch/MainActivity;
    invoke-virtual {v3}, Lcom/ti89touch/MainActivity;->getAssets()Landroid/content/res/AssetManager;
    move-result-object v3
    invoke-virtual {v3, v1}, Landroid/content/res/AssetManager;->open(Ljava/lang/String;)Ljava/io/InputStream;
    move-result-object v3
    :try_end_0
    .catch Ljava/io/IOException; {:try_start_0 .. :try_end_0} :catch_0

    new-instance v4, Landroid/webkit/WebResourceResponse;
    const-string v5, "utf-8"
    invoke-direct {v4, v2, v5, v3}, Landroid/webkit/WebResourceResponse;-><init>(Ljava/lang/String;Ljava/lang/String;Ljava/io/InputStream;)V
    return-object v4

    :catch_0
    new-instance v4, Landroid/webkit/WebResourceResponse;
    const-string v5, "text/plain"
    const/4 v3, 0x0
    invoke-direct {v4, v5, v3, v3}, Landroid/webkit/WebResourceResponse;-><init>(Ljava/lang/String;Ljava/lang/String;Ljava/io/InputStream;)V
    return-object v4
.end method


.method public shouldOverrideUrlLoading(Landroid/webkit/WebView;Landroid/webkit/WebResourceRequest;)Z
    .registers 4
    const/4 v0, 0x0
    return v0
.end method

package os.jarvis.navegador;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PictureInPictureParams;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.net.TrafficStats;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import android.util.Rational;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Navegador JARVIS para Android [04-nov].
 * · La interfaz (barras, panel de JARVIS, menús, ajustes) es una página HTML: assets/shell/ (como la versión de PC).
 * · Cada pestaña es un WebView real (motor Chromium de Android) colocado entre la barra de arriba y la de abajo.
 * · La interfaz habla con esta parte por el puente «Android.h(id, acción, datos)» y recibe avisos con window.__ev(canal, datos).
 */
public class MainActivity extends Activity {
    static final String BASE = "https://appassets.androidplatform.net/assets/";
    static final String INICIO = BASE + "inicio/index.html";

    WebView shell; FrameLayout raiz, paginas;
    final List<Pestana> pestanas = new ArrayList<>(); Pestana activa; int sigId = 1;
    final ArrayDeque<String> cerradas = new ArrayDeque<>();
    int arribaDp = 60, abajoDp = 64, insTop, insBottom, insIme; boolean cubierto, enPip;
    View completa; WebChromeClient.CustomViewCallback completaCb;
    WebViewAssetLoader cargador; Boveda boveda; Bloqueo bloqueo;
    final ExecutorService hilos = Executors.newCachedThreadPool();
    final Handler ui = new Handler(Looper.getMainLooper());
    TextToSpeech tts; boolean ttsListo;
    ValueCallback<Uri[]> archivoCb; static final int PIDE_ARCHIVO = 41, PIDE_PERMISO = 42, PIDE_RESPALDO_CREAR = 43, PIDE_RESPALDO_ABRIR = 44;
    String respaldoId, respaldoClave;   // 💾 respaldo esperando a que el usuario elija dónde guardarlo / cuál abrir
    String pendientePermiso;
    String uaMovil, uaEscritorio; float den; int zoomTexto = 100;
    long redRx0, redTx0, redT0;

    class Pestana {
        int id; WebView w; boolean privada, cargando, escritorio, certError; int progreso; String icono = "";
        int rastreadores, anuncios; final Map<String, int[]> hosts = new ConcurrentHashMap<>(); final Set<String> vistos = ConcurrentHashMap.newKeySet();
        String url() { String u = w.getUrl(); return u == null ? "" : u; }
        String titulo() { String t = w.getTitle(); return t == null ? "" : t; }
    }

    // ═══════════════════════════ arranque ═══════════════════════════
    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        den = getResources().getDisplayMetrics().density;
        WebView.setWebContentsDebuggingEnabled(false);   // 🔒 nadie puede espiar las páginas por USB
        boveda = new Boveda(this); bloqueo = new Bloqueo(this);
        cargador = new WebViewAssetLoader.Builder().addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        getWindow().setStatusBarColor(Color.TRANSPARENT); getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        getWindow().getDecorView().setBackgroundColor(0xFF03080E);

        raiz = new FrameLayout(this); raiz.setBackgroundColor(0xFF03080E);
        shell = new WebView(this); shell.setBackgroundColor(0xFF03080E);
        paginas = new FrameLayout(this); paginas.setBackgroundColor(0xFF050B12);
        raiz.addView(shell, new FrameLayout.LayoutParams(-1, -1));
        raiz.addView(paginas, new FrameLayout.LayoutParams(-1, -1));
        setContentView(raiz);

        raiz.setOnApplyWindowInsetsListener((v, ins) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets sb = ins.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets ime = ins.getInsets(WindowInsets.Type.ime());
                insTop = sb.top; insBottom = sb.bottom; insIme = ime.bottom;
            }
            acomodar();
            emitir("insets", "{\"top\":" + dp(insTop) + ",\"bottom\":" + dp(insBottom) + ",\"ime\":" + dp(insIme) + "}");
            return ins;
        });

        prepararShell();
        WebView probe = new WebView(this);
        uaMovil = probe.getSettings().getUserAgentString(); probe.destroy();
        uaEscritorio = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
        tts = new TextToSpeech(this, s -> ttsListo = s == TextToSpeech.SUCCESS);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel c = new NotificationChannel("jarvis", "JARVIS", NotificationManager.IMPORTANCE_DEFAULT);
            getSystemService(NotificationManager.class).createNotificationChannel(c);
        }
        // pestañas de la última vez (o la página de inicio) + el enlace con el que nos abrieron
        boolean alguna = false;
        try {
            JSONArray guardadas = new JSONArray(leer("pestanas.json", "[]"));
            for (int i = 0; i < Math.min(guardadas.length(), 12); i++) { nueva(guardadas.getString(i), false, i == 0); alguna = true; }
        } catch (Exception ignored) { }
        if (!alguna) nueva(INICIO, false, true);
        abrirIntent(getIntent());
        redRx0 = TrafficStats.getTotalRxBytes(); redTx0 = TrafficStats.getTotalTxBytes(); redT0 = System.currentTimeMillis();
    }

    void prepararShell() {
        WebSettings s = shell.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false); s.setAllowContentAccess(false); s.setTextZoom(100);
        shell.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) { return cargador.shouldInterceptRequest(r.getUrl()); }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { String u = r.getUrl().toString(); if (u.startsWith(BASE)) return false; nueva(u, false, true); return true; }
        });
        shell.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest r) {   // micrófono (voz) y cámara (gestos) para la interfaz
                ui.post(() -> {
                    List<String> faltan = new ArrayList<>();
                    for (String rec : r.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(rec) && !tiene(Manifest.permission.RECORD_AUDIO)) faltan.add(Manifest.permission.RECORD_AUDIO);
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(rec) && !tiene(Manifest.permission.CAMERA)) faltan.add(Manifest.permission.CAMERA);
                    }
                    if (faltan.isEmpty()) r.grant(r.getResources());
                    else { requestPermissions(faltan.toArray(new String[0]), PIDE_PERMISO); r.deny(); emitir("permiso-pedido", "{}"); }
                });
            }
        });
        shell.addJavascriptInterface(new Puente(), "Android");
        shell.loadUrl(BASE + "shell/index.html");
    }

    @Override protected void onNewIntent(Intent i) { super.onNewIntent(i); abrirIntent(i); }
    void abrirIntent(Intent i) {
        if (i == null) return;
        if (Intent.ACTION_VIEW.equals(i.getAction()) && i.getData() != null) {   // 🔒 otras apps solo pueden abrir páginas web
            String esq = i.getData().getScheme() == null ? "" : i.getData().getScheme().toLowerCase(Locale.ROOT);
            if (esq.equals("http") || esq.equals("https")) nueva(i.getData().toString(), false, true);
        }
        else if (Intent.ACTION_SEND.equals(i.getAction())) { String t = i.getStringExtra(Intent.EXTRA_TEXT); if (t != null) emitir("compartido", JSONObject.quote(t)); }
    }

    @Override protected void onPause() {
        super.onPause();
        JSONArray a = new JSONArray();
        for (Pestana p : pestanas) if (!p.privada && p.url().startsWith("http")) a.put(p.url());
        escribir("pestanas.json", a.toString());
        CookieManager.getInstance().flush();
    }

    // ═══════════════════════════ pestañas ═══════════════════════════
    Pestana nueva(String url, boolean privada, boolean activar) {
        Pestana p = new Pestana(); p.id = sigId++; p.privada = privada;
        WebView w = new WebView(this); p.w = w;
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(false); s.setMediaPlaybackRequiresUserGesture(true);
        s.setBuiltInZoomControls(true); s.setDisplayZoomControls(false); s.setLoadWithOverviewMode(true); s.setUseWideViewPort(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE); s.setTextZoom(zoomTexto); s.setUserAgentString(uaMovil);
        s.setAllowFileAccess(false); s.setGeolocationEnabled(true);
        if (privada) { s.setCacheMode(WebSettings.LOAD_NO_CACHE); s.setSaveFormData(false); }
        w.setBackgroundColor(0xFF050B12);
        CookieManager.getInstance().setAcceptThirdPartyCookies(w, false);
        w.setWebViewClient(new ClientePagina(p));
        w.setWebChromeClient(new ChromePagina(p));
        w.setDownloadListener((u, ua, cd, mime, largo) -> descargar(p, u, ua, cd, mime));
        w.setFindListener((ord, total, listo) -> { if (listo) emitir("encontrado", "{\"actual\":" + (total > 0 ? ord + 1 : 0) + ",\"total\":" + total + "}"); });
        w.setOnLongClickListener(v -> menuPagina(p));
        w.setVisibility(View.GONE);
        paginas.addView(w, new FrameLayout.LayoutParams(-1, -1));
        pestanas.add(p);
        w.loadUrl(url == null || url.isEmpty() ? INICIO : url);
        if (activar || activa == null) activar(p.id);
        avisarEstado();
        return p;
    }
    Pestana pest(int id) { for (Pestana p : pestanas) if (p.id == id) return p; return null; }

    void activar(int id) {
        Pestana p = pest(id); if (p == null) return;
        activa = p;
        for (Pestana x : pestanas) { x.w.setVisibility(x == p ? View.VISIBLE : View.GONE); if (x != p) x.w.onPause(); }
        p.w.onResume();
        avisarEstado(); emitir("escaner", escaneo(p).toString());
    }
    void cerrar(int id) {
        Pestana p = pest(id); if (p == null) return;
        int i = pestanas.indexOf(p);
        if (!p.privada && p.url().startsWith("http")) { cerradas.push(p.url()); while (cerradas.size() > 25) cerradas.removeLast(); }
        pestanas.remove(p); paginas.removeView(p.w);
        if (p.privada) { p.w.clearCache(true); p.w.clearHistory(); p.w.clearFormData(); }
        p.w.destroy();
        if (pestanas.isEmpty()) { activa = null; nueva(INICIO, false, true); return; }
        if (activa == p) activar(pestanas.get(Math.min(i, pestanas.size() - 1)).id);
        avisarEstado();
    }

    /** La página va entre la barra de arriba y la de abajo de la interfaz. Con un menú o el panel abiertos, la interfaz pasa al frente. */
    void acomodar() {
        if (paginas == null) return;
        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) paginas.getLayoutParams();
        if (completa != null || enPip) { lp.topMargin = 0; lp.bottomMargin = 0; }
        else {
            lp.topMargin = insTop + Math.round(arribaDp * den);
            lp.bottomMargin = (insIme > 0 ? insIme : insBottom) + Math.round(abajoDp * den);
        }
        paginas.setLayoutParams(lp);
        if (cubierto && !enPip) shell.bringToFront(); else paginas.bringToFront();
        if (completa != null) completa.bringToFront();
        shell.setVisibility(enPip ? View.GONE : View.VISIBLE);
        raiz.requestLayout(); raiz.invalidate();
    }

    JSONObject estado() {
        JSONObject e = new JSONObject();
        try {
            JSONArray a = new JSONArray();
            for (Pestana p : pestanas) a.put(new JSONObject().put("id", p.id).put("titulo", p.titulo()).put("url", p.url()).put("privada", p.privada)
                    .put("cargando", p.cargando).put("icono", p.icono).put("inicio", p.url().startsWith(INICIO)));
            e.put("pestanas", a).put("activa", activa == null ? 0 : activa.id);
            if (activa != null) {
                e.put("url", activa.url()).put("titulo", activa.titulo()).put("cargando", activa.cargando).put("progreso", activa.progreso)
                        .put("atras", activa.w.canGoBack()).put("adelante", activa.w.canGoForward()).put("privada", activa.privada)
                        .put("escritorio", activa.escritorio).put("inicio", activa.url().startsWith(INICIO)).put("https", activa.url().startsWith("https:"))
                        .put("certError", activa.certError);
            }
            e.put("zoom", zoomTexto).put("cerradas", cerradas.size()).put("pip", enPip);
        } catch (Exception ignored) { }
        return e;
    }
    void avisarEstado() { ui.removeCallbacks(empujar); ui.postDelayed(empujar, 40); }
    final Runnable empujar = () -> emitir("estado", estado().toString());

    void emitir(String canal, String json) {
        if (shell == null) return;
        ui.post(() -> shell.evaluateJavascript("window.__ev&&window.__ev(" + JSONObject.quote(canal) + "," + (json == null ? "null" : json) + ")", null));
    }

    // ═══════════════════════════ lo que pasa en cada página ═══════════════════════════
    class ClientePagina extends WebViewClient {
        final Pestana p; ClientePagina(Pestana p) { this.p = p; }
        @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            Uri u = r.getUrl(); String esq = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
            String s = u.toString();
            // 🔒 [seguridad 05-nov] la interfaz de JARVIS nunca se abre dentro de una pestaña (solo la página de inicio)
            if (s.startsWith(BASE) && !s.startsWith(BASE + "inicio/")) return true;
            if (esq.equals("http") || esq.equals("https") || esq.equals("about") || esq.equals("blob")) return false;
            if (esq.equals("data") || esq.equals("javascript") || esq.equals("file") || esq.equals("content")) return r.isForMainFrame();   // trucos de estafa: bloqueados arriba
            if (!r.hasGesture()) return true;   // abrir otra app solo si tú tocaste algo, nunca solo
            try {   // intent://, tel:, mailto:, whatsapp:… → la app que toque
                Intent i = esq.equals("intent") ? Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME) : new Intent(Intent.ACTION_VIEW, u);
                i.addCategory(Intent.CATEGORY_BROWSABLE); i.setComponent(null); i.setSelector(null);
                startActivity(i);
            } catch (Exception e) {
                if (esq.equals("intent")) { try { String f = Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME).getStringExtra("browser_fallback_url"); if (f != null) v.loadUrl(f); } catch (Exception ignored) { } }
            }
            return true;
        }
        @Override public void onPageStarted(WebView v, String url, Bitmap fav) {
            p.cargando = true; p.certError = false; p.rastreadores = 0; p.anuncios = 0; p.hosts.clear(); p.vistos.clear();
            avisarEstado();
        }
        @Override public void onPageFinished(WebView v, String url) {
            p.cargando = false; avisarEstado();
            if (!p.privada && url != null && url.startsWith("http")) emitir("navegado", new JSONObject(Map.of("url", url, "titulo", p.titulo())).toString());
            if (p == activa) emitir("escaner", escaneo(p).toString());
            emitir("pagina-cargada", "{\"id\":" + p.id + "}");
        }
        @Override public void doUpdateVisitedHistory(WebView v, String url, boolean recarga) { avisarEstado(); }
        @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
            Uri u = r.getUrl(); String s = u.toString();
            if (s.startsWith(BASE)) return s.startsWith(BASE + "inicio/") ? cargador.shouldInterceptRequest(u) : new WebResourceResponse("text/plain", "utf-8", 404, "No", new java.util.HashMap<>(), new ByteArrayInputStream(new byte[0]));
            String host = u.getHost(); if (host == null) return null;
            if (host.startsWith("www.")) host = host.substring(4);
            char t = r.isForMainFrame() ? 0 : bloqueo.tipo(host);
            int[] c = p.hosts.get(host); if (c == null) { c = new int[]{0, 0}; p.hosts.put(host, c); }
            c[0]++;
            if (t != 0) {
                c[1] = t;
                String clave = s.split("\\?")[0];
                if (p.vistos.add(clave)) { if (t == 'r') p.rastreadores++; else p.anuncios++; }
                return new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
            }
            return null;
        }
        @Override public void onReceivedSslError(WebView v, SslErrorHandler h, android.net.http.SslError e) { h.cancel(); p.certError = true; avisarEstado(); }
    }

    class ChromePagina extends WebChromeClient {
        final Pestana p; ChromePagina(Pestana p) { this.p = p; }
        @Override public void onProgressChanged(WebView v, int n) { p.progreso = n; if (p == activa) emitir("progreso", String.valueOf(n)); }
        @Override public void onReceivedTitle(WebView v, String t) { avisarEstado(); }
        @Override public void onReceivedIcon(WebView v, Bitmap ic) {
            try { Bitmap b = Bitmap.createScaledBitmap(ic, 48, 48, true); ByteArrayOutputStream o = new ByteArrayOutputStream(); b.compress(Bitmap.CompressFormat.PNG, 90, o);
                p.icono = "data:image/png;base64," + Boveda.b64(o.toByteArray()); avisarEstado(); } catch (Exception ignored) { }
        }
        @Override public boolean onCreateWindow(WebView v, boolean dialogo, boolean gesto, android.os.Message m) {   // enlaces que abren pestaña nueva
            if (!gesto) return false;   // ventanas emergentes sin que toques nada: bloqueadas
            Pestana n = nueva("about:blank", p.privada, true);
            ((WebView.WebViewTransport) m.obj).setWebView(n.w); m.sendToTarget();
            return true;
        }
        @Override public void onCloseWindow(WebView v) { cerrar(p.id); }
        @Override public void onShowCustomView(View vista, CustomViewCallback cb) {   // video a pantalla completa
            completa = vista; completaCb = cb;
            raiz.addView(vista, new FrameLayout.LayoutParams(-1, -1)); vista.setBackgroundColor(Color.BLACK);
            setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR);
            if (Build.VERSION.SDK_INT >= 30) getWindow().getInsetsController().hide(WindowInsets.Type.systemBars());
            acomodar();
        }
        @Override public void onHideCustomView() {
            if (completa != null) raiz.removeView(completa);
            completa = null; if (completaCb != null) completaCb.onCustomViewHidden(); completaCb = null;
            setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
            if (Build.VERSION.SDK_INT >= 30) getWindow().getInsetsController().show(WindowInsets.Type.systemBars());
            acomodar();
        }
        @Override public void onPermissionRequest(PermissionRequest r) {   // una página pide cámara o micrófono
            ui.post(() -> {
                String host = r.getOrigin() == null ? "" : r.getOrigin().getHost();
                new AlertDialog.Builder(MainActivity.this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                        .setTitle(host).setMessage(getString(R.string.pide_camara))
                        .setPositiveButton(R.string.permitir, (d, x) -> {
                            List<String> faltan = new ArrayList<>();
                            for (String rec : r.getResources()) {
                                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(rec) && !tiene(Manifest.permission.RECORD_AUDIO)) faltan.add(Manifest.permission.RECORD_AUDIO);
                                if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(rec) && !tiene(Manifest.permission.CAMERA)) faltan.add(Manifest.permission.CAMERA);
                            }
                            if (!faltan.isEmpty()) { requestPermissions(faltan.toArray(new String[0]), PIDE_PERMISO); r.deny(); } else r.grant(r.getResources());
                        })
                        .setNegativeButton(R.string.no_permitir, (d, x) -> r.deny()).show();
            });
        }
        @Override public void onGeolocationPermissionsShowPrompt(String origen, GeolocationPermissions.Callback cb) {
            new AlertDialog.Builder(MainActivity.this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                    .setTitle(Uri.parse(origen).getHost()).setMessage(getString(R.string.pide_ubicacion))
                    .setPositiveButton(R.string.permitir, (d, x) -> { if (!tiene(Manifest.permission.ACCESS_FINE_LOCATION)) requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, PIDE_PERMISO); cb.invoke(origen, true, false); })
                    .setNegativeButton(R.string.no_permitir, (d, x) -> cb.invoke(origen, false, false)).show();
        }
        @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams f) {
            if (archivoCb != null) archivoCb.onReceiveValue(null);
            archivoCb = cb;
            try { startActivityForResult(f.createIntent(), PIDE_ARCHIVO); } catch (Exception e) { archivoCb = null; return false; }
            return true;
        }
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req == PIDE_ARCHIVO && archivoCb != null) { archivoCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data)); archivoCb = null; }
        if (req == PIDE_RESPALDO_CREAR || req == PIDE_RESPALDO_ABRIR) {
            final String id = respaldoId, clave = respaldoClave; respaldoId = null; respaldoClave = null;
            if (id == null) return;
            if (res != RESULT_OK || data == null || data.getData() == null) { responder(id, resultado(false, "cancelado")); return; }
            final Uri u = data.getData(); final boolean crear = req == PIDE_RESPALDO_CREAR;
            hilos.execute(() -> responder(id, crear ? respaldoCrear(u, clave) : respaldoRestaurar(u, clave)));
        }
    }

    // ═══════════════════════════ 💾 respaldo de ajustes ═══════════════════════════
    JSONObject resultado(boolean ok, String error) { try { JSONObject r = new JSONObject().put("ok", ok); if (error != null) r.put("error", error); return r; } catch (Exception e) { return new JSONObject(); } }
    void pedirRespaldo(JSONObject d, boolean crear) {
        if (respaldoId != null) responder(respaldoId, resultado(false, "cancelado"));
        respaldoId = d.optString("_id"); respaldoClave = d.optString("clave");
        Intent i = new Intent(crear ? Intent.ACTION_CREATE_DOCUMENT : Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE);
        if (crear) i.setType("application/octet-stream").putExtra(Intent.EXTRA_TITLE, "JARVIS-respaldo-" + new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(new java.util.Date()) + ".jarvis");
        else i.setType("*/*");
        try { startActivityForResult(i, crear ? PIDE_RESPALDO_CREAR : PIDE_RESPALDO_ABRIR); }
        catch (Exception e) { String id = respaldoId; respaldoId = null; respaldoClave = null; responder(id, resultado(false, "sin-selector")); }
    }
    Object respaldoCrear(Uri u, String clave) {
        try {
            JSONObject arch = new JSONObject();
            File[] fs = getFilesDir().listFiles();
            if (fs != null) for (File f : fs) { String n = f.getName(); if (f.isFile() && n.matches("[\\w.-]+\\.json") && f.length() < 8_000_000) arch.put(n, leer(n, "")); }
            JSONObject llaves = boveda.todas();
            JSONObject todo = new JSONObject().put("v", 1).put("app", "JARVIS Browser").put("fecha", System.currentTimeMillis()).put("archivos", arch).put("llaves", llaves);
            byte[] c = Respaldo.cifrar(todo.toString().getBytes(StandardCharsets.UTF_8), clave);
            try (OutputStream o = getContentResolver().openOutputStream(u, "wt")) { o.write(c); }
            return resultado(true, null).put("archivos", arch.length()).put("llaves", llaves.length());
        } catch (Exception e) { return resultado(false, "escribir"); }
    }
    Object respaldoRestaurar(Uri u, String clave) {
        try {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            try (InputStream in = getContentResolver().openInputStream(u)) {
                byte[] t = new byte[65536]; int n;
                while ((n = in.read(t)) > 0) { b.write(t, 0, n); if (b.size() > 60_000_000) return resultado(false, "archivo"); }
            }
            JSONObject todo = new JSONObject(new String(Respaldo.descifrar(b.toByteArray(), clave), StandardCharsets.UTF_8));
            JSONObject arch = todo.optJSONObject("archivos"); int na = 0;
            if (arch != null) for (Iterator<String> it = arch.keys(); it.hasNext(); ) { String n = it.next(); if (n.matches("[\\w.-]+\\.json")) { escribir(n, arch.optString(n)); na++; } }
            JSONObject ll = todo.optJSONObject("llaves");
            int nl = ll == null ? 0 : boveda.reemplazar(ll);
            return resultado(true, null).put("archivos", na).put("llaves", nl);
        } catch (Respaldo.ClaveMala e) { return resultado(false, "clave"); }
        catch (Respaldo.NoEsRespaldo e) { return resultado(false, "archivo"); }
        catch (Exception e) { return resultado(false, "archivo"); }
    }
    @Override public void onRequestPermissionsResult(int req, String[] p, int[] r) { emitir("permisos", "{}"); }

    boolean menuPagina(Pestana p) {   // mantener pulsado un enlace o una imagen → menú de la interfaz
        WebView.HitTestResult h = p.w.getHitTestResult();
        int t = h.getType(); String extra = h.getExtra();
        if (extra == null || (t != WebView.HitTestResult.SRC_ANCHOR_TYPE && t != WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE && t != WebView.HitTestResult.IMAGE_TYPE)) return false;
        try { emitir("menu-pagina", new JSONObject().put("tipo", t == WebView.HitTestResult.IMAGE_TYPE ? "imagen" : t == WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE ? "imagen-enlace" : "enlace").put("url", extra).toString()); } catch (Exception ignored) { }
        return true;
    }

    void descargar(Pestana p, String u, String ua, String cd, String mime) {
        try {
            if (u.startsWith("blob:") || u.startsWith("data:")) { emitir("aviso", JSONObject.quote(getString(R.string.descarga_no))); return; }
            String nombre = URLUtil.guessFileName(u, cd, mime);
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(u));
            r.setMimeType(mime); r.addRequestHeader("User-Agent", ua); r.addRequestHeader("Cookie", CookieManager.getInstance().getCookie(u));
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, nombre);
            ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(r);
            emitir("descarga", new JSONObject().put("nombre", nombre).put("url", u).put("mime", mime == null ? "" : mime).toString());
        } catch (Exception e) { emitir("aviso", JSONObject.quote(getString(R.string.descarga_fallo))); }
    }

    // ═══════════════════════════ escáner ═══════════════════════════
    JSONObject escaneo(Pestana p) {
        JSONObject r = new JSONObject();
        try {
            JSONArray hs = new JSONArray();
            for (Map.Entry<String, int[]> e : p.hosts.entrySet())
                hs.put(new JSONObject().put("host", e.getKey()).put("n", e.getValue()[0]).put("bloqueado", e.getValue()[1] == 'r' ? "rastreador" : e.getValue()[1] == 'a' ? "anuncio" : ""));
            r.put("url", p.url()).put("rastreadores", p.rastreadores).put("anuncios", p.anuncios).put("hosts", hs).put("certError", p.certError).put("privada", p.privada);
        } catch (Exception ignored) { }
        return r;
    }

    // ═══════════════════════════ el puente con la interfaz ═══════════════════════════
    class Puente {
        @JavascriptInterface public void h(String id, String accion, String datos) {
            JSONObject d; try { d = new JSONObject(datos == null || datos.isEmpty() ? "{}" : datos); } catch (Exception e) { d = new JSONObject(); }
            try { d.put("_id", id); } catch (Exception ignored) { }
            final JSONObject dd = d;
            if (accion.equals("fetch") || accion.equals("dns") || accion.equals("guardar") || accion.equals("cargar") || accion.equals("monitor")) hilos.execute(() -> responder(id, hacer(accion, dd)));
            else ui.post(() -> { Object r = hacer(accion, dd); if (r != ASINCRONO) responder(id, r); });
        }
    }
    final Object ASINCRONO = new Object();
    void responder(String id, Object r) {
        String j = r == null || r == JSONObject.NULL ? "null" : (r instanceof Crudo || r instanceof JSONObject || r instanceof JSONArray) ? r.toString() : r instanceof Boolean || r instanceof Number ? r.toString() : JSONObject.quote(String.valueOf(r));
        ui.post(() -> shell.evaluateJavascript("window.__r&&window.__r(" + JSONObject.quote(id) + "," + j + ")", null));
    }

    Object hacer(String a, JSONObject d) {
        try {
            Pestana p = activa;
            switch (a) {
                case "estado": return estado();
                case "layout": arribaDp = d.optInt("arriba", arribaDp); abajoDp = d.optInt("abajo", abajoDp); acomodar(); return true;
                case "cubrir": cubierto = d.optBoolean("on"); acomodar(); return true;
                case "nueva": return nueva(d.optString("url", INICIO), d.optBoolean("privada"), d.optBoolean("activar", true)).id;
                case "activar": activar(d.optInt("id")); return true;
                case "cerrar": cerrar(d.optInt("id", p == null ? 0 : p.id)); return true;
                case "reabrir": { String u = cerradas.poll(); if (u != null) nueva(u, false, true); return u == null ? JSONObject.NULL : u; }
                case "ir": if (p != null) { p.w.loadUrl(d.optString("url")); p.w.requestFocus(); } return true;
                case "inicio": if (p != null) p.w.loadUrl(INICIO); return true;
                case "atras": if (p != null && p.w.canGoBack()) p.w.goBack(); return true;
                case "adelante": if (p != null && p.w.canGoForward()) p.w.goForward(); return true;
                case "recargar": if (p != null) { if (p.cargando) p.w.stopLoading(); else p.w.reload(); } return true;
                case "js": {   // código en la página (la de la pestaña indicada o la activa); devuelve el resultado
                    Pestana q = d.has("id") ? pest(d.optInt("id")) : p; if (q == null) return JSONObject.NULL;
                    String idr = d.optString("_id");
                    q.w.evaluateJavascript(d.optString("codigo"), v -> responder(idr, new Crudo(v)));
                    return ASINCRONO;
                }
                case "foto": {   // lo que se ve de la página, en JPEG
                    if (p == null || p.w.getWidth() == 0) return JSONObject.NULL;
                    int ancho = d.optInt("ancho", 900); float k = Math.min(1f, ancho / (float) p.w.getWidth());
                    Bitmap b = Bitmap.createBitmap(Math.max(1, Math.round(p.w.getWidth() * k)), Math.max(1, Math.round(p.w.getHeight() * k)), Bitmap.Config.ARGB_8888);
                    Canvas c = new Canvas(b); c.scale(k, k); c.translate(-p.w.getScrollX(), -p.w.getScrollY()); p.w.draw(c);
                    ByteArrayOutputStream o = new ByteArrayOutputStream(); b.compress(Bitmap.CompressFormat.JPEG, d.optInt("calidad", 72), o);
                    return Boveda.b64(o.toByteArray());
                }
                case "guardar-foto": {   // a la galería (Imágenes/JARVIS)
                    byte[] img = Base64.decode(d.optString("b64"), Base64.DEFAULT);
                    android.content.ContentValues cv = new android.content.ContentValues();
                    cv.put(android.provider.MediaStore.Images.Media.DISPLAY_NAME, "JARVIS_" + System.currentTimeMillis() + ".jpg");
                    cv.put(android.provider.MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                    cv.put(android.provider.MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/JARVIS");
                    Uri uri = getContentResolver().insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) { os.write(img); }
                    return true;
                }
                case "guardar": escribir(d.optString("clave") + ".json", d.optString("valor")); return true;
                case "cargar": return new Crudo(leer(d.optString("clave") + ".json", "null"));
                case "llaves": return boveda.estado();
                case "llave": return boveda.poner(d.optString("nombre"), d.optString("valor"));
                case "fetch": return pedir(d);
                case "dns": {
                    JSONObject r = new JSONObject(); JSONArray hs = d.optJSONArray("hosts");
                    for (int i = 0; hs != null && i < Math.min(hs.length(), 30); i++) { try { r.put(hs.getString(i), InetAddress.getByName(hs.getString(i)).getHostAddress()); } catch (Exception ignored) { } }
                    return r;
                }
                case "tts": {
                    if (!ttsListo) return false;
                    String lang = d.optString("lang", "en");
                    tts.setLanguage(lang.startsWith("es") ? new Locale("es", "US") : lang.startsWith("en") ? Locale.UK : Locale.forLanguageTag(lang));
                    tts.setSpeechRate((float) d.optDouble("velocidad", 1.0)); tts.setPitch(0.92f);
                    tts.speak(d.optString("texto"), d.optBoolean("cola") ? TextToSpeech.QUEUE_ADD : TextToSpeech.QUEUE_FLUSH, null, "j" + System.nanoTime());
                    return true;
                }
                case "tts-parar": if (tts != null) tts.stop(); return true;
                case "hablando": return tts != null && tts.isSpeaking();
                case "notificar": {
                    if (Build.VERSION.SDK_INT >= 33 && !tiene(Manifest.permission.POST_NOTIFICATIONS)) { requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, PIDE_PERMISO); return false; }
                    Notification n = new Notification.Builder(MainActivity.this, "jarvis").setSmallIcon(R.drawable.ic_noti).setContentTitle(d.optString("titulo", "JARVIS"))
                            .setContentText(d.optString("texto")).setStyle(new Notification.BigTextStyle().bigText(d.optString("texto"))).setAutoCancel(true)
                            .setContentIntent(android.app.PendingIntent.getActivity(MainActivity.this, 0, new Intent(MainActivity.this, MainActivity.class), android.app.PendingIntent.FLAG_IMMUTABLE)).build();
                    getSystemService(NotificationManager.class).notify((int) (System.currentTimeMillis() % 100000), n);
                    return true;
                }
                case "compartir": {
                    Intent i = new Intent(Intent.ACTION_SEND); i.setType("text/plain");
                    i.putExtra(Intent.EXTRA_TEXT, d.optString("texto")); if (d.has("titulo")) i.putExtra(Intent.EXTRA_SUBJECT, d.optString("titulo"));
                    startActivity(Intent.createChooser(i, null)); return true;
                }
                case "externo": startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(d.optString("url")))); return true;
                case "copiar": ((ClipboardManager) getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("JARVIS", d.optString("texto"))); return true;
                case "buscar-en-pagina": if (p != null) { if (d.optBoolean("siguiente")) p.w.findNext(!d.optBoolean("atras")); else p.w.findAllAsync(d.optString("texto")); } return true;
                case "buscar-parar": if (p != null) p.w.clearMatches(); return true;
                case "escritorio": if (p != null) { p.escritorio = d.optBoolean("on", !p.escritorio); p.w.getSettings().setUserAgentString(p.escritorio ? uaEscritorio : uaMovil); p.w.reload(); avisarEstado(); } return true;
                case "zoom": { zoomTexto = Math.max(60, Math.min(200, d.optInt("pct", 100))); for (Pestana x : pestanas) x.w.getSettings().setTextZoom(zoomTexto); avisarEstado(); return zoomTexto; }
                case "pip": return entrarPip();
                case "vibrar": { Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE); if (v != null && Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(d.optInt("ms", 18), VibrationEffect.DEFAULT_AMPLITUDE)); return true; }
                case "permiso": {
                    String q = d.optString("tipo").equals("camara") ? Manifest.permission.CAMERA : d.optString("tipo").equals("notificaciones") && Build.VERSION.SDK_INT >= 33 ? Manifest.permission.POST_NOTIFICATIONS : Manifest.permission.RECORD_AUDIO;
                    if (tiene(q)) return true; requestPermissions(new String[]{q}, PIDE_PERMISO); return false;
                }
                case "monitor": return monitor();
                case "escaneo": return p == null ? JSONObject.NULL : escaneo(p);
                case "oculto": { leerOculto(d, d.optString("_id")); return ASINCRONO; }
                case "insertar": if (p != null) { p.w.requestFocus(); p.w.evaluateJavascript("document.execCommand('insertText',false," + JSONObject.quote(d.optString("texto")) + ")", null); } return true;
                case "predeterminado": { try { startActivity(new Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)); } catch (Exception e) { startActivity(new Intent(Settings.ACTION_SETTINGS)); } return true; }
                case "descargas": startActivity(new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS)); return true;
                case "borrar-datos": {
                    if (d.optBoolean("cookies")) { CookieManager.getInstance().removeAllCookies(null); android.webkit.WebStorage.getInstance().deleteAllData(); }
                    if (d.optBoolean("cache")) for (Pestana x : pestanas) x.w.clearCache(true);
                    return true;
                }
                case "respaldo-crear": case "respaldo-restaurar": {
                    if (d.optString("clave").length() < 6) return resultado(false, "corta");
                    pedirRespaldo(d, a.equals("respaldo-crear")); return ASINCRONO;
                }
                case "version": return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
                case "salir": finishAndRemoveTask(); return true;
                default: return JSONObject.NULL;
            }
        } catch (Exception e) { try { return new JSONObject().put("error", String.valueOf(e.getMessage())); } catch (Exception x) { return JSONObject.NULL; } }
    }
    /** un JSON que ya viene hecho (resultado de evaluateJavascript o de un archivo) */
    static class Crudo { final String v; Crudo(String v) { this.v = v == null ? "null" : v; } @Override public String toString() { return v; } }

    // ═══════════════════════════ internet (las llaves se ponen aquí, nunca en la interfaz) ═══════════════════════════
    JSONObject pedir(JSONObject d) {
        JSONObject r = new JSONObject();
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(boveda.sustituir(d.optString("url"), d.optString("url"))).openConnection();
            c.setRequestMethod(d.optString("method", "GET"));
            int t = d.optInt("timeout", 60000); c.setConnectTimeout(Math.min(t, 20000)); c.setReadTimeout(t);
            JSONObject hs = d.optJSONObject("headers");
            if (hs != null) for (Iterator<String> it = hs.keys(); it.hasNext(); ) { String k = it.next(); c.setRequestProperty(k, boveda.sustituir(hs.optString(k), d.optString("url"))); }
            byte[] cuerpo = null;
            if (d.has("form")) {   // multipart: campos + un archivo (fotos a Telegram)
                String b = "----jarvis" + System.nanoTime(); ByteArrayOutputStream o = new ByteArrayOutputStream();
                JSONObject f = d.getJSONObject("form");
                for (Iterator<String> it = f.keys(); it.hasNext(); ) { String k = it.next();
                    o.write(("--" + b + "\r\nContent-Disposition: form-data; name=\"" + k + "\"\r\n\r\n" + boveda.sustituir(f.optString(k), d.optString("url")) + "\r\n").getBytes(StandardCharsets.UTF_8)); }
                JSONObject ar = d.optJSONObject("archivo");
                if (ar != null) {
                    o.write(("--" + b + "\r\nContent-Disposition: form-data; name=\"" + ar.optString("campo") + "\"; filename=\"" + ar.optString("nombre") + "\"\r\nContent-Type: " + ar.optString("mime") + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
                    o.write(Base64.decode(ar.optString("b64"), Base64.DEFAULT)); o.write("\r\n".getBytes());
                }
                o.write(("--" + b + "--\r\n").getBytes()); cuerpo = o.toByteArray();
                c.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + b);
            } else if (d.has("body") && !d.isNull("body")) cuerpo = boveda.sustituir(d.optString("body"), d.optString("url")).getBytes(StandardCharsets.UTF_8);
            if (cuerpo != null) { c.setDoOutput(true); try (OutputStream os = c.getOutputStream()) { os.write(cuerpo); } }
            int st = c.getResponseCode();
            InputStream in = st >= 400 ? c.getErrorStream() : c.getInputStream();
            byte[] datos = in == null ? new byte[0] : leerTodo(in);
            String ct = c.getContentType() == null ? "" : c.getContentType().toLowerCase();
            r.put("ok", st >= 200 && st < 300).put("status", st).put("tipo", ct);
            if (ct.startsWith("audio/") || ct.startsWith("image/") || ct.contains("octet-stream") || ct.contains("pdf")) r.put("b64", Boveda.b64(datos));
            else r.put("text", new String(datos, StandardCharsets.UTF_8));
        } catch (Exception e) {
            try { r.put("ok", false).put("status", 0).put("text", "{\"error\":{\"message\":" + JSONObject.quote("network: " + e.getClass().getSimpleName() + " " + e.getMessage()) + "}}"); } catch (Exception ignored) { }
        } finally { if (c != null) c.disconnect(); }
        return r;
    }
    static byte[] leerTodo(InputStream in) throws Exception { ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[16384]; int n; while ((n = in.read(b)) > 0) o.write(b, 0, n); in.close(); return o.toByteArray(); }

    // vigilante: abre una página escondida, espera a que cargue y le pregunta algo (el precio, el texto)
    void leerOculto(JSONObject d, String idr) {
        WebView w = new WebView(this);
        w.getSettings().setJavaScriptEnabled(true); w.getSettings().setDomStorageEnabled(true); w.getSettings().setUserAgentString(uaMovil);
        w.measure(View.MeasureSpec.makeMeasureSpec(1080, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(2200, View.MeasureSpec.EXACTLY)); w.layout(0, 0, 1080, 2200);
        final boolean[] hecho = {false};
        Runnable fin = () -> { if (hecho[0]) return; hecho[0] = true; w.evaluateJavascript(d.optString("js", "document.body.innerText"), v -> { responder(idr, new Crudo(v)); w.destroy(); }); };
        w.setWebViewClient(new WebViewClient() { @Override public void onPageFinished(WebView v, String u) { ui.postDelayed(fin, d.optInt("espera", 2500)); } });
        ui.postDelayed(fin, 30000);
        w.loadUrl(d.optString("url"));
    }

    JSONObject monitor() {
        JSONObject r = new JSONObject();
        try {
            Intent bat = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            int nivel = bat.getIntExtra(BatteryManager.EXTRA_LEVEL, -1), escala = bat.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
            r.put("bateria", Math.round(100f * nivel / escala)).put("temp", bat.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) / 10.0)
                    .put("cargando", bat.getIntExtra(BatteryManager.EXTRA_STATUS, 0) == BatteryManager.BATTERY_STATUS_CHARGING);
            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo(); ((ActivityManager) getSystemService(ACTIVITY_SERVICE)).getMemoryInfo(mi);
            r.put("ram", Math.round(100.0 * (mi.totalMem - mi.availMem) / mi.totalMem));
            if (Build.VERSION.SDK_INT >= 29) r.put("termico", ((PowerManager) getSystemService(POWER_SERVICE)).getCurrentThermalStatus());
            long rx = TrafficStats.getTotalRxBytes(), tx = TrafficStats.getTotalTxBytes(), ahora = System.currentTimeMillis();
            double dt = Math.max(0.5, (ahora - redT0) / 1000.0);
            r.put("bajada", Math.max(0, (rx - redRx0) / dt)).put("subida", Math.max(0, (tx - redTx0) / dt));
            redRx0 = rx; redTx0 = tx; redT0 = ahora;
        } catch (Exception ignored) { }
        return r;
    }

    // ═══════════════════════════ video flotante (PiP de Android) ═══════════════════════════
    boolean entrarPip() {
        if (Build.VERSION.SDK_INT < 26) return false;
        if (activa != null) activa.w.evaluateJavascript("(()=>{const v=[...document.querySelectorAll('video')].find(x=>!x.paused)||document.querySelector('video');if(!v)return;document.body.style.background='#000';v.scrollIntoView({block:'center'});})()", null);
        try { return enterPictureInPictureMode(new PictureInPictureParams.Builder().setAspectRatio(new Rational(16, 9)).build()); } catch (Exception e) { return false; }
    }
    @Override public void onPictureInPictureModeChanged(boolean pip, Configuration c) { super.onPictureInPictureModeChanged(pip, c); enPip = pip; acomodar(); avisarEstado(); }
    @Override protected void onUserLeaveHint() {   // sales de la app con un video sonando → sigue en una ventanita
        super.onUserLeaveHint();
        if (activa == null) return;
        activa.w.evaluateJavascript("(()=>[...document.querySelectorAll('video')].some(v=>!v.paused&&!v.muted&&v.readyState>2))()", v -> { if ("true".equals(v) && leerConfig().optBoolean("pipAuto", true)) entrarPip(); });
    }

    // ═══════════════════════════ botón atrás ═══════════════════════════
    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        if (completa != null) { new ChromePagina(activa).onHideCustomView(); return; }
        shell.evaluateJavascript("window.__atras?window.__atras():false", v -> {
            if ("true".equals(v)) return;
            if (activa != null && activa.w.canGoBack()) activa.w.goBack();
            else moveTaskToBack(true);
        });
    }

    // ═══════════════════════════ utilidades ═══════════════════════════
    boolean tiene(String perm) { return checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED; }
    int dp(int px) { return Math.round(px / den); }
    String leer(String nombre, String def) { try { return new String(Files.readAllBytes(new File(getFilesDir(), nombre).toPath()), StandardCharsets.UTF_8); } catch (Exception e) { return def; } }
    void escribir(String nombre, String txt) {
        if (!nombre.matches("[\\w.-]+")) return;
        try (FileOutputStream f = new FileOutputStream(new File(getFilesDir(), nombre))) { f.write(txt.getBytes(StandardCharsets.UTF_8)); } catch (Exception ignored) { }
    }
    JSONObject leerConfig() { try { return new JSONObject(leer("config.json", "{}")); } catch (Exception e) { return new JSONObject(); } }
}

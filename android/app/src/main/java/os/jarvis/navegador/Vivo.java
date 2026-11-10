package os.jarvis.navegador;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.AudioTrack;
import android.media.MediaRecorder;
import android.media.audiofx.AcousticEchoCanceler;
import android.media.audiofx.NoiseSuppressor;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.concurrent.LinkedBlockingQueue;

import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;

/**
 * 🗣 Conversación en vivo con JARVIS en el teléfono [09-nov] — Gemini Live.
 * Todo pasa aquí (nativo): el WebSocket con Gemini (la llave nunca llega a la interfaz), el micrófono a 16 kHz
 * con cancelación de eco, y la voz de JARVIS a 24 kHz. La interfaz solo recibe eventos (lo que dices, lo que dice,
 * herramientas que JARVIS quiere usar) y devuelve los resultados de esas herramientas.
 */
class Vivo {
    interface Oyente {
        void evento(JSONObject e);
        void herramienta(String id, String nombre, JSONObject args);
    }

    static final String HOST = "generativelanguage.googleapis.com";
    static final String RUTA = "/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=";
    static final String[] MODELOS = { "gemini-3.8-live", "gemini-3.1-flash-live-preview", "gemini-live-2.5-flash-preview" };

    private final SecureRandom azar = new SecureRandom();
    private SSLSocket sock; private OutputStream out; private InputStream in;
    private volatile boolean activo, listo;
    private AudioRecord rec; private AudioTrack pista;
    private final LinkedBlockingQueue<byte[]> cola = new LinkedBlockingQueue<>();
    private volatile long sonandoHasta;
    private Oyente oyente;

    synchronized void empezar(String llave, String sistema, JSONArray herramientas, Oyente o) {
        parar();
        oyente = o; activo = true;
        new Thread(() -> conectar(llave, sistema, herramientas, 0), "vivo-red").start();
    }

    private void conectar(String llave, String sistema, JSONArray herramientas, int intento) {
        if (!activo) return;
        if (intento >= MODELOS.length) { avisar("estado", "error", "error", "No pude conectar con Gemini Live."); activo = false; return; }
        String modelo = MODELOS[intento];
        try {
            SSLSocket s = (SSLSocket) SSLSocketFactory.getDefault().createSocket(HOST, 443);
            s.setSoTimeout(0); s.startHandshake();
            OutputStream os = s.getOutputStream(); InputStream is = s.getInputStream();
            byte[] k = new byte[16]; azar.nextBytes(k);
            String pedido = "GET " + RUTA + java.net.URLEncoder.encode(llave, "UTF-8") + " HTTP/1.1\r\nHost: " + HOST + "\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                    + "Sec-WebSocket-Key: " + Base64.encodeToString(k, Base64.NO_WRAP) + "\r\nSec-WebSocket-Version: 13\r\n\r\n";
            os.write(pedido.getBytes(StandardCharsets.UTF_8)); os.flush();
            String cab = leerCabecera(is);
            if (!cab.startsWith("HTTP/1.1 101")) { s.close(); conectar(llave, sistema, herramientas, intento + 1); return; }
            synchronized (this) { sock = s; out = os; in = is; }
            JSONObject setup = new JSONObject()
                    .put("model", "models/" + modelo)
                    .put("generationConfig", new JSONObject().put("responseModalities", new JSONArray().put("AUDIO"))
                            .put("speechConfig", new JSONObject().put("voiceConfig", new JSONObject().put("prebuiltVoiceConfig", new JSONObject().put("voiceName", "Charon")))))
                    .put("systemInstruction", new JSONObject().put("parts", new JSONArray().put(new JSONObject().put("text", sistema))))
                    .put("inputAudioTranscription", new JSONObject()).put("outputAudioTranscription", new JSONObject())
                    .put("realtimeInputConfig", new JSONObject().put("automaticActivityDetection", new JSONObject().put("silenceDurationMs", 600)));
            if (herramientas != null && herramientas.length() > 0) setup.put("tools", new JSONArray().put(new JSONObject().put("functionDeclarations", herramientas)));
            enviar(new JSONObject().put("setup", setup).toString());
            leerBucle(llave, sistema, herramientas, intento, modelo);
        } catch (Exception e) {
            if (activo && !listo) conectar(llave, sistema, herramientas, intento + 1);
            else if (activo) { avisar("estado", "fin", "error", "Se cortó la conexión con Gemini."); parar(); }
        }
    }

    private void leerBucle(String llave, String sistema, JSONArray herramientas, int intento, String modelo) throws Exception {
        ByteArrayOutputStream mensaje = new ByteArrayOutputStream();
        while (activo) {
            int b0 = in.read(); if (b0 < 0) break;
            int b1 = in.read(); if (b1 < 0) break;
            int op = b0 & 0x0F; boolean fin = (b0 & 0x80) != 0;
            long largo = b1 & 0x7F;
            if (largo == 126) largo = ((in.read() & 0xFF) << 8) | (in.read() & 0xFF);
            else if (largo == 127) { largo = 0; for (int i = 0; i < 8; i++) largo = (largo << 8) | (in.read() & 0xFF); }
            byte[] datos = leerN((int) largo);
            if (op == 8) {   // cierre
                String razon = datos.length > 2 ? new String(datos, 2, datos.length - 2, StandardCharsets.UTF_8) : "";
                if (!listo && activo) { cerrarSocket(); conectar(llave, sistema, herramientas, intento + 1); return; }
                avisar("estado", "fin", "error", razon.matches("(?is).*(quota|exhausted|429).*") ? "Se acabó la cuota gratis de Gemini Live por hoy." : "");
                parar(); return;
            }
            if (op == 9) { enviarMarco(10, datos); continue; }   // ping → pong
            if (op == 10) continue;
            mensaje.write(datos);
            if (!fin) continue;
            String txt = mensaje.toString("UTF-8"); mensaje.reset();
            procesar(new JSONObject(txt), modelo);
        }
        if (activo) { avisar("estado", "fin", "error", listo ? "" : "Gemini cerró la conexión."); parar(); }
    }

    private void procesar(JSONObject m, String modelo) throws Exception {
        if (m.has("setupComplete")) { listo = true; empezarAudio(); avisar("estado", "listo", "modelo", modelo); return; }
        JSONObject sc = m.optJSONObject("serverContent");
        if (sc != null) {
            if (sc.optBoolean("interrupted")) { callar(); oyente.evento(new JSONObject().put("interrumpido", true)); }
            JSONObject mt = sc.optJSONObject("modelTurn");
            if (mt != null) {
                JSONArray partes = mt.optJSONArray("parts");
                for (int i = 0; partes != null && i < partes.length(); i++) {
                    JSONObject id = partes.getJSONObject(i).optJSONObject("inlineData");
                    if (id != null && id.has("data")) { byte[] pcm = Base64.decode(id.getString("data"), Base64.DEFAULT); cola.offer(pcm); oyente.evento(new JSONObject().put("habla", true)); }
                }
            }
            JSONObject it = sc.optJSONObject("inputTranscription"); if (it != null && it.optString("text").length() > 0) oyente.evento(new JSONObject().put("tu", it.getString("text")));
            JSONObject ot = sc.optJSONObject("outputTranscription"); if (ot != null && ot.optString("text").length() > 0) oyente.evento(new JSONObject().put("jarvis", ot.getString("text")));
            if (sc.optBoolean("turnComplete")) oyente.evento(new JSONObject().put("turno", true));
        }
        JSONObject tc = m.optJSONObject("toolCall");
        if (tc != null) {
            JSONArray fs = tc.optJSONArray("functionCalls");
            for (int i = 0; fs != null && i < fs.length(); i++) {
                JSONObject f = fs.getJSONObject(i);
                oyente.herramienta(f.optString("id"), f.optString("name"), f.optJSONObject("args") == null ? new JSONObject() : f.getJSONObject("args"));
            }
        }
    }

    /** respuesta de una herramienta que ejecutó la interfaz */
    void responder(String id, String nombre, JSONObject salida) {
        try {
            JSONObject r = new JSONObject().put("id", id).put("name", nombre).put("response", new JSONObject().put("result", salida == null ? JSONObject.NULL : salida));
            enviar(new JSONObject().put("toolResponse", new JSONObject().put("functionResponses", new JSONArray().put(r))).toString());
        } catch (Exception ignored) { }
    }

    // ── audio ──
    private void empezarAudio() {
        int tamIn = Math.max(AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT), 6400);
        try {
            rec = new AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, tamIn);
            if (AcousticEchoCanceler.isAvailable()) { AcousticEchoCanceler a = AcousticEchoCanceler.create(rec.getAudioSessionId()); if (a != null) a.setEnabled(true); }
            if (NoiseSuppressor.isAvailable()) { NoiseSuppressor n = NoiseSuppressor.create(rec.getAudioSessionId()); if (n != null) n.setEnabled(true); }
            rec.startRecording();
        } catch (SecurityException e) { avisar("estado", "fin", "error", "Sin permiso para el micrófono."); parar(); return; }
        int tamOut = Math.max(AudioTrack.getMinBufferSize(24000, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT), 9600);
        pista = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                .setAudioFormat(new AudioFormat.Builder().setSampleRate(24000).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
                .setBufferSizeInBytes(tamOut).setTransferMode(AudioTrack.MODE_STREAM).build();
        pista.play();
        new Thread(() -> {   // micrófono → Gemini (trozos de 100 ms)
            byte[] buf = new byte[3200];
            while (activo && rec != null) {
                int n; try { AudioRecord r = rec; if (r == null) break; n = r.read(buf, 0, buf.length); } catch (Exception e) { break; } if (n <= 0) continue;
                // mientras JARVIS habla, solo pasa tu voz si es clara (para que no se interrumpa con su propio eco)
                if (System.currentTimeMillis() < sonandoHasta && rms(buf, n) < 1400) java.util.Arrays.fill(buf, 0, n, (byte) 0);
                try { enviar("{\"realtimeInput\":{\"audio\":{\"mimeType\":\"audio/pcm;rate=16000\",\"data\":\"" + Base64.encodeToString(buf, 0, n, Base64.NO_WRAP) + "\"}}}"); } catch (Exception e) { break; }
            }
        }, "vivo-micro").start();
        new Thread(() -> {   // Gemini → parlante
            while (activo) {
                try {
                    byte[] pcm = cola.take(); if (!activo || pista == null) break;
                    sonandoHasta = System.currentTimeMillis() + pcm.length / 48 + 400;
                    pista.write(pcm, 0, pcm.length);
                } catch (InterruptedException e) { break; } catch (Exception ignored) { }
            }
        }, "vivo-voz").start();
    }
    private static double rms(byte[] b, int n) { double s = 0; int k = 0; for (int i = 0; i + 1 < n; i += 2) { short v = (short) ((b[i] & 0xFF) | (b[i + 1] << 8)); s += v * (double) v; k++; } return k == 0 ? 0 : Math.sqrt(s / k); }
    private void callar() { cola.clear(); sonandoHasta = 0; try { if (pista != null) { pista.pause(); pista.flush(); pista.play(); } } catch (Exception ignored) { } }

    // ── WebSocket ──
    private String leerCabecera(InputStream is) throws Exception {
        ByteArrayOutputStream b = new ByteArrayOutputStream(); int c, f = 0;
        while ((c = is.read()) >= 0) { b.write(c); f = (c == '\r' || c == '\n') ? f + 1 : 0; if (f == 4) break; if (b.size() > 16384) break; }
        return b.toString("UTF-8");
    }
    private byte[] leerN(int n) throws Exception { byte[] d = new byte[n]; int o = 0; while (o < n) { int r = in.read(d, o, n - o); if (r < 0) throw new java.io.EOFException(); o += r; } return d; }
    private void enviar(String texto) throws Exception { enviarMarco(1, texto.getBytes(StandardCharsets.UTF_8)); }
    private synchronized void enviarMarco(int op, byte[] datos) throws Exception {
        if (out == null) throw new java.io.IOException("sin conexión");
        ByteArrayOutputStream f = new ByteArrayOutputStream(datos.length + 14);
        f.write(0x80 | op);
        if (datos.length < 126) f.write(0x80 | datos.length);
        else if (datos.length < 65536) { f.write(0x80 | 126); f.write(datos.length >> 8); f.write(datos.length & 0xFF); }
        else { f.write(0x80 | 127); for (int i = 7; i >= 0; i--) f.write((int) ((long) datos.length >> (8 * i)) & 0xFF); }
        byte[] m = new byte[4]; azar.nextBytes(m); f.write(m);
        for (int i = 0; i < datos.length; i++) f.write(datos[i] ^ m[i & 3]);
        out.write(f.toByteArray()); out.flush();
    }
    private void avisar(String k1, Object v1, String k2, Object v2) { try { if (oyente != null) oyente.evento(new JSONObject().put(k1, v1).put(k2, v2)); } catch (Exception ignored) { } }
    private synchronized void cerrarSocket() { try { if (sock != null) sock.close(); } catch (Exception ignored) { } sock = null; out = null; in = null; }

    synchronized void parar() {
        boolean estaba = activo; activo = false; listo = false;
        try { if (out != null) enviarMarco(8, new byte[] { 0x03, (byte) 0xE8 }); } catch (Exception ignored) { }
        cerrarSocket();
        try { if (rec != null) { rec.stop(); rec.release(); } } catch (Exception ignored) { } rec = null;
        try { if (pista != null) { pista.stop(); pista.release(); } } catch (Exception ignored) { } pista = null;
        cola.clear(); cola.offer(new byte[0]);   // despierta al hilo de la voz para que termine
        void_(estaba);
    }
    private static void void_(boolean b) { }
    boolean activo() { return activo; }
}

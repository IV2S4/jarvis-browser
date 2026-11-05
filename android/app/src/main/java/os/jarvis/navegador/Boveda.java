package os.jarvis.navegador;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.KeyStore;
import java.util.Iterator;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Llaves de las IAs, Telegram y VirusTotal: cifradas con una llave del Android Keystore (nunca salen del teléfono). */
public class Boveda {
    private static final String ALIAS = "jarvis_llaves";
    private final File archivo;
    private JSONObject llaves = new JSONObject();

    public Boveda(Context c) {
        archivo = new File(c.getFilesDir(), "llaves.bin");
        try {
            if (archivo.exists()) {
                byte[] todo = Files.readAllBytes(archivo.toPath());
                byte[] iv = java.util.Arrays.copyOfRange(todo, 0, 12);
                byte[] datos = java.util.Arrays.copyOfRange(todo, 12, todo.length);
                Cipher ci = Cipher.getInstance("AES/GCM/NoPadding");
                ci.init(Cipher.DECRYPT_MODE, llave(), new GCMParameterSpec(128, iv));
                llaves = new JSONObject(new String(ci.doFinal(datos), StandardCharsets.UTF_8));
            }
        } catch (Exception e) { llaves = new JSONObject(); }
    }

    private SecretKey llave() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) ks.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return kg.generateKey();
    }

    private void guardar() throws Exception {
        Cipher ci = Cipher.getInstance("AES/GCM/NoPadding");
        ci.init(Cipher.ENCRYPT_MODE, llave());
        byte[] datos = ci.doFinal(llaves.toString().getBytes(StandardCharsets.UTF_8));
        byte[] iv = ci.getIV();
        try (FileOutputStream f = new FileOutputStream(archivo)) { f.write(iv); f.write(datos); }
    }

    /** copia de todas las llaves (solo para meterlas en el respaldo cifrado con la clave del usuario) */
    public synchronized JSONObject todas() { try { return new JSONObject(llaves.toString()); } catch (Exception e) { return new JSONObject(); } }

    /** pone las llaves de un respaldo (las vuelve a cifrar con el Keystore de este teléfono) */
    public synchronized int reemplazar(JSONObject n) {
        int k = 0;
        try {
            for (Iterator<String> it = n.keys(); it.hasNext(); ) {
                String nombre = it.next(); String v = n.optString(nombre, "").trim();
                if (nombre.matches("[a-z]{2,20}") && !v.isEmpty()) { llaves.put(nombre, v); k++; }
            }
            guardar();
        } catch (Exception ignored) { }
        return k;
    }

    public synchronized String get(String nombre) { return llaves.optString(nombre, ""); }

    public synchronized boolean poner(String nombre, String valor) {
        try {
            if (valor == null || valor.trim().isEmpty()) llaves.remove(nombre); else llaves.put(nombre, valor.trim());
            guardar(); return true;
        } catch (Exception e) { return false; }
    }

    /** Lo único que ve la interfaz: qué llaves hay y sus 4 últimas letras. */
    public synchronized JSONObject estado() {
        JSONObject r = new JSONObject();
        try {
            for (Iterator<String> it = llaves.keys(); it.hasNext(); ) {
                String k = it.next(); String v = llaves.optString(k);
                r.put(k, new JSONObject().put("puesta", !v.isEmpty()).put("final", v.length() > 4 ? v.substring(v.length() - 4) : ""));
            }
        } catch (Exception ignored) { }
        return r;
    }

    /** 🔒 Cada llave SOLO puede ir a su servicio (y por HTTPS): aunque alguien lograra engañar a la interfaz, no podría mandarla a otro sitio. */
    private static final java.util.Map<String, String> SERVICIO = java.util.Map.of(
            "gemini", "generativelanguage.googleapis.com", "claude", "api.anthropic.com", "openai", "api.openai.com",
            "telegram", "api.telegram.org", "virustotal", "www.virustotal.com");

    /** Cambia {{LLAVE:gemini}} por la llave de verdad, justo antes de enviar, solo si la petición va al servicio de esa llave. */
    public synchronized String sustituir(String s, String urlDestino) {
        if (s == null || !s.contains("{{LLAVE:")) return s;
        String host = ""; boolean https = false;
        // (sin expresiones regulares: en Android la «}» suelta rompía el patrón y la llave se iba vacía) [05-nov]
        try { java.net.URL u = new java.net.URL(sinMarcadores(urlDestino)); host = u.getHost().toLowerCase(java.util.Locale.ROOT); https = "https".equals(u.getProtocol()); } catch (Exception ignored) { }
        for (Iterator<String> it = llaves.keys(); it.hasNext(); ) {
            String k = it.next();
            String permitido = SERVICIO.get(k);
            s = s.replace("{{LLAVE:" + k + "}}", https && permitido != null && permitido.equals(host) ? llaves.optString(k) : "");
        }
        return s;
    }

    /** quita los {{LLAVE:x}} de una dirección para poder leer a qué servidor va */
    static String sinMarcadores(String s) {
        if (s == null) return "";
        StringBuilder b = new StringBuilder(s); int i;
        while ((i = b.indexOf("{{LLAVE:")) >= 0) { int j = b.indexOf("}}", i); if (j < 0) break; b.replace(i, j + 2, "x"); }
        return b.toString();
    }

    public static String b64(byte[] b) { return Base64.encodeToString(b, Base64.NO_WRAP); }
}

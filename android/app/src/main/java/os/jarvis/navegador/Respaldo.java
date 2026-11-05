package os.jarvis.navegador;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * 💾 Respaldo de ajustes: un archivo cifrado con la clave que elige el usuario (PBKDF2 + AES-256-GCM).
 * Sin esa clave el archivo no sirve para nada, aunque alguien lo encuentre.
 * Formato: "JARVIS1" | sal (16) | iv (12) | datos cifrados.
 */
public final class Respaldo {
    private static final byte[] MAGIA = "JARVIS1".getBytes(StandardCharsets.US_ASCII);
    private static final int VUELTAS = 210_000;

    /** la clave era incorrecta (o el archivo está dañado) */
    public static class ClaveMala extends Exception { }
    /** no es un respaldo de JARVIS */
    public static class NoEsRespaldo extends Exception { }

    private Respaldo() { }

    private static SecretKeySpec derivar(String clave, byte[] sal) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(clave.toCharArray(), sal, VUELTAS, 256);
        try { return new SecretKeySpec(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(), "AES"); }
        finally { spec.clearPassword(); }
    }

    public static byte[] cifrar(byte[] datos, String clave) throws Exception {
        SecureRandom r = new SecureRandom();
        byte[] sal = new byte[16], iv = new byte[12];
        r.nextBytes(sal); r.nextBytes(iv);
        Cipher ci = Cipher.getInstance("AES/GCM/NoPadding");
        ci.init(Cipher.ENCRYPT_MODE, derivar(clave, sal), new GCMParameterSpec(128, iv));
        ci.updateAAD(MAGIA);
        byte[] c = ci.doFinal(datos);
        byte[] out = new byte[MAGIA.length + 16 + 12 + c.length];
        System.arraycopy(MAGIA, 0, out, 0, MAGIA.length);
        System.arraycopy(sal, 0, out, MAGIA.length, 16);
        System.arraycopy(iv, 0, out, MAGIA.length + 16, 12);
        System.arraycopy(c, 0, out, MAGIA.length + 28, c.length);
        return out;
    }

    public static byte[] descifrar(byte[] todo, String clave) throws Exception {
        int m = MAGIA.length;
        if (todo == null || todo.length < m + 28 + 16 || !Arrays.equals(Arrays.copyOfRange(todo, 0, m), MAGIA)) throw new NoEsRespaldo();
        byte[] sal = Arrays.copyOfRange(todo, m, m + 16), iv = Arrays.copyOfRange(todo, m + 16, m + 28);
        try {
            Cipher ci = Cipher.getInstance("AES/GCM/NoPadding");
            ci.init(Cipher.DECRYPT_MODE, derivar(clave, sal), new GCMParameterSpec(128, iv));
            ci.updateAAD(MAGIA);
            return ci.doFinal(todo, m + 28, todo.length - m - 28);
        } catch (javax.crypto.AEADBadTagException e) { throw new ClaveMala(); }
    }
}

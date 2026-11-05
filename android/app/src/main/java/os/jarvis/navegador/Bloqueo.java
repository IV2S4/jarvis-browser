package os.jarvis.navegador;

import android.content.Context;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.HashMap;
import java.util.Map;

/** Bloqueador de anuncios y rastreadores: lista de dominios (assets/bloqueo.txt: «a dominio» anuncio · «r dominio» rastreador). */
public class Bloqueo {
    private final Map<String, Character> lista = new HashMap<>();

    public Bloqueo(Context c) {
        try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getAssets().open("bloqueo.txt")))) {
            String l;
            while ((l = r.readLine()) != null) {
                l = l.trim();
                if (l.length() < 3 || l.startsWith("#")) continue;
                char tipo = l.charAt(0);
                String dom = l.substring(2).trim().toLowerCase();
                if (!dom.isEmpty()) lista.put(dom, tipo);
            }
        } catch (Exception ignored) { }
    }

    /** 0 = deja pasar · 'a' = anuncio · 'r' = rastreador. Mira el host y sus dominios padre (x.y.doubleclick.net → doubleclick.net). */
    public char tipo(String host) {
        if (host == null) return 0;
        String h = host.toLowerCase();
        while (true) {
            Character t = lista.get(h);
            if (t != null) return t;
            int p = h.indexOf('.');
            if (p < 0 || h.indexOf('.', p + 1) < 0) return 0;
            h = h.substring(p + 1);
        }
    }

    public int cuantos() { return lista.size(); }
}

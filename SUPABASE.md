# Cuentas con Supabase

Tobot funciona sin cuentas: si no configuras nada, todo se guarda en el
navegador de cada estudiante y no aparece ninguna pantalla de acceso. Este
documento es para cuando quieras que su trabajo los siga entre computadores.

## 1. Crea el proyecto

En [supabase.com](https://supabase.com) crea un proyecto (plan gratuito).
Anota la contraseña de la base de datos cuando te la pida.

## 2. Crea la tabla

Ve a **SQL Editor > New query**, pega el contenido de
[`supabase/schema.sql`](supabase/schema.sql) y ejecútalo.

Ese archivo crea una tabla y sus políticas de acceso. Las políticas importan:
la clave que usa la app es pública, así que **la base de datos es la que
impide que un estudiante lea el trabajo de otro**, no el código del navegador.

## 3. Conecta la app

En **Project Settings > API Keys** copia la *Project URL* y la clave
**publishable** (empieza con `sb_publishable_`). Crea un archivo `.env.local`
en la raíz:

```
VITE_SUPABASE_URL=https://tuproyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SUPABASE_GOOGLE=false
```

Si tu proyecto es anterior a 2025 puede que solo tengas una clave `anon`, en
la pestaña *Legacy API Keys*. Funciona igual: pégala en esa misma variable, o
usa `VITE_SUPABASE_ANON_KEY`, que la app también lee.

No confundas la clave publishable con la **secret** (`sb_secret_`): esa
salta las políticas de seguridad y nunca debe llegar al navegador.

Ambos valores son públicos por diseño; están pensados para vivir en el
navegador. `.env.local` está en `.gitignore` de todos modos.

Después de editarlo, reinicia `pnpm dev`: Vite lee las variables al arrancar.

Para el sitio publicado, ve a **Settings > Secrets and variables > Actions**:

- En la pestaña **Secrets**, añade `VITE_SUPABASE_URL` y
  `VITE_SUPABASE_PUBLISHABLE_KEY`.
- En la pestaña **Variables**, añade `VITE_SUPABASE_GOOGLE` con valor `true`
  o `false`. No es un secreto, solo un interruptor, y por eso va como
  *variable*. Si no la creas, el botón de Google simplemente no aparece.

Ninguno de los tres valores es realmente secreto: Vite los incrusta en el
JavaScript que descarga el navegador, así que cualquiera puede leerlos en el
sitio publicado. Van como *secrets* solo para no dejarlos escritos en el
repositorio. Lo que protege los datos son las políticas de la base de datos.

El workflow ya los pasa al paso de build
del workflow.

## 4. Correo de confirmación

Por defecto Supabase pide confirmar el correo antes de entrar. Para un curso
suele estorbar: los estudiantes se registran en clase y esperan entrar de
inmediato. Se desactiva en **Authentication > Sign In / Providers > Email**,
quitando *Confirm email*.

Ten en cuenta que el servicio de correo incluido tiene un límite bajo por
hora, pensado para pruebas. Si dejas la confirmación activada y 30
estudiantes se registran a la vez, algunos correos no llegarán.

## 5. Google (opcional)

1. En [Google Cloud Console](https://console.cloud.google.com), crea
   credenciales OAuth de tipo *aplicación web*.
2. Como URI de redirección autorizado usa el que Supabase te muestra en
   **Authentication > Providers > Google**.
3. Pega el *Client ID* y el *Client Secret* en esa misma página de Supabase y
   actívalo.
4. Pon `VITE_SUPABASE_GOOGLE=true` en tu `.env.local`.

Sin ese último paso el botón simplemente no aparece, en vez de fallar al
pulsarlo.

## Lo que aguanta el plan gratuito

Verificado en la documentación de Supabase:

| Límite | Gratis |
| --- | --- |
| Usuarios activos al mes | 50 000 |
| Conexiones simultáneas (pooler) | 200 |
| Base de datos | 500 MB |
| Egress | 5 GB al mes |

Para 90 estudiantes en tres grupos de 30 sobra por mucho. El límite que sí
molesta es otro: **un proyecto gratuito se pausa tras una semana sin uso**, lo
que en vacaciones significa que el primer estudiante que entre encuentra la
app caída hasta que la despiertes desde el panel. Se evita con el plan Pro o
con una consulta programada cada pocos días.

## Cómo está hecho

Toda la persistencia pasa por la interfaz `AlgorithmStore`
(`src/state/storage.ts`). `createAlgorithmStore()` devuelve la implementación
de Supabase cuando hay sesión y la de localStorage cuando no, y ningún
componente sabe cuál está usando.

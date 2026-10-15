# La Ruta de Suki

El mapa cafetero de Tijuana, hecho por la comunidad: cafeterías en un mapa real, horarios, fotos, reseñas, ranking, perfiles, guardadas y moderación.

Hecho con **Next.js** (la página), **Supabase** (base de datos, cuentas y fotos) y **OpenStreetMap + Leaflet** (el mapa). Todo funciona con planes gratuitos.

> Esta guía supone que nunca has hecho algo así. Ve paso por paso y no te saltes ninguno. Calcula 30 a 45 minutos la primera vez.

---

## Qué necesitas

1. Una computadora con internet.
2. **Node.js** versión 18 o mayor. Descarga la versión "LTS" de https://nodejs.org e instálala dando "Siguiente" a todo.
3. Una cuenta gratuita en https://supabase.com
4. (Solo para publicarla en internet) cuentas gratuitas en https://github.com y https://vercel.com

---

## Paso 1: Prepara la carpeta

1. Descomprime el .zip. Queda una carpeta llamada `la-ruta-de-suki`.
2. Abre una terminal dentro de esa carpeta:
   - **Windows:** abre la carpeta, haz clic derecho en un espacio vacío y elige "Abrir en Terminal".
   - **Mac:** clic derecho sobre la carpeta > "Nuevo terminal en la carpeta".
3. Instala las piezas que usa el proyecto escribiendo esto y pulsando Enter (tarda un par de minutos):

```
npm install
```

## Paso 2: Crea tu base de datos en Supabase

1. Entra a https://supabase.com, inicia sesión y presiona **New project**.
2. Ponle nombre (por ejemplo `la-ruta-de-suki`), crea una contraseña para la base de datos (guárdala) y elige la región más cercana (por ejemplo "West US").
3. Espera uno o dos minutos a que termine de crearse.

## Paso 3: Crea las tablas y las reglas de seguridad

1. En Supabase, en el menú de la izquierda, abre **SQL Editor** y presiona **New query**.
2. Abre el archivo `supabase/schema.sql` de esta carpeta con cualquier editor de texto (el Bloc de notas sirve), copia **todo** su contenido, pégalo en Supabase y presiona **Run**. Debe decir "Success".
3. Repite lo mismo con `supabase/seed.sql`. Esto agrega cuatro cafeterías de **ejemplo** para que el mapa no se vea vacío. Es opcional, y más adelante puedes quitarlas.

## Paso 4: Facilita el registro mientras pruebas

En Supabase abre **Authentication > Sign In / Providers > Email** y apaga **Confirm email**. Así podrás crear cuentas de prueba sin esperar un correo. Cuando publiques la app de verdad, vuelve a encenderlo.

## Paso 5: Conecta la app con tu base de datos

1. En Supabase abre **Project Settings > API**.
2. Copia dos datos: **Project URL** y la llave **anon public**.
3. En la carpeta del proyecto, copia el archivo `.env.example` y llama a la copia `.env.local`.
4. Abre `.env.local` y reemplaza los dos valores con los tuyos. Queda así (con tus datos):

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> La llave `anon public` está hecha para ir en la página y es segura **porque las reglas del Paso 3 protegen los datos**. Nunca pongas aquí la llave `service_role`.

## Paso 6: Ábrela en tu computadora

En la terminal escribe:

```
npm run dev
```

Abre http://localhost:3000 en el navegador. Deberías ver el mapa de Tijuana con las cafeterías de ejemplo. Para detenerla presiona `Ctrl + C` en la terminal.

Crea tu cuenta con el botón **Entrar > Crea tu cuenta**.

## Paso 7: Conviértete en moderador

Quien es moderador ve el botón **Moderar**, puede borrar reseñas ajenas y editar o borrar cualquier cafetería.

1. Primero crea tu cuenta en la app (Paso 6).
2. En Supabase, en **SQL Editor**, ejecuta esto cambiando el correo por el tuyo:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'tu-correo@ejemplo.com');
```

3. Recarga la página de la app. Debe aparecer **Moderar** arriba.

## Paso 8: Publícala en internet (con Vercel)

1. Crea un repositorio nuevo en GitHub y sube esta carpeta (GitHub Desktop es lo más fácil si no usas la terminal). El archivo `.env.local` **no** se sube porque ya está ignorado.
2. En https://vercel.com elige **Add New > Project**, importa tu repositorio.
3. Antes de presionar Deploy, abre **Environment Variables** y agrega las mismas dos variables del Paso 5 con tus valores.
4. Presiona **Deploy**. Al terminar te da una dirección tipo `https://la-ruta-de-suki.vercel.app`.
5. En Supabase abre **Authentication > URL Configuration** y pon esa dirección en **Site URL**.

---

## Paso 9 (opcional): llenar el mapa con cafeterías de OpenStreetMap

En vez de agregar todo a mano, puedes traer las cafeterías de Tijuana que ya existen en OpenStreetMap (nombre y ubicación, y a veces horario, teléfono o sitio web). Aparecen marcadas con la etiqueta "OpenStreetMap" y la comunidad las complementa con fotos y reseñas. Tu moderador (tú) puede corregir sus datos.

**9.1 Agrega las columnas nuevas** (solo si ya habías ejecutado `schema.sql` antes de esta versión; si tu proyecto es nuevo, ya vienen incluidas):

1. Abre `notepad supabase\migration-2-osm.sql`, `Ctrl + A`, `Ctrl + C`.
2. En Supabase, **SQL Editor > New query**, pega y presiona **Run**. Debe decir "Success".

**9.2 Descarga las cafeterías.** En la terminal, dentro de la carpeta del proyecto:

```
node scripts\import-osm.mjs
```

Tarda hasta un minuto y al final dice cuántas cafeterías encontró y que creó el archivo `supabase\import-osm.sql`. Si dice que no pudo descargar, espera unos minutos y repítelo (los servidores gratuitos a veces están ocupados).

**9.3 Súbelas a tu base de datos.**

1. `notepad supabase\import-osm.sql`, `Ctrl + A`, `Ctrl + C`.
2. En Supabase, **SQL Editor > New query**, pega y presiona **Run**.
3. Recarga la app. Deben aparecer las cafeterías en el mapa.

Es seguro repetirlo más adelante para traer las nuevas: las que ya existen no se duplican. Para quitar todo lo importado:

```sql
delete from public.cafes where source = 'osm';
```

> Si usas el SQL Editor con el traductor del navegador encendido, apágalo para esa pestaña: traduce el código y lo rompe.

**Qué esperar:** habrá cafeterías cerradas o con datos incompletos, porque dependen de lo que haya escrito la comunidad de OpenStreetMap. Cuando no hay horario, la app dice "Sin horario" en lugar de "Cerrado". Los horarios con varios turnos en un mismo día (por ejemplo, de 8 a 2 y de 4 a 8) no se importan para no mostrar un dato incorrecto.

---

## Botón "Cómo llegar"

En la ficha de cada cafetería (y con el botón **Ir** en el celular) hay dos formas de llegar:

- **En coche** o **A pie:** dibuja la ruta en el mapa y muestra el tiempo y la distancia. La primera vez pide permiso para usar tu ubicación. En internet eso solo funciona con `https` (Vercel lo da).
- **Google Maps, Waze o Apple Maps:** abre la cafetería como destino en tu app de mapas, para navegar con voz paso a paso.

**Seguir mi ubicación:** en el mapa, el botón **Seguir mi ubicación** hace que el punto azul se mueva mientras tú te mueves, y el mapa lo acompaña cuando se acerca al borde. Para apagarlo, el mismo botón dice **Dejar de seguir**. Solo funciona con la pantalla encendida y la página abierta, y gasta batería. La ruta dibujada no se recalcula si te sales del camino; para navegación con voz usa Google Maps o Waze.

La ruta dibujada usa servidores públicos y gratuitos de OpenStreetMap, pensados para uso ligero. Si la app crece, cambia las direcciones en `lib/routing.ts` por las de un servicio con llave gratuita (por ejemplo OpenRouteService) o por tu propio servidor. Si el servidor falla, la app lo avisa y los botones de Google Maps, Waze y Apple Maps siguen funcionando.

---

## Cómo está protegida la información

Las reglas están escritas en `supabase/schema.sql` y las aplica la base de datos, no la página, así que nadie puede saltárselas:

| Qué | Quién puede |
| --- | --- |
| Ver cafeterías, reseñas y perfiles | Todo el mundo |
| Agregar una cafetería o reseña | Cualquier persona con cuenta, a su nombre |
| Editar o borrar una cafetería | Quien la creó, o un moderador |
| Borrar una reseña | Quien la escribió, o un moderador |
| Ver tus guardadas ("Quiero ir", "Ya fui") | Solo tú |
| Reportar una reseña | Cualquier persona con cuenta |
| Ver todos los reportes | Solo moderadores |
| Cambiarse el rol a moderador | Nadie desde la app (solo con el SQL del Paso 7) |

## Qué hay en cada carpeta

- `app/`: la página principal y los estilos (`globals.css`, el diseño oscuro).
- `components/`: las pantallas (`views/`), el mapa (`MapView.tsx`) y la pieza central que conecta todo (`App.tsx`).
- `lib/`: funciones de apoyo (horarios, distancias, rutas en `routing.ts`, conexión a Supabase).
- `supabase/`: la base de datos (`schema.sql`), los ejemplos (`seed.sql`) y la migración de las columnas de importación (`migration-2-osm.sql`).
- `scripts/`: el importador de cafeterías de OpenStreetMap (`import-osm.mjs`).

## Problemas comunes

| Síntoma | Qué hacer |
| --- | --- |
| La página dice "Falta conectar Supabase" | Revisa que el archivo se llame exactamente `.env.local`, que tenga los dos valores, y reinicia `npm run dev`. |
| Dice "No se pudieron cargar los datos" | No ejecutaste `schema.sql`, o las llaves están mal copiadas. |
| No aparece el botón Moderar | Hiciste el Paso 7 con otro correo, o falta recargar la página. |
| Al crear cuenta pide confirmar el correo | Apaga **Confirm email** (Paso 4) o abre el correo que te llegó. |
| Las fotos no se suben | Verifica que `schema.sql` terminó con "Success" completo; crea el almacenamiento `photos`. |
| El botón "Mi ubicación" no funciona | Permite la ubicación en el navegador. En internet solo funciona con `https`. |
| "No pudimos calcular la ruta" | Los servidores gratuitos de rutas a veces fallan o están ocupados. Intenta de nuevo o usa Google Maps, Waze o Apple Maps desde la ficha. |
| `import-osm.mjs` dice que no pudo descargar | Revisa tu internet y repite en unos minutos. |
| Al correr `import-osm.sql` sale un error de columna `source` u `osm_id` | Falta el paso 9.1 (`migration-2-osm.sql`). |

## Límites y notas

- **Plan gratuito de Supabase:** 1 GB de fotos y la base de datos se pausa si pasa una semana sin uso (se reactiva desde su panel). Las fotos se reducen a 1280 px al subirlas para ahorrar espacio.
- **Mapa:** usa los mosaicos públicos de OpenStreetMap, que están pensados para uso ligero. Si la app crece mucho, cambia el proveedor en `components/MapView.tsx` (por ejemplo MapTiler o Stadia Maps, que dan un plan gratuito con llave).
- **Datos de OpenStreetMap:** las cafeterías importadas se publican bajo la licencia ODbL, que pide dar crédito; la app ya lo muestra en la lista y en el mapa. Las cafeterías importadas no tienen dueño, así que solo un moderador puede editarlas.
- **Zonas de Tijuana:** las seis colonias de la lista (`lib/utils.ts`, `BARRIOS`) son aproximadas. Agrega las que quieras.
- **Quitar las cafeterías de ejemplo:** en el SQL Editor ejecuta `delete from public.cafes where is_example = true;`

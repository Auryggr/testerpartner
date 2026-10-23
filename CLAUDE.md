# TesterPartner — instrucciones para Claude Code

Sitio de TesterPartner (testerpartner.com) en Cloudflare Pages con Pages Functions.
Responsable: Aurysmar Guerra. Idioma de trabajo con la responsable: español.

## Estructura

- `public/` — lo único que se publica: `index.html`, `style.css`, `script.js`,
  `cookie-consent.js`, `404.html`, `privacy-policy/`, `terms/`.
  **Editá siempre estos archivos; nunca crees páginas o assets en la raíz.**
  En el HTML usá rutas absolutas (`/style.css`, `/script.js`, `/terms/`) y
  nunca URLs a `pages.dev`.
- `functions/` — endpoints (`api/availability.js`, `api/booking.js`,
  `api/transcript.js`, `api/laxis-discovery.js`, `_middleware.js`).
- `lib/` — lógica compartida (Google Calendar, Airtable, scheduler, email,
  `internal-auth.js`).
- `tests/` — QA: `smoke.mjs` (sin dependencias) y `e2e-booking.mjs` (Playwright).
- `scripts/laxis-sync.mjs` — envío de datos de Laxis a los endpoints internos.

## Reglas de trabajo

1. Trabajá en la rama `staging`. **Nunca hagas commit ni push a `main`**:
   `main` se publica en producción y solo recibe cambios por pull request
   desde `staging`.
2. Antes de proponer un cambio como listo, corré
   `BASE_URL=https://staging.testerpartner.pages.dev node tests/smoke.mjs`
   (con `STAGING_USER`/`STAGING_PASSWORD` del entorno) o pedile a la
   responsable que revise el workflow "QA" en GitHub Actions.
3. **Nunca** muestres, copies ni subas valores de `.dev.vars`, claves, tokens
   o contraseñas. No los escribas en el código, en commits ni en la consola.
4. Los nombres de campos de Airtable (tabla OpportunityBriefs) deben
   coincidir exactamente con los que usa `functions/api/booking.js`.
5. Las reservas de prueba en staging son reales (Calendar, Airtable, email):
   no confirmes reservas salvo que la responsable lo pida.

## Integración con Laxis

**Quién llama a los endpoints hoy:** el userscript de Tampermonkey
`scripts/tampermonkey/laxis-meeting-discovery.user.js`, que corre en el
navegador de la responsable al abrir app.laxis.tech y envía las reuniones
transcriptas a `https://testerpartner.com/api/laxis-discovery`. La clave se
guarda en el almacenamiento de Tampermonkey (menú → "Set TesterPartner key"),
nunca en el archivo. Si cambiás el userscript, subí `@version`.


`/api/laxis-discovery` y `/api/transcript` exigen la clave `INTERNAL_API_KEY`
en el header `X-TesterPartner-Key`. **No los llames con curl ni fetch directo:**
usá siempre el script, que lee la clave de `.dev.vars` sin mostrarla.

- Emparejar reuniones de Laxis con los briefs:
  1. Obtené las reuniones con el MCP de Laxis (`list_meetings`).
  2. Guardalas en un archivo temporal fuera de `public/`, por ejemplo
     `/tmp/laxis-meetings.json`, como un array con `id`, `title`,
     `createdTime` y, si están, `duration`, `noteUrl` y `status`.
  3. Ejecutá `node scripts/laxis-sync.mjs discover /tmp/laxis-meetings.json`.
- Cargar una transcripción para un brief:
  `node scripts/laxis-sync.mjs transcript TP-XXXXXXXX /tmp/transcript.txt`
- Para probar contra staging, agregá `--staging`.

## Documentación

Runbook de despliegue, mapa del sistema y pendientes: Notion → TesterPartner.

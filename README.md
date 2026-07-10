# Sync Alegra → Notion 

Reemplaza el Zap de Zapier que se atoraba. Cada 10 minutos, GitHub Actions corre
`sync.mjs`, que compara **todas** las cotizaciones de Alegra contra **todos**
los folios en la base de Notion de Cinthya y crea las que falten.

- **Sin triggers que se atoren**: es reconciliación completa por folio.
- **Auto-reparable**: si una corrida falla, la siguiente rellena el hueco.
- **Sin duplicados**: si el folio ya existe en Notion, se salta.
- **Aviso de fallas**: GitHub manda correo si la corrida truena.

## Secrets (Settings → Secrets and variables → Actions)

| Secret | Qué es |
|---|---|
| `ALEGRA_EMAIL` | Correo de la cuenta de Alegra |
| `ALEGRA_TOKEN` | Token API de Alegra (Configuración → Integraciones → API) |
| `NOTION_TOKEN` | Secret de integración interna de Notion con acceso a la página de cotizaciones |
| `P1_THRESHOLD` | Umbral (MXN) para marcar Prioridad P1 🔥 — dato interno, no vive en el código |

## Correr a mano

```bash
ALEGRA_EMAIL=... ALEGRA_TOKEN=... NOTION_TOKEN=... node sync.mjs --dry-run   # solo muestra qué crearía
ALEGRA_EMAIL=... ALEGRA_TOKEN=... NOTION_TOKEN=... node sync.mjs             # sincroniza de verdad
```

También desde GitHub: pestaña **Actions → Sync Alegra → Notion → Run workflow**.

## Mapeo de campos

| Notion | Valor |
|---|---|
| Objetivo (título) | `Cotización \| {cliente}` |
| Folio | número de la cotización en Alegra |
| Estado de la cotización | `Enviado`; pasa solo a `Cerrada 🙌` cuando se factura en Alegra |
| Cliente | razón social del cliente (etiqueta) |
| Link Alegra | URL directa a la cotización en Alegra |
| Temas | clasificación automática por productos (Tubería, Compresores, Refacciones, Mantenimientos, Reparaciones) |
| Responsable / Colaboradores | vendedor en Alegra (default `Cinthya Huguez`) |
| Prioridad | `P1 🔥` según umbral del secret `P1_THRESHOLD`, si no `P2` |
| Fecha de Creación | fecha de la cotización |
| Contacto | email del cliente (o su nombre si no tiene) |

**Política de datos sensibles:** ningún monto, total ni ingreso se escribe en Notion,
en el dashboard, en `data.json` ni en los logs. Los totales de Alegra solo se usan
en memoria para derivar la Prioridad.

Los estados manuales se respetan: si Cinthya marca `Perdida`, el sync no la toca.
Solo sincroniza folios ≥ 70 (los anteriores son de la época de captura manual).

## Dashboard en vivo

`docs/` se publica en GitHub Pages: **https://adrianpeerezh-collab.github.io/alegra-notion-sync/**
El sync regenera `docs/data.json` en cada corrida y el workflow lo publica si cambió.
Está embebido en la página de Notion "📊 Panel comercial | ENP".
Muestra únicamente conteos y porcentajes (nº de cotizaciones, ganadas, conversión) — sin montos.

> Nota: el Zap viejo de Zapier debe quedar **apagado** para no generar duplicados.

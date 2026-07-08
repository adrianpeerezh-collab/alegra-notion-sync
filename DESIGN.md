# Design

Tema único **oscuro grafito** (estética PneumaDev/ENP "cuarto de control"). No sigue el tema de Notion: el panel es un instrumento, se ve igual siempre.

## Color (OKLCH)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `oklch(0.16 0.008 260)` | fondo del panel |
| `--panel` | `oklch(0.20 0.008 260)` | tarjetas / instrumentos |
| `--panel-2` | `oklch(0.23 0.009 260)` | hover, cabeceras internas |
| `--line` | `oklch(0.30 0.008 260)` | hairlines |
| `--ink` | `oklch(0.95 0.005 260)` | texto principal |
| `--muted` | `oklch(0.72 0.01 260)` | etiquetas, ejes (AA sobre --panel) |
| `--faint` | `oklch(0.58 0.01 260)` | ghost numbers, metadatos |
| `--green` | `oklch(0.72 0.14 165)` | acento único: ganadas, estado vivo, barras |
| `--green-ink` | `oklch(0.85 0.1 165)` | texto sobre tinte verde |
| `--amber` | `oklch(0.78 0.13 75)` | envejecimiento medio |
| `--red` | `oklch(0.68 0.17 25)` | urgente / error |

Estrategia: **Committed** — el grafito ES la superficie; el verde carga estado y dato bueno, nada más.

## Tipografía

Inter (única familia; registro product). Escala fija rem, ratio ~1.2: 11px meta / 12px etiquetas / 13.5px cuerpo-tabla / 15px títulos de sección / 34px KPI. Números SIEMPRE `font-variant-numeric: tabular-nums`. Etiquetas de KPI en 11px/500 uppercase tracking 0.08em (una sola vez por instrumento, no como eyebrow decorativo).

## Componentes

- **Instrumento KPI**: panel con ghost number gigante de fondo (marca de la casa PneumaDev), valor con count-up al cargar datos (estado, no decoración), sublabel muted.
- **Gauge radial SVG** para conversión (aro verde sobre pista grafito).
- **Status dot** en el header: pulso verde = datos frescos (<20 min), ámbar = viejos, rojo = error de carga (con botón reintentar).
- **Tabla densa** con hairlines `--line`, sin zebra; badge de días abierta (verde/ámbar/rojo + texto).
- **Skeleton** de carga (bloques `--panel-2` con shimmer suave), nunca spinner central.

## Gráficas (Plotly)

Fondo transparente, ejes `--muted`, grid `--line`, sin modebar. Enviadas = gris azulado `#6b7686`; Ganadas = verde acento. Hover unificado oscuro.

## Motion

150–250ms, ease-out. Count-up 600ms al recibir datos; pulso del status dot 2s. Todo desactivado bajo `prefers-reduced-motion` (valores aparecen instantáneos).

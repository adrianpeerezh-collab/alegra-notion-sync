# Product

## Register

product

## Users

Adrián Pérez (dirección) y Cinthya Huguez (ventas/administración) de Energía Neumática del Pacífico (Hermosillo, Sonora). Lo consultan varias veces al día embebido en Notion — entre cotizaciones, para decidir a quién dar seguimiento hoy — y Adrián lo proyecta en juntas de ventas. También se abre en teléfono.

## Product Purpose

Panel de actividad comercial en vivo (se refresca cada 10 minutos desde Alegra vía GitHub Actions). Muestra volumen de cotizaciones, ganadas, conversión y qué está abierto — SIN montos ni ingresos (política estricta de datos sensibles: la página es pública en GitHub Pages). Éxito = de un vistazo saber si el mes va bien y a quién llamar.

## Brand Personality

Industrial, preciso, confiable. Estética "cuarto de control" de la casa PneumaDev/ENP: grafito oscuro, un solo acento verde, números tabulares protagonistas. Profesional sin adornos.

## Anti-references

- Dashboards SaaS genéricos crema/pastel con tarjetas idénticas y gradientes.
- Cualquier cosa que muestre dinero, montos o ingresos.
- Decoración sin función; motion coreografiado de carga.

## Design Principles

1. **El dato es el héroe** — números grandes, tabulares, legibles a 3 metros en una junta.
2. **Un vistazo, una decisión** — la jerarquía responde "¿va bien el mes?" y "¿a quién llamo hoy?" en ese orden.
3. **Vivo, no estático** — el panel comunica su frescura (última actualización, indicador de estado) porque su valor es actualizarse solo.
4. **Consistencia de casa** — mismo lenguaje visual que los dashboards PneumaDev de ENP (grafito, acento verde, Inter, gauges).
5. **Nada sensible** — conteos y porcentajes; los montos viven solo en Alegra.

## Accessibility & Inclusion

Contraste AA (≥4.5:1 texto normal) sobre fondo oscuro; `prefers-reduced-motion` respetado (sin count-ups ni pulsos); semáforos siempre acompañados de texto, nunca solo color; funciona embebido (iframe Notion) y standalone, responsive hasta 360px.

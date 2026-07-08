#!/usr/bin/env node
/**
 * Sincronización Alegra → Notion (cotizaciones ENP) — v2
 *
 * Modelo de RECONCILIACIÓN: en cada corrida se leen TODAS las cotizaciones de
 * Alegra y TODAS las páginas de Notion (por folio); se crean las que falten y
 * se actualizan las existentes (Monto, Link, y cierre automático al facturar).
 * También escribe docs/data.json con los agregados para el dashboard en vivo.
 *
 * Requiere: ALEGRA_EMAIL, ALEGRA_TOKEN, NOTION_TOKEN (variables de entorno).
 * Uso:  node sync.mjs [--dry-run]
 */

import { writeFileSync, mkdirSync } from "fs";

const ALEGRA_EMAIL = process.env.ALEGRA_EMAIL;
const ALEGRA_TOKEN = process.env.ALEGRA_TOKEN;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DRY_RUN = process.argv.includes("--dry-run");

const NOTION_DATA_SOURCE_ID = "30a85db3-4082-81da-a96d-000ba74e7ec2";
const NOTION_VERSION = "2025-09-03";
// Umbral de Prioridad P1 🔥: viene del secret P1_THRESHOLD (dato de negocio,
// no vive en el código). Sin el secret, todo se marca P2.
const P1_THRESHOLD = parseFloat(process.env.P1_THRESHOLD ?? "") || Infinity;
const MIN_FOLIO = 70; // < 70 = era manual de Cinthya, no tocar

// Clasificación automática de Temas por texto de los productos cotizados
const TEMA_KEYWORDS = {
  "Tubería": ["tubo", "tuberia", "tubería", "codo", "cople", "conexion", "conexión", "abrazadera", "airpipe", "airnet", "transair", "manguera", "niple", "reduccion", "reducción", "valvula de bola", "válvula de bola"],
  "Compresores": ["compresor", "compressor", "udara", "tornillo", "pistón", "piston"],
  "Refacciones": ["filtro", "separador", "aceite", "kit ", "refaccion", "refacción", "elemento", "cartucho", "sensor", "valvula", "válvula", "rodamiento", "balero"],
  "Mantenimientos": ["mantenimiento", "servicio", "poliza", "póliza"],
  "Reparaciones": ["reparacion", "reparación", "rebobinado"],
};

if (!ALEGRA_EMAIL || !ALEGRA_TOKEN || !NOTION_TOKEN) {
  console.error("Faltan variables de entorno: ALEGRA_EMAIL, ALEGRA_TOKEN y/o NOTION_TOKEN");
  process.exit(2);
}

const alegraAuth = "Basic " + Buffer.from(`${ALEGRA_EMAIL}:${ALEGRA_TOKEN}`).toString("base64");
const notionHeaders = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Notion-Version": NOTION_VERSION,
  "Content-Type": "application/json",
};

async function fetchRetry(url, options = {}, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} en ${url}: ${await res.text()}`);
      } else {
        throw new Error(`HTTP ${res.status} en ${url}: ${await res.text()}`);
      }
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw lastErr;
}

async function fetchAllEstimates() {
  const all = [];
  for (let start = 0; ; start += 30) {
    const url = `https://api.alegra.com/api/v1/estimates?start=${start}&limit=30&order_direction=ASC&order_field=id`;
    const res = await fetchRetry(url, { headers: { Authorization: alegraAuth, Accept: "application/json" } });
    const page = await res.json();
    if (!Array.isArray(page)) throw new Error(`Respuesta inesperada de Alegra: ${JSON.stringify(page).slice(0, 300)}`);
    all.push(...page);
    if (page.length < 30) break;
  }
  return all;
}

function folioOf(est) {
  const n = est.number ?? est.numberTemplate?.number ?? est.id;
  const parsed = parseInt(String(n), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isBilled(est) {
  return String(est.status ?? "").toLowerCase() === "billed";
}

/** Nombre de cliente apto para opción de Select (Notion no permite comas) */
function clienteOf(est) {
  return (est.client?.name ?? "SIN CLIENTE").trim().replace(/,/g, " ").replace(/\s+/g, " ");
}

function temasOf(est) {
  const text = (est.items ?? []).map((i) => `${i.name ?? ""} ${i.description ?? ""}`).join(" ").toLowerCase();
  const temas = [];
  for (const [tema, keywords] of Object.entries(TEMA_KEYWORDS)) {
    if (keywords.some((k) => text.includes(k))) temas.push(tema);
  }
  return temas;
}

/** Todas las páginas de Notion con Folio: Map folio → {id, estado, monto, link, temas} */
async function fetchNotionPages() {
  const byFolio = new Map();
  let cursor = undefined;
  do {
    const body = { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) };
    const res = await fetchRetry(`https://api.notion.com/v1/data_sources/${NOTION_DATA_SOURCE_ID}/query`, {
      method: "POST",
      headers: notionHeaders,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    for (const page of data.results ?? []) {
      const p = page.properties ?? {};
      const folio = p["Folio"]?.number;
      if (typeof folio !== "number") continue;
      byFolio.set(folio, {
        id: page.id,
        estado: p["Estado de la cotización"]?.status?.name ?? null,
        link: p["Link Alegra"]?.url ?? null,
        temas: (p["Temas"]?.multi_select ?? []).map((t) => t.name),
        cliente: p["Cliente"]?.select?.name ?? null,
      });
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return byFolio;
}

function buildProperties(est, folio, { forCreate }) {
  const clientName = (est.client?.name ?? "SIN CLIENTE").trim();
  const clientEmail = (est.client?.email ?? "").trim();
  const sellerName = (est.seller?.name ?? "").trim() || "Cinthya Huguez";
  const total = parseFloat(est.total ?? "0") || 0;
  const temas = temasOf(est);

  const props = {
    "Link Alegra": { url: `https://app.alegra.com/estimate/view/id/${est.id}` },
    Cliente: { select: { name: clienteOf(est) } },
  };
  if (forCreate) {
    props["Objetivo"] = { title: [{ text: { content: `Cotización | ${clientName}` } }] };
    props["Folio"] = { number: folio };
    props["Estado de la cotización"] = { status: { name: isBilled(est) ? "Cerrada 🙌" : "Enviado" } };
    props["Responsable"] = { select: { name: sellerName } };
    props["Colaboradores"] = { multi_select: [{ name: sellerName }] };
    props["Prioridad"] = { select: { name: total >= P1_THRESHOLD ? "P1 🔥" : "P2" } };
    if (est.date) props["Fecha de Creación"] = { date: { start: est.date } };
    const contacto = clientEmail || clientName;
    if (contacto) props["Contacto"] = { email: contacto };
    if (temas.length) props["Temas"] = { multi_select: temas.map((t) => ({ name: t })) };
  }
  return props;
}
// Nota: el total de Alegra solo se usa internamente para derivar Prioridad;
// ningún monto se escribe en Notion ni en el dashboard (información sensible).

async function createPage(est, folio) {
  const props = buildProperties(est, folio, { forCreate: true });
  if (DRY_RUN) return console.log(`[dry-run] Crearía folio ${folio}`);
  await fetchRetry("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: notionHeaders,
    body: JSON.stringify({ parent: { type: "data_source_id", data_source_id: NOTION_DATA_SOURCE_ID }, properties: props }),
  });
  console.log(`✓ Creado folio ${folio} — ${est.client?.name}`);
}

async function patchPage(pageId, props, label) {
  if (DRY_RUN) return console.log(`[dry-run] Actualizaría ${label}: ${Object.keys(props).join(", ")}`);
  await fetchRetry(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: notionHeaders,
    body: JSON.stringify({ properties: props }),
  });
  console.log(`↻ Actualizado ${label}: ${Object.keys(props).join(", ")}`);
}

/**
 * Agregados para el dashboard público. SOLO conteos y porcentajes —
 * ningún monto ni ingreso sale de aquí (información sensible).
 */
function buildDashboardData(estimates) {
  const byMonth = {};
  const byClient = {};
  const open = [];
  let total = 0, ganadas = 0;

  for (const est of estimates) {
    const folio = folioOf(est);
    if (folio === null || folio < MIN_FOLIO) continue;
    const month = String(est.date ?? "").slice(0, 7) || "s/f";
    const client = (est.client?.name ?? "SIN CLIENTE").trim();
    const billed = isBilled(est);

    byMonth[month] ??= { n: 0, ganadas: 0 };
    byMonth[month].n += 1;
    if (billed) byMonth[month].ganadas += 1;

    byClient[client] ??= { n: 0, ganadas: 0 };
    byClient[client].n += 1;
    if (billed) byClient[client].ganadas += 1;

    total += 1;
    if (billed) ganadas += 1;
    else open.push({ folio, client, date: est.date });
  }

  open.sort((a, b) => b.folio - a.folio);
  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      numCotizaciones: total,
      ganadas,
      abiertas: total - ganadas,
      tasaConversion: total ? ganadas / total : 0,
    },
    byMonth,
    topClientes: Object.entries(byClient).sort((a, b) => b[1].n - a[1].n).slice(0, 10)
      .map(([name, v]) => ({ name, ...v })),
    recientesAbiertas: open.slice(0, 8),
  };
}

async function main() {
  console.log(`Sync Alegra → Notion v2${DRY_RUN ? " (dry-run)" : ""}`);

  const [estimates, notionPages] = await Promise.all([fetchAllEstimates(), fetchNotionPages()]);
  console.log(`Alegra: ${estimates.length} cotizaciones | Notion: ${notionPages.size} folios`);

  let created = 0, updated = 0, failures = 0;

  for (const est of estimates) {
    const folio = folioOf(est);
    if (folio === null || folio < MIN_FOLIO) continue;
    const existing = notionPages.get(folio);

    try {
      if (!existing) {
        await createPage(est, folio);
        created++;
        continue;
      }

      // Página existente: reconciliar Link, Cliente, Temas y cierre automático
      const patch = {};
      if (!existing.link) patch["Link Alegra"] = { url: `https://app.alegra.com/estimate/view/id/${est.id}` };
      if (!existing.cliente) patch["Cliente"] = { select: { name: clienteOf(est) } };
      if (isBilled(est) && existing.estado !== "Cerrada 🙌" && existing.estado !== "Perdida") {
        patch["Estado de la cotización"] = { status: { name: "Cerrada 🙌" } };
      }
      if (existing.temas.length === 0) {
        const temas = temasOf(est);
        if (temas.length) patch["Temas"] = { multi_select: temas.map((t) => ({ name: t })) };
      }
      if (Object.keys(patch).length > 0) {
        await patchPage(existing.id, patch, `folio ${folio}`);
        updated++;
      }
    } catch (e) {
      failures++;
      console.error(`✗ Error en folio ${folio}: ${e.message}`);
    }
  }

  // Datos para el dashboard en vivo (GitHub Pages, embebido en Notion)
  try {
    mkdirSync("docs", { recursive: true });
    writeFileSync("docs/data.json", JSON.stringify(buildDashboardData(estimates)));
    console.log("✓ docs/data.json regenerado");
  } catch (e) {
    console.error(`✗ Error generando data.json: ${e.message}`);
  }

  console.log(`Resumen: ${created} creadas, ${updated} actualizadas, ${failures} errores.`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Error fatal:", e.message);
  process.exit(1);
});

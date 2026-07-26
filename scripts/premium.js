// Brand premium "MARE CALMO PUGLIA".
// Stile Apple / Linear / Windy: minimal, tanto spazio, gerarchia forte,
// mappa vettoriale pulita. Un solo renderer per feed (1080x1080/1350) e
// storie (1080x1920): il layout si adatta all'altezza.
//
// Uso: node scripts/premium.js Brindisi          (feed 1080x1080)
//      node scripts/premium.js Brindisi storia    (storia 1080x1920)

import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cardinale, nomeVento } from '../src/geo.js';
import { spiaggeDiProvincia } from '../src/province.js';
import { preparaDati } from './manifesto.js';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(RADICE, 'out', 'premium');
const W = 1080, M = 80;

// Palette del brand (solo questi colori).
const BG = '#F7F3EC', LAND = '#EFE8D8';
const SEA1 = '#49B8C7', SEA2 = '#177A8A';
const INK = '#1F2E3A', MUTED = '#6A7782', HAIR = '#E4DCCB';
const VERDE = '#3BB273', GIALLO = '#E8B23E', ROSSO = '#E1614A';
const COL = { calmo: VERDE, mosso: GIALLO, moltomosso: ROSSO };

const K = Math.cos((40.4 * Math.PI) / 180);
const grezzo = ([lon, lat]) => [lon * K, -lat];

export async function fontCssInter() {
  const f = [['Inter', 400, 'inter-400.woff2'], ['Inter', 500, 'inter-500.woff2'],
    ['Inter', 600, 'inter-600.woff2'], ['Inter', 700, 'inter-700.woff2'], ['Inter', 800, 'inter-800.woff2']];
  const out = await Promise.all(f.map(async ([fam, peso, file]) => {
    const dati = await readFile(path.join(RADICE, 'assets', 'font', file));
    return `@font-face{font-family:'${fam}';font-weight:${peso};font-style:normal;src:url(data:font/woff2;base64,${dati.toString('base64')}) format('woff2')}`;
  }));
  return out.join('\n');
}

const dataEstesa = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  const s = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function logoMark(x, y, s) {
  return `
    <rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.3}" fill="url(#logoGrad)"/>
    <path d="M${x + s * 0.2} ${y + s * 0.58} q ${s * 0.15} -${s * 0.18} ${s * 0.3} 0 t ${s * 0.3} 0"
          fill="none" stroke="#fff" stroke-width="${s * 0.075}" stroke-linecap="round"/>
    <path d="M${x + s * 0.2} ${y + s * 0.38} q ${s * 0.15} -${s * 0.18} ${s * 0.3} 0 t ${s * 0.3} 0"
          fill="none" stroke="#fff" stroke-width="${s * 0.075}" stroke-linecap="round" opacity=".65"/>`;
}

/** Compone l'HTML del post/storia premium. Layout responsivo sull'altezza H. */
export async function componiHtmlPremium({ titolo, eyebrow = 'MARE CALMO · PUGLIA', valutate, ventoDir, ventoNodi, data, coste, account, H }) {
  const storia = H > 1400;
  const titleY = storia ? 320 : 252;
  const titleSize = storia ? 108 : 96;
  const dateY = titleY + (storia ? 50 : 48);
  const cardY = storia ? 208 : 178;
  const mapY = storia ? 470 : 384;
  const mapH = storia ? H - 470 - 150 : 520;
  const mapX = M, mapW = W - M * 2, pad = 50;
  const legendY = storia ? H - 78 : 958;

  const pts = valutate.map((s) => grezzo([s.lon, s.lat]));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scala = Math.min((mapW - pad * 2) / (maxX - minX || 0.01), (mapH - pad * 2) / (maxY - minY || 0.01));
  const oX = mapX + (mapW - (maxX - minX) * scala) / 2;
  const oY = mapY + (mapH - (maxY - minY) * scala) / 2;
  const proj = ([lon, lat]) => { const [gx, gy] = grezzo([lon, lat]); return [(gx - minX) * scala + oX, (gy - minY) * scala + oY]; };
  const percorso = (a) => a.map((p, i) => (i ? 'L' : 'M') + proj(p).map((n) => n.toFixed(1)).join(' ')).join('') + 'Z';
  const terra = [...coste.puglia, ...coste.contorno].map((a) => `<path d="${percorso(a)}"/>`).join('');

  const anelli = coste.puglia.map((a) => a.map(proj));
  const vicino = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const l2 = dx * dx + dy * dy || 1e-9; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)); return [a[0] + t * dx, a[1] + t * dy]; };
  const snap = (p) => { let best = p, bd = Infinity; for (const an of anelli) for (let i = 0; i < an.length - 1; i++) { const q = vicino(p, an[i], an[i + 1]); const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (d < bd) { bd = d; best = q; } } return best; };

  const cxMap = mapX + mapW / 2;
  const nodi = valutate.map((s) => { const [px, py] = snap(proj([s.lon, s.lat])); return { s, px, py, destra: px < cxMap, ly: py }; }).sort((a, b) => a.py - b.py);
  for (const lato of [true, false]) {
    const gruppo = nodi.filter((n) => n.destra === lato);
    let last = -Infinity;
    for (const n of gruppo) { if (n.ly < last + 38) n.ly = last + 38; last = n.ly; }
  }

  const etichette = nodi.map((n) => {
    const col = COL[n.s.statoMare] || GIALLO;
    const nome = n.s.nome.length > 22 ? n.s.nome.slice(0, 21) + '…' : n.s.nome;
    const gap = 20, w = 22 + nome.length * 11.2;
    const lx = n.destra ? n.px + gap : n.px - gap - w;
    const tx = n.destra ? lx + 14 : lx + w - 14;
    const anchor = n.destra ? 'start' : 'end';
    return `
      <line x1="${n.px.toFixed(1)}" y1="${n.py.toFixed(1)}" x2="${(n.destra ? lx : lx + w).toFixed(1)}" y2="${n.ly.toFixed(1)}" stroke="${INK}" stroke-width="1" opacity=".16"/>
      <rect x="${lx.toFixed(1)}" y="${(n.ly - 17).toFixed(1)}" width="${w.toFixed(1)}" height="34" rx="9" fill="#FFFFFF" opacity=".92"/>
      <circle cx="${n.px.toFixed(1)}" cy="${n.py.toFixed(1)}" r="6.5" fill="${col}" stroke="#fff" stroke-width="2.5"/>
      <text x="${tx.toFixed(1)}" y="${(n.ly + 5).toFixed(1)}" text-anchor="${anchor}" font-family="Inter" font-weight="600" font-size="22" fill="${INK}">${nome}</text>`;
  }).join('');

  const tempMax = Math.round(Math.max(...valutate.map((s) => s.temperatura ?? 0)));
  const font = await fontCssInter();

  const svg = `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sea" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${SEA1}"/><stop offset="1" stop-color="${SEA2}"/></linearGradient>
      <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${SEA1}"/><stop offset="1" stop-color="${SEA2}"/></linearGradient>
      <clipPath id="map"><rect x="${mapX}" y="${mapY}" width="${mapW}" height="${mapH}" rx="26"/></clipPath>
    </defs>
    <rect width="${W}" height="${H}" fill="${BG}"/>

    ${logoMark(M, storia ? 84 : 74, 46)}
    <text x="${M + 62}" y="${storia ? 104 : 94}" font-family="Inter" font-weight="700" font-size="20" letter-spacing="1.5" fill="${INK}">${eyebrow.split('·')[0].trim()}</text>
    <text x="${M + 62}" y="${storia ? 126 : 116}" font-family="Inter" font-weight="500" font-size="16" letter-spacing="3" fill="${MUTED}">${(eyebrow.split('·')[1] || '').trim().toUpperCase()}</text>

    <text x="${M}" y="${titleY}" font-family="Inter" font-weight="800" font-size="${titleSize}" letter-spacing="-3" fill="${INK}">${titolo}</text>
    <text x="${M}" y="${dateY}" font-family="Inter" font-weight="500" font-size="27" fill="${MUTED}">${dataEstesa(data)}</text>

    <g transform="translate(${W - M - 470} ${cardY})">
      <rect x="0" y="0" width="470" height="118" rx="20" fill="#FFFFFF" stroke="${HAIR}" stroke-width="1.5"/>
      <text x="28" y="42" font-family="Inter" font-weight="600" font-size="15" letter-spacing="1.2" fill="${MUTED}">TEMPERATURA</text>
      <text x="28" y="92" font-family="Inter" font-weight="700" font-size="46" fill="${INK}">${tempMax}°</text>
      <line x1="186" y1="26" x2="186" y2="92" stroke="${HAIR}" stroke-width="1.5"/>
      <text x="212" y="42" font-family="Inter" font-weight="600" font-size="15" letter-spacing="1.2" fill="${MUTED}">VENTO</text>
      <g transform="translate(224 74)"><g transform="rotate(${((ventoDir + 180) % 360).toFixed(0)})">
        <line x1="0" y1="9" x2="0" y2="-9" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M-5 -3 L0 -11 L5 -3" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g></g>
      <text x="246" y="82" font-family="Inter" font-weight="600" font-size="24" fill="${INK}">${nomeVento(ventoDir)} · ${ventoNodi} kn</text>
    </g>

    <rect x="${mapX}" y="${mapY}" width="${mapW}" height="${mapH}" rx="26" fill="url(#sea)"/>
    <g clip-path="url(#map)">
      <g fill="${LAND}" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round" opacity=".96">${terra}</g>
      <g fill="none" stroke="${SEA2}" stroke-width="1" opacity=".18">
        ${Array.from({ length: Math.ceil(mapH / 110) }, (_, i) => `<path d="M${mapX} ${mapY + 80 + i * 110} q ${mapW / 4} -18 ${mapW / 2} 0 t ${mapW / 2} 0" />`).join('')}
      </g>
      ${etichette}
    </g>
    <rect x="${mapX}" y="${mapY}" width="${mapW}" height="${mapH}" rx="26" fill="none" stroke="${HAIR}" stroke-width="1.5"/>

    <g transform="translate(${M} ${legendY})" font-family="Inter" font-weight="500" font-size="20" fill="${MUTED}">
      ${[['Calmo', VERDE], ['Poco mosso', GIALLO], ['Mosso', ROSSO]].map(([t, c], i) => {
        const x = i * 200; return `<circle cx="${x + 6}" cy="-6" r="7" fill="${c}"/><text x="${x + 22}" y="0">${t}</text>`;
      }).join('')}
    </g>
    <text x="${W - M}" y="${legendY + 6}" text-anchor="end" font-family="Inter" font-weight="600" font-size="20" fill="${INK}">@${account.replace('@', '')}</text>
  </svg>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>${font}*{margin:0;padding:0}</style></head><body style="margin:0">${svg}</body></html>`;
}

async function main() {
  const provincia = process.argv[2] || 'Brindisi';
  const H = process.argv[3] === 'storia' ? 1920 : 1080;
  const regione = JSON.parse(await readFile(path.join(RADICE, 'data', 'puglia.json'), 'utf8'));
  const coste = JSON.parse(await readFile(path.join(RADICE, 'data', 'coste.json'), 'utf8'));
  const spiagge = spiaggeDiProvincia(regione.spiagge, provincia);
  if (!spiagge.length) throw new Error(`Nessuna spiaggia in ${provincia}`);
  const dati = await preparaDati(spiagge, regione.fuso, 1);
  const html = await componiHtmlPremium({ titolo: provincia, ...dati, coste, account: regione.account, H });

  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: W, height: H } });
    await p.setContent(html, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    const file = path.join(OUT, `${provincia.toLowerCase()}-${H}.jpg`);
    await p.screenshot({ path: file, type: 'jpeg', quality: 95 });
    console.log(file);
  } finally { await browser.close(); }
}

if (process.argv[1] && process.argv[1].endsWith('premium.js')) {
  main().catch((e) => { console.error(`Errore: ${e.message}`); process.exit(1); });
}

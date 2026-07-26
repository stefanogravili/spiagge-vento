// Stile "cartoon": allegro, contorni spessi, sole sorridente e bollini
// semaforo per lo stato del mare (Calmo / Mosso / Molto mosso).
//
// Uso diretto: node scripts/cartone.js Brindisi
// componiHtmlCartone() e' riusato da scripts/province-tutte.js.

import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cardinale, nomeVento } from '../src/geo.js';
import { spiaggeDiProvincia } from '../src/province.js';
import { preparaDati } from './manifesto.js';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(RADICE, 'out', 'cartone');
const W = 1080, H = 1920;

const SKY1 = '#AEE3F0', SKY2 = '#D6F2F8';
const SEA = '#38B9C7', SEA_D = '#2A9DAB';
const SAND = '#F5DA92', SAND_D = '#EAC96E';
const INK = '#243b44';
const VERDE = '#34C759', GIALLO = '#FFC53D', ROSSO = '#FF5B4C';
const SOLE = '#FFCB3B';

const K = Math.cos((40.4 * Math.PI) / 180);
const grezzo = ([lon, lat]) => [lon * K, -lat];

async function fontCss() {
  const f = [['Fredoka', 500, 'fredoka-500.woff2'], ['Fredoka', 700, 'fredoka-700.woff2']];
  const out = await Promise.all(f.map(async ([fam, peso, file]) => {
    const dati = await readFile(path.join(RADICE, 'assets', 'font', file));
    return `@font-face{font-family:'${fam}';font-weight:${peso};font-style:normal;` +
      `src:url(data:font/woff2;base64,${dati.toString('base64')}) format('woff2')}`;
  }));
  return out.join('\n');
}

const dataEstesa = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  const s = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Tre livelli (scala Douglas, calcolata in score.js): Calmo / Mosso / Molto mosso.
const COLORE = { calmo: VERDE, mosso: GIALLO, moltomosso: ROSSO };

function soleFelice(cx, cy, r) {
  const raggi = [];
  for (let i = 0; i < 12; i++) {
    const a = (i * 30) * Math.PI / 180;
    raggi.push(`<line x1="${cx + Math.cos(a) * (r + 8)}" y1="${cy + Math.sin(a) * (r + 8)}"
      x2="${cx + Math.cos(a) * (r + 26)}" y2="${cy + Math.sin(a) * (r + 26)}"
      stroke="${SOLE}" stroke-width="9" stroke-linecap="round"/>`);
  }
  return `${raggi.join('')}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${SOLE}" stroke="${INK}" stroke-width="5"/>
    <circle cx="${cx - r * 0.32}" cy="${cy - r * 0.12}" r="6" fill="${INK}"/>
    <circle cx="${cx + r * 0.32}" cy="${cy - r * 0.12}" r="6" fill="${INK}"/>
    <path d="M${cx - r * 0.34} ${cy + r * 0.2} Q ${cx} ${cy + r * 0.58} ${cx + r * 0.34} ${cy + r * 0.2}"
          fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
}

/** Compone l'HTML completo di una tavola cartoon. */
export async function componiHtmlCartone({ titolo, eyebrow, sottotitolo, valutate, ventoDir, ventoNodi, seaEst, data, coste, account }) {
  const MW = 470, PY = 470, PH = 1150, PAD = 66;
  const panelX = seaEst ? (W - 46 - MW) : 46;
  const pts = valutate.map((s) => grezzo([s.lon, s.lat]));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scala = Math.min((MW - PAD * 2) / (maxX - minX || 0.01), (PH - PAD * 2) / (maxY - minY || 0.01));
  const oX = panelX + (MW - (maxX - minX) * scala) / 2;
  const oY = PY + (PH - (maxY - minY) * scala) / 2;
  const proietta = ([lon, lat]) => { const [gx, gy] = grezzo([lon, lat]); return [(gx - minX) * scala + oX, (gy - minY) * scala + oY]; };
  const percorso = (a) => a.map((p, i) => (i ? 'L' : 'M') + proietta(p).map((n) => n.toFixed(1)).join(' ')).join('') + 'Z';
  const terra = [...coste.puglia, ...coste.contorno].map((a) => `<path d="${percorso(a)}"/>`).join('');

  const nodi = valutate.map((s) => ({ s, punto: proietta([s.lon, s.lat]) })).sort((a, b) => a.punto[1] - b.punto[1]);
  const top = 500, bot = 1600, gap = Math.min(96, (bot - top) / Math.max(1, nodi.length - 1));
  nodi.forEach((n, i) => { n.ey = top + i * gap; });
  const ancoraX = seaEst ? panelX - 30 : panelX + MW + 30;

  const etichette = nodi.map((n) => {
    const [dx, dy] = n.punto;
    const col = COLORE[n.s.statoMare] || GIALLO;
    const larg = 44 + n.s.nome.length * 19;
    const pillX = seaEst ? ancoraX - larg : ancoraX;
    const dotX = seaEst ? ancoraX - 26 : ancoraX + 26;
    const testoX = seaEst ? ancoraX - 52 : ancoraX + 52;
    const nome = n.s.nome.length > 23 ? n.s.nome.slice(0, 22) + '…' : n.s.nome;
    return `
      <path d="M${dx.toFixed(1)} ${dy.toFixed(1)} L ${ancoraX} ${n.ey.toFixed(1)}" stroke="${INK}" stroke-width="3"/>
      <circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="9" fill="${col}" stroke="#fff" stroke-width="3"/>
      <circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="11.5" fill="none" stroke="${INK}" stroke-width="2"/>
      <rect x="${pillX}" y="${n.ey - 30}" width="${larg}" height="60" rx="30" fill="#fff" stroke="${INK}" stroke-width="4"/>
      <circle cx="${dotX}" cy="${n.ey}" r="15" fill="${col}" stroke="${INK}" stroke-width="3"/>
      <text x="${testoX}" y="${n.ey + 10}" text-anchor="${seaEst ? 'end' : 'start'}"
            font-family="Fredoka" font-weight="500" font-size="33" fill="${INK}">${nome}</text>`;
  }).join('');

  const font = await fontCss();
  const svg = `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SKY1}"/><stop offset="1" stop-color="${SKY2}"/></linearGradient>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SEA}"/><stop offset="1" stop-color="${SEA_D}"/></linearGradient>
      <clipPath id="pan"><rect x="${panelX}" y="${PY}" width="${MW}" height="${PH}" rx="34"/></clipPath>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${soleFelice(W - 165, 175, 66)}
    <text x="60" y="150" font-family="Fredoka" font-weight="700" font-size="30" fill="${SEA_D}">${eyebrow}</text>
    <text x="56" y="300" font-family="Fredoka" font-weight="700" font-size="150" fill="${INK}">${titolo}</text>
    <text x="60" y="372" font-family="Fredoka" font-weight="500" font-size="36" fill="${INK}">${sottotitolo} · ${dataEstesa(data)}</text>
    <g transform="translate(60 410)">
      <rect x="0" y="0" width="600" height="60" rx="30" fill="#fff" stroke="${INK}" stroke-width="4"/>
      <g transform="translate(38 30)"><g transform="rotate(${((ventoDir + 180) % 360).toFixed(0)})">
        <line x1="0" y1="12" x2="0" y2="-12" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
        <path d="M-7 -5 L0 -14 L7 -5 Z" fill="${INK}"/></g></g>
      <text x="72" y="40" font-family="Fredoka" font-weight="500" font-size="27" fill="${INK}">Vento: ${nomeVento(ventoDir)} · ${ventoNodi} nodi da ${cardinale(ventoDir)}</text>
    </g>
    <g clip-path="url(#pan)">
      <rect x="${panelX}" y="${PY}" width="${MW}" height="${PH}" fill="url(#sea)"/>
      <g stroke="#fff" stroke-width="4" opacity=".35" fill="none" stroke-linecap="round">
        ${Array.from({ length: 7 }, (_, i) => `<path d="M${panelX} ${PY + 110 + i * 160} q ${MW / 4} -26 ${MW / 2} 0 t ${MW / 2} 0"/>`).join('')}
      </g>
      <g fill="${SAND}" stroke="${INK}" stroke-width="5" stroke-linejoin="round">${terra}</g>
    </g>
    <rect x="${panelX}" y="${PY}" width="${MW}" height="${PH}" rx="34" fill="none" stroke="${INK}" stroke-width="5"/>
    ${etichette}
    <text x="${W / 2}" y="${H - 150}" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="40" fill="${SEA_D}">@${account.replace('@', '')}</text>
    <g transform="translate(0 ${H - 76})" font-family="Fredoka" font-weight="500" font-size="30" fill="${INK}">
      ${[['Calmo', VERDE], ['Mosso', GIALLO], ['Molto mosso', ROSSO]].map(([t, c], i) => {
        const x = 90 + i * 320;
        return `<circle cx="${x}" cy="-8" r="17" fill="${c}" stroke="${INK}" stroke-width="3"/><text x="${x + 28}" y="2">${t}</text>`;
      }).join('')}
    </g>
  </svg>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${font}*{margin:0;padding:0}</style></head><body style="margin:0">${svg}</body></html>`;
}

async function renderSuFile(html, file) {
  await mkdir(path.dirname(file), { recursive: true });
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: W, height: H } });
    await p.setContent(html, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: file, type: 'jpeg', quality: 94 });
  } finally { await browser.close(); }
}

async function main() {
  const provincia = process.argv[2] || 'Brindisi';
  const regione = JSON.parse(await readFile(path.join(RADICE, 'data', 'puglia.json'), 'utf8'));
  const coste = JSON.parse(await readFile(path.join(RADICE, 'data', 'coste.json'), 'utf8'));
  const spiagge = spiaggeDiProvincia(regione.spiagge, provincia);
  if (!spiagge.length) throw new Error(`Nessuna spiaggia in provincia di ${provincia}`);
  console.log(`Scarico i dati per ${spiagge.length} spiagge in provincia di ${provincia}...`);
  const dati = await preparaDati(spiagge, regione.fuso);
  const html = await componiHtmlCartone({
    titolo: provincia, eyebrow: 'MARE CALMO · PUGLIA', sottotitolo: 'Dove fare il bagno',
    ...dati, coste, account: regione.account,
  });
  const file = path.join(OUT, `${provincia.toLowerCase()}.jpg`);
  await renderSuFile(html, file);
  console.log(file);
}

if (process.argv[1] && process.argv[1].endsWith('cartone.js')) {
  main().catch((e) => { console.error(`Errore: ${e.message}`); process.exit(1); });
}

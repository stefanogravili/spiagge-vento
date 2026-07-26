// Manifesto vintage da viaggio, un poster per provincia.
// Costa reale stilizzata, spiagge con bandierine CALMO/POCO MOSSO/MOSSO,
// rosa dei venti, sole Art Deco, cornice e grana litografica.
//
// Uso diretto: node scripts/manifesto.js Brindisi
// Le funzioni preparaDati()/componiParti() sono riusate da scripts/anteprima.js.

import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { condizioniGiornata } from '../src/weather.js';
import { valuta } from '../src/score.js';
import { cardinale, nomeVento } from '../src/geo.js';
import { spiaggeDiProvincia } from '../src/province.js';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(RADICE, 'out', 'manifesto');
export const W = 1080, H = 1920;

const PAPER = '#EFE2C4', INK = '#33291D';
const SEA = '#1F6E72', SEA_D = '#164E52';
const SAND = '#D9B071', SAND_E = '#B4863A';
const GOLD = '#E7A32C', CORAL = '#D24A2E';
const F_CALMO = '#3C8C55', F_POCO = '#E0982E', F_MOSSO = '#D24A2E';

const K = Math.cos((40.4 * Math.PI) / 180);
const grezzo = ([lon, lat]) => [lon * K, -lat];

export async function fontCss() {
  const f = [
    ['Bebas', 400, 'normal', 'bebas-400.woff2'],
    ['Spectral', 400, 'normal', 'spectral-400.woff2'],
    ['Spectral', 600, 'normal', 'spectral-600.woff2'],
    ['Spectral', 500, 'italic', 'spectral-italic.woff2'],
  ];
  const out = await Promise.all(f.map(async ([fam, peso, stile, file]) => {
    const dati = await readFile(path.join(RADICE, 'assets', 'font', file));
    return `@font-face{font-family:'${fam}';font-weight:${peso};font-style:${stile};` +
      `src:url(data:font/woff2;base64,${dati.toString('base64')}) format('woff2')}`;
  }));
  return out.join('\n');
}

const dataEstesa = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  const s = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const flagColore = (p) => (p >= 70 ? F_CALMO : p >= 45 ? F_POCO : F_MOSSO);
const flagTesto = (p) => (p >= 70 ? 'CALMO' : p >= 45 ? 'POCO MOSSO' : 'MOSSO');

function bandiera(x, y, colore, versoDestra) {
  const dir = versoDestra ? 1 : -1;
  const w = 34 * dir;
  return `
    <line x1="${x}" y1="${y - 2}" x2="${x}" y2="${y - 40}" stroke="${INK}" stroke-width="3"/>
    <path d="M${x} ${y - 40} L${x + w} ${y - 33} L${x + w * 0.55} ${y - 26} L${x + w} ${y - 19} L${x} ${y - 22} Z"
          fill="${colore}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="${x}" cy="${y}" r="4.5" fill="${INK}"/>`;
}

function rosaVenti(cx, cy, r, gradiVento) {
  const punte = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * 45) * Math.PI / 180;
    const lung = i % 2 === 0 ? r : r * 0.5;
    const px = cx + Math.sin(a) * lung, py = cy - Math.cos(a) * lung;
    const b1 = a - 0.18, b2 = a + 0.18, w = r * 0.16;
    punte.push(`<path d="M${cx + Math.sin(b1) * w} ${cy - Math.cos(b1) * w}
      L${px.toFixed(1)} ${py.toFixed(1)} L${cx + Math.sin(b2) * w} ${cy - Math.cos(b2) * w} Z"
      fill="${i % 2 === 0 ? INK : 'none'}" stroke="${INK}" stroke-width="1.4"/>`);
  }
  const verso = (gradiVento + 180) % 360;
  return `
    <circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="none" stroke="${INK}" stroke-width="1.5" opacity=".5"/>
    ${punte.join('')}
    <circle cx="${cx}" cy="${cy}" r="${r * 0.2}" fill="${PAPER}" stroke="${INK}" stroke-width="1.4"/>
    <text x="${cx}" y="${cy - r - 16}" text-anchor="middle" font-family="Bebas" font-size="26" fill="${INK}">N</text>
    <g transform="rotate(${verso.toFixed(0)} ${cx} ${cy})">
      <line x1="${cx}" y1="${cy + r * 0.3}" x2="${cx}" y2="${cy - r * 0.75}" stroke="${CORAL}" stroke-width="4" stroke-linecap="round"/>
      <path d="M${cx - 8} ${cy - r * 0.55} L${cx} ${cy - r * 0.82} L${cx + 8} ${cy - r * 0.55} Z" fill="${CORAL}"/>
    </g>`;
}

function sole(cx, cy, r) {
  const raggi = [];
  for (let i = 0; i < 12; i++) {
    const a = (i * 30) * Math.PI / 180;
    const r1 = r + 8, r2 = r + 30, wr = 0.09;
    raggi.push(`<path d="M${cx + Math.cos(a - wr) * r1} ${cy + Math.sin(a - wr) * r1}
      L${cx + Math.cos(a) * r2} ${cy + Math.sin(a) * r2}
      L${cx + Math.cos(a + wr) * r1} ${cy + Math.sin(a + wr) * r1} Z" fill="${GOLD}"/>`);
  }
  return `${raggi.join('')}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${GOLD}" stroke="${INK}" stroke-width="2"/>`;
}

/** Scarica meteo, calcola punteggi e sintesi del vento per un gruppo di spiagge. */
export async function preparaDati(spiagge, fuso, offset = 0) {
  const valutate = (await condizioniGiornata(spiagge, fuso, offset)).map(valuta);
  let vx = 0, vy = 0;
  for (const s of valutate) { vx += Math.cos(s.ventoDa * Math.PI / 180); vy += Math.sin(s.ventoDa * Math.PI / 180); }
  const ventoDir = ((Math.atan2(vy, vx) * 180 / Math.PI) + 360) % 360;
  const ventoNodi = Math.round(valutate.reduce((a, s) => a + s.ventoNodi, 0) / valutate.length);
  const seaEst = valutate.reduce((a, s) => a + Math.sin(s.facing * Math.PI / 180), 0) >= 0;
  return { valutate, ventoDir, ventoNodi, seaEst, data: valutate[0].dataRiferimento };
}

/** Compone stile + markup del poster. Restituito a pezzi cosi' l'anteprima puo' scalarlo. */
export async function componiParti({ titolo, eyebrow, valutate, ventoDir, ventoNodi, seaEst, data, coste, account }) {
  const MW = 470, PY = 452, PH = 1180, PAD = 70;
  const panelX = seaEst ? (W - 40 - MW) : 40;
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
  const top = 470, bot = 1600, gap = Math.min(92, (bot - top) / Math.max(1, nodi.length - 1));
  nodi.forEach((n, i) => { n.ey = top + i * gap; });

  const ancoraX = seaEst ? panelX - 34 : panelX + MW + 34;
  const etichette = nodi.map((n) => {
    const [dx, dy] = n.punto;
    const col = flagColore(n.s.punteggio);
    const nameX = seaEst ? ancoraX - 46 : ancoraX + 46;
    const anchor = seaEst ? 'end' : 'start';
    return `
      <path d="M${dx.toFixed(1)} ${dy.toFixed(1)} Q ${((dx + ancoraX) / 2).toFixed(1)} ${n.ey.toFixed(1)} ${ancoraX} ${n.ey.toFixed(1)}"
            fill="none" stroke="${col}" stroke-width="2" opacity=".8"/>
      <circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="5.5" fill="${col}" stroke="${PAPER}" stroke-width="2"/>
      ${bandiera(ancoraX, n.ey, col, !seaEst)}
      <text x="${nameX}" y="${(n.ey - 8).toFixed(1)}" text-anchor="${anchor}"
            font-family="Spectral" font-weight="600" font-size="33" fill="${INK}">${n.s.nome}</text>
      <text x="${nameX}" y="${(n.ey + 20).toFixed(1)}" text-anchor="${anchor}"
            font-family="Spectral" font-weight="600" font-size="18" letter-spacing="1.5" fill="${col}">${flagTesto(n.s.punteggio)}</text>`;
  }).join('');

  const roseCx = seaEst ? panelX + MW - 96 : panelX + 96;

  const content = `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="mare" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SEA}"/><stop offset="1" stop-color="${SEA_D}"/></linearGradient>
      <clipPath id="pan"><rect x="${panelX}" y="${PY}" width="${MW}" height="${PH}" rx="6"/></clipPath>
    </defs>
    <rect width="${W}" height="${H}" fill="${PAPER}"/>
    <rect x="26" y="26" width="${W - 52}" height="${H - 52}" fill="none" stroke="${INK}" stroke-width="3"/>
    <rect x="38" y="38" width="${W - 76}" height="${H - 76}" fill="none" stroke="${INK}" stroke-width="1.2"/>
    ${sole(W - 150, 132, 44)}
    <text x="70" y="132" font-family="Spectral" font-weight="600" font-size="27" letter-spacing="7" fill="${CORAL}">${eyebrow}</text>
    <text x="66" y="292" font-family="Bebas" font-size="176" fill="${INK}">${titolo.toUpperCase()}</text>
    <text x="70" y="352" font-family="Spectral" font-style="italic" font-weight="500" font-size="34" fill="${INK}">Le spiagge al riparo dal vento — ${dataEstesa(data)}</text>
    <line x1="70" y1="392" x2="${W - 70}" y2="392" stroke="${INK}" stroke-width="2"/>
    <text x="70" y="432" font-family="Spectral" font-weight="600" font-size="26" fill="${INK}">Vento: ${nomeVento(ventoDir)} · ${ventoNodi} nodi da ${cardinale(ventoDir)}</text>
    <g clip-path="url(#pan)">
      <rect x="${panelX}" y="${PY}" width="${MW}" height="${PH}" fill="url(#mare)"/>
      <g stroke="${PAPER}" stroke-width="2" opacity=".2">
        ${Array.from({ length: 8 }, (_, i) => `<path d="M${panelX} ${PY + 90 + i * 150} q ${MW / 4} -22 ${MW / 2} 0 t ${MW / 2} 0" fill="none"/>`).join('')}
      </g>
      <g fill="${SAND}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round">${terra}</g>
    </g>
    <rect x="${panelX}" y="${PY}" width="${MW}" height="${PH}" rx="6" fill="none" stroke="${INK}" stroke-width="2.5"/>
    ${rosaVenti(roseCx, PY + 118, 52, ventoDir)}
    ${etichette}
    <g transform="translate(70 ${H - 96})" font-family="Spectral" font-weight="600" font-size="26" fill="${INK}">
      ${[['Calmo', F_CALMO], ['Poco mosso', F_POCO], ['Mosso', F_MOSSO]].map(([t, c], i) => {
        const x = i * 250;
        return `<rect x="${x}" y="-22" width="26" height="26" rx="3" fill="${c}" stroke="${INK}" stroke-width="1.5"/><text x="${x + 38}" y="0">${t}</text>`;
      }).join('')}
    </g>
    <text x="${W - 70}" y="${H - 76}" text-anchor="end" font-family="Bebas" font-size="34" fill="${INK}">@${account.replace('@', '')}</text>
  </svg>`;

  const style = `<style>${await fontCss()}
    *{margin:0;padding:0}
    .grain{position:absolute;top:0;left:0;width:${W}px;height:${H}px;opacity:.09;mix-blend-mode:multiply;pointer-events:none}
  </style>`;
  const grain = `<svg class="grain" width="${W}" height="${H}" preserveAspectRatio="none">
      <filter id="gr"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/></filter>
      <rect width="${W}" height="${H}" filter="url(#gr)"/></svg>`;
  return { style, content: `<div style="position:relative;width:${W}px;height:${H}px">${content}${grain}</div>` };
}

// --- CLI: una singola provincia a piena risoluzione ---
async function main() {
  const provincia = process.argv[2] || 'Brindisi';
  const regione = JSON.parse(await readFile(path.join(RADICE, 'data', 'puglia.json'), 'utf8'));
  const coste = JSON.parse(await readFile(path.join(RADICE, 'data', 'coste.json'), 'utf8'));
  const spiagge = spiaggeDiProvincia(regione.spiagge, provincia);
  if (!spiagge.length) throw new Error(`Nessuna spiaggia in provincia di ${provincia}`);

  console.log(`Scarico i dati per ${spiagge.length} spiagge in provincia di ${provincia}...`);
  const dati = await preparaDati(spiagge, regione.fuso);
  const { style, content } = await componiParti({
    titolo: provincia, eyebrow: 'MARE CALMO · PUGLIA', ...dati, coste, account: regione.account,
  });
  const html = `<!doctype html><html><head><meta charset="utf-8">${style}</head><body style="margin:0">${content}</body></html>`;

  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: W, height: H } });
    await p.setContent(html, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    const file = path.join(OUT, `${provincia.toLowerCase()}.jpg`);
    await p.screenshot({ path: file, type: 'jpeg', quality: 94 });
    console.log(file);
  } finally { await browser.close(); }
}

// Esegui main solo se lanciato direttamente (non quando importato dall'anteprima).
if (process.argv[1] && process.argv[1].endsWith('manifesto.js')) {
  main().catch((e) => { console.error(`Errore: ${e.message}`); process.exit(1); });
}

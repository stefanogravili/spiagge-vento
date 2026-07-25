// Genera la copertina della Pagina Facebook, nello stile della carta del vento.
//
// La copertina viene ritagliata in modo diverso su computer e telefono: il PC
// taglia sopra e sotto, il telefono taglia i lati. Per questo tutto cio' che
// conta sta in una fascia centrale sicura, e ai bordi c'e' solo texture.

import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(RADICE, 'out', 'cover');

// 1640x624 e' il doppio della misura mostrata su desktop (820x312): resa nitida.
const LARGHEZZA = 1640;
const ALTEZZA = 624;

const CARTA = '#E3DED0';
const INCHIOSTRO = '#16232E';
const SEGNALE = '#DA3F1F';
const SOLE = '#F4A93C';
const MARE = '#1F6E7A';

const FONT = [
  { famiglia: 'Anton', peso: 400, file: 'anton-400.woff2' },
  { famiglia: 'Plex Mono', peso: 400, file: 'plexmono-400.woff2' },
  { famiglia: 'Plex Mono', peso: 600, file: 'plexmono-600.woff2' },
];

async function regoleFont() {
  const regole = await Promise.all(
    FONT.map(async ({ famiglia, peso, file }) => {
      const dati = await readFile(path.join(RADICE, 'assets', 'font', file));
      return `@font-face{font-family:'${famiglia}';font-weight:${peso};font-style:normal;` +
        `src:url(data:font/woff2;base64,${dati.toString('base64')}) format('woff2');}`;
    })
  );
  return regole.join('\n');
}

/** Contorno della Puglia adattato a un riquadro. */
async function pathPuglia(box) {
  const { puglia: anelli } = JSON.parse(
    await readFile(path.join(RADICE, 'data', 'coste.json'), 'utf8')
  );
  const K = Math.cos((40.9 * Math.PI) / 180);
  const punti = anelli[0].map(([lon, lat]) => [lon * K, -lat]);
  const xs = punti.map((p) => p[0]);
  const ys = punti.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = Math.min(box.w / (maxX - minX), box.h / (maxY - minY));
  const offX = box.x + (box.w - (maxX - minX) * s) / 2;
  const offY = box.y + (box.h - (maxY - minY) * s) / 2;
  return punti
    .map(([x, y], i) => `${i ? 'L' : 'M'}${((x - minX) * s + offX).toFixed(1)} ${((y - minY) * s + offY).toFixed(1)}`)
    .join('') + 'Z';
}

/** Filetti di flusso diagonali, come sulla carta: danno il senso del vento. */
function flusso() {
  const rad = (28 * Math.PI) / 180; // da NO verso SE
  const dx = Math.cos(rad), dy = Math.sin(rad);
  const px = -dy, py = dx;
  const seg = [];
  for (let i = -20; i <= 20; i++) {
    const ox = LARGHEZZA / 2 + px * i * 46;
    const oy = ALTEZZA / 2 + py * i * 46;
    const L = 2600;
    seg.push(
      `<line x1="${(ox - dx * L).toFixed(0)}" y1="${(oy - dy * L).toFixed(0)}" ` +
      `x2="${(ox + dx * L).toFixed(0)}" y2="${(oy + dy * L).toFixed(0)}"/>`
    );
  }
  return seg.join('');
}

async function html() {
  const [font, dPuglia] = await Promise.all([
    regoleFont(),
    pathPuglia({ x: LARGHEZZA - 470, y: 70, w: 420, h: 460 }),
  ]);

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${font}
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:${LARGHEZZA}px;height:${ALTEZZA}px;background:${CARTA};
         font-family:'Plex Mono',monospace;color:${INCHIOSTRO};overflow:hidden;position:relative}
    .grana{position:absolute;inset:0;opacity:.14;mix-blend-mode:multiply}
    svg.mappa{position:absolute;inset:0}
    .contenuto{position:absolute;inset:0;display:flex;flex-direction:column;
               justify-content:center;padding-left:96px;z-index:2}
    .eyebrow{font-size:22px;font-weight:600;letter-spacing:.28em;text-transform:uppercase;
             color:${MARE};margin-bottom:18px}
    h1{font-family:Anton,sans-serif;font-weight:400;font-size:118px;line-height:.86;
       text-transform:uppercase;letter-spacing:.01em}
    h1 em{font-style:normal;color:${SEGNALE}}
    .tag{margin-top:24px;font-size:25px;letter-spacing:.02em;max-width:720px;line-height:1.4}
    .bordo{position:absolute;inset:18px;border:2px solid ${INCHIOSTRO};z-index:3;pointer-events:none}
    .fascia{position:absolute;left:0;right:0;bottom:18px;height:10px;
            background:${SOLE};z-index:1}
  </style></head><body>
    <svg class="mappa" viewBox="0 0 ${LARGHEZZA} ${ALTEZZA}">
      <g stroke="${SEGNALE}" stroke-width="1.4" opacity=".16">${flusso()}</g>
      <path d="${dPuglia}" fill="none" stroke="${INCHIOSTRO}" stroke-width="2.5" opacity=".30"/>
    </svg>
    <div class="fascia"></div>
    <div class="contenuto">
      <div class="eyebrow">Carta del vento · bollettino giornaliero</div>
      <h1>Mare<br><em>calmo</em> Puglia</h1>
      <div class="tag">Ogni mattina le spiagge pi&ugrave; riparate dal vento, calcolate sui dati del giorno.</div>
    </div>
    <div class="bordo"></div>
    <svg class="grana" width="${LARGHEZZA}" height="${ALTEZZA}" preserveAspectRatio="none">
      <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/></filter>
      <rect width="${LARGHEZZA}" height="${ALTEZZA}" filter="url(#g)"/>
    </svg>
  </body></html>`;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const pagina = await browser.newPage({ viewport: { width: LARGHEZZA, height: ALTEZZA } });
    await pagina.setContent(await html(), { waitUntil: 'load' });
    await pagina.evaluate(() => document.fonts.ready);
    await pagina.screenshot({ path: path.join(OUT, 'marecalmo-copertina.jpg'), type: 'jpeg', quality: 94 });
    console.log('out/cover/marecalmo-copertina.jpg');
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`Errore: ${e.message}`);
  process.exit(1);
});

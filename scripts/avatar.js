// Genera le proposte di foto profilo e un provino per giudicarle.
//
// Vincolo dominante: nel feed l'avatar e' un cerchio da circa 40 px. Tutto cio'
// che non sopravvive a quella dimensione e' decorazione inutile. Per questo il
// provino affianca sempre la versione grande e quella minuscola: la seconda e'
// l'unica che conta davvero.
//
// Direzione: la sagoma della Puglia come emblema da viaggio, che porta dentro
// sole, mare e vento invece di essere una silhouette piatta.

import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(RADICE, 'out', 'avatar');
const LATO = 1080;

// Palette: le tinte della carta piu' un sole caldo e un mare, per evocare la
// giornata di spiaggia restando coerenti con l'identita' dei post.
const SABBIA = '#EDE4D2';
const INCHIOSTRO = '#16232E';
const SEGNALE = '#DA3F1F';
const SOLE = '#F4A93C';
const MARE = '#1F6E7A';

/**
 * Costruisce il path della Puglia adattato a un riquadro, restituendo anche
 * la funzione di proiezione per posizionarci sopra altri elementi.
 */
async function formaPuglia(box) {
  const { puglia: anelli } = JSON.parse(
    await readFile(path.join(RADICE, 'data', 'coste.json'), 'utf8')
  );
  const anello = anelli[0];
  const K = Math.cos((40.9 * Math.PI) / 180);
  const punti = anello.map(([lon, lat]) => [lon * K, -lat]);
  const xs = punti.map((p) => p[0]);
  const ys = punti.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = Math.min(box.w / (maxX - minX), box.h / (maxY - minY));
  const offX = box.x + (box.w - (maxX - minX) * s) / 2;
  const offY = box.y + (box.h - (maxY - minY) * s) / 2;
  // I punti sono gia' proiettati in [lon*K, -lat]: qui si scala e trasla soltanto.
  const d = punti
    .map(([x, y], i) => `${i ? 'L' : 'M'}${((x - minX) * s + offX).toFixed(2)} ${((y - minY) * s + offY).toFixed(2)}`)
    .join('') + 'Z';
  return { d };
}

const cerchio = (colore) => `<circle cx="50" cy="50" r="50" fill="${colore}"/>`;

/* B1 — Sole e costa
   Grande sole caldo che sorge dietro la sagoma, tre onde alla base. La Puglia
   resta protagonista ma dentro una scena di giornata di mare. */
async function sole() {
  const { d } = await formaPuglia({ x: 20, y: 24, w: 60, h: 60 });
  return `
<svg viewBox="0 0 100 100" width="${LATO}" height="${LATO}">
  ${cerchio(SABBIA)}
  <circle cx="50" cy="46" r="30" fill="${SOLE}"/>
  <g stroke="${MARE}" stroke-width="3.4" stroke-linecap="round">
    <line x1="16" y1="83" x2="84" y2="83"/>
    <line x1="24" y1="91" x2="76" y2="91"/>
  </g>
  <path d="${d}" fill="${INCHIOSTRO}"/>
</svg>`;
}

/* B2 — Tramonto
   Cielo e mare in due bande calde, il sole basso sull'orizzonte, la Puglia
   come profilo scuro in controluce. Una sola scena, molto evocativa. */
async function tramonto() {
  const { d } = await formaPuglia({ x: 18, y: 20, w: 64, h: 62 });
  return `
<svg viewBox="0 0 100 100" width="${LATO}" height="${LATO}">
  <defs>
    <clipPath id="tondo"><circle cx="50" cy="50" r="50"/></clipPath>
  </defs>
  <g clip-path="url(#tondo)">
    <rect width="100" height="63" fill="${SOLE}"/>
    <rect y="63" width="100" height="37" fill="${MARE}"/>
    <circle cx="50" cy="52" r="34" fill="#F7C35B"/>
    <g stroke="${SABBIA}" stroke-width="2.2" stroke-linecap="round" opacity=".7">
      <line x1="30" y1="78" x2="70" y2="78"/>
      <line x1="38" y1="86" x2="62" y2="86"/>
    </g>
    <path d="${d}" fill="${INCHIOSTRO}"/>
  </g>
</svg>`;
}

/* B3 — Emblema
   Targa da viaggio: fondo scuro, sole raggiante dietro la sagoma in colore
   sabbia, onde in basso, anello di bordo. Massima riconoscibilita'. */
async function emblema() {
  const { d } = await formaPuglia({ x: 24, y: 26, w: 52, h: 54 });
  const raggi = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    const x1 = 50 + Math.cos(a) * 22, y1 = 46 + Math.sin(a) * 22;
    const x2 = 50 + Math.cos(a) * 30, y2 = 46 + Math.sin(a) * 30;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }).join('');
  return `
<svg viewBox="0 0 100 100" width="${LATO}" height="${LATO}">
  ${cerchio(INCHIOSTRO)}
  <g stroke="${SOLE}" stroke-width="2.6" stroke-linecap="round">${raggi}</g>
  <circle cx="50" cy="46" r="21" fill="${SOLE}"/>
  <g stroke="${SEGNALE}" stroke-width="3" stroke-linecap="round">
    <line x1="20" y1="84" x2="80" y2="84"/>
    <line x1="28" y1="91" x2="72" y2="91"/>
  </g>
  <path d="${d}" fill="${SABBIA}"/>
  <circle cx="50" cy="50" r="47.5" fill="none" stroke="${SOLE}" stroke-width="2"/>
</svg>`;
}

const PROVE = [
  { id: 'sole', nome: 'B1 — Sole e costa', svg: sole },
  { id: 'tramonto', nome: 'B2 — Tramonto', svg: tramonto },
  { id: 'emblema', nome: 'B3 — Emblema', svg: emblema },
];

/** Affianca ogni proposta grande e alle dimensioni reali del feed. */
function provino(varianti) {
  const righe = varianti.map(({ nome, markup }) => `
    <div class="riga">
      <div class="grande">${markup}</div>
      <div class="piccoli">
        <div><span>150 px — profilo</span>${markup}</div>
        <div class="p56"><span>56 px — storie</span>${markup}</div>
        <div class="p40"><span>40 px — feed</span>${markup}</div>
      </div>
      <div class="nome">${nome}</div>
    </div>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:1000px;background:#fff;font:13px/1.4 ui-monospace,monospace;color:#333;padding:36px}
    .riga{display:flex;align-items:center;gap:36px;padding:26px 0;border-bottom:1px solid #ddd}
    .riga:last-child{border:none}
    svg{display:block;border-radius:50%}
    .grande svg{width:190px;height:190px}
    .piccoli{display:flex;gap:30px;align-items:flex-end}
    .piccoli span{display:block;margin-bottom:8px;color:#999;font-size:10px;letter-spacing:.04em}
    .piccoli svg{width:150px;height:150px}
    .p56 svg{width:56px;height:56px}
    .p40 svg{width:40px;height:40px}
    .nome{margin-left:auto;font-weight:700;font-size:15px;white-space:nowrap}
  </style></head><body>${righe}</body></html>`;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const varianti = [];
  for (const p of PROVE) varianti.push({ ...p, markup: await p.svg() });

  const browser = await chromium.launch();
  try {
    for (const v of varianti) {
      const pagina = await browser.newPage({ viewport: { width: LATO, height: LATO } });
      await pagina.setContent(`<body style="margin:0">${v.markup}</body>`, { waitUntil: 'load' });
      await pagina.screenshot({ path: path.join(OUT, `avatar-${v.id}.png`), type: 'png' });
      await pagina.close();
      console.log(`avatar-${v.id}.png`);
    }

    const pagina = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    await pagina.setContent(provino(varianti), { waitUntil: 'load' });
    await pagina.screenshot({ path: path.join(OUT, 'provino.png'), type: 'png', fullPage: true });
    console.log('provino.png');
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`Errore: ${e.message}`);
  process.exit(1);
});

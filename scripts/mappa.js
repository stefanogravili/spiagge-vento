// BOZZA di un nuovo formato: mappa di zona con ogni spiaggia etichettata
// CALMO / MOSSO al suo posto reale sulla costa. Nasce dal confronto con la
// pagina concorrente: stessa idea, ma costa vera, vento in evidenza, zero caos.
//
// Uso: node scripts/mappa.js "Ionio salentino"

import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { condizioniGiornata } from '../src/weather.js';
import { valuta } from '../src/score.js';
import { cardinale, nomeVento } from '../src/geo.js';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(RADICE, 'out', 'mappa');
const W = 1080, H = 1920;

// Palette calda ma pulita: mare turchese, sabbia, due segnali netti.
const MARE1 = '#33BEC6', MARE2 = '#178C99';
const SABBIA1 = '#F0E4CA', SABBIA2 = '#E6D4AC';
const INCHIOSTRO = '#123039';
const CALMO = '#1F9D57', POCO = '#E8912E', MOSSO = '#E24E2B';

const K = Math.cos((40.4 * Math.PI) / 180);
const proiettaGrezzo = ([lon, lat]) => [lon * K, -lat];

async function fontCss() {
  const f = [
    ['Anton', 400, 'anton-400.woff2'],
    ['Plex Mono', 400, 'plexmono-400.woff2'],
    ['Plex Mono', 600, 'plexmono-600.woff2'],
  ];
  const regole = await Promise.all(
    f.map(async ([fam, peso, file]) => {
      const dati = await readFile(path.join(RADICE, 'assets', 'font', file));
      return `@font-face{font-family:'${fam}';font-weight:${peso};font-style:normal;` +
        `src:url(data:font/woff2;base64,${dati.toString('base64')}) format('woff2')}`;
    })
  );
  return regole.join('\n');
}

function dataEstesa(iso) {
  const d = new Date(`${iso}T12:00:00`);
  const s = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function main() {
  const zona = process.argv[2] || 'Ionio salentino';
  const regione = JSON.parse(await readFile(path.join(RADICE, 'data', 'puglia.json'), 'utf8'));
  const coste = JSON.parse(await readFile(path.join(RADICE, 'data', 'coste.json'), 'utf8'));

  const spiagge = regione.spiagge.filter((s) => s.zona === zona);
  if (!spiagge.length) throw new Error(`Nessuna spiaggia nella zona "${zona}"`);

  console.log(`Scarico i dati per ${spiagge.length} spiagge in ${zona}...`);
  const valutate = (await condizioniGiornata(spiagge, regione.fuso)).map(valuta);
  const data = valutate[0].dataRiferimento;

  // Vento dominante della zona (media vettoriale gia' fatta a monte per spiaggia).
  const ventoMedioDir = (() => {
    let x = 0, y = 0;
    for (const s of valutate) { x += Math.cos(s.ventoDa * Math.PI / 180); y += Math.sin(s.ventoDa * Math.PI / 180); }
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  })();
  const ventoNodi = Math.round(valutate.reduce((a, s) => a + s.ventoNodi, 0) / valutate.length);

  // --- Proiezione: si inquadra la zona nel pannello-mappa a sinistra ---
  const MAPPA = { x: 0, y: 470, w: 500, h: 1290, pad: 90 };
  const pts = valutate.map((s) => proiettaGrezzo([s.lon, s.lat]));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  let minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  const scala = Math.min(
    (MAPPA.w - MAPPA.pad * 2) / (maxX - minX || 0.01),
    (MAPPA.h - MAPPA.pad * 2) / (maxY - minY || 0.01)
  );
  const offX = MAPPA.x + (MAPPA.w - (maxX - minX) * scala) / 2;
  const offY = MAPPA.y + (MAPPA.h - (maxY - minY) * scala) / 2;
  const proietta = ([lon, lat]) => {
    const [gx, gy] = proiettaGrezzo([lon, lat]);
    return [(gx - minX) * scala + offX, (gy - minY) * scala + offY];
  };

  const percorso = (anello) =>
    anello.map((p, i) => (i ? 'L' : 'M') + proietta(p).map((n) => n.toFixed(1)).join(' ')).join('') + 'Z';
  const terra = [...coste.puglia, ...coste.contorno].map((a) => `<path d="${percorso(a)}"/>`).join('');

  // --- Etichette: colonna a destra, ordinata da nord a sud, senza sovrapposizioni ---
  const nodi = valutate
    .map((s) => ({ s, punto: proietta([s.lon, s.lat]) }))
    .sort((a, b) => a.punto[1] - b.punto[1]);

  const RIGA = 78, TOP = 480, BOT = H - 150;
  let y = TOP;
  for (const n of nodi) {
    y = Math.max(y, n.punto[1]);      // parte dalla latitudine reale...
    n.etY = y;
    y += RIGA;                         // ...poi scala per non accavallare
  }
  // Se sfora in basso, ricompatta verso l'alto.
  const extra = y - RIGA - BOT;
  if (extra > 0) nodi.forEach((n) => { n.etY -= extra * (nodi.indexOf(n) / nodi.length); });

  // Tre livelli, come la pagina migliore del concorrente ma con soglie coerenti
  // col nostro punteggio (che tiene conto di vento, onda e raffiche).
  const livelloTag = (p) =>
    p >= 70 ? { t: 'CALMO', c: CALMO } :
    p >= 45 ? { t: 'POCO MOSSO', c: POCO } :
              { t: 'MOSSO', c: MOSSO };

  const etichette = nodi.map((n) => {
    const [px, py] = n.punto;
    const { t: stato, c: col } = livelloTag(n.s.punteggio);
    const wTag = Math.round(28 + stato.length * 13.5); // pillola a misura del testo
    const lx = 540;
    return `
      <line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${lx - 14}" y2="${n.etY.toFixed(1)}"
            stroke="${col}" stroke-width="2.5"/>
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6" fill="${col}" stroke="#fff" stroke-width="2"/>
      <g transform="translate(${lx}, ${(n.etY - 26).toFixed(1)})">
        <rect width="${wTag}" height="40" rx="8" fill="${col}"/>
        <text x="${wTag / 2}" y="27" text-anchor="middle" fill="#fff"
              font-family="Plex Mono" font-weight="600" font-size="21">${stato}</text>
        <text x="${wTag + 14}" y="27" fill="${INCHIOSTRO}"
              font-family="Plex Mono" font-weight="600" font-size="27">${n.s.nome}</text>
      </g>`;
  }).join('');

  const font = await fontCss();
  const gradiFreccia = (ventoMedioDir + 180) % 360;

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    ${font}
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:${W}px;height:${H}px;font-family:'Plex Mono',monospace;color:${INCHIOSTRO};overflow:hidden;position:relative}
    .bg{position:absolute;inset:0;background:linear-gradient(160deg,${SABBIA1},${SABBIA2})}
    .grana{position:absolute;inset:0;opacity:.10;mix-blend-mode:multiply}
    .testata{position:absolute;top:0;left:0;right:0;height:430px;padding:70px 64px 0}
    .kick{font-size:24px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:${MARE2}}
    h1{font-family:Anton,sans-serif;font-weight:400;font-size:120px;line-height:.86;text-transform:uppercase;margin-top:10px}
    .data{margin-top:16px;font-size:26px;letter-spacing:.04em}
    .vento{position:absolute;top:74px;right:64px;display:flex;align-items:center;gap:16px;
           background:rgba(18,48,57,.06);border:1.5px solid rgba(18,48,57,.18);border-radius:16px;padding:14px 20px}
    .vento .n{font-family:Anton,sans-serif;font-size:34px;line-height:.9;color:${MOSSO}}
    .vento .d{font-size:16px;letter-spacing:.03em}
    .legenda{position:absolute;left:64px;bottom:54px;display:flex;gap:26px;font-size:20px;font-weight:600}
    .legenda i{display:inline-block;width:20px;height:20px;border-radius:5px;vertical-align:-3px;margin-right:9px}
    .brand{position:absolute;right:64px;bottom:54px;font-size:22px;font-weight:600;letter-spacing:.04em;color:${INCHIOSTRO}}
  </style></head><body>
    <div class="bg"></div>
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0">
      <defs>
        <linearGradient id="mare" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${MARE1}"/><stop offset="1" stop-color="${MARE2}"/>
        </linearGradient>
        <clipPath id="pannello"><rect x="0" y="430" width="560" height="${H - 430}"/></clipPath>
      </defs>
      <g clip-path="url(#pannello)">
        <rect x="0" y="430" width="560" height="${H - 430}" fill="url(#mare)"/>
        <g fill="${SABBIA2}" stroke="${INCHIOSTRO}" stroke-width="2.5" stroke-linejoin="round">${terra}</g>
        <g stroke="#fff" stroke-width="2" opacity=".22">
          ${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${520 + i * 150}" x2="560" y2="${540 + i * 150}"/>`).join('')}
        </g>
      </g>
      ${etichette}
    </svg>
    <div class="testata">
      <div class="kick">Mare calmo · ${regione.regione}</div>
      <h1>${zona.replace(/ /g, '<br>')}</h1>
      <div class="data">${dataEstesa(data)}</div>
    </div>
    <div class="vento">
      <svg width="42" height="42" viewBox="-21 -21 42 42">
        <g transform="rotate(${gradiFreccia.toFixed(0)})" stroke="${INCHIOSTRO}" stroke-width="3" fill="none" stroke-linecap="round">
          <line x1="0" y1="15" x2="0" y2="-15"/><path d="M-6 -8 L0 -16 L6 -8"/>
        </g>
      </svg>
      <div><div class="n">${nomeVento(ventoMedioDir)}</div><div class="d">${ventoNodi} nodi da ${cardinale(ventoMedioDir)}</div></div>
    </div>
    <div class="legenda">
      <span><i style="background:${CALMO}"></i>Calmo</span>
      <span><i style="background:${POCO}"></i>Poco mosso</span>
      <span><i style="background:${MOSSO}"></i>Mosso</span>
    </div>
    <div class="brand">@${regione.account.replace('@', '')}</div>
    <svg class="grana" width="${W}" height="${H}" preserveAspectRatio="none">
      <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/></filter>
      <rect width="${W}" height="${H}" filter="url(#g)"/>
    </svg>
  </body></html>`;

  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const pagina = await browser.newPage({ viewport: { width: W, height: H } });
    await pagina.setContent(html, { waitUntil: 'load' });
    await pagina.evaluate(() => document.fonts.ready);
    const file = path.join(OUT, `${zona.replace(/ /g, '-').toLowerCase()}.jpg`);
    await pagina.screenshot({ path: file, type: 'jpeg', quality: 94 });
    console.log(file);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(`Errore: ${e.message}`); process.exit(1); });

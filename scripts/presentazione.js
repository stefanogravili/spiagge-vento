// Post + storia di presentazione della pagina, nello stile cartoon.
// Uso: node scripts/presentazione.js

import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(RADICE, 'out', 'presentazione');

const SKY1 = '#AEE3F0', SKY2 = '#D6F2F8';
const SEA = '#38B9C7', SEA_D = '#2A9DAB';
const SAND = '#F5DA92';
const INK = '#243b44';
const VERDE = '#34C759', GIALLO = '#FFC53D', ROSSO = '#FF5B4C', SOLE = '#FFCB3B';

async function fontCss() {
  const f = [['Fredoka', 500, 'fredoka-500.woff2'], ['Fredoka', 700, 'fredoka-700.woff2']];
  const out = await Promise.all(f.map(async ([fam, peso, file]) => {
    const dati = await readFile(path.join(RADICE, 'assets', 'font', file));
    return `@font-face{font-family:'${fam}';font-weight:${peso};font-style:normal;src:url(data:font/woff2;base64,${dati.toString('base64')}) format('woff2')}`;
  }));
  return out.join('\n');
}

function sole(cx, cy, r) {
  const raggi = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30) * Math.PI / 180;
    return `<line x1="${cx + Math.cos(a) * (r + 8)}" y1="${cy + Math.sin(a) * (r + 8)}" x2="${cx + Math.cos(a) * (r + 28)}" y2="${cy + Math.sin(a) * (r + 28)}" stroke="${SOLE}" stroke-width="10" stroke-linecap="round"/>`;
  }).join('');
  return `${raggi}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${SOLE}" stroke="${INK}" stroke-width="6"/>
    <circle cx="${cx - r * 0.32}" cy="${cy - r * 0.12}" r="7" fill="${INK}"/>
    <circle cx="${cx + r * 0.32}" cy="${cy - r * 0.12}" r="7" fill="${INK}"/>
    <path d="M${cx - r * 0.36} ${cy + r * 0.22} Q ${cx} ${cy + r * 0.62} ${cx + r * 0.36} ${cy + r * 0.22}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
}

function componi(W, H) {
  const cx = W / 2;
  const onde = Array.from({ length: 5 }, (_, i) =>
    `<path d="M0 ${H - 300 + i * 70} q ${W / 4} -40 ${W / 2} 0 t ${W / 2} 0 V ${H} H0 Z" fill="${i % 2 ? SEA_D : SEA}" opacity="${0.5 + i * 0.1}"/>`
  ).join('');

  // Tutto in proporzione all'altezza, cosi' funziona sia feed (1350) sia storia (1920).
  const cardY = H * 0.575, cardH = H * 0.235;
  const riga = (y, col, titolo, testo) => `
    <circle cx="${cx - 330}" cy="${y}" r="24" fill="${col}" stroke="${INK}" stroke-width="5"/>
    <text x="${cx - 288}" y="${y - 2}" font-family="Fredoka" font-weight="700" font-size="38" fill="${INK}">${titolo}</text>
    <text x="${cx - 288}" y="${y + 36}" font-family="Fredoka" font-weight="500" font-size="28" fill="${INK}" opacity=".75">${testo}</text>`;

  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SKY1}"/><stop offset="1" stop-color="${SKY2}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${onde}
    ${sole(cx, H * 0.17, 88)}
    <text x="${cx}" y="${H * 0.37}" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="126" fill="${INK}">Mare Calmo</text>
    <text x="${cx}" y="${H * 0.435}" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="82" fill="${SEA_D}">PUGLIA</text>
    <text x="${cx}" y="${H * 0.5}" text-anchor="middle" font-family="Fredoka" font-weight="500" font-size="38" fill="${INK}">Dove fare il bagno col mare piatto,</text>
    <text x="${cx}" y="${H * 0.535}" text-anchor="middle" font-family="Fredoka" font-weight="500" font-size="38" fill="${INK}">provincia per provincia.</text>

    <rect x="${cx - 400}" y="${cardY}" width="800" height="${cardH}" rx="40" fill="#fff" stroke="${INK}" stroke-width="6"/>
    ${riga(cardY + cardH * 0.28, VERDE, 'Calmo', 'mare piatto, bagno perfetto')}
    ${riga(cardY + cardH * 0.55, GIALLO, 'Mosso', 'qualche onda, ma si sta')}
    ${riga(cardY + cardH * 0.82, ROSSO, 'Molto mosso', 'meglio un altro giorno')}

    <text x="${cx}" y="${H * 0.885}" text-anchor="middle" font-family="Fredoka" font-weight="500" font-size="33" fill="#fff">Calcolato sul vento e sulle onde reali</text>
    <text x="${cx}" y="${H * 0.918}" text-anchor="middle" font-family="Fredoka" font-weight="500" font-size="33" fill="#fff">Ogni sera, il mare del giorno dopo</text>
    <text x="${cx}" y="${H * 0.965}" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="50" fill="#fff">@marecalmo.puglia</text>
  </svg>`;
}

async function main() {
  const font = await fontCss();
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [nome, W, H] of [['feed', 1080, 1350], ['storia', 1080, 1920]]) {
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>${font}*{margin:0;padding:0}</style></head><body style="margin:0">${componi(W, H)}</body></html>`;
      const p = await browser.newPage({ viewport: { width: W, height: H } });
      await p.setContent(html, { waitUntil: 'load' });
      await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: path.join(OUT, `presentazione-${nome}.jpg`), type: 'jpeg', quality: 94 });
      await p.close();
      console.log(`presentazione-${nome}.jpg`);
    }
  } finally { await browser.close(); }
}

main().catch((e) => { console.error(`Errore: ${e.message}`); process.exit(1); });

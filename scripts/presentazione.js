// Post + storia di presentazione della pagina — stile premium (Inter, minimal).
// Uso: node scripts/presentazione.js

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fontCssInter, logoMark } from './premium.js';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(RADICE, 'out', 'presentazione');
const W = 1080, M = 80;

const BG = '#F7F3EC', INK = '#1F2E3A', MUTED = '#6A7782', HAIR = '#E4DCCB';
const VERDE = '#3BB273', GIALLO = '#E8B23E', ROSSO = '#E1614A';

function componi(H) {
  const storia = H > 1400;
  const topY = storia ? 300 : 150;
  const cardY = storia ? 1120 : 800;
  const cardH = 300;
  const riga = (y, col, titolo, testo) => `
    <circle cx="${M + 52}" cy="${y}" r="13" fill="${col}"/>
    <text x="${M + 84}" y="${y + 8}" font-family="Inter" font-weight="700" font-size="34" fill="${INK}">${titolo}</text>
    <text x="${W - M - 30}" y="${y + 8}" text-anchor="end" font-family="Inter" font-weight="500" font-size="26" fill="${MUTED}">${testo}</text>`;

  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#49B8C7"/><stop offset="1" stop-color="#177A8A"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="${BG}"/>

    ${logoMark(M, topY, 56)}
    <text x="${M}" y="${topY + 130}" font-family="Inter" font-weight="700" font-size="21" letter-spacing="2" fill="${MUTED}">MARE CALMO PUGLIA</text>

    <text x="${M}" y="${topY + 250}" font-family="Inter" font-weight="800" font-size="86" letter-spacing="-3" fill="${INK}">Dove fare il bagno,</text>
    <text x="${M}" y="${topY + 344}" font-family="Inter" font-weight="800" font-size="86" letter-spacing="-3" fill="${INK}">ogni giorno.</text>
    <text x="${M}" y="${topY + 410}" font-family="Inter" font-weight="500" font-size="30" fill="${MUTED}">Le spiagge col mare più calmo della Puglia,</text>
    <text x="${M}" y="${topY + 452}" font-family="Inter" font-weight="500" font-size="30" fill="${MUTED}">provincia per provincia.</text>

    <text x="${M}" y="${cardY - 20}" font-family="Inter" font-weight="600" font-size="18" letter-spacing="1.2" fill="${MUTED}">COME LEGGERE IL MARE</text>
    <rect x="${M}" y="${cardY}" width="${W - M * 2}" height="${cardH}" rx="22" fill="#FFFFFF" stroke="${HAIR}" stroke-width="1.5"/>
    ${riga(cardY + 66, VERDE, 'Calmo', 'mare piatto, bagno ideale')}
    <line x1="${M + 30}" y1="${cardY + 100}" x2="${W - M - 30}" y2="${cardY + 100}" stroke="${HAIR}" stroke-width="1.5"/>
    ${riga(cardY + 150, GIALLO, 'Poco mosso', 'qualche onda, ma si sta')}
    <line x1="${M + 30}" y1="${cardY + 184}" x2="${W - M - 30}" y2="${cardY + 184}" stroke="${HAIR}" stroke-width="1.5"/>
    ${riga(cardY + 234, ROSSO, 'Mosso', 'meglio un altro giorno')}

    <text x="${M}" y="${H - 128}" font-family="Inter" font-weight="500" font-size="26" fill="${MUTED}">Calcolato sul vento e sulle onde reali. Ogni sera, il mare del giorno dopo.</text>
    <text x="${M}" y="${H - 68}" font-family="Inter" font-weight="700" font-size="30" fill="${INK}">@marecalmo.puglia</text>
  </svg>`;
}

async function main() {
  const font = await fontCssInter();
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [nome, H] of [['feed', 1350], ['storia', 1920]]) {
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>${font}*{margin:0;padding:0}</style></head><body style="margin:0">${componi(H)}</body></html>`;
      const p = await browser.newPage({ viewport: { width: W, height: H } });
      await p.setContent(html, { waitUntil: 'load' });
      await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: path.join(OUT, `presentazione-${nome}.jpg`), type: 'jpeg', quality: 95 });
      await p.close();
      console.log(`presentazione-${nome}.jpg`);
    }
  } finally { await browser.close(); }
}

main().catch((e) => { console.error(`Errore: ${e.message}`); process.exit(1); });

// Genera in un colpo solo le tavole cartoon di tutte le province.
// Lecce e' divisa nelle due coste (adriatica e ionica) per restare leggibile.
//
// Uso: node scripts/province-tutte.js

import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { provinciaDi } from '../src/province.js';
import { preparaDati } from './manifesto.js';
import { componiHtmlCartone } from './cartone.js';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(RADICE, 'out', 'cartone');

const TARGET = [
  { key: 'foggia', titolo: 'Foggia', eyebrow: 'MARE CALMO · PUGLIA', sottotitolo: 'Dove fare il bagno', sel: (s) => provinciaDi(s.comune) === 'Foggia' },
  { key: 'bari', titolo: 'Bari', eyebrow: 'MARE CALMO · PUGLIA', sottotitolo: 'Dove fare il bagno', sel: (s) => provinciaDi(s.comune) === 'Bari' },
  { key: 'brindisi', titolo: 'Brindisi', eyebrow: 'MARE CALMO · PUGLIA', sottotitolo: 'Dove fare il bagno', sel: (s) => provinciaDi(s.comune) === 'Brindisi' },
  { key: 'taranto', titolo: 'Taranto', eyebrow: 'MARE CALMO · PUGLIA', sottotitolo: 'Dove fare il bagno', sel: (s) => provinciaDi(s.comune) === 'Taranto' },
  { key: 'lecce-adriatico', titolo: 'Lecce', eyebrow: 'MARE CALMO · SALENTO', sottotitolo: 'Costa adriatica', sel: (s) => provinciaDi(s.comune) === 'Lecce' && s.facing < 180 },
  { key: 'lecce-ionio', titolo: 'Lecce', eyebrow: 'MARE CALMO · SALENTO', sottotitolo: 'Costa ionica', sel: (s) => provinciaDi(s.comune) === 'Lecce' && s.facing >= 180 },
];

async function main() {
  const regione = JSON.parse(await readFile(path.join(RADICE, 'data', 'puglia.json'), 'utf8'));
  const coste = JSON.parse(await readFile(path.join(RADICE, 'data', 'coste.json'), 'utf8'));
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const t of TARGET) {
      const spiagge = regione.spiagge.filter(t.sel);
      if (!spiagge.length) { console.warn(`(salto ${t.key}: nessuna spiaggia)`); continue; }
      console.log(`${t.key}: ${spiagge.length} spiagge...`);
      const dati = await preparaDati(spiagge, regione.fuso, 1); // domani
      const html = await componiHtmlCartone({
        titolo: t.titolo, eyebrow: t.eyebrow, sottotitolo: t.sottotitolo,
        ...dati, coste, account: regione.account,
      });
      const p = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
      await p.setContent(html, { waitUntil: 'load' });
      await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: path.join(OUT, `${t.key}.jpg`), type: 'jpeg', quality: 94 });
      await p.close();
    }
  } finally { await browser.close(); }
  console.log('Fatto. Immagini in out/cartone/');
}

main().catch((e) => { console.error(`Errore: ${e.message}`); process.exit(1); });

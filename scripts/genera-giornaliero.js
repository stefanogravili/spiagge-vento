// Agente orchestratore: genera le immagini del giorno dopo (6 storie provincia
// + 1 post meteo feed), le mette in media/ e scrive out/manifest.json con la
// lista di cosa pubblicare. Non pubblica: lo fa pubblica-giornaliero.js.
//
// Uso: node scripts/genera-giornaliero.js

import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { provinciaDi } from '../src/province.js';
import { cardinale, nomeVento } from '../src/geo.js';
import { preparaDati } from './manifesto.js';
import { componiHtmlCartone } from './cartone.js';
import { componiMeteoPost } from './meteo-post.js';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA = path.join(RADICE, 'media');
const OUT = path.join(RADICE, 'out');

// Un target per storia. Lecce e' divisa nelle due coste.
const TARGET = [
  { key: 'foggia', titolo: 'Foggia', label: 'Foggia', eyebrow: 'MARE CALMO · PUGLIA', sottotitolo: 'Dove fare il bagno', sel: (s) => provinciaDi(s.comune) === 'Foggia' },
  { key: 'bari', titolo: 'Bari', label: 'Bari', eyebrow: 'MARE CALMO · PUGLIA', sottotitolo: 'Dove fare il bagno', sel: (s) => provinciaDi(s.comune) === 'Bari' },
  { key: 'brindisi', titolo: 'Brindisi', label: 'Brindisi', eyebrow: 'MARE CALMO · PUGLIA', sottotitolo: 'Dove fare il bagno', sel: (s) => provinciaDi(s.comune) === 'Brindisi' },
  { key: 'taranto', titolo: 'Taranto', label: 'Taranto', eyebrow: 'MARE CALMO · PUGLIA', sottotitolo: 'Dove fare il bagno', sel: (s) => provinciaDi(s.comune) === 'Taranto' },
  { key: 'lecce-adriatico', titolo: 'Lecce', label: 'Lecce Adr.', eyebrow: 'MARE CALMO · SALENTO', sottotitolo: 'Costa adriatica', sel: (s) => provinciaDi(s.comune) === 'Lecce' && s.facing < 180 },
  { key: 'lecce-ionio', titolo: 'Lecce', label: 'Lecce Ion.', eyebrow: 'MARE CALMO · SALENTO', sottotitolo: 'Costa ionica', sel: (s) => provinciaDi(s.comune) === 'Lecce' && s.facing >= 180 },
];

const dominante = (valutate) => {
  const c = { calmo: 0, mosso: 0, moltomosso: 0 };
  for (const s of valutate) c[s.statoMare]++;
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
};

const CAPTION_METEO = (data, tempMax, ventoNome) => [
  `🌡️ Meteo Puglia — ${data}`,
  '',
  `Temperatura fino a ${Math.round(tempMax)}°, vento ${ventoNome}.`,
  'Il mare provincia per provincia: 🟢 calmo · 🟡 mosso · 🔴 molto mosso.',
  'Il dettaglio spiaggia per spiaggia è nelle nostre storie! 📌',
  '',
  '#puglia #meteopuglia #meteo #mare #salento #gargano #marepuglia #spiaggepuglia #vacanzeinpuglia',
].join('\n');

async function renderFile(browser, html, file, w, h) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: file, type: 'jpeg', quality: 94 });
  await p.close();
}

async function main() {
  const regione = JSON.parse(await readFile(path.join(RADICE, 'data', 'puglia.json'), 'utf8'));
  const coste = JSON.parse(await readFile(path.join(RADICE, 'data', 'coste.json'), 'utf8'));
  await mkdir(MEDIA, { recursive: true });
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const manifest = [];
  const righeMeteo = [];
  let tutte = [], data = null;

  try {
    for (const t of TARGET) {
      const spiagge = regione.spiagge.filter(t.sel);
      if (!spiagge.length) continue;
      const dati = await preparaDati(spiagge, regione.fuso, 1); // giorno dopo
      data = dati.data;
      tutte = tutte.concat(dati.valutate);
      righeMeteo.push({ nome: t.label, stato: dominante(dati.valutate) });

      const html = await componiHtmlCartone({
        titolo: t.titolo, eyebrow: t.eyebrow, sottotitolo: t.sottotitolo,
        ...dati, coste, account: regione.account,
      });
      const nome = `giorno-${data}-${t.key}.jpg`;
      await renderFile(browser, html, path.join(MEDIA, nome), 1080, 1920);
      manifest.push({ nome, tipo: 'storia' });
      console.log(`storia ${t.key}`);
    }

    // Post meteo (feed): temperatura max e vento medio sull'intera regione.
    const tempMax = Math.max(...tutte.map((s) => s.temperatura ?? 0));
    let vx = 0, vy = 0;
    for (const s of tutte) { vx += Math.cos(s.ventoDa * Math.PI / 180); vy += Math.sin(s.ventoDa * Math.PI / 180); }
    const ventoGradi = ((Math.atan2(vy, vx) * 180 / Math.PI) + 360) % 360;
    const ventoNodi = Math.round(tutte.reduce((a, s) => a + s.ventoNodi, 0) / tutte.length);

    const htmlMeteo = await componiMeteoPost({
      data, tempMax, ventoNome: nomeVento(ventoGradi), ventoNodi,
      ventoSigla: cardinale(ventoGradi), ventoGradi, righe: righeMeteo, account: regione.account,
    });
    const nomeMeteo = `giorno-${data}-meteo.jpg`;
    await renderFile(browser, htmlMeteo, path.join(MEDIA, nomeMeteo), 1080, 1350);
    manifest.push({ nome: nomeMeteo, tipo: 'feed', caption: CAPTION_METEO(data, tempMax, nomeVento(ventoGradi)) });
    console.log('post meteo');

    // Pulizia: tiene in media/ solo gli ultimi ~40 file datati.
    await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`\nManifest scritto: ${manifest.length} elementi per il ${data}.`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(`Errore: ${e.message}`); process.exit(1); });

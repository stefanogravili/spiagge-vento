// Trasforma i dati in un JPG 1080x1350 pronto per il feed Instagram.
// Si usa un browser headless invece di una libreria grafica perche' il layout
// va iterato spesso: cambiare il post significa cambiare del CSS.

import { chromium } from 'playwright';
import { cardinale } from './geo.js';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Il feed usa il 4:5, il rapporto che occupa piu' schermo fra quelli ammessi.
export const FORMATI = {
  feed: { larghezza: 1080, altezza: 1350 },
  storia: { larghezza: 1080, altezza: 1920 },
};

const FONT = [
  { famiglia: 'Anton', peso: 400, file: 'anton-400.woff2' },
  { famiglia: 'Plex Mono', peso: 400, file: 'plexmono-400.woff2' },
  { famiglia: 'Plex Mono', peso: 600, file: 'plexmono-600.woff2' },
];

/**
 * I font vengono incorporati nel documento come data URI. Caricarli dalla rete
 * significherebbe accettare che un rallentamento di Google Fonts produca uno
 * screenshot con il carattere di ripiego, cioe' un post da buttare.
 */
async function regoleFont() {
  const regole = await Promise.all(
    FONT.map(async ({ famiglia, peso, file }) => {
      const dati = await readFile(path.join(RADICE, 'assets', 'font', file));
      return `@font-face{font-family:'${famiglia}';font-weight:${peso};font-style:normal;font-display:block;` +
        `src:url(data:font/woff2;base64,${dati.toString('base64')}) format('woff2');}`;
    })
  );
  return regole.join('\n');
}

const arrotonda1 = (n) => n.toFixed(1).replace('.', ',');

export async function componiHtml({ regione, account, data, numero, sintesi, top, tutte, vento, formato = 'feed' }) {
  const [template, font, coste] = await Promise.all([
    readFile(path.join(RADICE, 'templates', 'post.html'), 'utf8'),
    regoleFont(),
    readFile(path.join(RADICE, 'data', 'coste.json'), 'utf8').then(JSON.parse),
  ]);

  const dati = {
    regione,
    account,
    data,
    numero,
    vento,
    formato,
    buone: sintesi.buone,
    totale: sintesi.totale,
    coste,
    // Ogni spiaggia rilevata compare come punto minuto sulla carta: mostra
    // su quanti rilevamenti poggia la classifica.
    tutte: tutte.map((s) => [s.lon, s.lat]),
    top: top.map((s) => ({
      nome: s.nome,
      comune: s.comune,
      zona: s.zona,
      lat: s.lat,
      lon: s.lon,
      punteggio: s.punteggio,
      vento: Math.round(s.ventoNodi),
      ventoSigla: s.ventoSigla,
      onda: arrotonda1(s.onda),
      // L'esposizione della costa accanto alla direzione del vento rende
      // leggibile il criterio: il lettore impara la regola, non subisce l'esito.
      esposizione: cardinale(s.facing),
    })),
  };

  return template
    .replace('__FONT__', font)
    .replace('__DATI__', JSON.stringify(dati));
}

/**
 * Genera tutti i formati richiesti in una sola sessione del browser: avviare
 * Chromium costa piu' del rendering stesso.
 */
export async function generaImmagini(opzioni) {
  const { cartellaOutput, nomiFile } = opzioni;
  await mkdir(cartellaOutput, { recursive: true });

  const browser = await chromium.launch();
  try {
    const percorsi = {};
    for (const [formato, nomeFile] of Object.entries(nomiFile)) {
      const { larghezza, altezza } = FORMATI[formato];
      const html = await componiHtml({ ...opzioni, formato });

      const pagina = await browser.newPage({
        viewport: { width: larghezza, height: altezza },
        deviceScaleFactor: 1,
      });
      await pagina.setContent(html, { waitUntil: 'load' });
      await pagina.evaluate(() => document.fonts.ready);

      const percorso = path.join(cartellaOutput, nomeFile);
      await pagina.screenshot({ path: percorso, type: 'jpeg', quality: 94 });
      await pagina.close();
      percorsi[formato] = percorso;
    }
    return percorsi;
  } finally {
    await browser.close();
  }
}

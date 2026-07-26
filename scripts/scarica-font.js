// Scarica i woff2 dei font e li versiona in assets/font/.
// Si lancia una volta sola. I font vengono poi incorporati nel template come
// data URI: se dipendessero dalla rete, un ritardo di Google Fonts produrrebbe
// un post con il carattere di ripiego, cioe' un post da buttare.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARTELLA = path.join(RADICE, 'assets', 'font');

// Serve un UA moderno: con uno vecchio Google Fonts risponde con ttf o woff.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

const FONT = [
  { file: 'anton-400.woff2', css: 'family=Anton' },
  { file: 'plexmono-400.woff2', css: 'family=IBM+Plex+Mono:wght@400' },
  { file: 'plexmono-600.woff2', css: 'family=IBM+Plex+Mono:wght@600' },
  // Per il manifesto vintage: display da poster + serif caldo per i nomi.
  { file: 'bebas-400.woff2', css: 'family=Bebas+Neue' },
  { file: 'spectral-400.woff2', css: 'family=Spectral:wght@400' },
  { file: 'spectral-600.woff2', css: 'family=Spectral:wght@600' },
  { file: 'spectral-italic.woff2', css: 'family=Spectral:ital,wght@1,500' },
  // Per la versione cartoon: font tondo e giocoso.
  { file: 'fredoka-500.woff2', css: 'family=Fredoka:wght@500' },
  { file: 'fredoka-700.woff2', css: 'family=Fredoka:wght@700' },
];

async function scarica({ file, css }) {
  const foglio = await (
    await fetch(`https://fonts.googleapis.com/css2?${css}&display=swap`, {
      headers: { 'User-Agent': UA },
    })
  ).text();

  // Si prende l'ultimo blocco latin: e' quello senza estensioni, il piu' leggero.
  const blocchi = foglio.split('@font-face').filter((b) => b.includes('U+0000-00FF'));
  const url = blocchi.at(-1)?.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
  if (!url) throw new Error(`Nessun woff2 latino trovato per ${css}`);

  const dati = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(path.join(CARTELLA, file), dati);
  console.log(`${file} — ${Math.round(dati.length / 1024)} KB`);
}

await mkdir(CARTELLA, { recursive: true });
for (const f of FONT) await scarica(f);
console.log('Fatto.');

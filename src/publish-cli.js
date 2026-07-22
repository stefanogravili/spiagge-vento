// Pubblica su Instagram quanto gia' prodotto in out/ da src/index.js.
// Passo separato: fra i due deve esserci il caricamento dell'immagine online.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pubblica, rinnovaToken } from './publish.js';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'out');

/**
 * Dopo il push la CDN di GitHub impiega qualche secondo a servire il file.
 * Se si chiamasse Instagram troppo presto, l'errore restituito sarebbe generico
 * e difficile da collegare alla causa reale.
 */
async function attendiImmagine(url, tentativi = 10) {
  for (let i = 0; i < tentativi; i++) {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) return;
    console.log(`Immagine non ancora online (${res.status}), riprovo...`);
    await new Promise((r) => setTimeout(r, 10000));
  }
  throw new Error(`L'immagine non e' raggiungibile: ${url}`);
}

async function main() {
  const { IG_USER_ID, IG_TOKEN, IMAGE_BASE_URL } = process.env;
  if (!IG_USER_ID || !IG_TOKEN || !IMAGE_BASE_URL) {
    throw new Error('Mancano IG_USER_ID, IG_TOKEN o IMAGE_BASE_URL. Vedi SETUP.md.');
  }

  const caption = await readFile(path.join(OUT, 'caption.txt'), 'utf8');
  const nomeFile = (await readFile(path.join(OUT, 'nomefile.txt'), 'utf8')).trim();
  const imageUrl = `${IMAGE_BASE_URL.replace(/\/$/, '')}/${nomeFile}`;

  await attendiImmagine(imageUrl);

  console.log(`Pubblico ${imageUrl}`);
  const idPost = await pubblica({ igUserId: IG_USER_ID, token: IG_TOKEN, imageUrl, caption });
  console.log(`Post pubblicato. ID: ${idPost}`);

  // La storia e' un di piu': se fallisce, il post del feed resta comunque online
  // e non ha senso far fallire l'intera esecuzione.
  try {
    const nomeStoria = (await readFile(path.join(OUT, 'nomefile-storia.txt'), 'utf8')).trim();
    const urlStoria = `${IMAGE_BASE_URL.replace(/\/$/, '')}/${nomeStoria}`;
    await attendiImmagine(urlStoria);
    const idStoria = await pubblica({
      igUserId: IG_USER_ID,
      token: IG_TOKEN,
      imageUrl: urlStoria,
      storia: true,
    });
    console.log(`Storia pubblicata. ID: ${idStoria}`);
  } catch (e) {
    console.warn(`Attenzione: storia non pubblicata (${e.message}).`);
  }

  // Rinnovare a ogni esecuzione e' cio' che rende la pagina davvero autonoma:
  // il token a lunga durata scade dopo 60 giorni se non viene mai rinfrescato.
  try {
    const { token, scadeTraGiorni } = await rinnovaToken(IG_TOKEN);
    await writeFile(path.join(OUT, 'token-rinnovato.txt'), token, 'utf8');
    console.log(`Token rinnovato, valido altri ${scadeTraGiorni} giorni.`);
  } catch (e) {
    console.warn(`Attenzione: rinnovo token fallito (${e.message}). Il post e' comunque online.`);
  }
}

main().catch((e) => {
  console.error(`\nErrore: ${e.message}`);
  process.exit(1);
});

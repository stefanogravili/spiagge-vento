// Agente pubblicatore: legge out/manifest.json e pubblica su Instagram ogni
// elemento (post feed o storia), poi rinnova il token.
// Le immagini devono essere gia' online (committate in media/ e pushate).
//
// Uso (env IG_TOKEN, IG_USER_ID): node scripts/pubblica-giornaliero.js

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pubblica, rinnovaToken } from '../src/publish.js';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(RADICE, 'out');
const BASE = process.env.IMAGE_BASE_URL
  || 'https://raw.githubusercontent.com/stefanogravili/spiagge-vento/main/media';

const { IG_TOKEN, IG_USER_ID } = process.env;
if (!IG_TOKEN || !IG_USER_ID) throw new Error('Mancano IG_TOKEN / IG_USER_ID.');

const attesa = (ms) => new Promise((r) => setTimeout(r, ms));
async function online(url, n = 15) {
  for (let i = 0; i < n; i++) { if ((await fetch(url, { method: 'HEAD' })).ok) return; await attesa(6000); }
  throw new Error(`Immagine non raggiungibile: ${url}`);
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(OUT, 'manifest.json'), 'utf8'));
  if (!manifest.length) { console.log('Manifest vuoto, niente da pubblicare.'); return; }

  console.log('Aspetto che le immagini siano online...');
  await online(`${BASE}/${manifest[0].nome}`);
  await attesa(4000);

  for (const item of manifest) {
    const url = `${BASE}/${item.nome}`;
    try {
      await online(url, 5);
      const id = await pubblica({
        igUserId: IG_USER_ID, token: IG_TOKEN, imageUrl: url,
        caption: item.caption || '', storia: item.tipo === 'storia',
      });
      console.log(`✅ ${item.tipo.padEnd(6)} ${item.nome} → ${id}`);
    } catch (e) {
      console.error(`❌ ${item.nome}: ${e.message}`);
    }
    await attesa(2000);
  }

  // Rinnovo del token: se riesce, il workflow lo riscrive nei secret.
  try {
    const { token, scadeTraGiorni } = await rinnovaToken(IG_TOKEN);
    await writeFile(path.join(OUT, 'token-rinnovato.txt'), token, 'utf8');
    console.log(`\nToken rinnovato, valido altri ${scadeTraGiorni} giorni.`);
  } catch (e) {
    console.warn(`\nRinnovo token non riuscito (${e.message}). I post sono comunque online.`);
  }
}

main().catch((e) => { console.error(`Errore: ${e.message}`); process.exit(1); });

// Lancio della pagina: pubblica il post di presentazione (feed + storia) e le
// sei tavole di provincia come storie.
//
// Uso (env gia' impostati IG_TOKEN, IG_USER_ID):
//   node scripts/pubblica-lancio.js

import { readFile, copyFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pubblica } from '../src/publish.js';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA = path.join(RADICE, 'media');
const BASE = 'https://raw.githubusercontent.com/stefanogravili/spiagge-vento/main/media';

const { IG_TOKEN, IG_USER_ID } = process.env;
if (!IG_TOKEN || !IG_USER_ID) throw new Error('Mancano IG_TOKEN / IG_USER_ID nell\'ambiente.');

const CAPTION_PRESENTAZIONE = [
  '🌊 Benvenuti su Mare Calmo Puglia!',
  '',
  'Ogni giorno ti diciamo dove fare il bagno col mare piatto, provincia per provincia.',
  '🟢 Calmo  🟡 Mosso  🔴 Molto mosso',
  'Calcolato sul vento e sulle onde reali — ogni sera pubblichiamo il mare del giorno dopo.',
  '',
  'Seguici e attiva le notifiche 📌',
  '',
  '#puglia #salento #mare #spiagge #marecalmo #gargano #marepuglia #vacanzeinpuglia #weekendinpuglia #puglialovers #spiaggepuglia #estate',
].join('\n');

// file locali -> nome nel repo, tipo, didascalia
const LANCIO = [
  { src: 'out/presentazione/presentazione-feed.jpg', nome: 'lancio-presentazione.jpg', tipo: 'feed', caption: CAPTION_PRESENTAZIONE },
  { src: 'out/presentazione/presentazione-storia.jpg', nome: 'lancio-presentazione-storia.jpg', tipo: 'storia' },
  { src: 'out/cartone/foggia.jpg', nome: 'lancio-foggia.jpg', tipo: 'storia' },
  { src: 'out/cartone/bari.jpg', nome: 'lancio-bari.jpg', tipo: 'storia' },
  { src: 'out/cartone/brindisi.jpg', nome: 'lancio-brindisi.jpg', tipo: 'storia' },
  { src: 'out/cartone/taranto.jpg', nome: 'lancio-taranto.jpg', tipo: 'storia' },
  { src: 'out/cartone/lecce-adriatico.jpg', nome: 'lancio-lecce-adriatico.jpg', tipo: 'storia' },
  { src: 'out/cartone/lecce-ionio.jpg', nome: 'lancio-lecce-ionio.jpg', tipo: 'storia' },
];

const git = (...args) => execFileSync('git', args, { cwd: RADICE, stdio: 'pipe' }).toString();
const attesa = (ms) => new Promise((r) => setTimeout(r, ms));

async function attendiOnline(url, tentativi = 15) {
  for (let i = 0; i < tentativi; i++) {
    if ((await fetch(url, { method: 'HEAD' })).ok) return;
    await attesa(6000);
  }
  throw new Error(`Immagine non raggiungibile: ${url}`);
}

async function main() {
  console.log('1) Copio le immagini nel repo e le carico su GitHub...');
  await mkdir(MEDIA, { recursive: true });
  for (const item of LANCIO) await copyFile(path.join(RADICE, item.src), path.join(MEDIA, item.nome));

  git('add', 'media');
  try { git('commit', '-m', 'media: lancio pagina'); }
  catch { console.log('   (nessuna modifica da committare)'); }
  git('pull', '--rebase', '--autostash');
  git('push');

  console.log('2) Aspetto che le immagini siano online...');
  await attendiOnline(`${BASE}/${LANCIO[0].nome}`);
  await attesa(4000);

  console.log('3) Pubblico su Instagram...\n');
  for (const item of LANCIO) {
    const imageUrl = `${BASE}/${item.nome}`;
    try {
      await attendiOnline(imageUrl, 5);
      const id = await pubblica({
        igUserId: IG_USER_ID, token: IG_TOKEN, imageUrl,
        caption: item.caption || '', storia: item.tipo === 'storia',
      });
      console.log(`   ✅ ${item.tipo.padEnd(6)} ${item.nome}  →  ${id}`);
    } catch (e) {
      console.error(`   ❌ ${item.nome}: ${e.message}`);
    }
    await attesa(2000);
  }
  console.log('\nFatto.');
}

main().catch((e) => { console.error(`Errore: ${e.message}`); process.exit(1); });

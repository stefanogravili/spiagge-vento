// Pubblica la presentazione premium: post nel feed + storia.
// Uso (env IG_TOKEN, IG_USER_ID): node scripts/pubblica-presentazione.js

import { copyFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pubblica } from '../src/publish.js';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA = path.join(RADICE, 'media');
const BASE = 'https://raw.githubusercontent.com/stefanogravili/spiagge-vento/main/media';
const { IG_TOKEN, IG_USER_ID } = process.env;
if (!IG_TOKEN || !IG_USER_ID) throw new Error('Mancano IG_TOKEN / IG_USER_ID.');

const CAPTION = [
  '🌊 Benvenuti su Mare Calmo Puglia',
  '',
  'Ogni giorno le spiagge col mare più calmo della Puglia, provincia per provincia.',
  '🟢 Calmo  🟡 Poco mosso  🔴 Mosso — calcolato sul vento e sulle onde reali.',
  '',
  'Ogni sera pubblichiamo il mare del giorno dopo. Seguici e attiva le notifiche 📌',
  '',
  '#puglia #salento #mare #spiagge #marecalmo #gargano #marepuglia #vacanzeinpuglia #puglialovers #spiaggepuglia',
].join('\n');

const stamp = process.env.STAMP || 'p2';
const ITEMS = [
  { src: 'out/presentazione/presentazione-feed.jpg', nome: `pres-feed-${stamp}.jpg`, tipo: 'feed', caption: CAPTION },
  { src: 'out/presentazione/presentazione-storia.jpg', nome: `pres-storia-${stamp}.jpg`, tipo: 'storia' },
];

const git = (...a) => execFileSync('git', a, { cwd: RADICE, stdio: 'pipe' }).toString();
const attesa = (ms) => new Promise((r) => setTimeout(r, ms));
async function online(url, n = 15) { for (let i = 0; i < n; i++) { if ((await fetch(url, { method: 'HEAD' })).ok) return; await attesa(6000); } throw new Error(`Non online: ${url}`); }

async function main() {
  await mkdir(MEDIA, { recursive: true });
  for (const it of ITEMS) await copyFile(path.join(RADICE, it.src), path.join(MEDIA, it.nome));
  git('add', 'media', 'scripts/presentazione.js');
  try { git('commit', '-m', `presentazione premium ${stamp}`); } catch { /* niente */ }
  git('pull', '--rebase', '--autostash'); git('push');

  await online(`${BASE}/${ITEMS[0].nome}`); await attesa(4000);
  for (const it of ITEMS) {
    try {
      await online(`${BASE}/${it.nome}`, 5);
      const id = await pubblica({ igUserId: IG_USER_ID, token: IG_TOKEN, imageUrl: `${BASE}/${it.nome}`, caption: it.caption || '', storia: it.tipo === 'storia' });
      console.log(`✅ ${it.tipo} → ${id}`);
    } catch (e) { console.error(`❌ ${it.nome}: ${e.message}`); }
    await attesa(2000);
  }
  console.log('Fatto.');
}
main().catch((e) => { console.error(`Errore: ${e.message}`); process.exit(1); });

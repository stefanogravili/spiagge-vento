// Ripubblica solo le sei tavole di provincia come storie (versione corretta).
// Uso (env IG_TOKEN, IG_USER_ID): node scripts/pubblica-storie.js

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

// Nome file datato per avere sempre un URL nuovo (le storie vecchie restano cache lato IG).
const stamp = process.env.STAMP || 'v2';
const CHIAVI = ['foggia', 'bari', 'brindisi', 'taranto', 'lecce-adriatico', 'lecce-ionio'];

const git = (...a) => execFileSync('git', a, { cwd: RADICE, stdio: 'pipe' }).toString();
const attesa = (ms) => new Promise((r) => setTimeout(r, ms));
async function online(url, n = 15) { for (let i = 0; i < n; i++) { if ((await fetch(url, { method: 'HEAD' })).ok) return; await attesa(6000); } throw new Error(`Non online: ${url}`); }

async function main() {
  await mkdir(MEDIA, { recursive: true });
  const items = CHIAVI.map((k) => ({ k, nome: `storia-${k}-${stamp}.jpg` }));
  for (const it of items) await copyFile(path.join(RADICE, 'out', 'cartone', `${it.k}.jpg`), path.join(MEDIA, it.nome));

  console.log('Carico su GitHub...');
  git('add', 'media');
  try { git('commit', '-m', `media: storie corrette ${stamp}`); } catch { /* niente da committare */ }
  git('pull', '--rebase', '--autostash'); git('push');

  await online(`${BASE}/${items[0].nome}`);
  await attesa(4000);

  console.log('Pubblico le storie...\n');
  for (const it of items) {
    const url = `${BASE}/${it.nome}`;
    try {
      await online(url, 5);
      const id = await pubblica({ igUserId: IG_USER_ID, token: IG_TOKEN, imageUrl: url, storia: true });
      console.log(`   ✅ ${it.k}  →  ${id}`);
    } catch (e) { console.error(`   ❌ ${it.k}: ${e.message}`); }
    await attesa(2000);
  }
  console.log('\nFatto.');
}

main().catch((e) => { console.error(`Errore: ${e.message}`); process.exit(1); });

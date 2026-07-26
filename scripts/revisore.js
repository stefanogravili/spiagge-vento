// Agente revisore: controlla la qualita' di quanto generato PRIMA di pubblicare.
// Se qualcosa non torna esce con codice 1 e il workflow si ferma: cosi' non
// esce mai un post con dati assurdi, immagini vuote o data sbagliata.
//
// Uso: node scripts/revisore.js   (dopo genera-giornaliero.js)

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(RADICE, 'out');
const MEDIA = path.join(RADICE, 'media');

// Soglie di plausibilita'.
const PROVINCE_ATTESE = 6;
const IMMAGINI_ATTESE = 7;      // 6 storie + 1 post meteo
const PESO_MINIMO = 15000;      // byte: sotto questa soglia l'immagine e' vuota/rotta
const TEMP = [5, 50];           // gradi plausibili
const VENTO = [0, 70];          // nodi plausibili

async function main() {
  const errori = [];
  const ok = [];

  let c;
  try {
    c = JSON.parse(await readFile(path.join(OUT, 'controllo.json'), 'utf8'));
  } catch {
    console.error('❌ Manca out/controllo.json: la generazione non e\' andata a buon fine.');
    process.exit(1);
  }

  // 1. Problemi segnalati durante la generazione (dati mancanti per spiaggia).
  if (c.problemi?.length) errori.push(...c.problemi);
  else ok.push('nessun dato mancante per le spiagge');

  // 2. Data valida e non passata.
  const oggi = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.data || '')) errori.push(`data non valida: ${c.data}`);
  else if (c.data < oggi) errori.push(`la data ${c.data} e' nel passato`);
  else ok.push(`data ${c.data}`);

  // 3. Temperatura e vento plausibili.
  if (!(c.tempMax >= TEMP[0] && c.tempMax <= TEMP[1])) errori.push(`temperatura fuori scala: ${c.tempMax}`);
  else ok.push(`temperatura ${Math.round(c.tempMax)}°`);
  if (!(c.ventoNodi >= VENTO[0] && c.ventoNodi <= VENTO[1])) errori.push(`vento fuori scala: ${c.ventoNodi} nodi`);
  else ok.push(`vento ${c.ventoNodi} nodi`);

  // 4. Tutte le province presenti, con spiagge e almeno uno stato assegnato.
  if ((c.province?.length || 0) !== PROVINCE_ATTESE) errori.push(`province attese ${PROVINCE_ATTESE}, trovate ${c.province?.length || 0}`);
  for (const p of c.province || []) {
    if (!(p.spiagge > 0)) errori.push(`${p.key}: nessuna spiaggia`);
    const somma = (p.stati?.calmo || 0) + (p.stati?.mosso || 0) + (p.stati?.moltomosso || 0);
    if (somma !== p.spiagge) errori.push(`${p.key}: ${p.spiagge} spiagge ma ${somma} classificate`);
  }
  if (c.province?.length === PROVINCE_ATTESE) ok.push(`${PROVINCE_ATTESE} province complete`);

  // 5. Tutte le immagini esistono e non sono vuote.
  const imgs = c.immagini || [];
  if (imgs.length !== IMMAGINI_ATTESE) errori.push(`immagini attese ${IMMAGINI_ATTESE}, in manifest ${imgs.length}`);
  for (const im of imgs) {
    try {
      const s = await stat(path.join(MEDIA, im.nome));
      if (s.size < PESO_MINIMO) errori.push(`immagine troppo piccola (vuota?): ${im.nome} (${s.size} byte)`);
    } catch {
      errori.push(`immagine mancante: ${im.nome}`);
    }
  }
  if (imgs.length === IMMAGINI_ATTESE) ok.push(`${IMMAGINI_ATTESE} immagini presenti`);

  // --- Esito ---
  console.log('REVISIONE\n');
  for (const o of ok) console.log(`  ✅ ${o}`);
  if (errori.length) {
    console.log('');
    for (const e of errori) console.log(`  ⛔ ${e}`);
    console.error(`\nRevisione FALLITA: ${errori.length} problemi. Pubblicazione bloccata.`);
    process.exit(1);
  }
  console.log('\n✅ Revisione superata. Si puo\' pubblicare.');
}

main().catch((e) => { console.error(`Errore nel revisore: ${e.message}`); process.exit(1); });

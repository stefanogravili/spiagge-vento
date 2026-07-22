// Genera il post del giorno: dati -> punteggi -> immagine + didascalia in out/.
// La pubblicazione e' un passo separato (src/publish-cli.js) perche' l'API di
// Instagram vuole l'immagine gia' raggiungibile a un URL pubblico.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { condizioniGiornata } from './weather.js';
import { valuta, migliori, peggiori, sintesiRegione } from './score.js';
import { costruisciCaption, dataEstesa } from './caption.js';
import { generaImmagini } from './render.js';
import { cardinale } from './geo.js';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(RADICE, 'out');

const argomento = (nome, predefinito) => {
  const trovato = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return trovato ? trovato.split('=')[1] : predefinito;
};
const flag = (nome) => process.argv.includes(`--${nome}`);

// Numerazione progressiva del bollettino, come su una pubblicazione periodica.
// Derivarla dalla data la rende deterministica: due esecuzioni dello stesso
// giorno producono lo stesso numero.
const ORIGINE = Date.UTC(2026, 6, 21);
const numeroBollettino = (iso) => {
  const giorni = Math.round((Date.parse(`${iso}T00:00:00Z`) - ORIGINE) / 86400000);
  return String(Math.max(1, giorni)).padStart(3, '0');
};

async function main() {
  const slug = argomento('regione', 'puglia');
  const mostraCaption = flag('mostra-caption');

  const regione = JSON.parse(
    await readFile(path.join(RADICE, 'data', `${slug}.json`), 'utf8')
  );

  console.log(`Scarico i dati per ${regione.spiagge.length} spiagge in ${regione.regione}...`);
  const condizioni = await condizioniGiornata(regione.spiagge, regione.fuso);

  const valutate = condizioni.map(valuta);
  const top = migliori(valutate, 5);
  const flop = peggiori(valutate, 3);
  const sintesi = sintesiRegione(valutate);
  const data = valutate[0].dataRiferimento;

  // Il vento mostrato in copertina e' quello della spiaggia in testa: e' il
  // vento che spiega la classifica del giorno.
  const ventoGradi = top[0].ventoDa;

  console.log(`\n${sintesi.ventoDominante} ${sintesi.ventoMedio} nodi · ${sintesi.buone}/${sintesi.totale} spiagge riparate\n`);
  for (const [i, s] of top.entries()) {
    console.log(`${i + 1}. ${s.punteggio.toString().padStart(3)} ${s.nome} (${s.comune}) — ${s.motivo}`);
  }

  const nomiFile = {
    feed: `${slug}-${data}.jpg`,
    storia: `${slug}-${data}-storia.jpg`,
  };
  const percorsi = await generaImmagini({
    regione: regione.regione,
    account: regione.account,
    data: dataEstesa(data),
    numero: numeroBollettino(data),
    sintesi,
    top,
    tutte: valutate,
    vento: {
      nome: sintesi.ventoDominante,
      sigla: cardinale(ventoGradi),
      gradi: Math.round(ventoGradi),
      nodi: sintesi.ventoMedio,
    },
    cartellaOutput: OUT,
    nomiFile,
  });

  const caption = costruisciCaption({
    regione: regione.regione,
    hashtag: regione.hashtag,
    top,
    flop,
    sintesi,
    data,
  });

  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'caption.txt'), caption, 'utf8');
  await writeFile(path.join(OUT, 'nomefile.txt'), nomiFile.feed, 'utf8');
  await writeFile(path.join(OUT, 'nomefile-storia.txt'), nomiFile.storia, 'utf8');
  await writeFile(
    path.join(OUT, 'dati.json'),
    JSON.stringify({ data, sintesi, valutate }, null, 2),
    'utf8'
  );

  console.log(`\nPost:   ${percorsi.feed}`);
  console.log(`Storia: ${percorsi.storia}`);
  console.log(`Didascalia: ${path.join(OUT, 'caption.txt')}`);

  if (mostraCaption) {
    console.log('\n--- DIDASCALIA ---\n');
    console.log(caption);
  }
}

main().catch((e) => {
  console.error(`\nErrore: ${e.message}`);
  process.exit(1);
});

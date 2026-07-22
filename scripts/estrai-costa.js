// Estrae e semplifica i contorni geografici usati dalla carta.
// Si lancia una volta sola: il risultato finisce in data/coste.json e viene
// versionato, cosi' il post giornaliero non dipende da questa fonte esterna.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONTE = 'https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_regions.geojson';

// La regione protagonista tiene piu' dettaglio; le confinanti servono solo a
// dare continuita' alla terraferma ai bordi del foglio.
const PROTAGONISTA = 'Puglia';
const CONTORNO = ['Basilicata', 'Molise', 'Campania', 'Abruzzo', 'Calabria'];

/** Distanza punto-segmento, in gradi. Serve a Douglas-Peucker. */
function distanzaDaSegmento(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Douglas-Peucker: elimina i punti che non cambiano la forma percepita.
 * Il file originale ha decine di migliaia di vertici, ne bastano poche centinaia
 * per una mappa larga 600 px.
 */
function semplifica(punti, tolleranza) {
  if (punti.length < 3) return punti;
  let indiceMax = 0;
  let distMax = 0;
  for (let i = 1; i < punti.length - 1; i++) {
    const d = distanzaDaSegmento(punti[i], punti[0], punti[punti.length - 1]);
    if (d > distMax) {
      distMax = d;
      indiceMax = i;
    }
  }
  if (distMax <= tolleranza) return [punti[0], punti[punti.length - 1]];
  return [
    ...semplifica(punti.slice(0, indiceMax + 1), tolleranza).slice(0, -1),
    ...semplifica(punti.slice(indiceMax), tolleranza),
  ];
}

/** Tutti gli anelli esterni di un Polygon o MultiPolygon. */
function anelli(geometria) {
  const poligoni = geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.coordinates;
  return poligoni.map((p) => p[0]);
}

const arrotonda = (anello) => anello.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);

async function main() {
  console.log('Scarico i confini regionali...');
  const res = await fetch(FONTE);
  if (!res.ok) throw new Error(`Sorgente non raggiungibile: ${res.status}`);
  const geo = await res.json();

  const trova = (nome) => geo.features.find((f) => f.properties.reg_name === nome);

  const puglia = trova(PROTAGONISTA);
  if (!puglia) throw new Error(`Regione ${PROTAGONISTA} non trovata nella sorgente`);

  // Isole e scogli minori sparirebbero comunque alla scala del post.
  const anelliPuglia = anelli(puglia.geometry)
    .filter((a) => a.length > 40)
    .map((a) => arrotonda(semplifica(a, 0.004)))
    .sort((a, b) => b.length - a.length);

  const anelliContorno = CONTORNO.flatMap((nome) => {
    const f = trova(nome);
    if (!f) return [];
    return anelli(f.geometry)
      .filter((a) => a.length > 200)
      .map((a) => arrotonda(semplifica(a, 0.02)));
  });

  const totale = anelliPuglia.reduce((n, a) => n + a.length, 0);
  console.log(`Puglia: ${anelliPuglia.length} anelli, ${totale} vertici`);
  console.log(`Regioni confinanti: ${anelliContorno.length} anelli`);

  await mkdir(path.join(RADICE, 'data'), { recursive: true });
  await writeFile(
    path.join(RADICE, 'data', 'coste.json'),
    JSON.stringify({ puglia: anelliPuglia, contorno: anelliContorno }),
    'utf8'
  );
  console.log('Salvato in data/coste.json');
}

main().catch((e) => {
  console.error(`Errore: ${e.message}`);
  process.exit(1);
});

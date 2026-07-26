// Calcola quanto una spiaggia e' riparata, per chi cerca mare calmo.
//
// Principio: il vento che arriva DA TERRA spiana il mare (offshore), il vento
// che arriva DAL MARE alza le onde (onshore). Con la stessa identica giornata
// di Maestrale, la costa adriatica e quella ionica danno mari opposti: e'
// esattamente questa l'informazione che la pagina vende.

import { onshoreComponent, cardinale, nomeVento } from './geo.js';

// Pesi delle penalita'. Tarati perche' 15 nodi in pieno onshore o 1 m di onda
// portino il punteggio sotto la soglia del "consigliato".
const PESO_ONSHORE = 3.2;
const PESO_ONDA = 45;
const PESO_RAFFICA = 1.2;
const RAFFICA_TOLLERATA = 18; // nodi: sotto questa soglia il vento non da' fastidio in spiaggia

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const LIVELLI = [
  { min: 88, etichetta: 'Piatta come l\'olio', emoji: '🟢' },
  { min: 74, etichetta: 'Molto riparata', emoji: '🟢' },
  { min: 60, etichetta: 'Riparata', emoji: '🟡' },
  { min: 45, etichetta: 'Un po\' mossa', emoji: '🟠' },
  { min: 0, etichetta: 'Mare agitato', emoji: '🔴' },
];

const livello = (punteggio) => LIVELLI.find((l) => punteggio >= l.min);

export function valuta(c) {
  // Componente del vento perpendicolare alla costa: positiva = dal mare.
  const onshore = onshoreComponent(c.ventoNodi, c.ventoDa, c.facing);

  // Se il modello marino non copre il punto, si stima l'onda dal solo vento.
  const onda = c.onda != null ? c.onda : clamp(Math.max(0, onshore) / 22, 0, 2.5);

  // Stato del mare secondo la scala ufficiale (Douglas), da un'onda "efficace":
  // il mare-vento generato dalla componente che entra da mare, combinato con
  // l'onda del modello marino (ridotta se il vento e' da terra). E' la stima
  // piu' vicina a cosa trova davvero il bagnante sotto costa.
  const mareVento = Math.pow(Math.max(0, onshore), 1.3) * 0.02;
  const swell = (c.onda != null ? c.onda : 0) * (onshore >= 0 ? 1 : 0.45);
  const ondaEff = Math.max(mareVento, swell);
  const statoMare = ondaEff < 0.5 ? 'calmo' : ondaEff < 1.25 ? 'mosso' : 'moltomosso';

  const penalita =
    Math.max(0, onshore) * PESO_ONSHORE +
    onda * PESO_ONDA +
    Math.max(0, c.raffica - RAFFICA_TOLLERATA) * PESO_RAFFICA;

  const punteggio = Math.round(clamp(100 - penalita, 0, 100));
  const l = livello(punteggio);

  return {
    ...c,
    onda,
    ondaEff,
    statoMare,
    onshore,
    punteggio,
    etichetta: l.etichetta,
    emoji: l.emoji,
    ventoSigla: cardinale(c.ventoDa),
    ventoNome: nomeVento(c.ventoDa),
    motivo: spiega(onshore, c),
  };
}

/** Frase breve che spiega il verdetto: e' quello che rende il post credibile. */
function spiega(onshore, c) {
  const vento = nomeVento(c.ventoDa);
  // Le frasi evitano aggettivi concordati: i nomi dei venti hanno generi
  // diversi (il Maestrale, la Tramontana) e la frase deve valere per tutti.
  if (onshore < -6) return `${vento} da terra: mare spianato`;
  if (onshore < -1) return `${vento} da terra, acqua ferma sotto costa`;
  if (onshore < 3) return `${vento} di traverso alla costa: poca onda`;
  if (onshore < 9) return `${vento} che entra di lato: qualche increspatura`;
  return `${vento} in pieno dal mare: onda formata`;
}

/**
 * Ordina per punteggio ma limita quante spiagge puo' portare ogni zona.
 * Senza questo vincolo una giornata di Maestrale riempirebbe la classifica
 * con cinque spiagge dello stesso tratto di costa, rendendo il post inutile
 * per chi non abita li'.
 */
export function migliori(valutate, quante = 5, maxPerZona = 2) {
  const ordinate = [...valutate].sort((a, b) => b.punteggio - a.punteggio);
  const conteggioZona = new Map();
  const scelte = [];

  for (const s of ordinate) {
    if (scelte.length === quante) break;
    const n = conteggioZona.get(s.zona) || 0;
    if (n >= maxPerZona) continue;
    conteggioZona.set(s.zona, n + 1);
    scelte.push(s);
  }

  // Se il vincolo di zona non basta a riempire la classifica, si completa
  // con le migliori rimaste.
  for (const s of ordinate) {
    if (scelte.length === quante) break;
    if (!scelte.includes(s)) scelte.push(s);
  }

  return scelte;
}

/** Le peggiori, per la sezione "oggi da evitare". */
export function peggiori(valutate, quante = 3) {
  return [...valutate].sort((a, b) => a.punteggio - b.punteggio).slice(0, quante);
}

/** Quadro generale della giornata, usato nel titolo del post. */
export function sintesiRegione(valutate) {
  const ventoMedio = valutate.reduce((a, s) => a + s.ventoNodi, 0) / valutate.length;
  const conteggio = new Map();
  for (const s of valutate) {
    conteggio.set(s.ventoNome, (conteggio.get(s.ventoNome) || 0) + 1);
  }
  const ventoDominante = [...conteggio.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const buone = valutate.filter((s) => s.punteggio >= 74).length;

  return {
    ventoDominante,
    ventoMedio: Math.round(ventoMedio),
    buone,
    totale: valutate.length,
    giornataCalma: ventoMedio < 8,
  };
}

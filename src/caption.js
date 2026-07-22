// Costruisce la didascalia del post.
// Obiettivo: dare il verdetto nelle prime due righe (e' tutto cio' che si vede
// prima del "altro"), poi il dettaglio, poi la call to action.

const MEDAGLIE = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

const nodi = (n) => `${Math.round(n)} nodi`;
const metri = (m) => `${m.toFixed(1).replace('.', ',')} m`;

export function dataEstesa(iso) {
  const d = new Date(`${iso}T12:00:00`);
  const s = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function costruisciCaption({ regione, hashtag, top, flop, sintesi, data }) {
  const righe = [];

  righe.push(`🌊 DOVE TROVARE IL MARE CALMO OGGI — ${regione}`);
  righe.push('');
  righe.push(
    sintesi.giornataCalma
      ? `Giornata di bonaccia: ${sintesi.ventoDominante} debole, ${nodi(sintesi.ventoMedio)}. Quasi ovunque si sta bene.`
      : `Oggi soffia ${sintesi.ventoDominante} a ${nodi(sintesi.ventoMedio)}. Ecco le spiagge dove il mare resta piatto 👇`
  );
  righe.push('');

  top.forEach((s, i) => {
    righe.push(`${MEDAGLIE[i]} ${s.nome} — ${s.comune}`);
    righe.push(`${s.motivo}`);
    righe.push(`💨 ${nodi(s.ventoNodi)} da ${s.ventoSigla} · 🌊 onda ${metri(s.onda)}`);
    righe.push('');
  });

  if (flop.length) {
    righe.push(`⚠️ Oggi meglio evitare: ${flop.map((s) => s.nome).join(', ')} — vento in pieno dal mare.`);
    righe.push('');
  }

  righe.push('📌 Salva il post: lo pubblichiamo ogni mattina alle 7:00.');
  righe.push(`Dati: modello meteo Open-Meteo, fascia 10:00-18:00 del ${dataEstesa(data)}.`);
  righe.push('');
  righe.push(hashtag.join(' '));

  return righe.join('\n');
}

// Pubblicazione su Instagram tramite l'API Instagram con accesso di Instagram.
// Il token dell'account (che inizia per IGAA...) lavora su graph.instagram.com,
// non sul dominio di Facebook: e' il flusso "Instagram Business Login".
//
// Vincolo dell'API: l'immagine non si carica come file, va indicata come URL
// pubblico. Per questo il workflow prima committa il JPG nel repo e poi passa
// qui l'URL raw di GitHub.

const HOST = 'https://graph.instagram.com';
const VERSIONE = 'v21.0';
const BASE = `${HOST}/${VERSIONE}`;

async function chiama(url, opzioni) {
  const res = await fetch(url, opzioni);
  const corpo = await res.json();
  if (!res.ok || corpo.error) {
    const e = corpo.error || {};
    throw new Error(`Instagram API: ${e.message || res.status} (code ${e.code ?? '?'})`);
  }
  return corpo;
}

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Il contenitore appena creato non e' subito pubblicabile: Instagram deve
 * scaricare ed elaborare l'immagine. Si attende lo stato FINISHED.
 */
async function attendiPronto(idContenitore, token, tentativi = 12) {
  for (let i = 0; i < tentativi; i++) {
    const { status_code, status } = await chiama(
      `${BASE}/${idContenitore}?fields=status_code,status&access_token=${token}`
    );
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR') throw new Error(`Instagram non ha accettato l'immagine: ${status}`);
    await attendi(3000);
  }
  throw new Error("Instagram non ha finito di elaborare l'immagine in tempo");
}

/**
 * Pubblica un'immagine. Senza `caption` e con tipo STORIES finisce fra le
 * storie invece che nel feed: stesso flusso, stessa carta, doppia copertura.
 */
export async function pubblica({ igUserId, token, imageUrl, caption, storia = false }) {
  const corpo = { image_url: imageUrl, access_token: token };
  if (storia) corpo.media_type = 'STORIES';
  else corpo.caption = caption;

  const contenitore = await chiama(`${BASE}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });

  await attendiPronto(contenitore.id, token);

  const pubblicato = await chiama(`${BASE}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: contenitore.id, access_token: token }),
  });

  return pubblicato.id;
}

/**
 * I token Instagram a lunga durata scadono dopo 60 giorni. Il workflow lo
 * rinnova a ogni esecuzione: finche' la pagina posta ogni giorno, il token
 * non scade mai e non serve rimettere mano alla configurazione.
 */
export async function rinnovaToken(token) {
  // Il rinnovo sta sulla radice del dominio, senza il prefisso di versione.
  const r = await chiama(
    `${HOST}/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`
  );
  return { token: r.access_token, scadeTraGiorni: Math.round(r.expires_in / 86400) };
}

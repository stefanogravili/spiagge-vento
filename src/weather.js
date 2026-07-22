// Fetch dati meteo/marini da Open-Meteo.
// Nessuna API key, nessun limite pratico, nessun rinnovo: e' il motivo per cui
// e' stata scelta questa fonte invece di OpenWeather/WindGuru.

import { movePoint } from './geo.js';

const API_METEO = 'https://api.open-meteo.com/v1/forecast';
const API_MARINE = 'https://marine-api.open-meteo.com/v1/marine';

// Open-Meteo accetta liste di coordinate, ma URL troppo lunghi vengono rifiutati.
const CHUNK = 40;

// Fascia oraria da balneazione: e' su queste ore che si giudica la giornata.
export const ORA_INIZIO = 10;
export const ORA_FINE = 18;

function chunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo ha risposto ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  // Con una sola coordinata l'API restituisce un oggetto, non un array.
  return Array.isArray(data) ? data : [data];
}

/** Vento e temperatura per ogni spiaggia (punto a terra). */
async function fetchVento(spiagge, fuso) {
  const risultati = [];
  for (const gruppo of chunks(spiagge, CHUNK)) {
    const params = new URLSearchParams({
      latitude: gruppo.map((s) => s.lat).join(','),
      longitude: gruppo.map((s) => s.lon).join(','),
      hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m',
      wind_speed_unit: 'kn',
      timezone: fuso,
      forecast_days: 1,
    });
    risultati.push(...(await getJson(`${API_METEO}?${params}`)));
  }
  return risultati;
}

/**
 * Altezza onda per ogni spiaggia. La query viene fatta su un punto spostato
 * 6 km al largo nella direzione in cui guarda la spiaggia: sulla battigia
 * il modello marino restituirebbe valori nulli.
 */
async function fetchOnde(spiagge, fuso) {
  const puntiMare = spiagge.map((s) => movePoint(s.lat, s.lon, s.facing, 6));
  const risultati = [];
  for (const gruppo of chunks(puntiMare, CHUNK)) {
    const params = new URLSearchParams({
      latitude: gruppo.map((p) => p.lat).join(','),
      longitude: gruppo.map((p) => p.lon).join(','),
      hourly: 'wave_height',
      timezone: fuso,
      forecast_days: 1,
    });
    try {
      risultati.push(...(await getJson(`${API_MARINE}?${params}`)));
    } catch {
      // Il modello marino non copre tutti i punti costieri. Se un gruppo fallisce
      // si procede comunque: il punteggio userra' solo vento e raffiche.
      risultati.push(...gruppo.map(() => null));
    }
  }
  return risultati;
}

const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const massimo = (v) => (v.length ? Math.max(...v) : null);

/** Estrae i valori nella fascia balneare, scartando i null del modello. */
function fasciaBalneare(times, valori) {
  if (!valori) return [];
  const out = [];
  for (let i = 0; i < times.length; i++) {
    const ora = Number(times[i].slice(11, 13));
    if (ora >= ORA_INIZIO && ora <= ORA_FINE && valori[i] != null) out.push(valori[i]);
  }
  return out;
}

/**
 * Direzione media del vento. Va mediata come vettore, non come numero:
 * la media aritmetica di 350 e 10 darebbe 180 (sud) invece di 0 (nord).
 */
function direzioneMedia(gradi) {
  if (!gradi.length) return null;
  let x = 0;
  let y = 0;
  for (const g of gradi) {
    x += Math.cos((g * Math.PI) / 180);
    y += Math.sin((g * Math.PI) / 180);
  }
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/**
 * Restituisce, per ogni spiaggia, le condizioni sintetiche della giornata.
 * Un solo giro di chiamate per tutta la regione.
 */
export async function condizioniGiornata(spiagge, fuso) {
  const [vento, onde] = await Promise.all([
    fetchVento(spiagge, fuso),
    fetchOnde(spiagge, fuso),
  ]);

  return spiagge.map((spiaggia, i) => {
    const v = vento[i];
    const times = v.hourly.time;

    const velocita = fasciaBalneare(times, v.hourly.wind_speed_10m);
    const raffiche = fasciaBalneare(times, v.hourly.wind_gusts_10m);
    const direzioni = fasciaBalneare(times, v.hourly.wind_direction_10m);
    const temperature = fasciaBalneare(times, v.hourly.temperature_2m);
    const altezzaOnda = onde[i]
      ? fasciaBalneare(onde[i].hourly.time, onde[i].hourly.wave_height)
      : [];

    return {
      ...spiaggia,
      ventoNodi: media(velocita),
      ventoMaxNodi: massimo(velocita),
      raffica: massimo(raffiche),
      ventoDa: direzioneMedia(direzioni),
      temperatura: massimo(temperature),
      onda: media(altezzaOnda),
      ondaMax: massimo(altezzaOnda),
      dataRiferimento: times[0].slice(0, 10),
    };
  });
}

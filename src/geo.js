// Utility geometriche per lavorare con direzioni del vento e orientamento coste.
//
// Convenzione meteo: la direzione del vento e quella DA CUI il vento proviene.
// Convenzione nostra: `facing` di una spiaggia e la direzione VERSO CUI guarda
// il mare (dove punti lo sguardo stando sulla battigia).
//
// Quindi: vento che proviene da `facing` = vento dal mare = ONSHORE (mare mosso).
//         vento che proviene da `facing + 180` = vento da terra = OFFSHORE (mare piatto).

export const toRad = (deg) => (deg * Math.PI) / 180;
export const toDeg = (rad) => (rad * 180) / Math.PI;

/** Differenza angolare minima fra due direzioni, sempre in [0, 180]. */
export function angleDiff(a, b) {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Componente del vento perpendicolare alla costa.
 * Positiva = vento dal mare verso terra (onshore, alza le onde).
 * Negativa = vento da terra verso il mare (offshore, spiana il mare).
 */
export function onshoreComponent(windSpeed, windFrom, facing) {
  return windSpeed * Math.cos(toRad(angleDiff(windFrom, facing)));
}

/**
 * Quanto la costa ripara dal vento, da 0 (piena esposizione) a 1 (riparo totale).
 * E' il complemento normalizzato della componente onshore.
 */
export function shelterFactor(windFrom, facing) {
  return (1 - Math.cos(toRad(angleDiff(windFrom, facing)))) / 2;
}

const CARDINALI = [
  [0, 'N', 'Tramontana'],
  [45, 'NE', 'Grecale'],
  [90, 'E', 'Levante'],
  [135, 'SE', 'Scirocco'],
  [180, 'S', 'Ostro'],
  [225, 'SO', 'Libeccio'],
  [270, 'O', 'Ponente'],
  [315, 'NO', 'Maestrale'],
];

/** Sigla cardinale (N, NE, E...) da gradi. */
export function cardinale(deg) {
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return CARDINALI[i][1];
}

/** Nome del vento mediterraneo (Maestrale, Scirocco...) da gradi. */
export function nomeVento(deg) {
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return CARDINALI[i][2];
}

/**
 * Sposta un punto di `km` chilometri nella direzione `bearing`.
 * Serve per interrogare l'API marina in un punto realmente in mare aperto:
 * sulla battigia restituirebbe valori nulli.
 */
export function movePoint(lat, lon, bearing, km) {
  const dLat = (km / 111.32) * Math.cos(toRad(bearing));
  const dLon = (km / (111.32 * Math.cos(toRad(lat)))) * Math.sin(toRad(bearing));
  return { lat: +(lat + dLat).toFixed(4), lon: +(lon + dLon).toFixed(4) };
}

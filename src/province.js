// Ogni spiaggia appartiene a una provincia in base al comune. Si pubblica un
// post per provincia, non uno unico per la Puglia.
//
// Nota: i comuni dell'ex-provincia BAT (Barletta-Andria-Trani) sono accorpati
// dove hanno piu' senso geografico: Margherita di Savoia col golfo di Foggia,
// gli altri con Bari. Cosi' restano le cinque province richieste.

export const PROVINCE = ['Foggia', 'Bari', 'Brindisi', 'Taranto', 'Lecce'];

const COMUNE_PROVINCIA = {
  // Foggia (Gargano + golfo di Manfredonia)
  'San Nicandro Garganico': 'Foggia', 'Rodi Garganico': 'Foggia', 'Peschici': 'Foggia',
  'Vieste': 'Foggia', 'Mattinata': 'Foggia', 'Manfredonia': 'Foggia',
  'Zapponeta': 'Foggia', 'Margherita di Savoia': 'Foggia',
  // Bari (+ costa BAT meridionale)
  'Barletta': 'Bari', 'Trani': 'Bari', 'Bisceglie': 'Bari', 'Molfetta': 'Bari',
  'Giovinazzo': 'Bari', 'Bari': 'Bari', 'Polignano a Mare': 'Bari', 'Monopoli': 'Bari',
  // Brindisi
  'Fasano': 'Brindisi', 'Ostuni': 'Brindisi', 'Carovigno': 'Brindisi',
  'Brindisi': 'Brindisi', 'Torchiarolo': 'Brindisi',
  // Taranto (arco ionico)
  'Maruggio': 'Taranto', 'Torricella': 'Taranto', 'Pulsano': 'Taranto',
  'Taranto': 'Taranto', 'Palagiano': 'Taranto', 'Castellaneta': 'Taranto', 'Ginosa': 'Taranto',
  // Lecce (Adriatico + Ionio salentino)
  'Lecce': 'Lecce', 'Melendugno': 'Lecce', 'Otranto': 'Lecce', 'Santa Cesarea Terme': 'Lecce',
  'Castro': 'Lecce', 'Andrano': 'Lecce', 'Tricase': 'Lecce', 'Gagliano del Capo': 'Lecce',
  'Castrignano del Capo': 'Lecce', 'Morciano di Leuca': 'Lecce', 'Salve': 'Lecce',
  'Ugento': 'Lecce', 'Racale': 'Lecce', 'Taviano': 'Lecce', 'Gallipoli': 'Lecce',
  'Nardo': 'Lecce', 'Porto Cesareo': 'Lecce',
};

export const provinciaDi = (comune) => COMUNE_PROVINCIA[comune] || null;

export const spiaggeDiProvincia = (spiagge, provincia) =>
  spiagge.filter((s) => provinciaDi(s.comune) === provincia);

// Everything the game says about itself, in one place. Used by the home page
// (index.html) and by the "Kako se igra" page in the game (igra.html).
// When a feature, block type, mode or rule is added or changed, update it here:
// both pages pick it up, and tools/test-content.js fails if a block type in
// the levels has no description. Numbers come from the game data, so they stay current.
const ToppleContent = (() => {
  const levels = typeof LEVELS !== 'undefined' ? LEVELS.length : 0;
  const endless = typeof PUZZLES !== 'undefined' ? PUZZLES.endless.length : 0;
  const chapters = Math.ceil(levels / 10);

  const TYPES = {
    r: ['Crveni blok', 'Njega moraš izvesti. Dovedi ga do strelice na desnom rubu, u isti red.'],
    n: ['Obični blok', 'Klizi lijevo ili desno za koliko god polja želiš. Kad ispod njega nema ničega, padne.'],
    f: ['Kamen', 'Jedini se nikad ne miče: ne možeš ga gurnuti i ne pada. Služi kao čvrsti oslonac.'],
    i: ['Led', 'Kad ga gurneš, klizi sve do prve prepreke. Ne može stati na pola puta.'],
    h: ['Teški blok', 'Ako padne na ispucali blok, razbije ga i pada dalje. Ako samo leži na njemu, ništa se ne događa.'],
    k: ['Ispucali blok', 'Miče se i pada kao obični, ali ga teški blok u padu razbije i on nestane.'],
    b: ['Balon', 'Ne pada nego se diže, dok ne udari u nešto iznad sebe. Drugi blokovi mogu stajati na njemu.'],
  };
  const TYPE_ORDER = ['r', 'n', 'f', 'i', 'h', 'k', 'b'];

  const RULES = [
    ['Cilj', 'Izvedi crveni blok kroz izlaz, strelicu na desnom rubu ploče. Crveni mora biti u istom redu kao strelica i dotaknuti desni rub.'],
    ['Potez', 'Povuci blok prstom ili mišem lijevo ili desno. Klizi za koliko god slobodnih polja želiš, ali nikad gore ili dolje. Na tipkovnici odaberi blok tipkom Tab i miči ga strelicama.'],
    ['Gravitacija', 'Nakon svakog poteza sve što nema oslonac padne. Blok stoji ako je ispod barem jednog njegovog dijela nešto. Jedan potez može pokrenuti cijeli lanac padova.'],
    ['Zvjezdice', 'Cilj je najmanji mogući broj poteza. Riješiš li u tom broju, dobiješ 3 zvjezdice, s najviše 2 poteza više 2, inače 1. „Vrati” poništava zadnji potez, a „Ponovi” kreće ispočetka.'],
  ];

  const MODES = [
    ['Razine', `${levels} razina u ${chapters} poglavlja. Otključavaju se redom, postupno uvode nove blokove i postaju sve teže.`],
    ['Dnevna zagonetka', 'Svaki dan nova zagonetka, ista za sve igrače. Na ljestvici pobjeđuje manje poteza, a kod jednakog broja brže vrijeme. Nedjeljom je teža.'],
    ['Beskonačno', `Niz zagonetki koji nikad ne završava: prvih ${endless} je unaprijed složeno, a dalje ih igra slaže sama. Postaju sve teže i izmjenjuju vrste blokova.`],
  ];

  const FEATURES = [
    ['Ljestvica', 'Natječi se na dnevnoj ljestvici, u beskonačnom nizu i u zvjezdicama iz razina.'],
    ['Prijava i više uređaja', 'Prijavi se Google računom, e-mailom ili korisničkim imenom i lozinkom. Napredak te prati na mobitelu i na računalu.'],
    ['Pošteni rezultati', 'Server ponovno odigra svako poslano rješenje i sprema samo ispravna. Na ljestvicu se ne može upisati izmišljeni rezultat.'],
    ['Neograničeno „Vrati”', 'Eksperimentiraj bez kazne: svaki potez se može poništiti, a ploča vratiti na početak.'],
    ['Zvuk i glazba', 'Zvukovi drveta za klizanje, slijetanje i pucanje, a u pozadini Bachov Preludij u C-duru. Oboje se može isključiti.'],
    ['Radi bez interneta', 'Igra pamti napredak na uređaju i šalje rezultate kad se veza vrati.'],
    ['Mobitel i računalo', 'Igra se u pregledniku, bez instalacije. Prstom na mobitelu, mišem ili tipkovnicom na računalu.'],
  ];

  // Playing without an account is allowed, with limits (shared by the game and the home page).
  const GUEST = { levels: 20, endless: 10 };
  FEATURES.push(['Igraj i bez prijave', `Bez računa dobiješ smiješno ime gosta i igraš prvih ${GUEST.levels} razina, ${GUEST.endless} beskonačnih zagonetki i dnevnu zagonetku. Sve ostale razine, beskonačni niz bez ograničenja i mjesto na ljestvici imaju prijavljeni igrači.`]);

  const stats = { levels, chapters, endless, types: TYPE_ORDER.length };
  return { TYPES, TYPE_ORDER, RULES, MODES, FEATURES, GUEST, stats };
})();
if (typeof module !== 'undefined') module.exports = ToppleContent;

// Everything the game says about itself, in one place and in every language.
// Used by the home page (index.html) and by the "How to play" page in the game (igra.html).
// When a feature, block type, mode or rule is added or changed, update it here in all
// languages: both pages pick it up, and tools/test-content.js fails if a block type in the
// levels has no description in some language. Numbers come from the game data.
const ToppleContent = (() => {
  const levels = typeof LEVELS !== 'undefined' ? LEVELS.length : 0;
  const endless = typeof PUZZLES !== 'undefined' ? PUZZLES.endless.length : 0;
  const chapters = Math.ceil(levels / 10);
  // Playing without an account is allowed, with limits (shared by the game and the home page).
  const GUEST = { levels: 10, endless: 10 };
  const TYPE_ORDER = ['r', 'n', 'f', 'i', 'h', 'k', 'b', 'a', 's'];
  // Looks for the red block. `level` = the level to solve to unlock it (0 = from the start).
  // Each needs a .skin-<id> style in theme.css and a 'skin.<id>' name in i18n.js.
  const SKINS = [
    { id: 'classic', level: 0 }, { id: 'cat', level: 10 }, { id: 'robot', level: 20 }, { id: 'melon', level: 30 },
    { id: 'rainbow', level: 40 }, { id: 'gold', level: 50 }, { id: 'king', level: 60 },
    { id: 'frog', level: 70 }, { id: 'ghost', level: 80 }, { id: 'dragon', level: 90 }, { id: 'cosmos', level: 100 },
    { id: 'bee', level: 110 }, { id: 'diamond', level: 120 },
  ];

  // Achievements: earned from the player's progress (kind + target n; n 'all' = every level).
  const ACHIEVEMENTS = [
    { id: 'first', kind: 'levels', n: 1 }, { id: 'levels25', kind: 'levels', n: 25 }, { id: 'levels60', kind: 'levels', n: 60 },
    { id: 'levelsAll', kind: 'levels', n: 'all' }, { id: 'perfect10', kind: 'perfect', n: 10 }, { id: 'perfect50', kind: 'perfect', n: 50 },
    { id: 'nohint20', kind: 'nohint', n: 20 }, { id: 'daily1', kind: 'daily', n: 1 }, { id: 'daily10', kind: 'daily', n: 10 },
    { id: 'streak3', kind: 'streak', n: 3 }, { id: 'streak7', kind: 'streak', n: 7 }, { id: 'streak30', kind: 'streak', n: 30 },
    { id: 'endless10', kind: 'endless', n: 10 }, { id: 'endless50', kind: 'endless', n: 50 }, { id: 'skins5', kind: 'skins', n: 5 },
  ];

  const TEXT = {
    hr: {
      TYPES: {
        r: ['Crveni blok', 'Njega moraš izvesti. Dovedi ga do strelice na desnom rubu, u isti red.'],
        n: ['Obični blok', 'Klizi lijevo ili desno za koliko god polja želiš. Kad ispod njega nema ničega, padne.'],
        f: ['Kamen', 'Jedini se nikad ne miče: ne možeš ga gurnuti i ne pada. Služi kao čvrsti oslonac.'],
        i: ['Led', 'Kad ga gurneš, klizi sve do prve prepreke. Ne može stati na pola puta.'],
        h: ['Teški blok', 'Ako padne na ispucali blok, razbije ga i pada dalje. Ako samo leži na njemu, ništa se ne događa.'],
        k: ['Ispucali blok', 'Miče se i pada kao obični, ali ga teški blok u padu razbije i on nestane.'],
        b: ['Balon', 'Ne pada nego se diže, dok ne udari u nešto iznad sebe. Drugi blokovi mogu stajati na njemu.'],
        a: ['Strelica', 'Klizi samo u smjeru strelice. Inače pada kao obični blok.'],
        s: ['Opruga', 'Ne miče se i ne pada. Blok koji klizne do nje odbije se i klizi natrag do kraja, čak i strelica.'],
      },
      SKIN_TEXT: { classic: 'Izvorni crveni blok s velikim očima.', cat: 'Narančasti mačak s ušima i mačjim zjenicama.', robot: 'Metalni robot s antenom i svjetlećim očima.', melon: 'Sočna kriška lubenice sa sjemenkama.', rainbow: 'Sve boje duge u jednom bloku.', gold: 'Sjajni zlatni blok za uporne.', king: 'Kraljevski crveni blok sa zlatnom krunom.', frog: 'Zelena žaba s okruglim izbočinama na glavi i rumenim obrazima.', ghost: 'Bijeli duh s valovitim rubom i tamnim očima.', dragon: 'Zeleni zmaj sa zlatnim šiljcima i zmijskim zjenicama.', bee: 'Prugasta pčela s krilcima.', diamond: 'Brušeni dijamant koji svjetluca, za one koji prođu baš sve razine.', cosmos: 'Komadić svemira sa zvijezdama i zlatnom zvijezdom na vrhu, za one koji prođu prvih 100 razina.' },
      RULES: [
        ['Cilj', 'Izvedi crveni blok kroz izlaz, strelicu na desnom rubu ploče. Crveni mora biti u istom redu kao strelica i dotaknuti desni rub.'],
        ['Potez', 'Povuci blok prstom ili mišem lijevo ili desno. Klizi za koliko god slobodnih polja želiš, ali nikad gore ili dolje. Na tipkovnici odaberi blok tipkom Tab i miči ga strelicama.'],
        ['Gravitacija', 'Nakon svakog poteza sve što nema oslonac padne. Blok stoji ako je ispod barem jednog njegovog dijela nešto. Jedan potez može pokrenuti cijeli lanac padova.'],
        ['Zvjezdice', 'Cilj je najmanji mogući broj poteza. Riješiš li u tom broju, dobiješ 3 zvjezdice, s najviše 2 poteza više 2, inače 1. „Vrati” poništava zadnji potez, a „Ponovi” kreće ispočetka.'],
      ],
      MODES: [
        ['Razine', `${levels} razina u ${chapters} poglavlja. Otključavaju se redom, postupno uvode nove blokove i postaju sve teže.`],
        ['Dnevna zagonetka', 'Svaki dan nova zagonetka, ista za sve igrače. Na ljestvici pobjeđuje manje poteza, a kod jednakog broja brže vrijeme. Nedjeljom je teža.'],
        ['Beskonačno', `Niz zagonetki koji nikad ne završava: prvih ${endless} je unaprijed složeno, a dalje ih igra slaže sama. Postaju sve teže i izmjenjuju vrste blokova.`],
      ],
      FEATURES: [
        ['Ljestvica', 'Natječi se na dnevnoj ljestvici, u beskonačnom nizu i u zvjezdicama iz razina.'],
        ['Prijava i više uređaja', 'Prijavi se Google računom, e-mailom ili korisničkim imenom i lozinkom. Napredak te prati na mobitelu i na računalu.'],
        ['Profil', 'Pregled tvojih razina, zvjezdica, beskonačnog niza i mjesta na ljestvicama. Korisničko ime možeš promijeniti kad god želiš.'],
        ['Izgledi crvenog bloka', 'Riješi zadnju razinu poglavlja i otključaj novi izgled crvenog bloka, od mačka i robota do zmaja i dijamanta. Odabireš ga u izborniku.'],
        ['Niz dana i postignuća', 'Rješavaj dnevnu zagonetku svaki dan i gradi niz 🔥. Za razine, zvjezdice, nizove i beskonačne zagonetke dobivaš postignuća.'],
        ['Podijeli rezultat', 'Nakon rješenja jednim dodirom podijeli rezultat s prijateljima i izazovi ih na istu zagonetku.'],
        ['Pošteni rezultati', 'Server ponovno odigra svako poslano rješenje i sprema samo ispravna. Na ljestvicu se ne može upisati izmišljeni rezultat.'],
        ['Savjeti', 'Zapeo si? Savjet označi sljedeći najbolji potez iz trenutnog položaja. Svaki dan dobiješ jedan besplatni savjet, a još jedan za kratku reklamu. U dnevnoj zagonetki savjeta nema.'],
        ['Neograničeno „Vrati”', 'Eksperimentiraj bez kazne: svaki potez se može poništiti, a ploča vratiti na početak.'],
        ['Zvuk i glazba', 'Zvukovi drveta za klizanje, slijetanje i pucanje, a u pozadini Bachov Preludij u C-duru. Oboje se može isključiti.'],
        ['Radi bez interneta', 'Igra pamti napredak na uređaju i šalje rezultate kad se veza vrati.'],
        ['Mobitel i računalo', 'Igra se u pregledniku, bez instalacije. Prstom na mobitelu, mišem ili tipkovnicom na računalu.'],
        ['Četiri jezika', 'Hrvatski, engleski, talijanski i njemački. Igra sama odabere jezik preglednika, a može se promijeniti u izborniku.'],
        ['Igraj i bez prijave', `Bez računa dobiješ smiješno ime gosta i igraš prvih ${GUEST.levels} razina, ${GUEST.endless} beskonačnih zagonetki i dnevnu zagonetku. Sve ostale razine, beskonačni niz bez ograničenja i mjesto na ljestvici imaju prijavljeni igrači.`],
      ],
    },
    en: {
      TYPES: {
        r: ['Red block', 'The one you have to get out. Bring it to the arrow on the right edge, in the same row.'],
        n: ['Plain block', 'Slides left or right as far as you like. When nothing is below it, it falls.'],
        f: ['Stone', 'The only one that never moves: you cannot push it and it does not fall. A solid support.'],
        i: ['Ice', 'Once pushed, it slides all the way to the first obstacle. It cannot stop halfway.'],
        h: ['Heavy block', 'If it falls onto a cracked block, it breaks it and keeps falling. Just resting on one does nothing.'],
        k: ['Cracked block', 'Moves and falls like a plain block, but a falling heavy block breaks it and it disappears.'],
        b: ['Balloon', 'It does not fall, it rises until it hits something above. Other blocks can stand on it.'],
        a: ['Arrow', 'Slides only the way the arrow points. Otherwise it falls like a plain block.'],
        s: ['Spring', 'Never moves or falls. A block that slides up to it bounces back and slides all the way the other way, even an arrow.'],
      },
      SKIN_TEXT: { classic: 'The original red block with big eyes.', cat: 'An orange cat with ears and cat-like pupils.', robot: 'A metal robot with an antenna and glowing eyes.', melon: 'A juicy slice of watermelon, seeds and all.', rainbow: 'Every colour of the rainbow in one block.', gold: 'A shiny gold block for the persistent.', king: 'A royal red block with a golden crown.', frog: 'A green frog with round bumps on its head and rosy cheeks.', ghost: 'A white ghost with a wavy hem and dark eyes.', dragon: 'A green dragon with golden spikes and reptile pupils.', bee: 'A striped bee with little wings.', diamond: 'A cut diamond that sparkles, for those who beat every single level.', cosmos: 'A piece of outer space full of stars, with a golden star on top, for those who beat the first 100 levels.' },
      RULES: [
        ['Goal', 'Get the red block out through the exit, the arrow on the right edge of the board. The red block has to be in the arrow’s row and touch the right edge.'],
        ['Moves', 'Drag a block left or right with your finger or mouse. It slides as many free cells as you like, but never up or down. With a keyboard, pick a block with Tab and move it with the arrow keys.'],
        ['Gravity', 'After every move, anything without support falls. A block stands if something is under at least one of its cells. One move can start a whole chain of falls.'],
        ['Stars', 'The target is the fewest moves possible. Solve it in that many and you get 3 stars, with at most 2 extra moves 2, otherwise 1. “Undo” takes back the last move and “Restart” starts over.'],
      ],
      MODES: [
        ['Levels', `${levels} levels in ${chapters} chapters. They unlock in order, introduce new blocks step by step and get harder.`],
        ['Daily puzzle', 'A new puzzle every day, the same for all players. Fewest moves wins the leaderboard, and with equal moves the faster time. Sundays are harder.'],
        ['Endless', `A run of puzzles that never ends: the first ${endless} are prepared in advance, after that the game builds them itself. They get harder and mix the block types.`],
      ],
      FEATURES: [
        ['Leaderboard', 'Compete on the daily leaderboard, in the endless run and in stars from the levels.'],
        ['Sign-in and devices', 'Sign in with Google, e-mail or a username and password. Your progress follows you from phone to computer.'],
        ['Profile', 'See your levels, stars, endless run and leaderboard places. You can change your username at any time.'],
        ['Red block looks', 'Finish the last level of a chapter to unlock a new look for the red block, from a cat and a robot to a dragon and a diamond. Pick one in the menu.'],
        ['Streaks and achievements', 'Solve the daily puzzle every day to build a 🔥 streak. Levels, stars, streaks and endless puzzles earn you achievements.'],
        ['Share your result', 'After solving, share your result with friends in one tap and challenge them to the same puzzle.'],
        ['Fair results', 'The server replays every submitted solution and keeps only valid ones. Nobody can put a made-up score on the leaderboard.'],
        ['Hints', 'Stuck? A hint highlights the next best move from where you are. You get one free hint a day, and another for watching a short ad. The daily puzzle has no hints.'],
        ['Unlimited undo', 'Experiment without penalty: every move can be undone and the board reset.'],
        ['Sound and music', 'Wooden sounds for sliding, landing and cracking, and Bach’s Prelude in C major in the background. Both can be switched off.'],
        ['Works offline', 'The game keeps your progress on the device and sends results when you are back online.'],
        ['Phone and computer', 'Plays in the browser, no install. Finger on a phone, mouse or keyboard on a computer.'],
        ['Four languages', 'Croatian, English, Italian and German. The game picks your browser’s language, and you can change it in the menu.'],
        ['Play without an account', `Without an account you get a funny guest name and play the first ${GUEST.levels} levels, ${GUEST.endless} endless puzzles and the daily puzzle. All other levels, unlimited endless mode and a place on the leaderboard are for signed-in players.`],
      ],
    },
    it: {
      TYPES: {
        r: ['Blocco rosso', 'È quello da far uscire. Portalo alla freccia sul bordo destro, nella stessa riga.'],
        n: ['Blocco normale', 'Scorre a sinistra o a destra quanto vuoi. Quando sotto non c’è niente, cade.'],
        f: ['Pietra', 'L’unico che non si muove mai: non si può spingere e non cade. Un appoggio solido.'],
        i: ['Ghiaccio', 'Una volta spinto, scivola fino al primo ostacolo. Non può fermarsi a metà.'],
        h: ['Blocco pesante', 'Se cade su un blocco crepato, lo rompe e continua a cadere. Se ci è solo appoggiato, non succede nulla.'],
        k: ['Blocco crepato', 'Si muove e cade come un blocco normale, ma un blocco pesante in caduta lo rompe e sparisce.'],
        b: ['Palloncino', 'Non cade, sale finché non urta qualcosa sopra di sé. Altri blocchi possono appoggiarsi su di lui.'],
        a: ['Freccia', 'Scivola solo nella direzione della freccia. Per il resto cade come un blocco normale.'],
        s: ['Molla', 'Non si muove e non cade. Un blocco che scivola fino a lei rimbalza e scivola fino in fondo dall’altra parte, anche una freccia.'],
      },
      SKIN_TEXT: { classic: 'Il blocco rosso originale con gli occhioni.', cat: 'Un gatto arancione con orecchie e pupille da gatto.', robot: 'Un robot di metallo con antenna e occhi luminosi.', melon: 'Una succosa fetta di anguria con i semi.', rainbow: 'Tutti i colori dell’arcobaleno in un blocco.', gold: 'Un lucente blocco d’oro per i più tenaci.', king: 'Un regale blocco rosso con corona d’oro.', frog: 'Una rana verde con due gobbe tonde in testa e le guance rosa.', ghost: 'Un fantasma bianco con l’orlo ondulato e occhi scuri.', dragon: 'Un drago verde con punte d’oro e pupille da rettile.', bee: 'Un’ape a strisce con le alucce.', diamond: 'Un diamante tagliato che scintilla, per chi supera proprio tutti i livelli.', cosmos: 'Un pezzo di cielo stellato con una stella d’oro in cima, per chi supera i primi 100 livelli.' },
      RULES: [
        ['Obiettivo', 'Fai uscire il blocco rosso dall’uscita, la freccia sul bordo destro della tavola. Il rosso deve essere nella riga della freccia e toccare il bordo destro.'],
        ['Mosse', 'Trascina un blocco a sinistra o a destra con il dito o il mouse. Scorre di quante caselle libere vuoi, ma mai in su o in giù. Con la tastiera scegli un blocco con Tab e muovilo con le frecce.'],
        ['Gravità', 'Dopo ogni mossa tutto ciò che non ha appoggio cade. Un blocco sta fermo se sotto almeno una sua casella c’è qualcosa. Una mossa può scatenare un’intera catena di cadute.'],
        ['Stelle', 'L’obiettivo è il minor numero di mosse possibile. Se ci riesci prendi 3 stelle, con al massimo 2 mosse in più 2, altrimenti 1. “Annulla” toglie l’ultima mossa e “Ricomincia” riparte da capo.'],
      ],
      MODES: [
        ['Livelli', `${levels} livelli in ${chapters} capitoli. Si sbloccano in ordine, introducono nuovi blocchi poco a poco e diventano sempre più difficili.`],
        ['Rompicapo del giorno', 'Ogni giorno un nuovo rompicapo, uguale per tutti. In classifica vince chi usa meno mosse e, a parità, chi è più veloce. La domenica è più difficile.'],
        ['Infinito', `Una serie di rompicapi che non finisce mai: i primi ${endless} sono preparati in anticipo, poi il gioco li crea da solo. Diventano sempre più difficili e alternano i tipi di blocchi.`],
      ],
      FEATURES: [
        ['Classifica', 'Sfida gli altri nella classifica del giorno, nella serie infinita e nelle stelle dei livelli.'],
        ['Accesso e dispositivi', 'Accedi con Google, e-mail o nome utente e password. I tuoi progressi ti seguono dal telefono al computer.'],
        ['Profilo', 'Vedi i tuoi livelli, le stelle, la serie infinita e le posizioni in classifica. Puoi cambiare il nome utente quando vuoi.'],
        ['Aspetti del blocco rosso', 'Completa l’ultimo livello di un capitolo e sblocca un nuovo aspetto del blocco rosso, dal gatto e dal robot fino al drago e al diamante. Lo scegli nel menu.'],
        ['Serie e traguardi', 'Risolvi il rompicapo del giorno ogni giorno e allunga la tua serie 🔥. Livelli, stelle, serie e rompicapi infiniti ti fanno guadagnare traguardi.'],
        ['Condividi il risultato', 'Dopo la soluzione condividi il risultato con gli amici con un tocco e sfidali sullo stesso rompicapo.'],
        ['Risultati onesti', 'Il server rigioca ogni soluzione inviata e salva solo quelle valide. Nessuno può mettere in classifica un risultato inventato.'],
        ['Suggerimenti', 'Bloccato? Un suggerimento evidenzia la mossa migliore dalla posizione attuale. Ne ricevi uno gratis al giorno e un altro guardando una breve pubblicità. Il rompicapo del giorno non ha suggerimenti.'],
        ['Annulla senza limiti', 'Sperimenta senza penalità: ogni mossa si può annullare e la tavola si può ricominciare.'],
        ['Suoni e musica', 'Suoni di legno per scivolate, atterraggi e rotture, e in sottofondo il Preludio in do maggiore di Bach. Si possono disattivare entrambi.'],
        ['Funziona offline', 'Il gioco salva i progressi sul dispositivo e invia i risultati quando torni online.'],
        ['Telefono e computer', 'Si gioca nel browser, senza installazione. Con il dito sul telefono, con mouse o tastiera sul computer.'],
        ['Quattro lingue', 'Croato, inglese, italiano e tedesco. Il gioco sceglie la lingua del browser e puoi cambiarla nel menu.'],
        ['Gioca anche senza account', `Senza account ricevi un buffo nome da ospite e giochi i primi ${GUEST.levels} livelli, ${GUEST.endless} rompicapi infiniti e il rompicapo del giorno. Tutti gli altri livelli, la modalità infinita senza limiti e il posto in classifica sono per i giocatori registrati.`],
      ],
    },
    de: {
      TYPES: {
        r: ['Roter Block', 'Den musst du hinausbringen. Führ ihn zum Pfeil am rechten Rand, in dieselbe Reihe.'],
        n: ['Normaler Block', 'Gleitet so weit nach links oder rechts, wie du willst. Ist nichts darunter, fällt er.'],
        f: ['Stein', 'Der einzige, der sich nie bewegt: Er lässt sich nicht schieben und fällt nicht. Eine feste Stütze.'],
        i: ['Eis', 'Einmal angestoßen, rutscht es bis zum ersten Hindernis. Auf halbem Weg kann es nicht anhalten.'],
        h: ['Schwerer Block', 'Fällt er auf einen rissigen Block, zerbricht er ihn und fällt weiter. Liegt er nur darauf, passiert nichts.'],
        k: ['Rissiger Block', 'Bewegt sich und fällt wie ein normaler Block, aber ein fallender schwerer Block zerbricht ihn, und er verschwindet.'],
        b: ['Ballon', 'Er fällt nicht, sondern steigt, bis er oben auf etwas trifft. Andere Blöcke können auf ihm stehen.'],
        a: ['Pfeil', 'Gleitet nur in Pfeilrichtung. Sonst fällt er wie ein normaler Block.'],
        s: ['Feder', 'Bewegt sich nie und fällt nicht. Ein Block, der bis an sie gleitet, prallt ab und gleitet ganz zurück auf die andere Seite, sogar ein Pfeil.'],
      },
      SKIN_TEXT: { classic: 'Der ursprüngliche rote Block mit großen Augen.', cat: 'Eine orange Katze mit Ohren und Katzenpupillen.', robot: 'Ein Metallroboter mit Antenne und leuchtenden Augen.', melon: 'Eine saftige Scheibe Wassermelone mit Kernen.', rainbow: 'Alle Farben des Regenbogens in einem Block.', gold: 'Ein glänzender Goldblock für Ausdauernde.', king: 'Ein königlicher roter Block mit goldener Krone.', frog: 'Ein grüner Frosch mit runden Höckern auf dem Kopf und rosigen Wangen.', ghost: 'Ein weißes Gespenst mit welligem Saum und dunklen Augen.', dragon: 'Ein grüner Drache mit goldenen Zacken und Reptilienpupillen.', bee: 'Eine gestreifte Biene mit kleinen Flügeln.', diamond: 'Ein geschliffener, funkelnder Diamant für alle, die wirklich jedes Level schaffen.', cosmos: 'Ein Stück Weltall voller Sterne, mit einem goldenen Stern obendrauf, für alle, die die ersten 100 Level schaffen.' },
      RULES: [
        ['Ziel', 'Bring den roten Block durch den Ausgang hinaus, den Pfeil am rechten Rand des Bretts. Der rote Block muss in der Reihe des Pfeils sein und den rechten Rand berühren.'],
        ['Züge', 'Zieh einen Block mit Finger oder Maus nach links oder rechts. Er gleitet beliebig viele freie Felder, aber nie nach oben oder unten. Mit der Tastatur wählst du einen Block mit Tab und bewegst ihn mit den Pfeiltasten.'],
        ['Schwerkraft', 'Nach jedem Zug fällt alles, was keinen Halt hat. Ein Block steht, wenn unter mindestens einem seiner Felder etwas ist. Ein Zug kann eine ganze Kette von Stürzen auslösen.'],
        ['Sterne', 'Das Ziel ist die kleinstmögliche Zahl an Zügen. Schaffst du das, gibt es 3 Sterne, mit höchstens 2 Zügen mehr 2, sonst 1. „Zurück“ nimmt den letzten Zug zurück, „Neu“ fängt von vorne an.'],
      ],
      MODES: [
        ['Level', `${levels} Level in ${chapters} Kapiteln. Sie werden der Reihe nach freigeschaltet, führen nach und nach neue Blöcke ein und werden immer schwerer.`],
        ['Tagesrätsel', 'Jeden Tag ein neues Rätsel, für alle gleich. In der Rangliste gewinnt, wer die wenigsten Züge braucht, bei Gleichstand die schnellere Zeit. Sonntags ist es schwerer.'],
        ['Endlos', `Eine Reihe von Rätseln, die nie endet: Die ersten ${endless} sind vorbereitet, danach baut das Spiel sie selbst. Sie werden schwerer und wechseln die Blockarten.`],
      ],
      FEATURES: [
        ['Rangliste', 'Miss dich in der Tagesrangliste, im Endlosmodus und mit den Sternen aus den Leveln.'],
        ['Anmeldung und Geräte', 'Melde dich mit Google, E-Mail oder Benutzername und Passwort an. Dein Fortschritt begleitet dich vom Handy zum Computer.'],
        ['Profil', 'Sieh deine Level, Sterne, deinen Endlos-Lauf und deine Ranglistenplätze. Deinen Benutzernamen kannst du jederzeit ändern.'],
        ['Looks für den roten Block', 'Schaff das letzte Level eines Kapitels und schalte ein neues Aussehen für den roten Block frei, von Katze und Roboter bis Drache und Diamant. Du wählst es im Menü.'],
        ['Serien und Erfolge', 'Löse jeden Tag das Tagesrätsel und bau deine 🔥-Serie aus. Für Level, Sterne, Serien und endlose Rätsel bekommst du Erfolge.'],
        ['Ergebnis teilen', 'Teile nach dem Lösen dein Ergebnis mit einem Tipp und fordere Freunde mit demselben Rätsel heraus.'],
        ['Faire Ergebnisse', 'Der Server spielt jede eingereichte Lösung nach und speichert nur gültige. Niemand kann ein erfundenes Ergebnis in die Rangliste bringen.'],
        ['Tipps', 'Festgefahren? Ein Tipp markiert den besten nächsten Zug von deiner Position aus. Du bekommst einen Gratis-Tipp pro Tag und einen weiteren für eine kurze Werbung. Beim Tagesrätsel gibt es keine Tipps.'],
        ['Unbegrenztes Zurück', 'Probier ohne Strafe aus: Jeder Zug lässt sich zurücknehmen und das Brett neu starten.'],
        ['Klang und Musik', 'Holzgeräusche für Gleiten, Landen und Zerbrechen, im Hintergrund Bachs Präludium in C-Dur. Beides lässt sich ausschalten.'],
        ['Funktioniert offline', 'Das Spiel speichert den Fortschritt auf dem Gerät und schickt Ergebnisse, sobald du wieder online bist.'],
        ['Handy und Computer', 'Läuft im Browser, ohne Installation. Mit dem Finger am Handy, mit Maus oder Tastatur am Computer.'],
        ['Vier Sprachen', 'Kroatisch, Englisch, Italienisch und Deutsch. Das Spiel wählt die Sprache deines Browsers, im Menü kannst du sie ändern.'],
        ['Auch ohne Konto spielen', `Ohne Konto bekommst du einen lustigen Gastnamen und spielst die ersten ${GUEST.levels} Level, ${GUEST.endless} Endlos-Rätsel und das Tagesrätsel. Alle weiteren Level, den Endlosmodus ohne Grenze und einen Platz in der Rangliste haben angemeldete Spieler.`],
      ],
    },
  };

  const lang = typeof ToppleI18n !== 'undefined' && TEXT[ToppleI18n.lang] ? ToppleI18n.lang : 'hr';
  const stats = { levels, chapters, endless, types: TYPE_ORDER.length };
  return { ...TEXT[lang], TYPE_ORDER, SKINS, GUEST, ACHIEVEMENTS, stats, TEXT };
})();
if (typeof module !== 'undefined') module.exports = ToppleContent;

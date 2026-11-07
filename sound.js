/* ---------- Geluid: de arena ----------
   Speelt echte opnames af uit assets/sound/. Welke bestanden het spel verwacht staat in SOUNDS hieronder
   en in assets/sound/LEESMIJ.md. Ontbreekt een bestand, dan blijft dat geluid gewoon stil.
   Werkt ook als je index.html direct opent (zonder server): we gebruiken <audio>, geen fetch.
   Gebruik: SFX.init() na een klik (browsers starten geluid pas na een handeling van de speler),
   daarna SFX.cheer(0..1), SFX.boo(0..1), SFX.hit(), SFX.hurt(), SFX.block(), SFX.mood('fight'|'calm'). */

const SFX = (() => {
  // Bestanden per soort geluid. Bij meer bestanden kiest het spel er telkens willekeurig één,
  // zodat het niet steeds hetzelfde klinkt. Andere namen of .ogg/.wav mag ook: pas het dan hier aan.
  const SOUNDS = {
    crowd:    ['assets/sound/crowd-loop.wav'],                    // publiek dat continu roezemoest (loop; .wav herhaalt naadloos)
    cheer:    ['assets/sound/cheer-1.mp3', 'assets/sound/cheer-2.mp3', 'assets/sound/cheer-3.mp3'],   // kort gejuich bij een rake klap
    cheerBig: ['assets/sound/cheer-big.mp3'],                     // groot gejuich: iemand valt, Pugnate!, jij wint
    boo:      ['assets/sound/boo.mp3'],                           // gejoel: jij wordt geraakt of verliest
    hit:      ['assets/sound/hit-1.wav'],                         // een vuistslag raakt (.wav: geen vertraging aan het begin)
    hurt:     ['assets/sound/hurt.wav'],                          // jij wordt geraakt: "oof"
    block:    ['assets/sound/block.wav']                          // een klap wordt geblokt
  };
  // Volumes (0 tot 1). Pas hier aan als iets te hard of te zacht is.
  const MIX = { crowd: { calm: .35, fight: .6 }, cheer: .7, cheerBig: .9, boo: .7, hit: .6, hurt: .7, block: .5 };
  const MAX_AT_ONCE = 3;   // zoveel juich- of joelgeluiden tegelijk, daarna wordt de oudste stilgezet

  let started = false, muted = false, crowd = null, crowdTarget = MIX.crowd.calm, fade = null;
  const ok = {}, playing = [];
  try { muted = localStorage.getItem('rn-muted') === '1'; } catch (e) {}

  // Kijk welke bestanden er echt zijn; ontbrekende worden overgeslagen.
  for (const [kind, list] of Object.entries(SOUNDS)) {
    ok[kind] = [];
    for (const src of list) {
      const a = new Audio(); a.preload = 'auto';
      a.oncanplaythrough = () => { if (!ok[kind].includes(src)) ok[kind].push(src); a.oncanplaythrough = null; };
      a.onerror = () => {};
      a.src = encodeURI(src);
    }
  }
  const pick = kind => { const l = ok[kind]; return l.length ? l[Math.floor(Math.random() * l.length)] : null; };

  function play(kind, vol, track) {
    if (!started || muted) return;
    const src = pick(kind); if (!src) return;
    const a = new Audio(encodeURI(src)); a.volume = Math.max(0, Math.min(1, vol));
    a.playbackRate = .94 + Math.random() * .12;   // klein verschil in toonhoogte, klinkt minder herhalend
    a.play().catch(() => {});
    if (track) {
      playing.push(a); a.onended = () => { const i = playing.indexOf(a); if (i >= 0) playing.splice(i, 1); };
      while (playing.length > MAX_AT_ONCE) { const old = playing.shift(); old.pause(); }
    }
  }
  function startCrowd() {
    const src = pick('crowd'); if (!src || crowd) return;
    crowd = new Audio(encodeURI(src)); crowd.loop = true; crowd.volume = muted ? 0 : crowdTarget;
    crowd.play().catch(() => {});
  }
  function fadeCrowd(to) {
    crowdTarget = to; if (!crowd) return;
    clearInterval(fade);
    fade = setInterval(() => {
      const goal = muted ? 0 : crowdTarget, v = crowd.volume + (goal - crowd.volume) * .15;
      crowd.volume = Math.abs(goal - v) < .01 ? goal : v;
      if (crowd.volume === goal) clearInterval(fade);
    }, 50);
  }

  return {
    SOUNDS, MIX,
    init() {
      if (started) return; started = true;
      startCrowd();
      if (!crowd) setTimeout(startCrowd, 800);   // het bestand was misschien nog niet gecontroleerd
    },
    get muted() { return muted; },
    setMuted(m) {
      muted = m; try { localStorage.setItem('rn-muted', m ? '1' : '0'); } catch (e) {}
      if (m) playing.splice(0).forEach(a => a.pause());
      fadeCrowd(crowdTarget);
    },
    mood(m) { fadeCrowd(MIX.crowd[m] ?? MIX.crowd.calm); },
    cheer(a = .5) { a >= .6 && ok.cheerBig.length ? play('cheerBig', MIX.cheerBig * (.6 + .4 * a), true) : play('cheer', MIX.cheer * (.5 + .5 * a), true); },
    boo(a = .5) { play('boo', MIX.boo * (.4 + .6 * a), true); },
    hit() { play('hit', MIX.hit); },
    hurt() { play('hit', MIX.hit * .8); play('hurt', MIX.hurt); },   // jij geraakt: de klap én je "oof"
    block() { play('block', MIX.block); },
    // Welke bestanden gevonden zijn (handig om te controleren in de console: SFX.found()).
    found() { return Object.fromEntries(Object.entries(ok).map(([k, l]) => [k, l.length + ' van ' + SOUNDS[k].length])); }
  };
})();

/* ---------- Geluid: de arena ----------
   Speelt echte opnames af uit assets/sound/. Welke bestanden het spel verwacht staat in SOUNDS hieronder
   en in assets/sound/LEESMIJ.md. Ontbreekt een bestand, dan blijft dat geluid gewoon stil.
   Werkt ook als je index.html direct opent (zonder server): we gebruiken <audio>, geen fetch.
   Gebruik: SFX.init() na een klik (browsers starten geluid pas na een handeling van de speler),
   daarna SFX.cheer(0..1), SFX.boo(0..1), SFX.hit(), SFX.hurt(), SFX.block(), SFX.mood('fight'|'calm'|'town'). */

const SFX = (() => {
  // Bestanden per soort geluid. Bij meer bestanden kiest het spel er telkens willekeurig één,
  // zodat het niet steeds hetzelfde klinkt. Andere namen of .ogg/.wav mag ook: pas het dan hier aan.
  const SOUNDS = {
    crowd:    ['assets/sound/crowd-loop.wav'],                    // publiek dat continu roezemoest (loop; .wav herhaalt naadloos)
    cheer:    ['assets/sound/cheer-1.mp3', 'assets/sound/cheer-2.mp3', 'assets/sound/cheer-3.mp3'],   // kort gejuich bij een rake klap
    cheerBig: ['assets/sound/cheer-big.mp3'],                     // groot gejuich: iemand valt, Pugnate!, jij wint
    boo:      ['assets/sound/boo.mp3'],                           // gejoel: jij verliest
    hit:      ['assets/sound/hit-1.wav'],                         // een vuistslag raakt (.wav: geen vertraging aan het begin)
    hurt:     ['assets/sound/hurt.wav'],                          // jij wordt geraakt: "oof"
    block:    ['assets/sound/block.wav']                          // een klap wordt geblokt
  };
  // Volumes (0 tot 1). Pas hier aan als iets te hard of te zacht is.
  const MIX = { crowd: { calm: .25, fight: .42, town: .1 }, cheer: .7, cheerBig: .9, boo: .7, hit: .6, hurt: .7, block: .5 };
  const MAX_AT_ONCE = 2;   // zoveel juich- of joelgeluiden tegelijk; daarna faadt de oudste snel weg
  const GAP = { cheer: .35, cheerBig: 1.5, boo: 1.5 };   // seconden: niet opnieuw starten binnen deze tijd

  const lastStart = {};
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

  function fadeOut(a, ms = 180) {
    const v0 = a.volume, t0 = performance.now();
    const step = () => { const k = (performance.now() - t0) / ms; if (k >= 1) { a.pause(); return; } a.volume = v0 * (1 - k); requestAnimationFrame(step); };
    step();
  }
  // track = juich- en joelgeluiden: die worden beperkt in aantal. Twee keer dezelfde opname vlak na elkaar
  // geeft een holle, zwiepende klank; daarom kiezen we een andere variant of slaan we hem over.
  function play(kind, vol, track) {
    if (!started || muted) return;
    const now = performance.now() / 1000;
    if (GAP[kind] && now - (lastStart[kind] || -99) < GAP[kind]) return;
    const busy = playing.filter(a => !a.ended).map(a => a.dataset.src);
    const free = ok[kind].filter(src => !busy.includes(src));
    const list = free.length ? free : ok[kind]; if (!list.length) return;
    const src = list[Math.floor(Math.random() * list.length)];
    if (track && busy.includes(src)) return;
    lastStart[kind] = now;
    const a = new Audio(encodeURI(src)); a.dataset.src = src; a.volume = Math.max(0, Math.min(1, vol));
    if (!track) {   // klappen: klein verschil in echte toonhoogte (niet opgerekt), klinkt minder herhalend
      a.preservesPitch = false; a.playbackRate = .92 + Math.random() * .16;
    }
    a.play().catch(() => {});
    if (track) {
      playing.push(a); a.onended = () => { const i = playing.indexOf(a); if (i >= 0) playing.splice(i, 1); };
      while (playing.length > MAX_AT_ONCE) fadeOut(playing.shift());
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
      if (m) playing.splice(0).forEach(a => fadeOut(a, 80));
      fadeCrowd(crowdTarget);
    },
    mood(m) { fadeCrowd(MIX.crowd[m] ?? MIX.crowd.calm); },
    cheer(a = .5) {
      const now = performance.now() / 1000;
      if (now - (lastStart.cheerBig || -99) < GAP.cheerBig) return;   // groot gejuich is nog bezig: niets eroverheen
      a >= .6 && ok.cheerBig.length ? play('cheerBig', MIX.cheerBig * (.6 + .4 * a), true) : play('cheer', MIX.cheer * (.5 + .5 * a), true);
    },
    boo(a = .5) { play('boo', MIX.boo * (.4 + .6 * a), true); },
    hit() { play('hit', MIX.hit); },
    hurt() { play('hit', MIX.hit * .8); play('hurt', MIX.hurt); },   // jij geraakt: de klap én je "oof"
    block() { play('block', MIX.block); },
    // Welke bestanden gevonden zijn (handig om te controleren in de console: SFX.found()).
    found() { return Object.fromEntries(Object.entries(ok).map(([k, l]) => [k, l.length + ' van ' + SOUNDS[k].length])); }
  };
})();

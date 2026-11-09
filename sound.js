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
    hit:      ['assets/sound/hit-1.wav', 'assets/sound/hit-2.wav'],   // een klap raakt; twee opnames die elkaar afwisselen (.wav: geen vertraging aan het begin)
    whoosh:   ['assets/sound/whoosh.wav', 'assets/sound/whoosh-2.wav', 'assets/sound/whoosh-3.wav', 'assets/sound/whoosh-4.wav', 'assets/sound/whoosh-5.wav', 'assets/sound/whoosh-6.wav', 'assets/sound/whoosh-7.wav', 'assets/sound/whoosh-8.wav'],   // zwiep van de stok (8 varianten)
    meow:     ['assets/sound/meow.wav'],                          // de kat in de straat
    hurt:     ['assets/sound/hurt.wav'],                          // jij wordt geraakt: "oof"
    block:    ['assets/sound/block.wav'],                         // een klap wordt geblokt (metaal op schild)
    // ----- Nieuwe vijanden. Ontbreekt een bestand, dan klinkt de terugval uit FALLBACK (of niets). -----
    roll:        ['assets/sound/roll.wav'],          // jij rolt: stof en een zwiep
    netCharge:   ['assets/sound/net-charge.wav'],    // retiarius maakt zich klaar om te gooien: touw dat strak trekt
    netThrow:    ['assets/sound/whoosh.wav', 'assets/sound/whoosh-2.wav', 'assets/sound/whoosh-3.wav', 'assets/sound/whoosh-4.wav', 'assets/sound/whoosh-5.wav', 'assets/sound/whoosh-6.wav', 'assets/sound/whoosh-7.wav', 'assets/sound/whoosh-8.wav'],   // retiarius gooit zijn net (de zwiepen)
    net:         ['assets/sound/net.wav'],           // je zit in het net (touw dat strak trekt)
    javelin:     ['assets/sound/whoosh.wav', 'assets/sound/whoosh-2.wav', 'assets/sound/whoosh-3.wav', 'assets/sound/whoosh-4.wav', 'assets/sound/whoosh-5.wav', 'assets/sound/whoosh-6.wav', 'assets/sound/whoosh-7.wav', 'assets/sound/whoosh-8.wav'],   // werpspeer of lans vliegt (voorlopig de zwiepen)
    woodBreak:   ['assets/sound/crash.wav'],         // speer van de hoplomachus breekt (zelfde houtbreuk als de wagen)
    shieldBreak: ['assets/sound/shield-break.wav'],  // scutum van de murmillo breekt
    crash:       ['assets/sound/crash.wav'],         // wagen breekt, olifant tegen de muur
    horseFall:   ['assets/sound/horse-fall-1.mp3', 'assets/sound/horse-fall-2.mp3'],   // paard valt neer
    gallop:      ['assets/sound/gallop.mp3'],        // eques zet een charge in
    horse:       ['assets/sound/horse.mp3'],         // paard hinnikt als het de arena in komt (zelfde als in de stallen)
    tiger:       ['assets/sound/tiger.mp3'],         // tijger komt binnen
    lion:        ['assets/sound/lion.mp3'],          // leeuw komt binnen en brult
    bear:        ['assets/sound/bear.mp3'],          // beer komt binnen of wordt woest
    elephant:    ['assets/sound/elephant-1.mp3', 'assets/sound/elephant-2.mp3', 'assets/sound/elephant-3.mp3'],   // olifant komt binnen of stormt
    hyena:       ['assets/sound/hyena-1.mp3', 'assets/sound/hyena-2.mp3', 'assets/sound/hyena-3.mp3', 'assets/sound/hyena-pack.mp3']   // hyena's: één lach, verschoven in toonhoogte en tempo, plus een roedel
  };
  // Terugval als een bestand (nog) ontbreekt.
  const FALLBACK = { roll: 'whoosh', netThrow: 'whoosh', javelin: 'whoosh', woodBreak: 'hit', shieldBreak: 'hit', crash: 'hit', horseFall: 'horse', gallop: 'horse', block: 'hit' };
  // Volumes (0 tot 1). Pas hier aan als iets te hard of te zacht is.
  const MIX = { crowd: { calm: .25, fight: .42, town: 0 }, cheer: .7, cheerBig: .9, boo: .7, hit: .6, hurt: .7, block: .5, whoosh: .45, meow: .3, purr: .7,
                roll: .4, netCharge: .55, netThrow: .45, net: .6, javelin: .45, woodBreak: .8, shieldBreak: .7, crash: .8, horseFall: .6, gallop: .35, horse: .45, tiger: .8, lion: .85, bear: .75, elephant: .85, hyena: .55 };
  // De straat: achtergrond per werkplaats. street = volume op straat (0 = daar niet te horen), inside = in die winkel;
  // chunk = zoveel seconden spelen (vanaf een willekeurig punt), pause = zoveel seconden stil daarna. whole = het hele bestand afspelen.
  // loop = continu (vogeltjes). shop = hoort bij die winkel (ook als die nog dicht is, wordt er binnen gewerkt).
  const AMB = {
    birds:   { src: 'assets/sound/birds-loop.wav', loop: true, street: .25, inside: .12 },
    smith:   { src: 'assets/sound/smithy.mp3',    shop: 'smith',   street: .1,  inside: .6,  chunk: [5, 10], pause: [6, 16], pauseIn: [1, 3] },
    bowyer:  { src: 'assets/sound/carve.mp3',     shop: 'bowyer',  street: .18, inside: .55, chunk: [3, 6], pause: [5, 11], pauseIn: [2, 5] },
    armorer: { src: 'assets/sound/footsteps.mp3', shop: 'armorer', street: 0,   inside: .35, chunk: [4, 8], pause: [3, 8], pauseIn: [2, 5] },
    stable:  { src: 'assets/sound/horse.mp3',     shop: 'stable',  street: .05, inside: .25,  whole: true, pause: [12, 30], pauseIn: [4, 9] },
    clop:    { src: 'assets/sound/clopping.mp3',  street: .075, inside: .025, whole: true, pause: [20, 45], first: [6, 14] }   // komt af en toe langs
  };
  const PURR = 'assets/sound/purr-loop.wav';
  const MAX_AT_ONCE = 2;   // zoveel juich- of joelgeluiden tegelijk; daarna faadt de oudste snel weg
  const GAP = { cheer: .35, cheerBig: 1.5, boo: 1.5, meow: 6, horse: 1.2, tiger: 1.5, lion: 1.5, bear: 1.5, elephant: 1.5, hyena: 2.5, gallop: .8 };   // seconden: niet opnieuw starten binnen deze tijd

  const lastStart = {};
  let started = false, muted = false, crowd = null, crowdTarget = MIX.crowd.calm, fade = null;
  const ok = {}, playing = [];
  try { muted = localStorage.getItem('rn-muted') === '1'; } catch (e) {}
  // Hoofdvolume (0..1), op het startscherm in te stellen; alles hieronder wordt ermee vermenigvuldigd.
  let master = .6;
  try { const v = parseFloat(localStorage.getItem('rn-volume')); if (!isNaN(v)) master = v; } catch (e) {}

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
    const a = new Audio(encodeURI(src)); a.dataset.src = src; a.volume = Math.max(0, Math.min(1, vol * master));
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
    crowd = new Audio(encodeURI(src)); crowd.loop = true; crowd.volume = muted ? 0 : crowdTarget * master;
    crowd.play().catch(() => {});
  }
  function fadeCrowd(to) {
    crowdTarget = to; if (!crowd) return;
    clearInterval(fade);
    fade = setInterval(() => {
      const goal = muted ? 0 : crowdTarget * master, v = crowd.volume + (goal - crowd.volume) * .15;
      crowd.volume = Math.abs(goal - v) < .01 ? goal : v;
      if (crowd.volume === goal) clearInterval(fade);
    }, 50);
  }

  /* ---------- De straat ---------- */
  const amb = {};   // per bron: { a: Audio, timer, playing }
  let where = null, openShops = [];
  const rnd = ([a, b]) => a + Math.random() * (b - a);
  function ramp(a, to, ms, then) {
    clearInterval(a._ramp); const v0 = a.volume, t0 = performance.now();
    a._ramp = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms); a.volume = Math.max(0, Math.min(1, v0 + (to - v0) * k));
      if (k >= 1) { clearInterval(a._ramp); if (then) then(); }
    }, 40);
  }
  const level = (key) => {
    const c = AMB[key];
    if (muted || !where) return 0;
    if (where === 'street') return c.street * master;
    if (c.shop === where) return c.inside * master;          // in deze winkel
    if (c.shop) return c.street * .5 * master;                // de andere werkplaatsen hoor je gedempt
    return (c.inside ?? 0) * master;                         // vogels en hoefgetrappel: zacht binnen
  };
  function schedule(key, wait) {
    const s = amb[key]; clearTimeout(s.timer);
    s.timer = setTimeout(() => playChunk(key), wait * 1000);
  }
  function playChunk(key) {
    const c = AMB[key], s = amb[key];
    if (!where) return;
    const vol = level(key);
    const inside = where === c.shop;
    if (vol <= 0) { schedule(key, 3); return; }
    const a = s.a, dur = isFinite(a.duration) ? a.duration : 0;
    const len = c.whole ? dur : Math.min(rnd(c.chunk), dur || 5);
    a.currentTime = c.whole || !dur ? 0 : Math.random() * Math.max(0, dur - len);
    a.volume = 0; a.play().catch(() => {}); s.playing = true;
    ramp(a, vol, c.whole ? 120 : 600);
    clearTimeout(s.stop);
    s.stop = setTimeout(() => ramp(a, 0, c.whole ? 300 : 800, () => { a.pause(); s.playing = false; schedule(key, rnd(inside && c.pauseIn ? c.pauseIn : c.pause)); }), Math.max(.5, len - (c.whole ? .3 : .8)) * 1000);
  }
  function setPlace(place, shops) {
    where = place; if (shops) openShops = shops;
    for (const [key, c] of Object.entries(AMB)) {
      if (!amb[key]) { const a = new Audio(encodeURI(c.src)); a.preload = 'auto'; a.loop = !!c.loop; a.onerror = () => {}; amb[key] = { a, timer: 0, playing: false }; }
      const s = amb[key], vol = level(key);
      if (!place) { clearTimeout(s.timer); clearTimeout(s.stop); if (s.playing || c.loop) ramp(s.a, 0, 500, () => { s.a.pause(); s.playing = false; }); continue; }
      if (c.loop) { if (s.a.paused) { s.a.volume = 0; s.a.play().catch(() => {}); } ramp(s.a, vol, 800); continue; }
      if (s.playing) ramp(s.a, vol, 500);                 // klinkt al: alleen harder of zachter
      else if (!s.timer || place !== 'street') schedule(key, place === c.shop ? .3 : rnd(c.first || [1, c.pause ? c.pause[0] : 4]));
    }
  }
  let purr = null;

  return {
    SOUNDS, MIX, AMB,
    // De straat: SFX.town('street', ['smith', ...]) op straat, SFX.town('smith') in een winkel, SFX.town(null) weg uit de stad.
    town(place, shops) { if (!started) return; setPlace(place, shops); },
    whoosh() { play('whoosh', MIX.whoosh); },
    meow() { play('meow', MIX.meow); },
    // Elk geluid uit SOUNDS bij naam; ontbreekt het bestand, dan de terugval.
    fx(kind) { const k = ok[kind] && ok[kind].length ? kind : FALLBACK[kind]; if (k && ok[k] && ok[k].length) play(k, MIX[kind] ?? MIX[k] ?? .6); },
    purr(on) {
      if (!started) return;
      if (!purr) { purr = new Audio(encodeURI(PURR)); purr.loop = true; purr.onerror = () => {}; }
      if (on && !muted) { if (purr.paused) { purr.volume = 0; purr.currentTime = Math.random() * 5; purr.play().catch(() => {}); } ramp(purr, MIX.purr * master, 500); }
      else ramp(purr, 0, 900, () => purr.pause());
    },
    init() {
      if (started) return; started = true;
      startCrowd();
      if (!crowd) setTimeout(startCrowd, 800);   // het bestand was misschien nog niet gecontroleerd
    },
    get muted() { return muted; },
    get volume() { return master; },
    // Hoofdvolume instellen (0..1). Omhoog schuiven zet het geluid ook weer aan.
    setVolume(v) {
      master = Math.max(0, Math.min(1, v)); try { localStorage.setItem('rn-volume', String(master)); } catch (e) {}
      if (master > 0 && muted) this.setMuted(false);
      fadeCrowd(crowdTarget); if (where) setPlace(where);
    },
    setMuted(m) {
      muted = m; try { localStorage.setItem('rn-muted', m ? '1' : '0'); } catch (e) {}
      if (m) playing.splice(0).forEach(a => fadeOut(a, 80));
      fadeCrowd(crowdTarget);
      if (where) setPlace(where);
      if (m && purr) purr.pause();
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
    block() { this.fx('block'); },
    // Wat er nu in de straat klinkt (console: SFX.street()).
    street() { return Object.fromEntries(Object.entries(amb).map(([k, s]) => [k, s.a.paused ? '–' : s.a.volume.toFixed(2)])); },
    // Welke bestanden gevonden zijn (handig om te controleren in de console: SFX.found()).
    found() { return Object.fromEntries(Object.entries(ok).map(([k, l]) => [k, l.length + ' van ' + SOUNDS[k].length])); }
  };
})();

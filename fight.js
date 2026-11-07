/* ---------- Proef: gladiatorgevecht ----------
   Jij te voet met je vuisten tegen slaven. Voor elk gevecht verdeel je punten over vijf stats
   (zoals in Swords and Sandals). Je stuurt alleen; slaan gaat vanzelf zodra een
   tegenstander binnen bereik is. Tegenstanders zetten eerst aan (ze kleuren rood en trekken hun
   arm terug) voordat ze uithalen: dat is je moment om weg te stappen.
   Dit bestand vervangt game.js op deze branch. arena.js, quadriga.js en judge.js blijven werken. */

const $ = id => document.getElementById(id);
const cvs = $('arena'), ctx = cvs.getContext('2d'), stage = $('stage');
const css = getComputedStyle(document.documentElement);
const C = {}; ['night','porphyry','bronze','sand','sand-2','ink','muted','blood','blood-dark','laurel','coin','coin-ink','skin','skin-2','skin-3','hair-1','hair-2','iron','toga']
  .forEach(k => C[k] = css.getPropertyValue('--' + k).trim());

/* ---------- Instellingen: hier balanceer je het spel ---------- */
// Lage getallen, zoals een slaaf begint: 8 leven, 2 schade met je vuisten.
const PLAYER = { hp: 8, speed: 85, radius: 10, accel: 12, invuln: .6, weapon: 'fists' };
// Stats: wat één punt doet. Raken en blokken zijn kansen; tegenstanders gebruiken dezelfde formules.
const STATS = {
  strength: { name: 'Strength', nl: 'Kracht',     desc: '+0,5 schade per klap' },
  agility:  { name: 'Agility',  nl: 'Behendigheid', desc: '+6 loopsnelheid (later: afstandswapens)' },
  vitality: { name: 'Vitality', nl: 'Vitaliteit',  desc: '+2 leven' }
};
// Attack en Defense (raak- en blokkans) staan voorlopig uit: elke klap binnen bereik raakt.
// Terugzetten: hitBase .6 en blockBase .1, en de twee stats weer in STATS en S.stats.
const STAT_RULES = { dmg: .5, speed: 6, hitBase: 1, hit: .05, hitMax: 1, blockBase: 0, block: .06, blockMax: .75, hp: 2 };
// Punten verdien je met XP: verslagen tegenstanders laten blauwwitte bolletjes vallen. Een niveau omhoog = POINTS.perLevel punten.
const POINTS = { start: 0, perLevel: 2 };
// XP-drempels (totaal) voor niveau II, III, IV, ... Gevecht I, II, III leveren 5, 10, 15 XP op.
const LEVELS = [4, 12, 24, 40, 60, 85, 115];
// life = na zoveel seconden verdwijnt een bolletje; de laatste 'fade' seconden knippert en vervaagt het.
const XP = { life: 6, fade: 2, perFoe: { slave: 5, gladiator: 10 }, speed: [70, 150], friction: 3.5, settle: .3, pickup: 6, magnet: 26, pull: 160, collect: 5 };
const levelOf = xp => 1 + LEVELS.filter(t => xp >= t).length;
const hitChance = att => Math.min(STAT_RULES.hitMax, STAT_RULES.hitBase + STAT_RULES.hit * att);
const blockChance = def => Math.min(STAT_RULES.blockMax, STAT_RULES.blockBase + STAT_RULES.block * def);
// reach = hoe ver voorbij je eigen lijf je raakt; cooldown = seconden tussen twee slagen; price = in denarii bij de wapensmid.
// Je begint met je vuisten, net als een slaaf: zelfde schade, zelfde bereik, ongeveer even vaak.
const WEAPONS = {
  fists: { name: 'Vuisten', kind: 'fists', dmg: 2, reach: 10, cooldown: 2, swing: .22, knock: 0, price: 0 },   // vuisten duwen niet terug
  stick: { name: 'Stok', kind: 'stick', dmg: 3, reach: 13, cooldown: 2, swing: .22, knock: 85, price: 12 },
  gladius: { name: 'Gladius', kind: 'sword', dmg: 5, reach: 15, cooldown: 2, swing: .2, knock: 60, price: 40 }
};
// windup = hoe lang een tegenstander aanzet voor hij uithaalt; recover = even stilstaan erna.
const FOES = {
  slave: { name: 'slaaf', plural: 'slaven', hp: 14, dmg: 2, armor: 0, attack: 0, defense: 0, speed: 68, radius: 10, reach: 10, windup: .36, recover: .45, cooldown: 1.6, lunge: 9,
           tunic: '#9c8a6c', hair: 'hair-2', skin: 'skin-2' },
  // Gladiator in leren harnas: armor 1 = elke klap doet 1 minder. Sneller en harder dan een slaaf, zet korter aan.
  gladiator: { name: 'gladiator', plural: 'gladiatoren', hp: 16, dmg: 3, armor: 1, attack: 0, defense: 0, speed: 74, radius: 11, reach: 12, windup: .32, recover: .4, cooldown: 1.4, lunge: 10,
           tunic: '#7a5230', belt: '#3b2a1e', hair: 'bronze', skin: 'skin-3' }
};
// De gevechten. Later volgen gladiatoren, 10 slaven en het gemengde gevecht.
// Testen met meer tegenstanders: zet ?n=3 achter de url.
// reward = denarii als je wint. Verlies je een gewoon gevecht of tussenbaas, dan betaal je MONEY.lossShare van die beloning (nooit onder 0).
// kind: 'normal', 'boss' (tussenbaas: zwaarder, meer geld) of 'tournament' (rondes achter elkaar, tot de dood: zie TOURNAMENT).
const FIGHTS = [
  { kind: 'normal', foes: [['slave', 1]], reward: 5 },
  { kind: 'normal', foes: [['slave', 2]], reward: 8 },
  { kind: 'normal', foes: [['slave', 3]], reward: 12 },
  { kind: 'boss', foes: [['gladiator', 1]], reward: 25 },
  { kind: 'tournament', rounds: [[['slave', 2]], [['slave', 3]], [['gladiator', 1]]], reward: 60 }
];
const KINDS = { normal: 'Gevecht', boss: 'Tussenbaas', tournament: 'Toernooi' };
// Toernooi: tussen de rondes krijg je heal × je maximale leven terug. Ga je neer, dan beslist Caesar.
// Kans op duim omhoog = mercyBase + mercyFavor × (schade die je uitdeelde / alle leven van alle tegenstanders), hoogstens mercyMax.
// Duim omhoog: je leeft, maar het toernooi en de beloning zijn weg (geen boete). Duim omlaag: dood, alles opnieuw vanaf gevecht I.
const TOURNAMENT = { heal: .25, mercyBase: .15, mercyFavor: .8, mercyMax: .95 };
const fightDef = () => FIGHTS[Math.min(S.fight, FIGHTS.length - 1)];
const roundsOf = def => def.rounds || [def.foes];
const listSummary = list => list.map(([t, n]) => `${n} ${n > 1 ? FOES[t].plural : FOES[t].name}`).join(' en ');
// Na elk gevecht ga je de stad in; terug naar de arena door op de arena te klikken.
const MONEY = { lossShare: .5 };
// De winkels in de straat. Alleen de wapensmid is al open; wares = sleutels uit WEAPONS.
const SHOPS = {
  smith:   { nl: 'Wapensmid',   la: 'Faber',     open: true,  wares: ['stick', 'gladius'] },
  armorer: { nl: 'Harnasmaker', la: 'Loricarius', open: false, wares: [] },
  bowyer:  { nl: 'Boogmaker',   la: 'Arcuarius', open: false, wares: [] },
  stable:  { nl: 'Stallen',     la: 'Stabulum',  open: false, wares: [] }
};
const FEEL = { hitstop: .06, shake: 5, playerShake: 9, flash: .12 };
// Aftellen aan het begin (III, II, I, Pugnate!): je kunt al lopen, tegenstanders wachten nog.
const INTRO = { step: .8, count: 3, shout: .7 };
// Grootte van het zandveld (oppervlak in wereld-eenheden). Kleiner = de camera zit dichter op het gevecht.
const FIGHT_AREA = 30000;

/* ---------- Toestand ---------- */
const S = { fight: 0, round: 0, dealt: 0, poolHp: 0, money: 0, delta: 0, owned: ['fists'], townSeen: false, xp: 0, xpStart: 0, pointsStart: 0, orbs: [], collect: 0, gained: 0, levelUps: 0, stats: { strength: 0, agility: 0, vitality: 0 }, points: 0, foes: [], floats: [], dust: [], paused: true, over: null, overT: 0, freeze: 0, shake: 0, intro: 0, shout: 0 };
const W = { rx: 280, ry: 220, area: 66000 };
const view = { cw: 1, ch: 1, dpr: 1, scale: 1 };
const P = { x: 0, y: 0, vx: 0, vy: 0, face: -Math.PI / 2, hp: PLAYER.hp, cd: 0, swing: 0, swingDir: 1, hurt: 0, flash: 0, target: null, dead: false };
const car = P;   // arena.js laat Caesar kijken naar 'car'; hier is dat de speler
const steer = { active: false, down: false, x: 0, y: 0 };
const keys = new Set();

const ROMAN = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
function toRoman(n) { if (n <= 0) return 'nulla'; let s = ''; for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; } return s; }
const pick = a => a[Math.floor(Math.random() * a.length)];
const denarii = n => `${n} ${n === 1 ? 'denarius' : 'denarii'}`;
const fmt = n => n.toLocaleString('nl-NL', { maximumFractionDigits: 1 });   // 2,5 in plaats van 2.5
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU2 = Math.PI * 2;
function lerpAngle(a, b, t) { const d = ((b - a + Math.PI * 3) % TAU2) - Math.PI; return a + d * t; }
const testCount = +new URLSearchParams(location.search).get('n') || 0;
// Afgeleide waarden van de speler: basis + stats.
const me = {
  get maxHp() { return PLAYER.hp + STAT_RULES.hp * S.stats.vitality; },
  get speed() { return PLAYER.speed + STAT_RULES.speed * S.stats.agility; },
  get dmg() { return WEAPONS[PLAYER.weapon].dmg + STAT_RULES.dmg * S.stats.strength; },
  get hit() { return hitChance(S.stats.attack || 0); },
  get block() { return blockChance(S.stats.defense || 0); }
};

/* ---------- Wereld ---------- */
function fitWorld(reset) {
  const r = stage.getBoundingClientRect();
  view.cw = Math.max(r.width, 1); view.ch = Math.max(r.height, 1);
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  cvs.width = Math.round(view.cw * view.dpr); cvs.height = Math.round(view.ch * view.dpr);
  const aspect = clamp(view.cw / view.ch, .6, 1.8);
  const nrx = Math.sqrt(W.area * aspect), nry = Math.sqrt(W.area / aspect);
  if (!reset) {
    const sx = nrx / W.rx, sy = nry / W.ry;
    for (const f of S.foes) { f.x *= sx; f.y *= sy; }
    P.x *= sx; P.y *= sy; steer.x *= sx; steer.y *= sy;
  }
  W.rx = nrx; W.ry = nry;
  view.scale = Math.min(view.cw / (2 * (W.rx + 40)), view.ch / (2 * (W.ry + 58)));
  AR.dirty = true;
}
function contain(o, ex, ey) {
  const k = (o.x / ex) ** 2 + (o.y / ey) ** 2; if (k <= 1) return;
  const s = 1 / Math.sqrt(k); o.x *= s; o.y *= s;
  let nx = o.x / (ex * ex), ny = o.y / (ey * ey); const l = Math.hypot(nx, ny); nx /= l; ny /= l;
  const vn = o.vx * nx + o.vy * ny; if (vn > 0) { o.vx -= vn * nx; o.vy -= vn * ny; }
}

function startFight() {
  const def = fightDef();
  W.area = FIGHT_AREA; fitWorld(true);
  Object.assign(P, { x: 0, y: W.ry * .45, vx: 0, vy: 0, face: -Math.PI / 2, hp: me.maxHp, cd: 0, swing: 0, hurt: 0, flash: 0, target: null, dead: false });
  steer.active = false;
  S.foes = []; S.floats = []; S.dust = []; S.over = null; S.overT = 0; S.freeze = 0; S.shake = 0;
  S.intro = INTRO.step * INTRO.count; S.shout = 0;
  S.orbs = []; S.collect = 0; S.gained = 0; S.levelUps = 0; S.xpStart = S.xp; S.pointsStart = S.points;
  S.round = 0; S.dealt = 0;
  S.poolHp = roundsOf(def).flat().reduce((n, [t, c]) => n + FOES[t].hp * c, 0);
  spawnRound();
}
// De tegenstanders van de huidige ronde (een gewoon gevecht heeft één ronde).
function spawnRound() {
  const list = testCount ? [['slave', testCount]] : roundsOf(fightDef())[S.round];
  S.foes = [];
  let i = 0, total = list.reduce((n, [, c]) => n + c, 0);
  for (const [type, count] of list) for (let k = 0; k < count; k++, i++) {
    // Tegenstanders staan links en rechts, een eind van je af, en komen meteen op je af.
    const side = i % 2 ? 1 : -1, spread = (Math.floor(i / 2) - (Math.ceil(total / 2) - 1) / 2) * 26;
    S.foes.push(mkFoe(type, side * W.rx * .5, spread - W.ry * .1));
  }
  updateUI();
}
// Toernooi: volgende ronde. Een deel van je leven komt terug, nieuw aftellen.
function nextRound() {
  S.round++;
  const heal = Math.min(me.maxHp - P.hp, Math.ceil(me.maxHp * TOURNAMENT.heal));
  P.hp += heal; P.hurt = 0;
  S.orbs = []; S.collect = 0; S.floats = [];
  S.intro = INTRO.step * INTRO.count; S.shout = 0;
  SFX.mood('calm'); arenaCheer(); SFX.cheer(.8);
  spawnRound();
  if (heal) float(P.x, P.y - 30, `+${heal} leven`, C.laurel);
}
function mkFoe(type, x, y) {
  const d = FOES[type];
  return { type, d, x, y, vx: 0, vy: 0, face: Math.atan2(P.y - y, P.x - x), hp: d.hp, state: 'walk', t: 0, cd: .2 + Math.random() * .4,
           flash: 0, lunge: 0, dead: 0, wob: Math.random() * 10 };
}

/* ---------- Gevecht ---------- */
function hitFoe(f, dmg, from) {
  const w = WEAPONS[PLAYER.weapon], real = Math.max(0, dmg - f.d.armor);
  S.dealt += Math.min(real, Math.max(0, f.hp));
  f.hp -= real; f.flash = FEEL.flash;
  const dx = f.x - from.x, dy = f.y - from.y, l = Math.hypot(dx, dy) || 1;
  const kb = w.knock * (f.state === 'windup' ? .2 : 1);   // tijdens de aanzet zet hij zich schrap
  f.vx += dx / l * kb; f.vy += dy / l * kb;
  S.freeze = FEEL.hitstop; S.shake = Math.max(S.shake, FEEL.shake);
  float(f.x, f.y - 18, real ? '−' + fmt(real) : '0', C.ink);
  SFX.hit(); SFX.cheer(f.hp <= 0 ? .75 : .35);   // het publiek juicht bij elke rake klap, harder als hij valt
  if (f.hp <= 0) {
    f.state = 'dead'; f.dead = 1; f.vx *= 1.6; f.vy *= 1.6;
    dropXp(f);
    if (S.foes.every(o => o.state === 'dead')) { S.collect = XP.collect; arenaCheer(); SFX.cheer(1); }   // nog even oprapen
  }
}
// Blokken: korte bronzen flits aan de kant van de aanvaller, geen schade.
function blocked(def, att) {
  def.block = .3; def.blockA = Math.atan2(att.y - def.y, att.x - def.x);
  S.freeze = FEEL.hitstop * .6; S.shake = Math.max(S.shake, 2);
  float(def.x, def.y - 20, 'geblokt', C.bronze);
  SFX.block();
}
function hitPlayer(f) {
  if (P.hurt > 0 || P.dead) return;
  const real = Math.max(0, f.d.dmg);
  P.hp = Math.max(0, P.hp - real); P.hurt = PLAYER.invuln; P.flash = FEEL.flash;
  const dx = P.x - f.x, dy = P.y - f.y, l = Math.hypot(dx, dy) || 1;
  P.vx += dx / l * 170; P.vy += dy / l * 170;
  S.freeze = FEEL.hitstop * 1.4; S.shake = Math.max(S.shake, FEEL.playerShake);
  float(P.x, P.y - 20, real ? '−' + fmt(real) : '0', C.blood);
  SFX.hurt();
  $('stage').classList.remove('hurt'); void $('stage').offsetWidth; $('stage').classList.add('hurt');
  updateUI();
  if (P.hp <= 0) { P.dead = true; endFight(false); }
}
function endFight(won) {
  if (S.over) return;
  S.over = won ? 'won' : 'lost'; S.overT = 0;
  const def = fightDef(), reward = def.reward || 0;
  if (won) {
    S.delta = reward; S.money += reward;
  } else {
    arenaJeer(); SFX.boo(1); S.xp = S.xpStart; S.points = S.pointsStart;   // verloren: XP en punten uit dit gevecht vervallen
    // gewoon gevecht of tussenbaas: boete. Toernooi: geen boete, Caesar beslist (openMercy).
    const fine = def.kind === 'tournament' ? 0 : Math.min(S.money, Math.round(reward * MONEY.lossShare));
    S.delta = -fine; S.money -= fine;
  }
  updateUI();
}
/* XP: bolletjes spatten weg uit een verslagen tegenstander en blijven op het zand liggen. */
function dropXp(f) {
  const n = XP.perFoe[f.type] || 3, a0 = Math.random() * TAU2;
  for (let i = 0; i < n; i++) {
    const a = a0 + i / n * TAU2 + (Math.random() - .5) * .8, sp = XP.speed[0] + Math.random() * (XP.speed[1] - XP.speed[0]);
    S.orbs.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, ph: Math.random() * 6, state: 'free' });
  }
}
function gainXp(o) {
  o.state = 'taken'; S.xp++; S.gained++;
  const before = levelOf(S.xp - 1), after = levelOf(S.xp);
  if (after > before) {
    S.points += POINTS.perLevel; S.levelUps++;
    float(P.x, P.y - 34, `Niveau ${toRoman(after)}!`, '#bfe3ff'); SFX.cheer(.5);
  }
  updateUI();
}
function float(x, y, text, color) { S.floats.push({ x, y, text, color, t: 1 }); }

function update(dt) {
  if (S.over) { S.overT += dt; if (S.overT > (S.over === 'won' ? .7 : 1.1) && $('result').hidden) openResult(); }
  if (S.collect > 0 && !S.over) {   // laatste 5 seconden om XP op te rapen
    S.collect -= dt;
    if (!S.orbs.some(o => o.state === 'free')) S.collect = Math.min(S.collect, .25);   // alles opgeraapt: meteen door
    if (S.collect <= 0) {
      S.collect = 0; for (const o of S.orbs) if (o.state === 'free') o.state = 'gone';
      if (S.round + 1 < roundsOf(fightDef()).length && !testCount) nextRound(); else endFight(true);
    }
  }
  if (S.freeze > 0) { S.freeze -= dt; return; }   // hit-stop: alles staat heel even stil
  S.shake = Math.max(0, S.shake - dt * 40);
  const w = WEAPONS[PLAYER.weapon];

  // Speler: sturen met toetsen of slepen.
  let dx = 0, dy = 0, tx = 0, ty = 0;
  if (!P.dead) {
    if (keys.has('ArrowLeft') || keys.has('a')) dx--;
    if (keys.has('ArrowRight') || keys.has('d')) dx++;
    if (keys.has('ArrowUp') || keys.has('w')) dy--;
    if (keys.has('ArrowDown') || keys.has('s')) dy++;
    if (dx || dy) { const l = Math.hypot(dx, dy); tx = dx / l * me.speed; ty = dy / l * me.speed; steer.active = false; }
    else if (steer.active) {
      const ex = steer.x - P.x, ey = steer.y - P.y, d = Math.hypot(ex, ey);
      if (d > 6) { const sp = Math.min(me.speed, d * 4); tx = ex / d * sp; ty = ey / d * sp; }
      else if (!steer.down) steer.active = false;
    }
  }
  const k = 1 - Math.exp(-dt * PLAYER.accel);
  P.vx += (tx - P.vx) * k; P.vy += (ty - P.vy) * k;
  P.x += P.vx * dt; P.y += P.vy * dt;
  contain(P, W.rx - PLAYER.radius - 4, W.ry - PLAYER.radius - 4);
  const sp = Math.hypot(P.vx, P.vy);
  if (sp > 90 && Math.random() < dt * 14) S.dust.push({ x: P.x + (Math.random() - .5) * 8, y: P.y + (Math.random() - .5) * 8, t: 1 });

  // Aftellen: jij kunt al lopen en kijken, maar er wordt nog niet geslagen.
  if (S.intro > 0) {
    S.intro -= dt;
    if (S.intro <= 0) { S.shout = INTRO.shout; arenaCheer(); SFX.cheer(.6); SFX.mood('fight'); }
    for (const f of S.foes) f.face = lerpAngle(f.face, Math.atan2(P.y - f.y, P.x - f.x), 1 - Math.exp(-dt * 6));
    return;
  }
  S.shout = Math.max(0, S.shout - dt);
  // Automatisch slaan: de dichtstbijzijnde levende tegenstander binnen bereik.
  P.block = Math.max(0, (P.block || 0) - dt);
  P.cd = Math.max(0, P.cd - dt); P.swing = Math.max(0, P.swing - dt); P.hurt = Math.max(0, P.hurt - dt); P.flash = Math.max(0, P.flash - dt);
  let best = null, bd = Infinity;
  for (const f of S.foes) if (f.state !== 'dead') { const d = Math.hypot(f.x - P.x, f.y - P.y); if (d < bd) { bd = d; best = f; } }
  P.target = best;
  const inReach = best && bd - best.d.radius - PLAYER.radius <= w.reach;
  if (inReach) P.face = lerpAngle(P.face, Math.atan2(best.y - P.y, best.x - P.x), 1 - Math.exp(-dt * 20));
  else if (sp > 20) P.face = lerpAngle(P.face, Math.atan2(P.vy, P.vx), 1 - Math.exp(-dt * 12));
  if (!P.dead && inReach && P.cd === 0) {
    P.cd = w.cooldown; P.swing = w.swing; P.swingDir *= -1;
    // Raakt de klap? Eerst je eigen raakkans, dan de blokkans van de tegenstander.
    if (Math.random() >= me.hit) { /* mis */ }
    else if (Math.random() < blockChance(best.d.defense)) blocked(best, P);
    else hitFoe(best, me.dmg, P);
  }

  // Tegenstanders: aanlopen, aanzetten, uithalen, herstellen.
  for (const f of S.foes) {
    f.flash = Math.max(0, f.flash - dt); f.lunge = Math.max(0, f.lunge - dt * 5); f.block = Math.max(0, (f.block || 0) - dt);
    const fr = Math.exp(-dt * 7); f.vx *= fr; f.vy *= fr;   // knockback dooft uit
    if (f.state === 'dead') { f.dead = Math.max(0, f.dead - dt * .35); f.x += f.vx * dt; f.y += f.vy * dt; continue; }
    const ex = P.x - f.x, ey = P.y - f.y, d = Math.hypot(ex, ey) || 1, gap = d - f.d.radius - PLAYER.radius;
    f.cd = Math.max(0, f.cd - dt);
    let mx = 0, my = 0;
    if (f.state === 'walk') {
      f.face = lerpAngle(f.face, Math.atan2(ey, ex), 1 - Math.exp(-dt * 8));
      if (gap > f.d.reach * .6) { const wob = Math.sin(performance.now() / 300 + f.wob) * .25; mx = Math.cos(f.face + wob) * f.d.speed; my = Math.sin(f.face + wob) * f.d.speed; }
      if (!P.dead && gap <= f.d.reach && f.cd === 0) { f.state = 'windup'; f.t = f.d.windup; }
    } else if (f.state === 'windup') {
      f.face = lerpAngle(f.face, Math.atan2(ey, ex), 1 - Math.exp(-dt * 4));
      f.t -= dt;
      if (f.t <= 0) {
        f.lunge = 1; f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown;
        // Uithalen: raakt als je nog binnen bereik staat (met een klein beetje speling voor de uitval).
        if (gap > f.d.reach + f.d.lunge) { /* ontweken: buiten bereik gestapt */ }
        else if (Math.random() >= hitChance(f.d.attack)) { /* mis */ }
        else if (Math.random() < me.block) blocked(P, f);
        else hitPlayer(f);
      }
    } else if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; }
    f.x += (mx + f.vx) * dt; f.y += (my + f.vy) * dt;
    contain(f, W.rx - f.d.radius - 4, W.ry - f.d.radius - 4);
  }
  // Lijven duwen elkaar weg, zodat niemand door een ander heen loopt.
  const bodies = [P, ...S.foes.filter(f => f.state !== 'dead')];
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j], ra = a === P ? PLAYER.radius : a.d.radius, rb = b === P ? PLAYER.radius : b.d.radius;
    const ddx = b.x - a.x, ddy = b.y - a.y, dd = Math.hypot(ddx, ddy) || .01, o = ra + rb - dd;
    if (o > 0) { const ux = ddx / dd * o / 2, uy = ddy / dd * o / 2; a.x -= ux; a.y -= uy; b.x += ux; b.y += uy; }
  }
  for (const o of S.orbs) {
    if (o.state === 'taken') continue;
    o.t += dt; const fr = Math.exp(-dt * XP.friction); o.vx *= fr; o.vy *= fr;
    if (o.state === 'free' && o.t > XP.life) { o.state = 'taken'; continue; }   // te lang blijven liggen: verdwenen
    if (o.state === 'free' && o.t > XP.settle && !P.dead) {
      const dx = P.x - o.x, dy = P.y - o.y, d = Math.hypot(dx, dy);
      if (d < PLAYER.radius + XP.pickup) { gainXp(o); continue; }
      if (d < XP.magnet) { o.vx += dx / d * XP.pull * dt * 6; o.vy += dy / d * XP.pull * dt * 6; }
    }
    o.x += o.vx * dt; o.y += o.vy * dt; contain(o, W.rx - 6, W.ry - 6);
  }
  for (const f of S.floats) { f.t -= dt * .9; f.y -= dt * 30; }
  S.floats = S.floats.filter(f => f.t > 0);
  for (const p of S.dust) p.t -= dt * 2;
  S.dust = S.dust.filter(p => p.t > 0);
}

/* ---------- Tekenen ---------- */
function draw(now) {
  const { cw, ch, dpr, scale } = view;
  if (AR.dirty) buildArena();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(AR.bg, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = (Math.random() - .5) * S.shake, sy = (Math.random() - .5) * S.shake;
  ctx.save(); ctx.translate(cw / 2 + sx, ch / 2 + sy); ctx.scale(scale, scale);
  drawArenaLive(ctx, now);

  if (steer.active && !P.dead) {
    ctx.strokeStyle = C.porphyry; ctx.lineWidth = 2; ctx.globalAlpha = .5;
    ctx.beginPath(); ctx.arc(steer.x, steer.y, 8 + Math.sin(now / 150) * 2, 0, TAU2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  for (const p of S.dust) { ctx.fillStyle = C['sand-2']; ctx.globalAlpha = p.t * .45; ctx.beginPath(); ctx.arc(p.x, p.y, 3 + (1 - p.t) * 5, 0, TAU2); ctx.fill(); }
  ctx.globalAlpha = 1;

  const ents = [...S.foes].sort((a, b) => (a.state === 'dead' ? -1 : 0) - (b.state === 'dead' ? -1 : 0));
  drawOrbs(now);
  for (const f of ents) drawFoe(f, now);
  drawPlayer(now);
  for (const o of [P, ...S.foes]) if (o.block > 0) {   // blok: bronzen boog aan de kant van de aanvaller
    ctx.strokeStyle = `rgba(226,179,94,${o.block / .3})`; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(o.x, o.y, 15, o.blockA - .7, o.blockA + .7); ctx.stroke(); ctx.lineCap = 'butt';
  }
  for (const f of S.foes) if (f.state !== 'dead' && f.hp < f.d.hp) drawBar(f.x, f.y - f.d.radius - 10, f.hp / f.d.hp);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of S.floats) {
    ctx.globalAlpha = Math.min(1, f.t * 1.5); ctx.font = '700 16px Cinzel, Georgia, serif';
    ctx.lineWidth = 4; ctx.strokeStyle = C.night; ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  if (S.intro > 0 || S.shout > 0) {   // III, II, I, Pugnate!
    const txt = S.intro > 0 ? toRoman(Math.ceil(S.intro / INTRO.step)) : 'Pugnate!';
    const f = S.intro > 0 ? (S.intro / INTRO.step) % 1 : S.shout / INTRO.shout, k = 1 + .3 * f * f;
    ctx.save(); ctx.translate(0, -W.ry * .35); ctx.scale(k, k);
    ctx.font = `900 ${S.intro > 0 ? 56 : 44}px Cinzel, Georgia, serif`; ctx.globalAlpha = Math.min(1, .35 + f);
    ctx.lineWidth = 6; ctx.strokeStyle = C.night; ctx.strokeText(txt, 0, 0);
    ctx.fillStyle = S.intro > 0 ? C.ink : C.coin; ctx.fillText(txt, 0, 0); ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.restore();
}
function drawOrbs(now) {
  for (const o of S.orbs) {
    if (o.state === 'taken') continue;
    if (o.state === 'gone') {   // te laat: dof en niet meer op te pakken
      ctx.fillStyle = 'rgba(120,135,150,.45)'; ctx.beginPath(); ctx.arc(o.x, o.y, 2.6, 0, TAU2); ctx.fill(); continue;
    }
    const left = XP.life - o.t, fade = Math.max(0, Math.min(1, left / XP.fade));
    // De laatste seconden: vervagen en steeds sneller knipperen.
    ctx.globalAlpha = fade < 1 ? fade * (.55 + .45 * Math.sin(now / (40 + 120 * fade))) : 1;
    const pulse = 1 + .18 * Math.sin(now / 160 + o.ph), r = 3.4 * pulse * (.6 + .4 * fade);
    const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r * 3.2);
    g.addColorStop(0, 'rgba(170,215,255,.75)'); g.addColorStop(1, 'rgba(90,160,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, r * 3.2, 0, TAU2); ctx.fill();
    ctx.fillStyle = '#5aa8ff'; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, TAU2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(o.x - r * .25, o.y - r * .25, r * .55, 0, TAU2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
function drawBar(x, y, f) {
  ctx.fillStyle = 'rgba(14,9,13,.7)'; ctx.fillRect(x - 13, y - 2, 26, 4);
  ctx.fillStyle = f > .35 ? C.laurel : C.blood; ctx.fillRect(x - 12.5, y - 1.5, 25 * f, 3);
}
// Figuur van bovenaf, kijkend naar +x: schouders, armen, hoofd. 'item' tekent wat hij vasthoudt.
function drawBody(o, r, tunic, skin, hair, opts = {}) {
  ctx.save(); ctx.translate(o.x, o.y);
  ctx.fillStyle = 'rgba(40,20,8,.28)'; ctx.beginPath(); ctx.ellipse(2, 3, r * 1.05, r * .9, 0, 0, TAU2); ctx.fill();
  ctx.rotate(o.face + (opts.lean || 0));
  if (opts.forward) ctx.translate(opts.forward, 0);
  const fl = opts.flash > 0;
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)';
  // armen (handen) links en rechts voor de schouders
  for (const side of [-1, 1]) {
    const reach = side === 1 ? (opts.armR ?? 0) : (opts.armL ?? 0);
    ctx.fillStyle = fl ? '#fff' : skin; ctx.beginPath(); ctx.arc(r * .35 + reach, side * r * .78, r * .3, 0, TAU2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = fl ? '#fff' : tunic; ctx.beginPath(); ctx.ellipse(0, 0, r * .62, r, 0, 0, TAU2); ctx.fill(); ctx.stroke();
  if (opts.belt) { ctx.strokeStyle = opts.belt; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * .2, -r * .9); ctx.lineTo(r * .2, r * .9); ctx.stroke(); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)'; }
  ctx.fillStyle = fl ? '#fff' : skin; ctx.beginPath(); ctx.arc(r * .12, 0, r * .48, 0, TAU2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = fl ? '#fff' : hair; ctx.beginPath(); ctx.arc(-r * .02, 0, r * .42, Math.PI * .5, Math.PI * 1.5); ctx.fill();
  if (opts.item) opts.item(r);
  ctx.restore();
}
function drawPlayer(now) {
  const w = WEAPONS[PLAYER.weapon];
  if (P.dead) { drawFallen(P, PLAYER.radius, C.blood, C.skin, 1); return; }
  if (P.hurt > 0 && Math.floor(now / 70) % 2 === 0) ctx.globalAlpha = .45;
  const sw = P.swing > 0 ? 1 - P.swing / w.swing : -1;   // 0..1 tijdens een slag, anders -1
  if (w.kind === 'fists') {
    // Vuistslag: de rechter- of linkervuist schiet naar voren en het lijf leunt mee, zoals bij een slaaf.
    const punch = sw >= 0 ? Math.sin(sw * Math.PI) : 0, right = P.swingDir > 0;
    drawBody(P, PLAYER.radius, C.blood, C.skin, C['hair-1'], {
      flash: P.flash, belt: C.bronze, forward: 3 * punch,
      armR: right ? 9 * punch : 0, armL: right ? 0 : 9 * punch,
      item: () => {
        if (punch > .3) {
          ctx.strokeStyle = `rgba(255,240,210,${punch * .7})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(0, 0, PLAYER.radius + w.reach + 2, -.45, .45); ctx.stroke();
        }
      }
    });
    ctx.globalAlpha = 1; return;
  }
  // Stok of zwaard: rust schuin naar voren; bij een slag zwaait hij in een boog langs de voorkant.
  const ang = sw >= 0 ? P.swingDir * (-1.1 + 2.2 * sw) : .55;
  const len = PLAYER.radius + w.reach + 2;
  drawBody(P, PLAYER.radius, C.blood, C.skin, C['hair-1'], {
    flash: P.flash, belt: C.bronze, armR: sw >= 0 ? 3 : 0,
    item: r => {
      if (sw >= 0) {   // zwaaispoor
        ctx.strokeStyle = 'rgba(255,240,210,.55)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        const a0 = P.swingDir * -1.1, a1 = ang;
        ctx.beginPath(); ctx.arc(0, 0, len * .85, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke(); ctx.lineCap = 'butt';
      }
      const hx = r * .35 + (sw >= 0 ? 3 : 0), hy = r * .78;
      const ex = Math.cos(ang) * len, ey = Math.sin(ang) * len + (sw >= 0 ? 0 : hy * .4);
      ctx.lineCap = 'round';
      if (w.kind === 'sword') {   // gladius: kort lemmet, bronzen gevest en dwarsstuk
        const dx = ex - hx, dy = ey - hy, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, gx = hx + ux * 5, gy = hy + uy * 5;
        ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = '#e4e0d4'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = C.bronze; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx - ux * 2, hy - uy * 2); ctx.lineTo(gx, gy); ctx.stroke();
        ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(gx - uy * 4, gy + ux * 4); ctx.lineTo(gx + uy * 4, gy - ux * 4); ctx.stroke();
      } else {
        ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(hx - Math.cos(ang) * 4, hy - Math.sin(ang) * 4); ctx.lineTo(ex, ey); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
  });
  ctx.globalAlpha = 1;
}
function drawFoe(f, now) {
  const d = f.d;
  if (f.state === 'dead') { drawFallen(f, d.radius, d.tunic, C[d.skin], f.dead); return; }
  const wind = f.state === 'windup' ? 1 - f.t / d.windup : 0;
  // Aanzet: rode gloed en arm naar achteren; uitval: arm en lijf naar voren.
  if (wind > 0) {
    ctx.fillStyle = `rgba(212,70,59,${.15 + .3 * wind})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, d.radius + 4 + 3 * wind, 0, TAU2); ctx.fill();
  }
  const tunic = wind > 0 ? mix(d.tunic, C.blood, .55 * wind) : d.tunic;
  drawBody(f, d.radius, tunic, C[d.skin], C[d.hair], {
    flash: f.flash, belt: d.belt, armR: -5 * wind + 9 * f.lunge, forward: 5 * f.lunge, lean: -.25 * wind
  });
  if (f.lunge > .3) {   // vuistslag
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.face);
    ctx.strokeStyle = `rgba(212,70,59,${f.lunge * .7})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, d.radius + d.reach + 4, -.5, .5); ctx.stroke(); ctx.restore();
  }
}
function drawFallen(o, r, tunic, skin, a) {
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.4)); ctx.translate(o.x, o.y); ctx.rotate(o.face + Math.PI / 2);
  ctx.fillStyle = 'rgba(90,20,15,.35)'; ctx.beginPath(); ctx.ellipse(2, 2, r * 1.3, r * .9, 0, 0, TAU2); ctx.fill();
  ctx.fillStyle = tunic; ctx.strokeStyle = 'rgba(30,15,8,.75)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.25, r * .55, 0, 0, TAU2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(r * 1.35, 0, r * .45, 0, TAU2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  requestAnimationFrame(loop);
  try { if (!S.paused) update(dt); draw(now); } catch (err) { console.error(err); }
}

/* ---------- Interface ---------- */
function foeSummary() {
  return listSummary(testCount ? [['slave', testCount]] : roundsOf(fightDef())[S.round] || []);
}
// Korte omschrijving van een gevecht, voor het bord bij de arena in de stad.
function describeFight(i) {
  const def = FIGHTS[i], n = toRoman(i + 1);
  if (def.kind === 'tournament') return `Gevecht ${n} · toernooi tot de dood, ${toRoman(def.rounds.length)} rondes`;
  if (def.kind === 'boss') return `Gevecht ${n} · tussenbaas: ${listSummary(def.foes)}`;
  return `Gevecht ${n} · tegen ${listSummary(def.foes)}`;
}
function updateUI() {
  $('fightNo').textContent = toRoman(S.fight + 1);
  const def = fightDef(), rounds = roundsOf(def).length;
  $('foeText').textContent = def.kind === 'tournament'
    ? `Toernooi · ronde ${toRoman(S.round + 1)} van ${toRoman(rounds)} · tegen ${foeSummary()}`
    : (def.kind === 'boss' ? 'Tussenbaas · tegen ' : 'Tegen ') + foeSummary();
  $('money').textContent = S.money;
  $('weapon').textContent = WEAPONS[PLAYER.weapon].name;
  $('hpText').textContent = `${P.hp} / ${me.maxHp}`;
  $('hpFill').style.transform = `scaleX(${P.hp / me.maxHp})`;
  $('hpBar').classList.toggle('low', P.hp / me.maxHp <= .3);
  const lv = levelOf(S.xp), lo = LEVELS[lv - 2] || 0, hi = LEVELS[lv - 1];
  $('lvlText').textContent = `Niveau ${toRoman(lv)}`;
  $('xpText').textContent = hi ? `${S.xp} / ${hi} XP` : `${S.xp} XP`;
  $('xpFill').style.transform = `scaleX(${hi ? (S.xp - lo) / (hi - lo) : 1})`;
}
function openResult() {
  SFX.mood('calm');
  S.paused = true; keys.clear(); steer.down = false;
  const won = S.over === 'won', def = fightDef();
  if (!won && def.kind === 'tournament') { openMercy(); return; }
  $('resultEyebrow').textContent = `Gevecht ${toRoman(S.fight + 1)}`;
  $('resultTitle').textContent = won ? 'Overwinning!' : 'Je ligt in het zand.';
  const total = S.orbs.length, last = S.fight + 1 >= FIGHTS.length;
  $('resultText').textContent = won
    ? `Je had nog ${P.hp} van de ${me.maxHp} leven over en raapte ${S.gained} van de ${total} XP op. `
      + (S.levelUps ? `Niveau ${toRoman(levelOf(S.xp))}: je hebt ${S.points} ${S.points === 1 ? 'punt' : 'punten'} te verdelen.` : `Nog ${LEVELS[levelOf(S.xp) - 1] - S.xp} XP tot het volgende niveau.`)
      + (def.kind === 'tournament' ? ` Je overleefde alle ${toRoman(def.rounds.length)} rondes van het toernooi.` : '')
      + (last ? ' Je hebt alle gevechten van deze proef gewonnen!' : '')
    : 'Het publiek joelt. Je mag het nog eens proberen. De XP uit dit gevecht is weg; je stats blijven zoals ze waren.';
  $('resultMoney').textContent = won ? `+${denarii(S.delta)}` : S.delta ? `Boete: ${denarii(-S.delta)}` : 'Geen denarii om te verliezen';
  $('resultMoney').classList.toggle('loss', !won);
  $('resultBtn').textContent = 'Naar de stad';
  $('townNote').hidden = S.townSeen;   // de eerste keer: zeg wat je in de stad kunt
  $('result').hidden = false; $('resultBtn').focus();
}
// Na de uitslag ga je altijd de stad in. Terug naar de arena: klik in de stad op de arena.
$('resultBtn').onclick = () => { $('result').hidden = true; openTown(); };

/* ---------- Caesars duim (toernooi verloren) ---------- */
let mercyTimers = [];
function openMercy() {
  const def = fightDef(), favor = S.poolHp ? Math.min(1, S.dealt / S.poolHp) : 0;
  const chance = Math.min(TOURNAMENT.mercyMax, TOURNAMENT.mercyBase + TOURNAMENT.mercyFavor * favor);
  const ok = Math.random() < chance;
  S.spared = ok;
  const d = $('judgeDetail'), b = $('judgeBtn');
  d.innerHTML = `<dt>Ronde</dt><dd>${toRoman(S.round + 1)} van ${toRoman(def.rounds.length)}</dd>
    <dt>Schade uitgedeeld</dt><dd>${fmt(S.dealt)} van ${S.poolHp}</dd>
    <dt>Gunst van het publiek</dt><dd>${Math.round(chance * 100)}%</dd>
    <dt>Uitslag</dt><dd class="${ok ? 'good' : 'bad'}">${ok ? 'Je leeft. Het toernooi is voorbij, geen beloning.' : 'Mors. Je begint opnieuw bij gevecht I.'}</dd>`;
  b.textContent = ok ? 'Naar de stad' : 'Opnieuw beginnen'; b.dataset.ok = ok ? '1' : '';
  for (const el of [d, b]) { el.hidden = false; el.style.visibility = 'hidden'; }
  $('judgeTitle').textContent = 'Caesar overweegt…';
  $('judge').hidden = false;
  judgeStart();
  mercyTimers.forEach(clearTimeout);
  mercyTimers = [
    setTimeout(() => { $('judgeTitle').textContent = ok ? 'Duim omhoog!' : 'Duim omlaag.'; judgeVerdict(ok); ok ? SFX.cheer(1) : SFX.boo(1); }, JUDGE.think),
    setTimeout(() => {
      for (const el of [d, b]) { el.style.visibility = ''; el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' }); }
      b.focus();
    }, JUDGE.think + JUDGE.detail)
  ];
}
$('judgeBtn').onclick = () => {
  $('judge').hidden = true; judgeEnd();
  if ($('judgeBtn').dataset.ok) openTown(); else newRun();
};
// Klik op de arena: heb je nog punten, dan eerst het perkament; anders meteen het gevecht.
function proceed() {
  if (S.points) { openStats('arena'); return; }
  enterArena();
}
function enterArena() {
  if (S.over === 'won') {
    if (S.fight + 1 >= FIGHTS.length) { newRun(); return; }   // alles gewonnen: opnieuw beginnen
    S.fight++;
  }                                                           // verloren: zelfde gevecht, stats blijven
  startFight(); S.paused = false;
}
function newRun() {
  S.fight = 0; S.xp = 0; S.points = POINTS.start; for (const k in S.stats) S.stats[k] = 0;
  S.money = 0; S.delta = 0; S.owned = ['fists']; S.townSeen = false; PLAYER.weapon = 'fists'; S.over = null;
  startFight(); S.paused = false;
}
$('startBtn').onclick = () => { SFX.init(); $('start').hidden = true; newRun(); };
// Geluid aan/uit: knop rechtsboven, of de toets M.
function showMute() { const b = $('mute'); b.textContent = SFX.muted ? 'Geluid uit' : 'Geluid aan'; b.setAttribute('aria-pressed', String(!SFX.muted)); }
$('mute').onclick = () => { SFX.init(); SFX.setMuted(!SFX.muted); showMute(); };
showMute();

/* ---------- Punten verdelen ---------- */
// mode 'town' = vanuit de straat (Klaar = terug de straat in); 'arena' = op weg naar het gevecht.
let added = {}, statsMode = 'town';
function openStats(mode = 'town') {
  S.paused = true; added = {}; statsMode = mode;
  for (const k in STATS) added[k] = 0;
  $('statsBack').hidden = mode !== 'arena';
  renderStats(); $('stats').hidden = false; $('statsBtn').focus();
}
function statEffect(k, n) {
  const v = { ...S.stats, [k]: n };
  return { strength: `${fmt(WEAPONS[PLAYER.weapon].dmg + STAT_RULES.dmg * v.strength)} schade`,
           agility: `snelheid ${PLAYER.speed + STAT_RULES.speed * v.agility}`,
           vitality: `${PLAYER.hp + STAT_RULES.hp * v.vitality} leven` }[k];
}
function renderStats() {
  const list = $('statList'); list.innerHTML = '';
  for (const [k, d] of Object.entries(STATS)) {
    const li = document.createElement('li');
    li.innerHTML = `<div><b>${d.nl} <i>${d.name}</i></b><span>${d.desc}</span><span class="eff">${statEffect(k, S.stats[k])}</span></div>
      <div class="stepper"><button aria-label="${d.nl} omlaag" ${added[k] ? '' : 'disabled'}>−</button><output aria-label="${S.stats[k]}">${S.stats[k] ? toRoman(S.stats[k]) : '–'}</output><button aria-label="${d.nl} omhoog" ${S.points ? '' : 'disabled'}>+</button></div>`;
    const [minus, plus] = li.querySelectorAll('button');
    minus.onclick = () => { added[k]--; S.stats[k]--; S.points++; renderStats(); };
    plus.onclick = () => { added[k]++; S.stats[k]++; S.points--; renderStats(); };
    list.appendChild(li);
  }
  const left = S.points ? ` (nog ${toRoman(S.points)} over)` : '';
  $('statsBtn').textContent = (statsMode === 'arena' ? 'Naar de arena' : 'Klaar') + left;
}
$('statsBtn').onclick = () => {
  $('stats').hidden = true;
  if (statsMode === 'arena') enterArena(); else TOWN.purse();
};
$('statsBack').onclick = () => { $('stats').hidden = true; openTown(); };

function toWorld(ev) {
  const r = cvs.getBoundingClientRect();
  steer.x = (ev.clientX - r.left - view.cw / 2) / view.scale;
  steer.y = (ev.clientY - r.top - view.ch / 2) / view.scale;
}
cvs.addEventListener('pointerdown', ev => { if (S.paused) return; cvs.setPointerCapture(ev.pointerId); steer.down = steer.active = true; toWorld(ev); });
cvs.addEventListener('pointermove', ev => { if (steer.down) toWorld(ev); });
['pointerup', 'pointercancel'].forEach(t => cvs.addEventListener(t, () => steer.down = false));
const anyOverlay = () => ['start', 'result', 'stats', 'town', 'shop', 'judge'].some(id => !$(id).hidden);
addEventListener('keydown', ev => {
  if (anyOverlay()) return;
  const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  if (k === 'm') { $('mute').click(); return; }
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s'].includes(k)) { keys.add(k); ev.preventDefault(); }
});
addEventListener('keyup', ev => keys.delete(ev.key.length === 1 ? ev.key.toLowerCase() : ev.key));
addEventListener('blur', () => keys.clear());
new ResizeObserver(() => fitWorld(false)).observe(stage);

startFight();
requestAnimationFrame(loop);

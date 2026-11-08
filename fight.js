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
  strength: { name: 'Strength', nl: 'Kracht',     desc: '+0,25 schade per klap' },
  agility:  { name: 'Agility',  nl: 'Behendigheid', desc: '+3 loopsnelheid, en je schiet sneller met een boog' },
  vitality: { name: 'Vitality', nl: 'Vitaliteit',  desc: '+1 leven' }
};
// Attack en Defense (raak- en blokkans) staan voorlopig uit: elke klap binnen bereik raakt.
// Terugzetten: hitBase .6 en blockBase .1, en de twee stats weer in STATS en S.stats.
const STAT_RULES = { dmg: .25, speed: 3, shoot: .04, shootMin: .5, hitBase: 1, hit: .05, hitMax: 1, blockBase: 0, block: .06, blockMax: .75, hp: 1 };
// Punten verdien je met XP: verslagen tegenstanders laten blauwwitte bolletjes vallen. Een niveau omhoog = POINTS.perLevel punten.
const POINTS = { start: 0, perLevel: 2 };
// XP-drempels (totaal) voor niveau II, III, IV, ... Gevecht I, II, III leveren 5, 10, 15 XP op.
const LEVELS = [4, 12, 24, 40, 60, 85, 115, 150, 190, 235, 285, 340, 400, 470, 550, 640, 740, 850];
// life = na zoveel seconden verdwijnt een bolletje; de laatste 'fade' seconden knippert en vervaagt het.
const XP = { life: 6, fade: 2, perFoe: { slave: 5, archer: 5, gladiator: 10, gladiatorStick: 12, gladiatorSword: 15, champion: 25 }, speed: [70, 150], friction: 3.5, settle: .3, pickup: 6, magnet: 26, pull: 160, collect: 5 };
const levelOf = xp => 1 + LEVELS.filter(t => xp >= t).length;
const hitChance = att => Math.min(STAT_RULES.hitMax, STAT_RULES.hitBase + STAT_RULES.hit * att);
const blockChance = def => Math.min(STAT_RULES.blockMax, STAT_RULES.blockBase + STAT_RULES.block * def);
// reach = hoe ver voorbij je eigen lijf je raakt; cooldown = seconden tussen twee slagen; price = in denarii bij de wapensmid.
// Je begint met je vuisten, net als een slaaf: zelfde schade, zelfde bereik, ongeveer even vaak.
const WEAPONS = {
  fists: { name: 'Vuisten', kind: 'fists', dmg: 2, reach: 10, cooldown: 2, swing: .22, knock: 0, price: 0 },   // vuisten duwen niet terug
  stick: { name: 'Stok', kind: 'stick', dmg: 3, reach: 13, cooldown: 2, swing: .22, knock: 85, price: 12 },
  gladius: { name: 'Gladius', kind: 'sword', dmg: 5, reach: 15, cooldown: 2, swing: .2, knock: 60, price: 40 },
  // Hasta: speer. Groot bereik en duwt ver, maar trager.
  hasta: { name: 'Hasta', kind: 'spear', dmg: 4, reach: 20, cooldown: 2.3, swing: .26, knock: 120, price: 70 },
  // Bogen: schieten vanzelf op de dichtstbijzijnde tegenstander binnen range. Staat er iemand tegen je aan, dan sla je met je vuisten.
  // Behendigheid: per punt STAT_RULES.shoot korter wachten tussen twee pijlen (hoogstens tot shootMin × cooldown). Niet samen met een schild.
  bow: { name: 'Korte boog', kind: 'bow', dmg: 2, range: 150, arrow: 300, reach: 0, cooldown: 1.8, swing: .25, knock: 20, price: 60 },
  composite: { name: 'Composietboog', kind: 'bow', dmg: 3, range: 190, arrow: 340, reach: 0, cooldown: 1.4, swing: .25, knock: 30, price: 140 }
};
const isBow = k => !!k && WEAPONS[k].kind === 'bow';
// Twee wapenvakken: melee (dichtbij) en ranged (boog). Wisselen met 1 en 2 duurt switchTime seconden;
// met een boog in je handen loop je speedMul zo snel (de strijdwagen niet).
const ARMS = { switchTime: 1, speedMul: .4 };
// Strijdwagen: speed = topsnelheid, cruise = zo hard rijd je als je niet stuurt (stilstaan kan niet), turn = draaien (rad/s, sneller als je langzaam gaat),
// turnSlow = bij een scherpe bocht remt hij af tot dit deel van de topsnelheid, zodat je kunt bijsturen;
// ram = schade als je iemand omverrijdt met meer dan ramSpeed (paarden voorop: reach); ramCd = zoveel seconden voor je dezelfde weer kunt raken.
const CHARIOT = { speed: 120, cruise: 55, accel: 2.4, turn: 4.2, turnSlow: .45, ram: 5, ramSpeed: 80, ramPush: 260, ramCd: .7, reach: 26 };
// windup = hoe lang een tegenstander aanzet voor hij uithaalt; recover = even stilstaan erna.
const FOES = {
  slave: { name: 'slaaf', plural: 'slaven', hp: 14, dmg: 2, armor: 0, attack: 0, defense: 0, speed: 68, radius: 10, reach: 10, windup: .36, recover: .45, cooldown: 1.6, lunge: 9,
           tunic: '#9c8a6c', hair: 'hair-2', skin: 'skin-2' },
  // Gladiator in leren harnas: armor 1 = elke klap doet 1 minder. Sneller en harder dan een slaaf, zet korter aan.
  gladiator: { name: 'gladiator', plural: 'gladiatoren', hp: 16, dmg: 3, armor: 1, attack: 0, defense: 0, speed: 74, radius: 11, reach: 12, windup: .32, recover: .4, cooldown: 1.4, lunge: 10,
           tunic: '#7a5230', belt: '#3b2a1e', hair: 'bronze', skin: 'skin-3' },
  // Gladiator met stok: langer bereik en zijn klap duwt je ver weg (knock).
  gladiatorStick: { name: 'gladiator met stok', plural: 'gladiatoren met stok', hp: 22, dmg: 3, armor: 1, attack: 0, defense: 0, speed: 72, radius: 11, reach: 16, windup: .4, recover: .45, cooldown: 1.7, lunge: 10, knock: 140, weapon: 'stick',
           tunic: '#7a5230', belt: '#3b2a1e', hair: 'bronze', skin: 'skin-3' },
  // Gladiator met gladius: kort zwaard, raakt hard (4) en zet snel aan. Pas in toernooi II.
  gladiatorSword: { name: 'gladiator met gladius', plural: 'gladiatoren met gladius', hp: 20, dmg: 4, armor: 1, attack: 0, defense: 0, speed: 74, radius: 11, reach: 15, windup: .34, recover: .4, cooldown: 1.5, lunge: 11, knock: 60, weapon: 'sword',
           tunic: '#7a5230', belt: '#d49a48', hair: 'bronze', skin: 'skin-3' },
  // Boogschutter: houdt afstand en schiet. Hij richt eerst (een rode lijn naar je toe, windup seconden), dan vliegt de pijl
  // naar waar je op dat moment stond: blijf bewegen. Kom je te dichtbij (flee), dan loopt hij weg.
  archer: { name: 'boogschutter', plural: 'boogschutters', hp: 10, dmg: 2, armor: 0, attack: 0, defense: 0, speed: 60, radius: 10, reach: 0, windup: .7, recover: .35, cooldown: 2.6, lunge: 0,
           ranged: { min: 90, max: 180, flee: 60, arrow: 240, life: 1.4 },
           tunic: '#5f6d45', belt: '#3b2a1e', hair: 'hair-1', skin: 'skin' },
  // Kampioen: de eindbaas van een toernooi. Groter, harder, zware armor; veel sterker dan alles daarvoor.
  champion: { name: 'kampioen', plural: 'kampioenen', hp: 28, dmg: 3, armor: 2, attack: 0, defense: 0, speed: 74, radius: 13, reach: 14, windup: .34, recover: .35, cooldown: 1.5, lunge: 12,
           tunic: '#5c5a62', belt: '#d49a48', hair: 'bronze', skin: 'skin-2' }   // grijs = ijzeren harnas
};
// De reeks: steeds 5 gevechten en dan een toernooi (5-1-5-1). Pas als je het toernooi wint, komen de volgende 5 gevechten vrij.
// Het toernooi mag je ook eerder kiezen (en dan merken hoe snel je het verliest). Win je het eerder, dan sla je de rest van die 5 over.
// Testen met meer tegenstanders: zet ?n=3 achter de url.
// reward = denarii als je wint. Verlies je een gevecht, dan betaal je MONEY.lossShare van die beloning (nooit onder 0).
// kind: 'normal', 'boss' (tussenbaas: zwaarder, meer geld) of 'tournament' (rondes achter elkaar, tot de dood; de laatste ronde is de eindbaas).
const STAGES = [
  { fights: [
      { kind: 'normal', foes: [['slave', 1]], reward: 5 },
      { kind: 'normal', foes: [['slave', 2]], reward: 8 },
      { kind: 'normal', foes: [['slave', 2], ['archer', 1]], reward: 12 },
      { kind: 'normal', foes: [['gladiator', 1], ['archer', 1], ['slave', 1]], reward: 18 },
      { kind: 'boss', foes: [['gladiatorStick', 1]], reward: 25 } ],
    tourney: { kind: 'tournament', rounds: [[['slave', 2]], [['slave', 1], ['archer', 2]], [['champion', 1]]], reward: 60 } },
  { fights: [
      { kind: 'normal', foes: [['gladiator', 2]], reward: 20 },
      { kind: 'normal', foes: [['archer', 3]], reward: 22 },
      { kind: 'normal', foes: [['slave', 10]], reward: 25 },
      { kind: 'normal', foes: [['gladiatorStick', 1], ['archer', 2]], reward: 30 },
      { kind: 'boss', foes: [['gladiatorStick', 2]], reward: 40 } ],
    tourney: { kind: 'tournament', rounds: [[['gladiator', 1], ['archer', 2]], [['gladiatorSword', 1], ['slave', 2]], [['champion', 2]]], reward: 120 } },
  // Blok 3: na toernooi II gaan de stallen open. Grote groepen en veel boogschutters: hier loont de strijdwagen.
  { fights: [
      { kind: 'normal', foes: [['archer', 5]], reward: 35 },
      { kind: 'normal', foes: [['gladiator', 4]], reward: 40 },
      { kind: 'normal', foes: [['slave', 15]], reward: 45 },
      { kind: 'normal', foes: [['gladiatorSword', 2], ['archer', 3]], reward: 55 },
      { kind: 'boss', foes: [['champion', 1], ['gladiatorStick', 2]], reward: 70 } ],
    tourney: { kind: 'tournament', rounds: [[['gladiatorSword', 2]], [['slave', 10], ['archer', 2]], [['champion', 3]]], reward: 200 } }
];
const KINDS = { normal: 'Gevecht', boss: 'Tussenbaas', tournament: 'Toernooi' };
// Tussen de rondes krijg je heal × je maximale leven terug. Ga je neer, dan beslist Caesar.
// Kans op duim omhoog = mercyBase + mercyFavor × (schade die je uitdeelde / alle leven van alle tegenstanders), hoogstens mercyMax.
// Duim omhoog: je leeft, maar het toernooi en de beloning zijn weg (geen boete); je mag het opnieuw proberen. Duim omlaag: dood, alles opnieuw vanaf gevecht I.
const TOURNAMENT = { heal: .25, mercyBase: .15, mercyFavor: .8, mercyMax: .95 };
// Waar je bent: S.stage (welk blok), S.inStage (zoveel gevechten van dat blok gewonnen), S.finished (alle toernooien gewonnen).
const stageOf = () => STAGES[Math.min(S.stage, STAGES.length - 1)];
const fightIdx = () => S.finished ? stageOf().fights.length - 1 : Math.min(S.inStage, stageOf().fights.length - 1);
const fightNumber = () => STAGES.slice(0, Math.min(S.stage, STAGES.length - 1)).reduce((n, st) => n + st.fights.length, 0) + fightIdx() + 1;
const fightOpen = () => S.finished || S.inStage < stageOf().fights.length;   // na 5 gevechten: eerst het toernooi
const fightDef = () => S.mode === 'tournament' ? stageOf().tourney : stageOf().fights[fightIdx()];
const fightTitle = () => S.mode === 'tournament' ? `Toernooi ${toRoman(Math.min(S.stage, STAGES.length - 1) + 1)}` : `Gevecht ${toRoman(fightNumber())}`;
const roundsOf = def => def.rounds || [def.foes];
const listSummary = list => list.map(([t, n]) => `${n} ${n > 1 ? FOES[t].plural : FOES[t].name}`).join(' en ');
// Na elk gevecht ga je de stad in; terug naar de arena door op de arena te klikken.
const MONEY = { lossShare: .5 };
// Uitrusting naast je wapen, in vakken: body (harnas), head (helm), shield (schild). Eén ding per vak.
// armor = elke klap doet zoveel minder (maar altijd minstens 1); speed = loopsnelheid erbij of eraf;
// knock = hoe ver je wordt weggeduwd (× dit getal); front = schild: pijlen van voren houdt het tegen, klappen van voren doen 1 minder.
const GEAR = {
  leather: { slot: 'body',   name: 'Leren harnas',      price: 35,  armor: 1, short: 'armor 1', desc: 'armor 1: elke klap 1 minder' },
  galea:   { slot: 'head',   name: 'Galea',             price: 30,  knock: .5, short: '−50% wegduwen', desc: 'je wordt half zo ver weggeduwd' },
  scutum:  { slot: 'shield', name: 'Scutum',            price: 50,  front: 1, short: 'van voren −1 · pijlen 0', desc: 'pijlen van voren houdt hij tegen; klappen van voren 1 minder' },
  lorica:  { slot: 'body',   name: 'Lorica segmentata', price: 120, armor: 2, speed: -8, short: 'armor 2 · −8 snelheid', desc: 'armor 2, maar −8 loopsnelheid' },
  quiver:  { slot: 'quiver', name: 'Pijlkoker', price: 30, capacity: 15, short: '15 pijlen', desc: '15 pijlen mee in plaats van 5' },
  chariot: { slot: 'mount',  name: 'Strijdwagen', price: 250, needsBow: true, short: 'met boog (2)', desc: 'veel sneller en je rijdt tegenstanders omver; stilstaan kan niet; je rijdt als je de boog vasthoudt (vak 2), met je melee-wapen sta je naast de wagen' }
};
const SLOTS = { body: 'Harnas', head: 'Helm', shield: 'Schild', quiver: 'Pijlkoker', mount: 'Rijdier' };
// Pijlen koop je bij de boogmaker: price denarii per stuk. Zonder pijlkoker kun je er base meenemen.
const AMMO = { base: 5, price: 2 };
// De winkels in de straat. after = open na zoveel gewonnen toernooien (0 = vanaf het begin); wares = sleutels uit WEAPONS of GEAR.
const SHOPS = {
  smith:   { nl: 'Wapensmid',   la: 'Faber',      after: 0, wares: ['stick', 'gladius', 'hasta'] },
  armorer: { nl: 'Harnasmaker', la: 'Loricarius', after: 0, wares: ['leather', 'galea', 'scutum', 'lorica'] },
  bowyer:  { nl: 'Boogmaker',   la: 'Arcuarius',  after: 1, wares: ['arrows', 'bow', 'composite', 'quiver'] },
  stable:  { nl: 'Stallen',     la: 'Stabulum',   after: 2, wares: ['chariot'] }
};
const shopOpen = id => SHOPS[id].wares.length > 0 && (S.finished ? STAGES.length : S.stage) >= SHOPS[id].after;
const FEEL = { hitstop: .06, shake: 5, playerShake: 9, flash: .12 };
// Aftellen aan het begin (III, II, I, Pugnate!): je kunt al lopen, tegenstanders wachten nog.
const INTRO = { step: .8, count: 3, shout: .7 };
// Grootte van het zandveld (oppervlak in wereld-eenheden). Kleiner = de camera zit dichter op het gevecht.
const FIGHT_AREA = 30000;

/* ---------- Toestand ---------- */
const S = { ammo: 0, melee: 'fists', ranged: null, active: 'melee', switching: 0, switchTo: null, arrows: [], mode: 'fight', stage: 0, inStage: 0, finished: false, round: 0, dealt: 0, poolHp: 0, money: 0, delta: 0, owned: ['fists'], gear: { body: null, head: null, shield: null, mount: null, quiver: null }, townSeen: false, xp: 0, xpStart: 0, pointsStart: 0, orbs: [], collect: 0, gained: 0, levelUps: 0, stats: { strength: 0, agility: 0, vitality: 0 }, points: 0, foes: [], floats: [], dust: [], paused: true, over: null, overT: 0, freeze: 0, shake: 0, intro: 0, shout: 0 };
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
const fmt = n => n.toLocaleString('nl-NL', { maximumFractionDigits: 2 });   // 2,5 in plaats van 2.5
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU2 = Math.PI * 2;
function lerpAngle(a, b, t) { const d = ((b - a + Math.PI * 3) % TAU2) - Math.PI; return a + d * t; }
const testCount = +new URLSearchParams(location.search).get('n') || 0;
// Afgeleide waarden van de speler: basis + stats.
// Het wapen in je handen volgt het actieve vak.
function syncWeapon() { PLAYER.weapon = S.active === 'ranged' && S.ranged ? S.ranged : S.melee; }
// Uitrusting aandoen. Wapens gaan in hun eigen vak (boog in ranged, de rest in melee).
// Het schild werkt alleen als je je melee-wapen vasthoudt; de strijdwagen alleen met een boog in je handen.
function wear(key) {
  if (WEAPONS[key]) {
    if (isBow(key)) S.ranged = key; else S.melee = key;
  } else {
    const g = GEAR[key];
    if (g.needsBow && !S.ranged) return 'Koop eerst een boog: de strijdwagen gaat alleen met een boog.';
    S.gear[g.slot] = key;
  }
  syncWeapon();
  return '';
}
// Wisselen tussen de vakken (toets 1 of 2, of de knoppen in de HUD). Tijdens het wisselen val je niet aan.
function switchTo(slot) {
  if (slot === 'ranged' && !S.ranged) return;
  if (S.switching > 0) { if (slot === S.active) { S.switching = 0; S.switchTo = null; updateUI(); } return; }   // terug naar wat je had: wissel afgebroken
  if (slot === S.active) return;
  S.switchTo = slot; S.switching = ARMS.switchTime; P.swing = 0; P.punch = 0;
  updateUI();
}
const gearSum = key => Object.values(S.gear).reduce((n, g) => n + (g && GEAR[g][key] || 0), 0);
const me = {
  get maxHp() { return PLAYER.hp + STAT_RULES.hp * S.stats.vitality; },
  get speed() { return (PLAYER.speed + STAT_RULES.speed * S.stats.agility + gearSum('speed')) * (S.active === 'ranged' && S.ranged ? ARMS.speedMul : 1); },
  get armor() { return gearSum('armor'); },
  get riding() { return S.gear.mount === 'chariot' && S.active === 'ranged' && !!S.ranged; },   // op de wagen alleen met de boog in je handen
  get ammoMax() { return S.gear.quiver ? GEAR[S.gear.quiver].capacity : AMMO.base; },
  get shield() { return !!S.gear.shield && S.active === 'melee'; },
  get shootCd() { const w = WEAPONS[PLAYER.weapon]; return w.cooldown * Math.max(STAT_RULES.shootMin, 1 - STAT_RULES.shoot * S.stats.agility); },
  get knock() { return Object.values(S.gear).reduce((k, g) => k * (g && GEAR[g].knock || 1), 1); },
  get dmg() { return WEAPONS[S.melee].dmg + STAT_RULES.dmg * S.stats.strength; },   // kracht telt voor je melee-wapen
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
  Object.assign(P, { heading: -Math.PI / 2, spd: 0, punch: 0, x: 0, y: W.ry * .45, vx: 0, vy: 0, face: -Math.PI / 2, hp: me.maxHp, cd: 0, swing: 0, hurt: 0, flash: 0, target: null, dead: false });
  steer.active = false;
  S.foes = []; S.floats = []; S.dust = []; S.arrows = []; S.over = null; S.overT = 0; S.freeze = 0; S.shake = 0;
  S.intro = INTRO.step * INTRO.count; S.shout = 0;
  S.orbs = []; S.collect = 0; S.gained = 0; S.levelUps = 0; S.xpStart = S.xp; S.pointsStart = S.points;
  S.round = 0; S.dealt = 0; S.switching = 0; syncWeapon();
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
  S.orbs = []; S.collect = 0; S.floats = []; S.arrows = [];
  S.intro = INTRO.step * INTRO.count; S.shout = 0;
  SFX.mood('calm'); arenaCheer(); SFX.cheer(.8);
  spawnRound();
  void heal;
}
function mkFoe(type, x, y) {
  const d = FOES[type];
  return { type, d, x, y, vx: 0, vy: 0, face: Math.atan2(P.y - y, P.x - x), hp: d.hp, state: 'walk', t: 0, cd: .2 + Math.random() * .4,
           flash: 0, lunge: 0, dead: 0, wob: Math.random() * 10 };
}

/* ---------- Gevecht ---------- */
// soft = omverrijden: geen hit-stop en weinig schudden, anders schokt het als je door een groep rijdt.
function hitFoe(f, dmg, from, soft) {
  const w = WEAPONS[PLAYER.weapon], real = Math.max(0, dmg - f.d.armor);
  S.dealt += Math.min(real, Math.max(0, f.hp));
  f.hp -= real; f.flash = FEEL.flash;
  const dx = f.x - from.x, dy = f.y - from.y, l = Math.hypot(dx, dy) || 1;
  const kb = soft ? 0 : w.knock * (f.state === 'windup' ? .2 : 1);   // tijdens de aanzet zet hij zich schrap
  f.vx += dx / l * kb; f.vy += dy / l * kb;
  if (soft) S.shake = Math.max(S.shake, 1.5);
  else { S.freeze = FEEL.hitstop; S.shake = Math.max(S.shake, FEEL.shake); }
  float(f.x, f.y - 18, real ? '−' + fmt(real) : '0', C.ink);
  const now = performance.now();
  if (!soft || now - (S.lastRamSfx || 0) > 120) { SFX.hit(); S.lastRamSfx = now; }   // niet tien klappen tegelijk
  SFX.cheer(f.hp <= 0 ? .75 : .35);   // het publiek juicht bij elke rake klap, harder als hij valt
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
  // Schild: geldt alleen als de klap of pijl van voren komt (binnen 60° van waar je naar kijkt).
  const toward = Math.abs(((Math.atan2(f.y - P.y, f.x - P.x) - P.face + Math.PI * 3) % TAU2) - Math.PI);
  const front = me.shield && toward < Math.PI / 3 ? GEAR[S.gear.shield].front : 0;
  if (front && f.arrow) {   // pijl op het schild
    P.block = .3; P.blockA = Math.atan2(f.y - P.y, f.x - P.x);
    SFX.block(); return;
  }
  const real = Math.max(1, f.d.dmg - me.armor - front);   // harnas en schild: altijd minstens 1
  P.hp = Math.max(0, P.hp - real); P.hurt = PLAYER.invuln; P.flash = FEEL.flash;
  const dx = P.x - f.x, dy = P.y - f.y, l = Math.hypot(dx, dy) || 1;
  const push = (170 + (f.d.knock || 0)) * me.knock;
  P.vx += dx / l * push; P.vy += dy / l * push;
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
    SFX.cheer(.5);
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
  let k = 1 - Math.exp(-dt * PLAYER.accel);
  if (me.riding && !P.dead) {
    // Strijdwagen: je stuurt een richting, de wagen draait daar langzaam heen en rijdt altijd door.
    const want = (tx || ty) ? Math.atan2(ty, tx) : null;
    if (P.heading === undefined) P.heading = P.face;
    const top = CHARIOT.speed + STAT_RULES.speed * S.stats.agility;
    let goal = want !== null ? top : CHARIOT.cruise;
    if (want !== null) {
      const d = ((want - P.heading + Math.PI * 3) % TAU2) - Math.PI, turn = CHARIOT.turn * (1.6 - .6 * Math.min(1, (P.spd || 0) / top));
      P.heading += clamp(d, -turn * dt, turn * dt);
      goal *= Math.max(CHARIOT.turnSlow, 1 - Math.abs(d) / Math.PI * 1.2);   // scherpe bocht: inhouden
    }
    P.spd = (P.spd || 0) + (goal - (P.spd || 0)) * (1 - Math.exp(-dt * CHARIOT.accel));
    tx = Math.cos(P.heading) * P.spd; ty = Math.sin(P.heading) * P.spd;
    k = 1 - Math.exp(-dt * 6);
  }
  P.vx += (tx - P.vx) * k; P.vy += (ty - P.vy) * k;
  P.x += P.vx * dt; P.y += P.vy * dt;
  contain(P, W.rx - PLAYER.radius - 4, W.ry - PLAYER.radius - 4);
  if (me.riding && !P.dead) {   // tegen de muur: de wagen remt af en draait mee langs de muur, maar jij kunt er nog vanaf sturen
    const v = Math.hypot(P.vx, P.vy);
    if (v < (P.spd || 0) * .7 && v > 5) { P.heading = lerpAngle(P.heading, Math.atan2(P.vy, P.vx), 1 - Math.exp(-dt * 3)); P.spd *= Math.exp(-dt * 2); }
  }
  const sp = Math.hypot(P.vx, P.vy);
  if (sp > 90 && Math.random() < dt * 14) S.dust.push({ x: P.x + (Math.random() - .5) * 8, y: P.y + (Math.random() - .5) * 8, t: 1 });

  // Wisselen van wapen loopt ook door tijdens het aftellen.
  if (S.switching > 0) {
    S.switching -= dt;
    if (S.switching <= 0) { S.switching = 0; S.active = S.switchTo; syncWeapon(); P.cd = Math.max(P.cd, .2); updateUI(); }
  }
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
  const bow = w.kind === 'bow', fists = WEAPONS.fists;
  const inReach = !bow && best && bd - best.d.radius - PLAYER.radius <= w.reach;
  const inRange = bow && best && bd <= w.range;
  if (inReach || inRange) P.face = lerpAngle(P.face, Math.atan2(best.y - P.y, best.x - P.x), 1 - Math.exp(-dt * 20));
  else if (sp > 20) P.face = lerpAngle(P.face, Math.atan2(P.vy, P.vx), 1 - Math.exp(-dt * 12));
  P.punch = Math.max(0, (P.punch || 0) - dt); P.noAmmo = Math.max(0, (P.noAmmo || 0) - dt);
  if (S.switching > 0) {   // wisselen van wapen: even niets
  } else if (bow && !P.dead && P.cd === 0 && best && inRange && S.ammo <= 0) {
    if (!(P.noAmmo > 0)) { P.noAmmo = 2.5; const b = $('slot_ranged'); b.classList.remove('empty'); void b.offsetWidth; b.classList.add('empty'); }   // koker leeg: vak 2 knippert rood
  } else if (bow && !P.dead && P.cd === 0 && best && inRange) {
    // Schieten: richt een tikje voor (waar hij heen loopt), de pijl vliegt rechtdoor.
    const t = bd / w.arrow, ax = best.x + (best.state === 'walk' ? Math.cos(best.face) * best.d.speed * t * .6 : 0), ay = best.y + (best.state === 'walk' ? Math.sin(best.face) * best.d.speed * t * .6 : 0);
    const a = Math.atan2(ay - P.y, ax - P.x);
    S.arrows.push({ x: P.x + Math.cos(a) * (PLAYER.radius + 4), y: P.y + Math.sin(a) * (PLAYER.radius + 4), vx: Math.cos(a) * w.arrow, vy: Math.sin(a) * w.arrow, t: 0, life: w.range / w.arrow * 1.15, dmg: w.dmg, stuck: 0, mine: true });
    P.cd = me.shootCd; P.swing = w.swing; S.ammo--; updateUI();
  } else if (!bow && !P.dead && inReach && P.cd === 0) {
    P.cd = w.cooldown; P.swing = w.swing; P.swingDir *= -1;
    if (w.kind === 'stick') SFX.whoosh();
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
    const R = f.d.ranged;
    if (R) {
      // Boogschutter: afstand houden, richten, schieten.
      f.face = lerpAngle(f.face, Math.atan2(ey, ex), 1 - Math.exp(-dt * (f.state === 'windup' ? 3 : 8)));
      if (f.state === 'walk') {
        let dir = 0;
        if (d < R.flee + f.d.radius) dir = -1;          // te dichtbij: weglopen
        else if (d > R.max) dir = 1;                     // te ver: dichterbij
        const side = Math.sin(performance.now() / 900 + f.wob) > 0 ? 1 : -1;   // anders langzaam opzij stappen
        if (dir) { mx = ex / d * f.d.speed * dir; my = ey / d * f.d.speed * dir; }
        else { mx = -ey / d * f.d.speed * .35 * side; my = ex / d * f.d.speed * .35 * side; }
        if (!P.dead && f.cd === 0 && d >= R.flee && d <= R.max + 30) { f.state = 'windup'; f.t = f.d.windup; }
      } else if (f.state === 'windup') {
        f.t -= dt;
        if (d < R.flee * .6) { f.state = 'walk'; f.cd = .4; }   // je staat er bovenop: hij breekt af
        else if (f.t <= 0) {
          const a = Math.atan2(ey, ex);
          S.arrows.push({ x: f.x + Math.cos(a) * (f.d.radius + 4), y: f.y + Math.sin(a) * (f.d.radius + 4), vx: Math.cos(a) * R.arrow, vy: Math.sin(a) * R.arrow, t: 0, life: R.life, dmg: f.d.dmg, stuck: 0 });
          f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown;
        }
      } else if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; }
      f.x += (mx + f.vx) * dt; f.y += (my + f.vy) * dt;
      contain(f, W.rx - f.d.radius - 4, W.ry - f.d.radius - 4);
      continue;
    }
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
  // Strijdwagen: wie je met vaart raakt, gaat omver.
  if (me.riding && !P.dead && S.intro <= 0) {
    const spd = Math.hypot(P.vx, P.vy);
    for (const f of S.foes) {
      f.ramCd = Math.max(0, (f.ramCd || 0) - dt);
      if (f.state === 'dead' || f.ramCd > 0 || spd < CHARIOT.ramSpeed) continue;
      // de paarden lopen voorop: geraakt wordt wie bij de paarden of de wagen staat
      const hx = P.x + Math.cos(P.heading) * CHARIOT.reach, hy = P.y + Math.sin(P.heading) * CHARIOT.reach;
      const near = Math.min(Math.hypot(f.x - hx, f.y - hy) - 14, Math.hypot(f.x - P.x, f.y - P.y) - PLAYER.radius - 6) - f.d.radius;
      if (near > 0) continue;
      const ex = f.x - P.x, ey = f.y - P.y, d = Math.hypot(ex, ey) || 1;
      f.ramCd = CHARIOT.ramCd; f.vx += ex / d * CHARIOT.ramPush; f.vy += ey / d * CHARIOT.ramPush;
      if (f.state === 'windup') { f.state = 'recover'; f.t = f.d.recover; }   // omvergereden: zijn klap gaat niet door
      hitFoe(f, CHARIOT.ram, P, true);
    }
  }
  // Lijven duwen elkaar weg, zodat niemand door een ander heen loopt.
  const bodies = [P, ...S.foes.filter(f => f.state !== 'dead')];
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j], ra = a === P ? PLAYER.radius : a.d.radius, rb = b === P ? PLAYER.radius : b.d.radius;
    const ddx = b.x - a.x, ddy = b.y - a.y, dd = Math.hypot(ddx, ddy) || .01, o = ra + rb - dd;
    if (o > 0) {
      // De strijdwagen wordt niet door lijven tegengehouden: alleen de ander gaat opzij.
      const share = me.riding && !P.dead ? (a === P ? 0 : b === P ? 1 : .5) : .5;
      const ux = ddx / dd * o, uy = ddy / dd * o; a.x -= ux * share; a.y -= uy * share; b.x += ux * (1 - share); b.y += uy * (1 - share);
    }
  }
  // Pijlen: vliegen rechtdoor; raken ze je niet, dan blijven ze even in het zand steken.
  for (const a of S.arrows) {
    if (a.stuck) { a.stuck -= dt; if (a.stuck <= 0) a.stuck = -1; continue; }
    a.t += dt; a.x += a.vx * dt; a.y += a.vy * dt;
    if (a.mine) {   // jouw pijl: raakt de eerste tegenstander die hij tegenkomt
      const f = S.foes.find(f => f.state !== 'dead' && Math.hypot(a.x - f.x, a.y - f.y) < f.d.radius + 2);
      if (f) { hitFoe(f, a.dmg, { x: a.x - a.vx * .05, y: a.y - a.vy * .05 }); a.stuck = -1; continue; }
    } else if (!P.dead && P.hurt <= 0 && Math.hypot(a.x - P.x, a.y - P.y) < PLAYER.radius + 2) {
      hitPlayer({ x: a.x - a.vx * .05, y: a.y - a.vy * .05, d: { dmg: a.dmg }, arrow: true }); a.stuck = -1; continue;
    }
    if (a.t > a.life || (a.x / W.rx) ** 2 + (a.y / W.ry) ** 2 > 1) a.stuck = 1.5;
  }
  S.arrows = S.arrows.filter(a => a.stuck >= 0);
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
  drawArrows();
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
  if (opts.shield) {   // scutum aan de linkerarm: rood met een bronzen knop
    ctx.fillStyle = fl ? '#fff' : '#8e1f1a'; ctx.beginPath(); ctx.roundRect(r * .35, -r * 1.3, r * .42, r * 1.1, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.bronze; ctx.beginPath(); ctx.arc(r * .56, -r * .75, r * .16, 0, TAU2); ctx.fill();
  }
  ctx.fillStyle = fl ? '#fff' : skin; ctx.beginPath(); ctx.arc(r * .12, 0, r * .48, 0, TAU2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = fl ? '#fff' : hair; ctx.beginPath(); ctx.arc(-r * .02, 0, r * .42, Math.PI * .5, Math.PI * 1.5); ctx.fill();
  if (opts.item) opts.item(r);
  ctx.restore();
}
// Hoe de speler eruitziet met zijn uitrusting.
function playerLook() {
  const b = S.gear.body;
  return { tunic: b === 'lorica' ? '#8f8a80' : b === 'leather' ? '#7a5230' : C.blood,
           belt: b === 'lorica' ? '#5c5a62' : C.bronze, hair: S.gear.head ? C.bronze : C['hair-1'], shield: me.shield };
}
// Strijdwagen van bovenaf: twee paarden voorop, wagenbak met wielen, jij erin.
function drawChariot(now) {
  const h = P.heading ?? P.face, moving = Math.hypot(P.vx, P.vy), gallop = Math.sin(now / 70) * Math.min(1, moving / 80);
  ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(h);
  ctx.fillStyle = 'rgba(40,20,8,.28)'; ctx.beginPath(); ctx.ellipse(14, 3, 30, 15, 0, 0, TAU2); ctx.fill();
  ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(26, 0); ctx.stroke();                     // dissel
  for (const side of [-1, 1]) {                                                          // paarden
    const y = side * 6.5, b = side * gallop * 1.5;
    ctx.fillStyle = side < 0 ? C.horse || '#5a3a26' : '#6b4526'; ctx.strokeStyle = 'rgba(30,15,8,.75)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(27 + b, y, 9, 3.6, 0, 0, TAU2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(38 + b, y, 4.2, 2.6, 0, 0, TAU2); ctx.fill(); ctx.stroke();   // hoofd
    ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(31 + b, y); ctx.lineTo(36 + b, y); ctx.stroke();   // manen
    ctx.strokeStyle = 'rgba(226,179,94,.8)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(34 + b, y); ctx.stroke();   // teugels
  }
  ctx.fillStyle = '#3b2a1e'; ctx.fillRect(-6, -13, 6, 3); ctx.fillRect(-6, 10, 6, 3);   // wielen
  ctx.fillStyle = '#8e1f1a'; ctx.strokeStyle = C.bronze; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(-9, -10, 15, 20, 4); ctx.fill(); ctx.stroke();           // wagenbak
  ctx.restore();
}
function drawPlayer(now) {
  const w = WEAPONS[PLAYER.weapon], look = playerLook();
  if (P.dead) { drawFallen(P, PLAYER.radius, C.blood, C.skin, 1); return; }
  if (P.hurt > 0 && Math.floor(now / 70) % 2 === 0) ctx.globalAlpha = .45;
  if (me.riding) drawChariot(now);
  if (S.switching > 0) {   // wisselen: een ring die volloopt
    const t = 1 - S.switching / ARMS.switchTime;
    ctx.strokeStyle = 'rgba(245,234,214,.8)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(P.x, P.y, PLAYER.radius + 7, -Math.PI / 2, -Math.PI / 2 + TAU2 * t); ctx.stroke();
  }
  const sw = P.swing > 0 ? 1 - P.swing / w.swing : -1;   // 0..1 tijdens een slag, anders -1
  if (w.kind === 'bow') {
    // Boog: pees naar achteren vlak voor het schot; met je vuisten als iemand tegen je aan staat.
    const pull = P.cd > 0 && P.cd < .35 ? 1 - P.cd / .35 : 0, punch = P.punch > 0 ? Math.sin((1 - P.punch / WEAPONS.fists.swing) * Math.PI) : 0;
    drawBody(P, PLAYER.radius, look.tunic, C.skin, look.hair, {
      flash: P.flash, belt: look.belt, armR: 4 + 9 * punch, armL: 4,
      item: r => {
        const bx = r + 3, ang = 1.1;
        ctx.strokeStyle = w === WEAPONS.composite ? '#2a1a12' : '#5a3a26'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(bx - 6, 0, 9, -ang, ang); ctx.stroke();
        const tx = bx - 6 + Math.cos(ang) * 9, ty = Math.sin(ang) * 9, p = 6 * pull;
        ctx.strokeStyle = 'rgba(245,234,214,.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(tx, -ty); ctx.lineTo(tx - p, 0); ctx.lineTo(tx, ty); ctx.stroke();
        if (pull > 0) { ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(tx - p, 0); ctx.lineTo(bx + 6, 0); ctx.stroke(); }
        if (punch > .3) { ctx.strokeStyle = `rgba(255,240,210,${punch * .7})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, PLAYER.radius + WEAPONS.fists.reach + 2, -.45, .45); ctx.stroke(); }
        ctx.lineCap = 'butt';
      }
    });
    ctx.globalAlpha = 1; return;
  }
  if (w.kind === 'fists') {
    // Vuistslag: de rechter- of linkervuist schiet naar voren en het lijf leunt mee, zoals bij een slaaf.
    const punch = sw >= 0 ? Math.sin(sw * Math.PI) : 0, right = P.swingDir > 0;
    drawBody(P, PLAYER.radius, look.tunic, C.skin, look.hair, {
      flash: P.flash, belt: look.belt, shield: look.shield, forward: 3 * punch,
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
  drawBody(P, PLAYER.radius, look.tunic, C.skin, look.hair, {
    flash: P.flash, belt: look.belt, shield: look.shield, armR: sw >= 0 ? 3 : 0,
    item: r => {
      if (sw >= 0) {   // zwaaispoor
        ctx.strokeStyle = 'rgba(255,240,210,.55)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        const a0 = P.swingDir * -1.1, a1 = ang;
        ctx.beginPath(); ctx.arc(0, 0, len * .85, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke(); ctx.lineCap = 'butt';
      }
      const hx = r * .35 + (sw >= 0 ? 3 : 0), hy = r * .78;
      const ex = Math.cos(ang) * len, ey = Math.sin(ang) * len + (sw >= 0 ? 0 : hy * .4);
      ctx.lineCap = 'round';
      if (w.kind === 'spear') {   // hasta: lange schacht met ijzeren punt
        const dx = ex - hx, dy = ey - hy, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
        ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(hx - ux * 8, hy - uy * 8); ctx.lineTo(ex - ux * 5, ey - uy * 5); ctx.stroke();
        ctx.fillStyle = C.iron; ctx.beginPath(); ctx.moveTo(ex + ux * 2, ey + uy * 2); ctx.lineTo(ex - ux * 6 - uy * 3, ey - uy * 6 + ux * 3); ctx.lineTo(ex - ux * 6 + uy * 3, ey - uy * 6 - ux * 3); ctx.fill();
      } else if (w.kind === 'sword') {   // gladius: kort lemmet, bronzen gevest en dwarsstuk
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
function drawArrows() {
  ctx.lineCap = 'round';
  for (const a of S.arrows) {
    const ang = Math.atan2(a.vy, a.vx), c = Math.cos(ang), s = Math.sin(ang);
    ctx.globalAlpha = a.stuck ? Math.min(1, a.stuck) * .7 : 1;
    const len = a.stuck ? 8 : 13;   // in het zand: half erin
    ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(a.x - c * len, a.y - s * len); ctx.lineTo(a.x, a.y); ctx.stroke();
    ctx.strokeStyle = a.mine ? '#8e1f1a' : '#ece3cf'; ctx.lineWidth = 2.4;   // veren (jouw pijlen: rood)
    ctx.beginPath(); ctx.moveTo(a.x - c * len, a.y - s * len); ctx.lineTo(a.x - c * (len - 3), a.y - s * (len - 3)); ctx.stroke();
    if (!a.stuck) { ctx.fillStyle = C.iron; ctx.beginPath(); ctx.moveTo(a.x + c * 3, a.y + s * 3); ctx.lineTo(a.x - s * 2, a.y + c * 2); ctx.lineTo(a.x + s * 2, a.y - c * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1; ctx.lineCap = 'butt';
}
function drawFoe(f, now) {
  const d = f.d;
  if (f.state === 'dead') { drawFallen(f, d.radius, d.tunic, C[d.skin], f.dead); return; }
  const wind = f.state === 'windup' ? 1 - f.t / d.windup : 0;
  if (d.ranged) { drawArcher(f, wind); return; }
  // Aanzet: rode gloed en arm naar achteren; uitval: arm en lijf naar voren.
  if (wind > 0) {
    ctx.fillStyle = `rgba(212,70,59,${.15 + .3 * wind})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, d.radius + 4 + 3 * wind, 0, TAU2); ctx.fill();
  }
  const tunic = wind > 0 ? mix(d.tunic, C.blood, .55 * wind) : d.tunic;
  drawBody(f, d.radius, tunic, C[d.skin], C[d.hair], {
    flash: f.flash, belt: d.belt, armR: -5 * wind + 9 * f.lunge, forward: 5 * f.lunge, lean: -.25 * wind
  });
  if (d.weapon) {   // stok of gladius: naar achteren bij het aanzetten, zwaai naar voren bij de uitval
    const ang = wind > 0 ? .55 + .7 * wind : f.lunge > 0 ? 1.25 - 2.3 * (1 - f.lunge) : .55, len = d.radius + d.reach;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.face);
    const hx = d.radius * .35, hy = d.radius * .78, ex = Math.cos(ang) * len, ey = Math.sin(ang) * len;
    ctx.lineCap = 'round';
    if (d.weapon === 'sword') {
      const dx = ex - hx, dy = ey - hy, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, gx = hx + ux * 5, gy = hy + uy * 5;
      ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = '#e4e0d4'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = C.bronze; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx - ux * 2, hy - uy * 2); ctx.lineTo(gx, gy); ctx.stroke();
      ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(gx - uy * 4, gy + ux * 4); ctx.lineTo(gx + uy * 4, gy - ux * 4); ctx.stroke();
    } else {
      ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
    }
    if (f.lunge > .3) { ctx.strokeStyle = `rgba(212,70,59,${f.lunge * .7})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, len * .9, -1, 1.2); ctx.stroke(); }
    ctx.lineCap = 'butt'; ctx.restore();
  } else if (f.lunge > .3) {   // vuistslag
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.face);
    ctx.strokeStyle = `rgba(212,70,59,${f.lunge * .7})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, d.radius + d.reach + 4, -.5, .5); ctx.stroke(); ctx.restore();
  }
}
// Boogschutter: boog voor het lijf; bij het richten een rode stippellijn naar je toe die steeds feller wordt.
function drawArcher(f, wind) {
  const d = f.d, r = d.radius;
  if (wind > 0) {
    const reach = d.ranged.arrow * d.ranged.life * .5;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.face);
    ctx.strokeStyle = `rgba(212,70,59,${.15 + .55 * wind})`; ctx.lineWidth = 1.5 + wind; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(r + 6, 0); ctx.lineTo(reach, 0); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }
  drawBody(f, r, wind > 0 ? mix(d.tunic, C.blood, .4 * wind) : d.tunic, C[d.skin], C[d.hair], { flash: f.flash, belt: d.belt, armR: 4, armL: 4 });
  ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.face);
  const bx = r + 3, pull = 6 * wind;
  ctx.strokeStyle = '#5a3a26'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(bx - 6, 0, 9, -1.1, 1.1); ctx.stroke();   // boog
  const tx = bx - 6 + Math.cos(1.1) * 9, ty = Math.sin(1.1) * 9;
  ctx.strokeStyle = 'rgba(245,234,214,.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(tx, -ty); ctx.lineTo(tx - pull, 0); ctx.lineTo(tx, ty); ctx.stroke();   // pees
  if (wind > 0) { ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(tx - pull, 0); ctx.lineTo(bx + 6, 0); ctx.stroke(); }
  ctx.lineCap = 'butt'; ctx.restore();
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
function updateUI() {
  $('fightTitle').textContent = fightTitle();
  const def = fightDef(), rounds = roundsOf(def).length;
  $('foeText').textContent = def.kind === 'tournament' ? `Ronde ${toRoman(S.round + 1)}/${toRoman(rounds)}` : '';
  $('money').textContent = S.money;
  for (const slot of ['melee', 'ranged']) {
    const b = $('slot_' + slot), key = S[slot];
    b.querySelector('span').textContent = key ? WEAPONS[key].name + (slot === 'ranged' ? ` · ${S.ammo}/${me.ammoMax}` : '') : '—';
    b.disabled = !key; b.classList.toggle('on', S.active === slot && !S.switching); b.classList.toggle('to', S.switching > 0 && S.switchTo === slot);
  }
  $('armor').textContent = me.armor;
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
  $('resultEyebrow').textContent = fightTitle();
  $('resultTitle').textContent = won ? 'Overwinning' : 'Verloren';
  const total = S.orbs.length;
  $('resultText').textContent = won
    ? `Je had nog ${P.hp} van de ${me.maxHp} leven over en raapte ${S.gained} van de ${total} XP op. `
      + (S.levelUps ? `Niveau ${toRoman(levelOf(S.xp))}: je hebt ${S.points} ${S.points === 1 ? 'punt' : 'punten'} te verdelen.` : `Nog ${LEVELS[levelOf(S.xp) - 1] - S.xp} XP tot het volgende niveau.`)
      + (def.kind === 'tournament' ? ` Je overleefde alle ${toRoman(def.rounds.length)} rondes van het toernooi.` : '')
    : 'Het publiek joelt. Je mag het nog eens proberen. De XP uit dit gevecht is weg; je stats blijven zoals ze waren.';
  $('resultMoney').textContent = won ? `+${S.delta} d` : S.delta ? `−${-S.delta} d` : '';
  $('resultMoney').classList.toggle('loss', !won);
  $('resultBtn').textContent = 'Verder';
  $('result').hidden = false; $('resultBtn').focus();
}
// Na de uitslag ga je altijd de stad in. Terug naar de arena: klik in de stad op de arena.
$('resultBtn').onclick = () => { $('result').hidden = true; toTown(); };
// Naar de stad, maar heb je punten, dan eerst het perkament (zodat je het niet vergeet).
function toTown() { if (S.points) openStats('toTown'); else openTown(); }

/* ---------- Caesars duim (toernooi verloren) ---------- */
let mercyTimers = [];
function openMercy() {
  const def = fightDef(), favor = S.poolHp ? Math.min(1, S.dealt / S.poolHp) : 0;
  const chance = Math.min(TOURNAMENT.mercyMax, TOURNAMENT.mercyBase + TOURNAMENT.mercyFavor * favor);
  const ok = Math.random() < chance;
  S.spared = ok;
  const d = $('judgeDetail'), b = $('judgeBtn');
  d.hidden = true; d.innerHTML = `<dt>Ronde</dt><dd>${toRoman(S.round + 1)} van ${toRoman(def.rounds.length)}</dd>
    <dt>Schade uitgedeeld</dt><dd>${fmt(S.dealt)} van ${S.poolHp}</dd>
    <dt>Gunst van het publiek</dt><dd>${Math.round(chance * 100)}%</dd>
    <dt>Uitslag</dt><dd class="${ok ? 'good' : 'bad'}">${ok ? 'Je leeft. Het toernooi is voorbij, geen beloning.' : 'Mors. Je begint opnieuw bij gevecht I.'}</dd>`;
  b.textContent = ok ? 'Verder' : 'Opnieuw'; b.dataset.ok = ok ? '1' : '';
  b.hidden = false; b.style.visibility = 'hidden';
  $('judgeTitle').textContent = '';
  $('judge').hidden = false;
  judgeStart();
  mercyTimers.forEach(clearTimeout);
  mercyTimers = [
    setTimeout(() => { judgeVerdict(ok); ok ? SFX.cheer(1) : SFX.boo(1); }, JUDGE.think),
    setTimeout(() => {
      for (const el of [d, b]) { el.style.visibility = ''; el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' }); }
      b.focus();
    }, JUDGE.think + JUDGE.detail)
  ];
}
$('judgeBtn').onclick = () => {
  $('judge').hidden = true; judgeEnd();
  if ($('judgeBtn').dataset.ok) toTown(); else newRun();
};
// Na een gewonnen gevecht schuift de reeks op (bij het openen van de stad). Verloren: alles blijft staan.
function settle() {
  if (S.over !== 'won') return;
  if (S.mode === 'tournament') {
    if (S.stage + 1 >= STAGES.length) S.finished = true;    // laatste toernooi: daarna blijft het laatste gevecht als herhaling
    else { S.stage++; S.inStage = 0; }                       // de volgende 5 gevechten komen vrij
  } else if (!S.finished) S.inStage = Math.min(S.inStage + 1, stageOf().fights.length);
  S.over = 'done';
}
// In de arena gekozen: 'fight' of 'tournament'. Heb je nog punten, dan eerst het perkament.
function chooseArena(mode) {
  S.mode = mode;
  if (S.points) { openStats('arena'); return; }
  enterArena();
}
function enterArena() { startFight(); S.paused = false; }
function newRun() {
  S.mode = 'fight'; S.stage = 0; S.inStage = 0; S.finished = false;
  S.xp = 0; S.points = POINTS.start; for (const k in S.stats) S.stats[k] = 0;
  S.money = 0; S.delta = 0; S.owned = ['fists']; S.gear = { body: null, head: null, shield: null, mount: null, quiver: null }; S.townSeen = false; S.ammo = 0; S.melee = 'fists'; S.ranged = null; S.active = 'melee'; S.switching = 0; PLAYER.weapon = 'fists'; S.over = null;
  startFight(); S.paused = false;
}
$('startBtn').onclick = () => { SFX.init(); $('start').hidden = true; newRun(); };
// Geluid aan/uit: knop rechtsboven, of de toets M.
function showMute() { const b = $('mute'); b.textContent = SFX.muted ? 'Geluid uit' : 'Geluid aan'; b.setAttribute('aria-pressed', String(!SFX.muted)); }
$('slot_melee').onclick = () => { switchTo('melee'); $('slot_melee').blur(); };
$('slot_ranged').onclick = () => { switchTo('ranged'); $('slot_ranged').blur(); };
$('mute').onclick = () => { SFX.init(); SFX.setMuted(!SFX.muted); showMute(); };
showMute();

/* ---------- Punten verdelen ---------- */
// mode 'toTown' = na de uitslag, op weg naar de stad; 'town' = vanuit de straat (Klaar = terug de straat in); 'arena' = op weg naar het gevecht.
let added = {}, statsMode = 'town';
function openStats(mode = 'town') {
  S.paused = true; added = {}; statsMode = mode;
  for (const k in STATS) added[k] = 0;
  $('statsBack').hidden = mode !== 'arena';
  renderStats(); $('stats').hidden = false; $('statsBtn').focus();
}
function statEffect(k, n) {
  const v = { ...S.stats, [k]: n };
  return { strength: `${fmt(WEAPONS[S.melee].dmg + STAT_RULES.dmg * v.strength)} schade`,
           agility: `snelheid ${PLAYER.speed + STAT_RULES.speed * v.agility}`,
           vitality: `${PLAYER.hp + STAT_RULES.hp * v.vitality} leven` }[k];
}
function renderStats() {
  const list = $('statList'); list.innerHTML = '';
  for (const [k, d] of Object.entries(STATS)) {
    const li = document.createElement('li');
    li.innerHTML = `<div><b>${d.nl}</b><span class="eff">${statEffect(k, S.stats[k])}</span></div>
      <div class="stepper"><button aria-label="${d.nl} omlaag" ${added[k] ? '' : 'disabled'}>−</button><output aria-label="${S.stats[k]}">${S.stats[k] ? toRoman(S.stats[k]) : '–'}</output><button aria-label="${d.nl} omhoog" ${S.points ? '' : 'disabled'}>+</button></div>`;
    const [minus, plus] = li.querySelectorAll('button');
    minus.onclick = () => { added[k]--; S.stats[k]--; S.points++; renderStats(); };
    plus.onclick = () => { added[k]++; S.stats[k]++; S.points--; renderStats(); };
    list.appendChild(li);
  }
  $('statsBtn').textContent = statsMode === 'arena' ? 'Naar de arena' : 'Verder';
  $('statsTitle').textContent = S.points ? toRoman(S.points) : '';
}
$('statsBtn').onclick = () => {
  $('stats').hidden = true;
  if (statsMode === 'arena') enterArena(); else if (statsMode === 'toTown') openTown(); else TOWN.purse();
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
const anyOverlay = () => ['start', 'result', 'stats', 'town', 'shop', 'pick', 'judge'].some(id => !$(id).hidden);
addEventListener('keydown', ev => {
  if (anyOverlay()) return;
  const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  if (k === 'm') { $('mute').click(); return; }
  if (k === '1') { switchTo('melee'); return; }
  if (k === '2') { switchTo('ranged'); return; }
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s'].includes(k)) { keys.add(k); ev.preventDefault(); }
});
addEventListener('keyup', ev => keys.delete(ev.key.length === 1 ? ev.key.toLowerCase() : ev.key));
addEventListener('blur', () => keys.clear());
new ResizeObserver(() => fitWorld(false)).observe(stage);

startFight();
requestAnimationFrame(loop);

/* ---------- Proef: gladiatorgevecht ----------
   Jij te voet met je vuisten tegen slaven. Voor elk gevecht verdeel je punten over vijf stats
   (zoals in Swords and Sandals). Je kijkt naar je muis, slaat met links (of J), blokt met rechts (of K/Shift) en rolt (Spatie).
   Tegenstanders zetten eerst aan (ze kleuren rood en trekken hun
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
  strength: { name: 'Strength', nl: 'Strength', desc: '+0.25 damage per hit' },
  agility:  { name: 'Agility',  nl: 'Agility', desc: '+3 move speed, and you shoot faster with a bow' },
  vitality: { name: 'Vitality', nl: 'Vitality', desc: '+1 health' },
  haste:    { name: 'Attack speed', nl: 'Attack speed', desc: 'less time between two attacks' }
};
// Attack en Defense (raak- en blokkans) staan voorlopig uit: elke klap binnen bereik raakt.
// Terugzetten: hitBase .6 en blockBase .1, en de twee stats weer in STATS en S.stats.
// haste = per punt Attack speed zoveel korter wachten tussen twee aanvallen (alle wapens), nooit korter dan hasteMin × de wachttijd van het wapen.
const STAT_RULES = { haste: .06, hasteMin: .5, dmg: .25, speed: 3, shoot: .04, shootMin: .5, hitBase: 1, hit: .05, hitMax: 1, blockBase: 0, block: .06, blockMax: .75, hp: 1 };
// Punten verdien je met XP: verslagen tegenstanders laten blauwwitte bolletjes vallen. Een niveau omhoog = POINTS.perLevel punten.
const POINTS = { start: 0, perLevel: 2 };
// XP-drempels (totaal) voor niveau II, III, IV, ... Gevecht I, II, III leveren 5, 10, 15 XP op.
const LEVELS = [4, 12, 24, 40, 60, 85, 115, 150, 190, 235, 285, 340, 400, 470, 550, 640, 740, 850, 970, 1100, 1240, 1390, 1550, 1720, 1900, 2090, 2300];   // tot niveau XXVIII: genoeg voor alle 5 blokken
// life = na zoveel seconden verdwijnt een bolletje; de laatste 'fade' seconden knippert en vervaagt het.
const XP = { life: 7.8, fade: 3, perFoe: { noxius: 1, noxiusClub: 2, slave: 5, archer: 5, tiro: 10, tiroStick: 12, murmillo: 15, thraex: 14, hoplomachus: 15, retiarius: 15, secutor: 16, dimachaerus: 14, tiger: 15, lion: 16, hyena: 2, eques: 18, sagittarius: 16, essedarius: 18, essedarius2: 22, bear: 20, elephant: 40 } /* kampioen: ×CHAMPION.xp van zijn klasse */, speed: [70, 150], friction: 3.5, settle: .3, pickup: 6, magnet: 26, pull: 160, collect: 5 };
const levelOf = xp => 1 + LEVELS.filter(t => xp >= t).length;
const hitChance = att => Math.min(STAT_RULES.hitMax, STAT_RULES.hitBase + STAT_RULES.hit * att);
const blockChance = def => Math.min(STAT_RULES.blockMax, STAT_RULES.blockBase + STAT_RULES.block * def);
// reach = hoe ver voorbij je eigen lijf je raakt; cooldown = seconden tussen twee slagen; price = in denarii bij de wapensmid.
// Je begint met je vuisten, net als een slaaf: zelfde schade, zelfde bereik, ongeveer even vaak.
const WEAPONS = {
  fists: { name: 'Fists', kind: 'fists', dmg: 3.2, reach: 10, cooldown: .8, swing: .22, knock: 0, price: 0, arc: .7 },   // vuisten duwen niet terug
  // hit: 'single' = één tegenstander; 'sweep' = iedereen binnen bereik in een boog voor je (arc = halve breedte, rad);
  // 'pierce' = iedereen op een smalle lijn recht voor je (width = halve breedte). Zonder hit: de dichtstbijzijnde binnen arc voor je.
  // cooldown = seconden tussen twee slagen (je slaat zelf; Attack speed maakt dit korter).
  stick: { name: 'Staff', kind: 'stick', dmg: 2, reach: 21, cooldown: .9, swing: .22, knock: 85, price: 12, hit: 'sweep', arc: 1.6 },
  gladius: { name: 'Gladius', kind: 'sword', dmg: 5, reach: 19, cooldown: .8, swing: .2, knock: 60, price: 40, hit: 'sweep', arc: .52 },   // arc .52 = ca. 60° breed
  // Hasta: speer. Groot bereik en duwt ver, maar trager.
  hasta: { name: 'Hasta', kind: 'spear', dmg: 6, reach: 22, cooldown: 1, swing: .26, knock: 120, price: 70, hit: 'pierce', width: 7 },
  // Bogen: J schiet op de dichtstbijzijnde tegenstander binnen range (of naar je muis). Staat er iemand tegen je aan, dan sla je met je vuisten.
  // Behendigheid: per punt STAT_RULES.shoot korter wachten tussen twee pijlen (hoogstens tot shootMin × cooldown). Niet samen met een schild.
  bow: { name: 'Short bow', kind: 'bow', dmg: 2, range: 150, arrow: 300, reach: 0, cooldown: 1.2, swing: .25, knock: 20, price: 60 },
  composite: { name: 'Composite bow', kind: 'bow', dmg: 3, range: 190, arrow: 340, reach: 0, cooldown: 1, swing: .25, knock: 30, price: 140 },
  // Late wapens (after = pas te koop na zoveel gewonnen toernooien).
  // Sica: kort gebogen zwaard van de Thraciërs. Minder schade dan de gladius, maar veel sneller.
  sica: { name: 'Sica', kind: 'sword', dmg: 4, reach: 17, cooldown: .6, swing: .16, knock: 30, price: 150, hit: 'sweep', arc: .6, after: 2 },
  // Spatha: lang zwaard van de ruiterij. Zwaar, lang bereik, brede zwaai.
  // Falx: gebogen zwaard met een brede zwaai (±70°): het wapen tegen groepen.
  falx: { name: 'Falx', kind: 'sword', dmg: 5, reach: 21, cooldown: 1, swing: .26, knock: 70, price: 200, hit: 'sweep', arc: 1.2, after: 2 },
  spatha: { name: 'Spatha', kind: 'sword', dmg: 7, reach: 23, cooldown: .95, swing: .24, knock: 90, price: 240, hit: 'sweep', arc: .75, after: 3 },
  // Scythische boog: ver, hard en snel.
  scythian: { name: 'Scythian bow', kind: 'bow', dmg: 4, range: 220, arrow: 380, reach: 0, cooldown: .9, swing: .25, knock: 40, price: 260, after: 3 }
};
const isBow = k => !!k && WEAPONS[k].kind === 'bow';
// Twee wapenvakken: melee (dichtbij) en ranged (boog). Wisselen met 1 en 2 duurt switchTime seconden;
// met een boog in je handen loop je speedMul zo snel (1 = gewoon tempo; de strijdwagen telt niet mee).
const ARMS = { switchTime: 1, speedMul: 1 };
// Strijdwagen: speed = topsnelheid, cruise = zo hard rijd je als je niet stuurt (stilstaan kan niet), turn = draaien (rad/s, sneller als je langzaam gaat),
// turnSlow = bij een scherpe bocht remt hij af tot dit deel van de topsnelheid, zodat je kunt bijsturen;
// ram = schade als je iemand omverrijdt met meer dan ramSpeed (paarden voorop: reach); ramCd = zoveel seconden voor je dezelfde weer kunt raken.
const CHARIOT = { speed: 105, cruise: 55, accel: 2.4, turn: 4.2, turnSlow: .45, ram: 5, ramSpeed: 80, ramPush: 260, ramCd: .7, reach: 26 };
// windup = hoe lang een tegenstander aanzet voor hij uithaalt; recover = even stilstaan erna.
const FOES = {
  slave: { name: 'slave', plural: 'slaves', hp: 14, dmg: 2, armor: 0, attack: 0, defense: 0, speed: 68, radius: 10, reach: 10, windup: .36, recover: .45, cooldown: 1.6, lunge: 9,
           tunic: '#9c8a6c', hair: 'hair-2', skin: 'skin-2' },
  // Voetvolk (noxii): veroordeelden die in groepen de arena in moesten. Zwak per stuk (leven 3 × ATTACK.foeHp = 6, schade 1,
  // altijd minstens 1 ook met harnas), een duidelijke aanloop, maar met velen. speedVar = loopsnelheid per stuk tussen
  // speed × [a, b], zodat een groep uiteenvalt in golfjes. swarm = telt mee voor 'drukte remt' (CROWDED).
  noxius: { name: 'noxius', plural: 'noxii', hp: 3, dmg: 1, armor: 0, attack: 0, defense: 0, speed: 72, speedVar: [.82, 1.18], radius: 9, reach: 9, windup: .55, recover: .5, cooldown: 1.7, lunge: 8, swarm: true,
            tunic: '#7d6e58', hair: 'hair-2', skin: 'skin-3' },
  noxiusClub: { name: 'noxius with club', plural: 'noxii with clubs', hp: 4, dmg: 1, armor: 0, attack: 0, defense: 0, speed: 68, speedVar: [.85, 1.15], radius: 9, reach: 13, windup: .6, recover: .55, cooldown: 1.9, lunge: 9, knock: 80, weapon: 'stick', swarm: true,
                tunic: '#6e604c', hair: 'hair-1', skin: 'skin-2' },
  // Tiro: een nieuweling uit de gladiatorenschool, met slechte uitrusting (een leren kap, armor 1).
  // Vecht met een rudis, het houten oefenzwaard. Sneller en harder dan een slaaf, zet korter aan.
  tiro: { name: 'tiro', plural: 'tirones', hp: 16, dmg: 3, armor: 1, attack: 0, defense: 0, speed: 74, radius: 11, reach: 13, windup: .32, recover: .4, cooldown: 1.4, lunge: 10, weapon: 'rudis',
           tunic: '#8a6a48', belt: '#3b2a1e', hair: 'bronze', skin: 'skin-3', cap: true },
  // Tiro met stok: langer bereik en zijn klap duwt je ver weg (knock).
  tiroStick: { name: 'tiro with staff', plural: 'tirones with staffs', hp: 22, dmg: 3, armor: 1, attack: 0, defense: 0, speed: 72, radius: 11, reach: 16, windup: .4, recover: .45, cooldown: 1.7, lunge: 10, knock: 140, weapon: 'stick',
           tunic: '#8a6a48', belt: '#3b2a1e', hair: 'bronze', skin: 'skin-3', cap: true },
  // Murmillo: zwaar en methodisch, met scutum, gladius en een helm met een vissenvin. Loopt langzaam op je af.
  // Schildmuur: zolang hij in dekking staat (gele rand) blokt hij elke klap die van voren komt (binnen shield.arc
  // van waar hij naar kijkt). Elke geblokte klap = 1 barst, een zware klap (schade >= shield.heavy, of een speer) = 2.
  // Na shield.cracks barsten breekt het scutum: hij wankelt shield.stagger seconden en vecht daarna zonder schild.
  // Aanval: aanzetten (windup) → schildstoot (duwt je bash.push weg, geen schade) → na bash.gap de steek met de gladius
  // → recover: dan staat hij open (witte rand) en raak je hem altijd.
  murmillo: { name: 'murmillo', plural: 'murmillones', hp: 16, dmg: 4, armor: 0, attack: 0, defense: 0, speed: 50, radius: 12, reach: 15, windup: .5, recover: 1.2, cooldown: 1.5, lunge: 12, knock: 60, weapon: 'sword', ai: 'murmillo',
           shield: { arc: 1.35, cracks: 4, heavy: 7, stagger: 2 }, bash: { push: 150, gap: .22 },
           tunic: '#7a5230', belt: '#d49a48', hair: 'bronze', skin: 'skin-3', helmet: 'murmillo' },
  // Thraciër (thraex): snel, met een klein vierkant schildje (parmula) en een gebogen zwaard (sica). Cirkelt om je heen
  // en schiet dan naar binnen voor een snelle snee. Pareren: soms duikt hij in elkaar (zilveren flits, parry.time s).
  // Sla je hem dan, dan stapt hij opzij en snijdt terug. Zijn sica haakt om je schild heen (hook: je schild blokt niet)
  // en laat je bloeden: bleed.dmg schade per seconde, bleed.time seconden lang; het stopt zodra jij hem raakt.
  thraex: { name: 'Thracian', plural: 'Thracians', hp: 14, dmg: 3, armor: 0, attack: 0, defense: 0, speed: 70, radius: 11, reach: 13, windup: .35, recover: .55, cooldown: 1.4, lunge: 14, weapon: 'sica', ai: 'thraex',
           orbit: 30, dart: { speed: 220, time: .16 }, parry: { time: .8, cd: 4.5, step: 26, near: 30 }, hook: true, bleed: { dmg: 1, time: 3 },
           tunic: '#6a4a7a', belt: '#d49a48', hair: 'hair-1', skin: 'skin', helmet: 'thraex', parmula: true },
  // Hoplomachus: Griekse stijl, met een lange speer en een rond, hol bronzen schildje. Houdt je op speerafstand: komt je te
  // dichtbij, dan ramt hij je met zijn schild weg (ram, geen schade) of stapt hij achteruit. Steek: richten (rode lijn,
  // de richting ligt dan vast) en dan een stoot in die lijn. Raak je hem terwijl hij richt of steekt, dan BREEKT de speer:
  // hij wankelt even en vecht daarna met een kort zwaard (after): korter bereik, maar sneller en agressiever.
  hoplomachus: { name: 'hoplomachus', plural: 'hoplomachi', hp: 18, dmg: 4, armor: 1, attack: 0, defense: 0, speed: 62, radius: 11, reach: 30, windup: .55, recover: .6, cooldown: 1.6, lunge: 8, weapon: 'spear', ai: 'hoplomachus',
           width: 7, ram: { push: 190, cd: 2.5, near: 10, time: .16 }, breakStagger: .7,
           after: { weapon: 'sword', ai: 'melee', reach: 13, windup: .3, recover: .35, cooldown: 1.0, speed: 80, lunge: 11, dmg: 3 },
           tunic: '#3e5a6e', belt: '#d49a48', hair: 'hair-2', skin: 'skin-2', helmet: 'hoplo', roundShield: true },
  // Retiarius: de netvechter. Geen helm en bijna geen armor (alleen de galerus op zijn schouder), dus kwetsbaar.
  // Houdt afstand (keep) en gooit zijn net naar waar je heen loopt: een rode cirkel op de grond, NET.flight seconden.
  // Gevangen? Dan komt hij met zijn drietand (fuscina): richten (rode lijn) en een lange stoot. Mist het net, dan blijft
  // het liggen en moet hij het terughalen: dan is hij een makkelijk doelwit. Sta jij bij het net, dan kan hij het niet
  // pakken en vecht hij met de drietand. Kom je tegen hem aan staan, dan steekt hij snel met zijn dolk (pugio).
  retiarius: { name: 'retiarius', plural: 'retiarii', hp: 13, dmg: 4, armor: 0, attack: 0, defense: 0, speed: 72, radius: 11, reach: 24, windup: .35, recover: .55, cooldown: 1.2, lunge: 8, weapon: 'trident', ai: 'retiarius',
           width: 8, keep: 105, toss: { windup: .45, range: 190, min: 45, lead: .35, cd: 2.2 }, pugio: { dmg: 2, windup: .18, cd: 1.1, near: 8 },
           tunic: '#c9b28a', belt: '#3b2a1e', hair: 'hair-2', skin: 'skin-3', galerus: true },
  // Secutor: de achtervolger, gemaakt om de retiarius te vangen. Gladde ronde helm met kleine kijkgaatjes: weinig lucht
  // en weinig zicht. Sprint: richten (rode pijl, sprint.windup) en dan recht op je af (sprint.time). Na 'breath' sprints is
  // hij op: 'spent' seconden op zijn knieën en dan doet elke klap dubbele schade. Smal zicht ('view', halve hoek):
  // sta je na zijn sprint buiten zijn zicht, dan raakt hij je kwijt en zoekt hij even ('search' seconden).
  secutor: { name: 'secutor', plural: 'secutores', hp: 18, dmg: 4, armor: 1, attack: 0, defense: 0, speed: 56, radius: 12, reach: 14, windup: .4, recover: .5, cooldown: 1.4, lunge: 11, knock: 60, weapon: 'sword', ai: 'secutor',
           sprint: { windup: .35, time: .45, speed: 250, range: 170, cd: .8 }, breath: 3, spent: 2.2, view: .9, search: 1,
           tunic: '#7a3a2a', belt: '#d49a48', hair: 'bronze', skin: 'skin-2', helmet: 'secutor', scutum: true },
  // Boogschutter: houdt afstand en schiet. Hij richt eerst (een rode lijn naar je toe, windup seconden), dan vliegt de pijl
  // naar waar je op dat moment stond: blijf bewegen. Kom je te dichtbij (flee), dan loopt hij weg.
  // Sta je echt vlakbij (dagger.near, ruimte tussen jullie), dan stopt hij met schieten en pakt hij zijn dolk (swap s);
  // ben je weer verder dan dagger.far, dan pakt hij zijn boog weer. Met de dolk steekt hij als een slaaf, maar zwakker.
  // Wordt hij leave s niet geraakt (je let niet op hem), dan rent hij weg (hoogstens run s) en zoekt hij een plek om te schieten.
  archer: { name: 'archer', plural: 'archers', hp: 10, dmg: 2, armor: 0, attack: 0, defense: 0, speed: 60, radius: 10, reach: 0, windup: .7, recover: .35, cooldown: 2.6, lunge: 0,
           ranged: { min: 90, max: 180, flee: 60, arrow: 240, life: 1.4 },
           dagger: { near: 40, far: 80, swap: .35, dmg: 1, reach: 11, lunge: 8, windup: .4, recover: .5, cooldown: 1.3, leave: 2.5, run: 3 },
           tunic: '#5f6d45', belt: '#3b2a1e', hair: 'hair-1', skin: 'skin' },
  // Dimachaerus: twee zwaarden, geen schild, een helm en scheenplaten. Glass cannon: weinig leven, maar een combo van
  // 'combo' klappen kort na elkaar (elke 'gap' s). Raak je hem terwijl hij aanzet of zijn combo slaat, dan wankelt hij even (flinch s) en is de combo weg.
  dimachaerus: { name: 'dimachaerus', plural: 'dimachaeri', hp: 14, dmg: 3, armor: 0, attack: 0, defense: 0, speed: 82, radius: 11, reach: 13, windup: .3, recover: .7, cooldown: 1.6, lunge: 9, weapon: 'twin', ai: 'dimachaerus',
           combo: 3, gap: .15, flinch: .35, tunic: '#8e3a3a', belt: '#d49a48', hair: 'hair-1', skin: 'skin-3', helmet: 'dima' },
  // ----- Bereden. Zolang hij rijdt, raakt elke klap het paard (of de wagen): mount.hp is een eigen levensbalk.
  // Is die op, dan valt hij eraf (afstijgen) en vecht hij te voet verder met de waarden uit 'foot'.
  // Eques: ruiter op een versierd wit paard, met lans (hasta) en rond ruiterschild (parma equestris). Galoppeert in rechte
  // lijnen: richten (rode pijl, windup) en dan een charge (charge.speed, charge.time). Draait traag (turn, rad/s).
  // Paard neer: eerst gooit hij zijn lans (rode cirkel), dan vecht hij te voet met de gladius.
  eques: { name: 'eques', plural: 'equites', hp: 14, dmg: 5, armor: 1, attack: 0, defense: 0, speed: 110, radius: 15, reach: 0, windup: .6, recover: .5, cooldown: 1.6, lunge: 0, knock: 200, ai: 'eques',
           mount: { kind: 'horse', hp: 16, color: '#efe8dc', deco: true }, turn: 3.2, charge: { speed: 260, time: .5, min: 45, max: 200 }, hasta: { dmg: 4, windup: .6 },
           foot: { ai: 'throwThen', weapon: 'sword', radius: 11, reach: 14, speed: 74, windup: .35, recover: .45, cooldown: 1.4, lunge: 10, dmg: 3, knock: 60 },
           tunic: '#d8cfbe', belt: '#d49a48', hair: 'hair-1', skin: 'skin', helmet: 'hoplo', roundShield: true },
  // Sagittarius: boogschutter te paard. Rijdt rondjes om je heen op afstand (keep) en schiet al rijdend (rode lijn = hij richt).
  // Paard neer: te voet met een gladius.
  sagittarius: { name: 'sagittarius', plural: 'sagittarii', hp: 10, dmg: 2, armor: 0, attack: 0, defense: 0, speed: 130, radius: 15, reach: 0, windup: .6, recover: .4, cooldown: 2.2, lunge: 0, ai: 'sagittarius',
           mount: { kind: 'horse', hp: 14, color: '#6b4a32' }, turn: 2.6, keep: 150, ranged: { min: 90, max: 220, flee: 0, arrow: 240, life: 1.4 },
           foot: { ai: 'melee', ranged: null, weapon: 'sword', radius: 10, reach: 13, speed: 76, windup: .35, recover: .45, cooldown: 1.4, lunge: 10, dmg: 3 },
           tunic: '#5f6d45', belt: '#3b2a1e', hair: 'hair-1', skin: 'skin-3' },
  // Essedarius: op een Keltische strijdwagen (essedum) met een menner. Rijdt rondjes langs de rand en gooit werpsperen
  // (rode cirkel). Sta je in de baan van de wagen, dan word je overreden (ram). Wagen kapot: te voet met een korte speer.
  essedarius: { name: 'essedarius', plural: 'essedarii', hp: 12, dmg: 4, armor: 0, attack: 0, defense: 0, speed: 125, radius: 18, reach: 0, windup: .5, recover: .4, cooldown: 2, lunge: 0, knock: 220, ai: 'essedarius',
           mount: { kind: 'chariot', horses: 1, hp: 16, color: '#7a5232' }, turn: 1.8, loop: .62, hunt: { every: 7, time: 1.6 }, jav: { min: 60, max: 230, lead: .3 },
           foot: { ai: 'melee', weapon: 'javelin', radius: 11, reach: 18, speed: 72, windup: .4, recover: .5, cooldown: 1.5, lunge: 8, dmg: 3 },
           tunic: '#4a6a4a', belt: '#d49a48', hair: 'hair-2', skin: 'skin-2' },
  // Zelfde, maar met twee paarden: sneller, taaier, draait trager.
  essedarius2: { name: 'essedarius with two horses', plural: 'essedarii with two horses', hp: 12, dmg: 4, armor: 0, attack: 0, defense: 0, speed: 150, radius: 20, reach: 0, windup: .5, recover: .4, cooldown: 1.8, lunge: 0, knock: 240, ai: 'essedarius',
           mount: { kind: 'chariot', horses: 2, hp: 26, color: '#5a3a26' }, turn: 1.5, loop: .62, hunt: { every: 6, time: 1.6 }, jav: { min: 60, max: 240, lead: .3 },
           foot: { ai: 'melee', weapon: 'javelin', radius: 11, reach: 18, speed: 72, windup: .4, recover: .5, cooldown: 1.5, lunge: 8, dmg: 3 },
           tunic: '#4a6a4a', belt: '#d49a48', hair: 'hair-2', skin: 'skin-2' },
  // Beer: traag en taai. Gaat op zijn achterpoten staan (rear: rode waaier voor hem, windup s) en haalt dan breed uit
  // (swipe.arc = halve hoek) met veel terugstoot. Onder rage van zijn leven wordt hij woest: sneller en korter aanzetten.
  bear: { name: 'bear', plural: 'bears', hp: 40, dmg: 5, armor: 1, attack: 0, defense: 0, speed: 55, radius: 15, reach: 16, windup: .8, recover: .9, cooldown: 1.2, lunge: 8, knock: 300, animal: true, ai: 'bear',
          swipe: { arc: .75 }, rage: { at: .5, speed: 85, windup: .55 }, tunic: '#6b4a2e', hair: 'hair-2', skin: 'skin-2' },
  // Olifant: baas-dier. Kan niet weggeduwd worden (heavy). Slurf: dichtbij een brede zwiep (trunk) die je ver wegslaat.
  // Stormloop: richten (rode baan, stampede.windup s) en dan rechtdoor tot de muur; vertrapt jou en ook andere vijanden
  // (stampede.trample schade). Tegen de muur: stun seconden verdoofd, en dan telt zijn armor niet.
  elephant: { name: 'elephant', plural: 'elephants', hp: 70, dmg: 6, armor: 2, attack: 0, defense: 0, speed: 42, radius: 24, reach: 20, windup: .6, recover: .8, cooldown: 1.6, lunge: 6, knock: 320, animal: true, heavy: true, ai: 'elephant',
          trunk: { dmg: 3, arc: 1, knock: 360 }, stampede: { windup: 1, speed: 250, time: 2.6, cd: 6, min: 70, trample: 10 }, stun: 2.2, tunic: '#8a8a86', hair: 'hair-2', skin: 'skin-2' },
  // Tijger: komt later binnen (door de poort) en springt op je af. Hij duikt eerst in elkaar en kijkt in een vaste
  // richting (rode pijl, windup seconden); dan stormt hij die kant op (dash), heel ver. Stap of rol opzij.
  tiger: { name: 'tiger', plural: 'tigers', hp: 26, dmg: 4, armor: 0, attack: 0, defense: 0, speed: 62, radius: 12, reach: 0, windup: .8, recover: 1.1, cooldown: 1.2, lunge: 0, knock: 160, animal: true,
          dash: { range: 190, speed: 380, time: .5 }, tunic: '#d9782e', hair: 'hair-2', skin: 'skin-2' },
  // Leeuw: sluipt in een cirkel om je heen (orbit). Brult af en toe (roar): een ring om hem heen; sta je erin, dan loop
  // je slow.time seconden half zo snel. Springt (pounce: rode pijl, kort) als je met een ander bezig bent, of na
  // pounce.cd seconden. De sprong is kort: rol erdoorheen of stap opzij.
  lion: { name: 'lion', plural: 'lions', hp: 26, dmg: 5, armor: 0, attack: 0, defense: 0, speed: 66, radius: 13, reach: 0, windup: .5, recover: 1, cooldown: 1, lunge: 0, knock: 180, animal: true, ai: 'lion',
          orbit: 85, roar: { windup: .7, radius: 115, cd: 6 }, slow: { time: 1.2, mul: .5 }, pounce: { range: 140, speed: 340, time: .32, cd: 2.8, busy: 1.2 },
          tunic: '#c9934a', hair: 'hair-2', skin: 'skin-2' },
  // Hyena: in een roedel. Bijten en wegrennen (flee s). Ruikt bloed: zit je in een net of heb je minder dan 'weak' van je
  // leven, dan bijten ze steeds door. En ze eten je XP-bolletjes op (smell = zo ver ruiken ze een bolletje) als ze kunnen.
  // Bestiarius: dierenvechter met een korte speer. In een escort-ronde moet jij hem in leven houden; de dieren jagen vooral op hem.
  // Hij blijft bij je in de buurt, deinst terug voor een dier dichter dan fear en prikt als er een binnen bereik komt.
  bestiarius: { name: 'bestiarius', plural: 'bestiarii', hp: 22, dmg: 2, armor: 0, attack: 0, defense: 0, speed: 70, radius: 10, reach: 18, windup: .35, recover: .5, cooldown: 1.4, lunge: 8, weapon: 'javelin', ai: 'bestiarius',
           fear: 60, keep: 34, tunic: '#6d7a3a', belt: '#3b2a1e', hair: 'hair-1', skin: 'skin', cap: true, follow: true },
  hyena: { name: 'hyena', plural: 'hyenas', hp: 6, dmg: 1, armor: 0, attack: 0, defense: 0, speed: 96, radius: 9, reach: 8, windup: .22, recover: .25, cooldown: 1.1, lunge: 6, animal: true, ai: 'hyena',
           flee: .8, weak: .35, smell: 90, tunic: '#9a8460', hair: 'hair-2', skin: 'skin-2' },
};
// Kampioen (primus palus): de beste van zijn school. Schrijf 'champion:<klasse>' (bijv. 'champion:murmillo') in STAGES:
// dezelfde klasse en hetzelfde gedrag, maar met meer leven, schade en armor, groter en met een gouden kam.
const CHAMPION = { hp: 1.8, dmg: 1.3, armor: 1, size: 1.2, xp: 2.5 };
function foeBase(type) {
  if (!type.startsWith('champion:')) return FOES[type];
  const b = FOES[type.slice(9)];
  return { ...b, name: `champion (${b.name})`, plural: `champions (${b.plural})`, hp: Math.round(b.hp * CHAMPION.hp), dmg: Math.round(b.dmg * CHAMPION.dmg),
           armor: b.armor + CHAMPION.armor, radius: Math.round(b.radius * CHAMPION.size), reach: Math.round(b.reach * CHAMPION.size), champ: true,
           mount: b.mount && { ...b.mount, hp: Math.round(b.mount.hp * CHAMPION.hp) } };
}
const foeXp = t => t.startsWith('champion:') ? Math.round((XP.perFoe[t.slice(9)] || 3) * CHAMPION.xp) : XP.perFoe[t] || 3;
// De reeks: steeds 5 gevechten en dan een toernooi (5-1-5-1). Pas als je het toernooi wint, komen de volgende 5 gevechten vrij.
// Het toernooi gaat pas open als je alle gevechten van het blok gewonnen hebt (dan is ook duidelijk wanneer er een toernooi is).
// Publiek: bij een gewoon gevecht zit de arena voor 10–60% vol (CROWD), bij een toernooi helemaal, met de keizer en het velarium.
// Testen met meer tegenstanders: zet ?n=3 achter de url.
// reward = denarii als je wint. Verlies je een gevecht, dan betaal je MONEY.lossShare van die beloning (nooit onder 0).
// kind: 'normal', 'boss' (tussenbaas: zwaarder, meer geld) of 'tournament' (rondes achter elkaar, tot de dood; de laatste ronde is de eindbaas).
const STAGES = [
  { fights: [
      { kind: 'normal', foes: [['slave', 1]], reward: 5 },
      // Twee slaven, maar één is oud en traag (70%): je kunt hem ontlopen en eerst de ander aanpakken.
      { kind: 'normal', foes: [['slave', 1], ['slave', 1, { speed: .7 }]], reward: 8 },
      { kind: 'normal', foes: [['slave', 2], ['archer', 1]], reward: 12 },
      { kind: 'normal', type: 'team', allies: [['tiro', 1], ['slave', 2]], foes: [['tiro', 2], ['archer', 1], ['slave', 2]], reward: 18 },
      { kind: 'boss', foes: [['murmillo', 1], ['slave', 2]], reward: 25 } ],
    tourney: { kind: 'tournament', rounds: [[['slave', 3]], { type: 'ffa', foes: [['slave', 3], ['archer', 2]] }, [['champion:murmillo', 1]]], reward: 60 } },
  // Vanaf blok 2 bouwt de chaos rustig op (plan-chaos): voetvolk (noxii) in golven, hyenaroedels, en een vast ritme per blok:
  // 1 opbouw-chaos, 2 duel, 3 speciaal, 4 grote chaos, 5 tussenbaas; toernooi: chaos → speciaal → eindbaas.
  // Blok 2: de Thraciër en de hoplomachus komen erbij. Eerste voetvolk en de eerste roedel hyena's (6). Brood van het publiek.
  { fights: [
      { kind: 'normal', foes: [['thraex', 1], ['noxius', 3]], waves: { every: 9, foes: [['noxius', 2]], max: 2 }, reward: 20 },
      { kind: 'normal', foes: [['hoplomachus', 1]], reward: 22 },   // duel
      { kind: 'normal', type: 'hunt', foes: [['hyena', 6]], hatches: [{ after: 10, foes: [['tiger', 1]] }], reward: 25 },
      { kind: 'normal', foes: [['slave', 10]], extra: { at: .5, foes: [['hyena', 6]] }, reward: 30 },   // de tien slaven, nu met een roedel
      { kind: 'boss', foes: [['hoplomachus', 1], ['thraex', 1]], extra: { at: .5, foes: [['murmillo', 1], ['noxius', 3]] }, reward: 40 } ],
    tourney: { kind: 'tournament', rounds: [
      { foes: [['tiro', 2], ['noxius', 5]], waves: { every: 8, foes: [['noxius', 2]], max: 2 } },
      { type: 'hunt', foes: [['hyena', 6]], hatches: [{ after: 6, foes: [['tiger', 1]] }] },
      { foes: [['champion:hoplomachus', 1]], extra: { after: 8, foes: [['tiger', 1]] } }], reward: 120 } },
  // Blok 3: na toernooi II gaan de stallen open. De retiarius en de secutor komen erbij. Voetvolk 4–9, roedels van 6–8.
  { fights: [
      { kind: 'normal', foes: [['retiarius', 1], ['noxius', 4], ['noxiusClub', 1]], waves: { every: 9, foes: [['noxius', 3]], max: 2 }, reward: 35 },
      { kind: 'normal', foes: [['dimachaerus', 1]], reward: 40 },   // duel
      // Overleven: alleen met snelle tegenstanders die je moet ontwijken (sprints, sprongen, roedels), niet met trage die je ontloopt.
      { kind: 'normal', foes: [['secutor', 1], ['hyena', 6]], goal: { kind: 'survive', time: 40 }, waves: { every: 14, foes: [['hyena', 4]], max: 2 },
        hatches: [{ after: 10, foes: [['tiger', 1]] }, { after: 22, foes: [['lion', 1]] }], reward: 45 },
      { kind: 'normal', foes: [['murmillo', 1], ['noxius', 6], ['noxiusClub', 2]], goal: { kind: 'hold', time: 20 }, extra: { at: .5, foes: [['hyena', 8]] }, reward: 55 },
      { kind: 'boss', foes: [['murmillo', 1], ['retiarius', 1]], extra: { at: .5, foes: [['secutor', 1], ['hoplomachus', 1], ['noxius', 4]] }, reward: 70 } ],
    tourney: { kind: 'tournament', rounds: [
      { foes: [['thraex', 1], ['noxius', 6]], waves: { every: 9, foes: [['noxius', 3]], max: 2 } },
      { type: 'escort', foes: [['hyena', 6]], hatches: [{ after: 8, foes: [['hyena', 4]] }, { after: 16, foes: [['lion', 1]] }] },
      { foes: [['champion:secutor', 1], ['retiarius', 1]], extra: { after: 8, foes: [['lion', 2]] } }], reward: 200 } },
  // Blok 4: de bereden vechters. Voetvolk 8–14, twee roedels van 8 tegelijk.
  { fights: [
      { kind: 'normal', foes: [['eques', 1], ['noxius', 6], ['noxiusClub', 2]], waves: { every: 9, foes: [['noxius', 4]], max: 2 }, reward: 80 },
      { kind: 'normal', foes: [['essedarius', 1]], reward: 90 },   // duel
      { kind: 'normal', type: 'team', allies: [['murmillo', 1], ['archer', 1]], foes: [['eques', 2], ['noxius', 6]], extra: { at: .5, foes: [['essedarius2', 1]] }, reward: 100 },
      { kind: 'normal', foes: [['sagittarius', 1], ['noxius', 8], ['noxiusClub', 2]], hatches: [{ after: 10, foes: [['hyena', 8]] }, { after: 10, foes: [['hyena', 8]] }], reward: 110 },
      { kind: 'boss', foes: [['essedarius2', 1], ['sagittarius', 1]], extra: { at: .5, foes: [['eques', 1], ['dimachaerus', 1], ['noxius', 6]] }, reward: 130 } ],
    tourney: { kind: 'tournament', rounds: [
      { type: 'ffa', foes: [['noxius', 8], ['tiro', 3], ['dimachaerus', 1], ['murmillo', 1]] },
      { type: 'hunt', foes: [['lion', 1]], hatches: [{ after: 3, foes: [['hyena', 8]] }, { after: 3, foes: [['hyena', 8]] }] },
      { foes: [['champion:eques', 1], ['essedarius', 1]], extra: { after: 8, foes: [['lion', 1], ['tiger', 1]] } }], reward: 320 } },
  // Blok 5: de grote dieren en de beste gladiatoren. Voetvolk 12–25, twee roedels van 10 tegelijk. Het slottoernooi eindigt met een olifant.
  { fights: [
      { kind: 'normal', foes: [['bear', 1], ['noxius', 6], ['noxiusClub', 2]], goal: { kind: 'timed', time: 90 }, waves: { every: 10, foes: [['noxius', 4]], max: 2 }, reward: 150 },
      { kind: 'normal', foes: [['champion:thraex', 1]], reward: 160 },   // duel
      { kind: 'normal', foes: [['elephant', 1], ['noxius', 12]], goal: { kind: 'trample', count: 6 }, waves: { every: 9, foes: [['noxius', 4]], max: 3 }, reward: 170 },
      { kind: 'normal', foes: [['eques', 1], ['sagittarius', 1], ['champion:murmillo', 1], ['noxius', 10], ['noxiusClub', 4]], goal: { kind: 'champion' },
        hatches: [{ after: 12, foes: [['hyena', 10]] }, { after: 12, foes: [['hyena', 10]] }], reward: 185 },
      { kind: 'boss', foes: [['elephant', 1], ['dimachaerus', 1], ['noxius', 8]], extra: { at: .5, foes: [['champion:murmillo', 1], ['noxius', 6]] }, reward: 220 } ],
    tourney: { kind: 'tournament', rounds: [
      { foes: [['champion:thraex', 1], ['champion:hoplomachus', 1], ['noxius', 12], ['noxiusClub', 3]], waves: { every: 10, foes: [['noxius', 5]], max: 2 } },
      { foes: [['essedarius2', 1], ['sagittarius', 2], ['noxius', 10]] },
      { foes: [['elephant', 1], ['champion:secutor', 1]], extra: { after: 10, foes: [['lion', 1], ['bear', 1]] } }], reward: 500 } }
];
const KINDS = { normal: 'Fight', boss: 'Mini-boss', tournament: 'Tournament' };
// Tussen de rondes krijg je heal × je maximale leven terug. Ga je neer, dan beslist Caesar.
// Kans op duim omhoog = mercyBase + mercyFavor × (schade die je uitdeelde / alle leven van alle tegenstanders), hoogstens mercyMax.
// Duim omhoog: je leeft, maar het toernooi en de beloning zijn weg (geen boete); je mag het opnieuw proberen. Duim omlaag: dood, alles opnieuw vanaf gevecht I.
const TOURNAMENT = { heal: 0, mercyBase: .15, mercyFavor: .8, mercyMax: .95 };
// Waar je bent: S.stage (welk blok), S.inStage (zoveel gevechten van dat blok gewonnen), S.finished (alle toernooien gewonnen).
const stageOf = () => STAGES[Math.min(S.stage, STAGES.length - 1)];
const fightIdx = () => S.finished ? stageOf().fights.length - 1 : Math.min(S.inStage, stageOf().fights.length - 1);
const fightNumber = () => STAGES.slice(0, Math.min(S.stage, STAGES.length - 1)).reduce((n, st) => n + st.fights.length, 0) + fightIdx() + 1;
const fightOpen = () => S.finished || S.inStage < stageOf().fights.length;   // na 5 gevechten: eerst het toernooi
const fightDef = () => S.test ? { kind: 'normal', reward: 0, ...(S.testCfg || {}), foes: S.test } : S.mode === 'tournament' ? stageOf().tourney : stageOf().fights[fightIdx()];   // S.test = testarena (spqr-menu)
const fightTitle = () => S.test ? 'Testarena' : S.mode === 'tournament' ? `Tournament ${toRoman(Math.min(S.stage, STAGES.length - 1) + 1)}` : `Fight ${toRoman(fightNumber())}`;
// Een ronde is een lijst [[type, aantal], ...] of { foes, extra }. extra = versterking die door de poort binnenkomt:
// { foes, at: 0,5 } = als de helft van de eerste groep verslagen is; { foes, after: 8 } = na 8 seconden.
const roundsOf = def => (def.rounds || [def.extra ? { foes: def.foes, extra: def.extra } : def.foes]).map(r => Array.isArray(r) ? r : r.foes);
const extraOf = def => def.rounds ? def.rounds.map(r => Array.isArray(r) ? null : r.extra || null) : [def.extra || null];
// Kort label voor een gevecht met een doel of rondetype (keuzescherm in de stad, testmenu).
function fightTag(def) {
  const g = def.goal, t = def.type;
  const goal = g && { survive: `Survive ${g.time || GOALS_DEFAULT.survive.time} s`, trample: 'Let the elephant trample', champion: 'Defeat the champion',
                      timed: `Win in ${g.time || GOALS_DEFAULT.timed.time} s`, hold: 'Hold the center' }[g.kind];
  return [t && TYPES[t], goal, def.hatches && 'hatches'].filter(Boolean).join(' · ');
}
const listSummary = list => list.map(([t, n]) => `${n} ${n > 1 ? foeBase(t).plural : foeBase(t).name}`).join(' and ');
// Na elk gevecht ga je de stad in; terug naar de arena door op de arena te klikken.
const MONEY = { lossShare: .5 };
// Uitrusting naast je wapen, in vakken: body (harnas), head (helm), shield (schild). Eén ding per vak.
// armor = elke klap doet zoveel minder (maar altijd minstens 1); speed = loopsnelheid erbij of eraf;
// knock = hoe ver je wordt weggeduwd (× dit getal); front = schild: pijlen van voren houdt het tegen, klappen van voren doen 1 minder.
const GEAR = {
  leather: { slot: 'body',   name: 'Leather armor',     price: 35,  armor: 1, short: 'armor 1', desc: 'armor 1: every hit does 1 less' },
  // Galea: na een klap ben je langer onaantastbaar (invuln × dit getal). Tegen groepen: vijf tikjes tegelijk worden er minder.
  galea:   { slot: 'head',   name: 'Galea',             price: 30,  invuln: 1.6, short: '+60% recovery', desc: 'after a hit, nothing can hurt you for 60% longer (1 s instead of 0.6 s): strong in a crowd' },
  scutum:  { slot: 'shield', name: 'Scutum',            price: 50,  front: 1, short: 'front −1 · arrows 0', desc: 'stops arrows from the front; hits from the front do 1 less' },
  secutorHelm: { slot: 'head', name: 'Secutor helmet', price: 70, netMul: .5, speed: -8, short: '−50% net · −8 speed', desc: 'smooth and round: a net slides off twice as fast, but you can barely breathe (−8 move speed)' },
  lorica:  { slot: 'body',   name: 'Lorica segmentata', price: 120, armor: 2, speed: -8, short: 'armor 2 · −8 speed', desc: 'armor 2, but −8 move speed' },
  // Late uitrusting (after = pas te koop na zoveel gewonnen toernooien).
  parma:   { slot: 'shield', name: 'Parma', price: 90, front: 1, arrows: false, roll: .25, after: 1, short: 'front −1 · roll 25% faster', desc: 'small round shield: hits from the front do 1 less (not arrows) and you can roll again 25% sooner' },
  squamata: { slot: 'body', name: 'Lorica squamata', price: 300, armor: 3, speed: -6, after: 3, short: 'armor 3 · −6 speed', desc: 'scale armor: armor 3, but −6 move speed' },
  quadriga: { slot: 'mount', name: 'Quadriga', price: 500, needsBow: true, mountSpeed: 1.2, ramMul: 1.6, after: 3, short: 'with bow (2) · faster, rams harder', desc: 'four horses: 20% faster and you run foes over 60% harder' },
  quiver:  { slot: 'quiver', name: 'Quiver', price: 30, capacity: 15, short: '15 arrows', desc: 'carry 15 arrows instead of 5' },
  chariot: { slot: 'mount',  name: 'Chariot', price: 250, needsBow: true, short: 'with bow (2)', desc: 'much faster and you run foes over; you cannot stand still; you ride while holding your bow (slot 2), with your melee weapon you stand next to the chariot' }
};
const SLOTS = { body: 'Armor', head: 'Helmet', shield: 'Shield', quiver: 'Quiver', mount: 'Mount' };
// Pijlen koop je bij de boogmaker: price denarii per stuk. Zonder pijlkoker kun je er base meenemen.
const AMMO = { base: 5, price: 2 };
// De winkels in de straat. after = open na zoveel gewonnen toernooien (0 = vanaf het begin); wares = sleutels uit WEAPONS of GEAR.
const SHOPS = {
  smith:   { nl: 'Weaponsmith', la: 'Faber',      after: 0, wares: ['stick', 'gladius', 'hasta', 'sica', 'falx', 'spatha'] },
  armorer: { nl: 'Armorer',     la: 'Loricarius', after: 0, wares: ['leather', 'galea', 'secutorHelm', 'parma', 'scutum', 'lorica', 'squamata'] },
  bowyer:  { nl: 'Bowyer',      la: 'Arcuarius',  after: 1, wares: ['arrows', 'bow', 'composite', 'scythian', 'quiver'] },
  stable:  { nl: 'Stables',     la: 'Stabulum',   after: 2, wares: ['chariot', 'quadriga'] }
};
// Hoeveel toernooien je gewonnen hebt (voor winkels en spullen met 'after').
const tourneysWon = () => S.finished ? STAGES.length : S.stage;
const itemOpen = k => ((GEAR[k] || WEAPONS[k] || {}).after || 0) <= tourneysWon();
const shopOpen = id => SHOPS[id].wares.length > 0 && (S.finished ? STAGES.length : S.stage) >= SHOPS[id].after;
const FEEL = { hitstop: .06, shake: 5, playerShake: 9, flash: .12 };
// Aftellen aan het begin (III, II, I, Pugnate!): je kunt al lopen, tegenstanders wachten nog.
const INTRO = { step: 1, count: 3, shout: .7, fly: 700 };   // fly = ms dat het doel naar zijn plek bovenin zweeft
// Grootte van het zandveld (oppervlak in wereld-eenheden). VIEW_AREA = hoeveel zand je tegelijk ziet (de zoom).
// Is het zandveld groter dan wat je ziet, dan loopt de camera met je mee tot de rand van het stadion.
// edge = zoveel tribune zie je nog voorbij het zand als de camera aan de rand staat (x opzij, y boven en onder, voor de keizersloge).
// follow = hoe snel de camera je volgt (hoger = strakker).
const FIGHT_AREA = 51000, VIEW_AREA = 20000;
const CAMERA = { edgeX: 40, edgeY: 58, follow: 7 };
// Ontwijkrol (Spatie): time = hoe lang de rol duurt, inv = de eerste zoveel seconden kun je niet geraakt worden,
// speed = vaart tijdens de rol, cd = wachttijd daarna (Behendigheid: −cdAgi per punt, nooit onder cdMin).
// Niet op de strijdwagen en niet als je in een net zit.
// Je rolt altijd opzij (links of rechts van waar je kijkt): de kant waar je heen loopt, anders dezelfde kant als de vorige keer.
// speedAgi = per punt Behendigheid rol je zoveel sneller (en dus verder).
// enabled: false = rollen staat (voorlopig) uit; Spatie en A doen dan niets en de uitleg noemt het niet.
const ROLL = { enabled: false, time: .55, inv: .3, speed: 120, speedAgi: .04, cd: 1.2, cdAgi: .05, cdMin: .6 };
// Net van de retiarius: flight = vliegtijd (zo lang zie je de rode cirkel), radius = hoe groot het net is,
// hold = zo lang zit je vast, mash = elke druk op een looptoets maakt het zoveel korter,
// pick = zo dichtbij moet hij komen om zijn net op te rapen, block = sta jij zo dichtbij het net, dan kan hij het niet pakken.
// Werpsperen (hasta van de eques, speren van de essedarius): een rode cirkel waar hij landt, flight seconden vliegen.
const JAVELIN = { flight: .6, radius: 16 };
const NET = { flight: .6, radius: 20, hold: 1.5, mash: .12, pick: 12, block: 18 };
// Zelf slaan (linkermuisknop of J): je slaat in de richting van je muis. Zonder muis draai je vanzelf naar wie binnen bereik staat.
// buffer = druk je tot zoveel seconden te vroeg, dan slaat hij zodra het kan. foeHp = tegenstanders hebben zoveel keer het leven uit FOES
// (je slaat veel vaker dan toen het vanzelf ging).
const ATTACK = { buffer: .2, foeHp: 2 };
// Blokken (rechtermuisknop, K of Shift ingedrukt houden).
// Met schild: zolang je de toets vasthoudt houd je klappen (en, als het schild dat kan, pijlen) van voren tegen (arc = halve hoek, rad).
//   Je loopt dan shieldSpeed zo snel en slaat niet. Heel zware klappen (knock >= heavy: beer, olifant, charge te paard) breken erdoorheen:
//   je wankelt break s en krijgt de helft. Hef je het schild vlak voor de klap (binnen perfect s), dan wankelt de aanvaller stagger s.
// Zonder schild, met een wapen (niet met vuisten of boog): een korte parade van window s. Komt de klap in die tijd van voren, dan wankelt
//   hij stagger s. Mis je, dan sta je recover s open (je kunt niet slaan). cd = wachttijd tot je weer kunt pareren.
// Na een geslaagde parade of perfect blok doet je volgende klap riposteMul × schade, als hij binnen riposte s valt.
// Luiken in het zand: hier komen dieren uit. warn = zo lang schudt het luik met een rode cirkel voordat het opengaat,
// open = zo lang staat het open. size = halve breedte. spots = plekken als deel van de arena (x × breedte, y × hoogte).
const HATCH = { warn: 1.4, open: 1.6, size: 12, spots: [[-.45, -.4], [.45, -.4], [-.55, .25], [.55, .25], [0, -.55]] };
// Doelen: zet goal: { kind, ... } in een gevecht of ronde. Zonder goal: versla iedereen.
//   survive  { time }  blijf time seconden in leven. Met waves blijven er tegenstanders door de poort komen.
//                      Alleen met snelle tegenstanders (secutor, hyena's, tijger, leeuw, ruiters): van trage loop je gewoon weg.
//   trample  { count } zorg dat de olifant count keer een ander vertrapt. Gaat de olifant eerder dood: verloren.
//   champion {}        versla de kampioen ('champion:<klasse>'); de rest geeft zich dan over.
//   timed    { time }  versla iedereen binnen time seconden.
//   hold     { time, radius } sta in totaal time seconden in de cirkel in het midden.
// Rondetypen: zet type: in een gevecht of ronde.
//   hunt   versla of vang alle dieren. Je hebt netten (toets E). Is een dier zwakker dan HUNT.capture van zijn leven als het net
//          hem raakt (of sla je hem zo ver terwijl hij vastzit), dan is hij gevangen: captureBonus denarii extra. Sterker: hij zit hold s vast.
//          Olifanten glijden eruit. Een net blijft daarna liggen: loop eroverheen om het op te rapen.
//   escort houd de bestiarius in leven (hij staat naast je). De dieren jagen vooral op hem (prefer: kleiner = liever).
//   team   jij en je maten (allies: [[klasse, aantal]]) tegen de rest.
//   ffa    ieder voor zich: iedereen valt de dichtstbijzijnde aan, ook elkaar.
// Extra's: hatches: [{ after: s, foes }] of { every: s, foes, max } (dieren uit de luiken); waves: { every: s, foes, max } (door de poort).
const HUNT = { nets: 3, capture: .5, hold: 2.5, range: 170, captureBonus: 5, prefer: .6 };
const TYPES = { hunt: 'Hunt', escort: 'Protect the bestiarius', team: 'Team fight', ffa: 'Free for all' };
// Haak (sica van de Thraciër) tegen je schild: geen schade, maar hij trekt je pull ver naar zich toe en je schild is
// open seconden weg (witte rand: kwetsbaar). Dan kunnen anderen je raken; de Thraciër zelf moet eerst opnieuw aanvallen.
const HOOK = { pull: 260, open: 1.1 };
// Drukte remt: elke voetvolker (swarm) die tegen je aan staat maakt je per zoveel trager, hoogstens tot min.
const CROWDED = { per: .1, min: .6, touch: 4 };
// Brood van het publiek. Opwinding komt van doden (gewone tegenstander 1, voetvolk .3, gevangen dier 1), parades (.6) en
// perfecte blokken (.4); per seconde zakt hij met decay. Bij need vliegt er brood van de tribune het zand op, vlak bij de actie.
// Een voller publiek raakt sneller opgewonden (× 0,4 + 0,6 × vulling) en gooit bij een volle arena 2 tegelijk.
// heal = leven per brood, life = zo lang ligt het er, max = hoogstens zoveel tegelijk op het zand, pick = oprapen binnen.
// In een vrij gevecht (ffa) en een teamgevecht gaan de tegenstanders (geen dieren, niet bereden, niet je maten) ook voor brood
// binnen foeRange; zij krijgen heal × ATTACK.foeHp.
const BREAD = { need: 4, decay: .08, heal: 2, life: 8, flight: .9, max: 4, pick: 12, foeRange: 160 };
// Schildstoot: slaan terwijl je je schild ophoudt. Duwt alles voor je (binnen arc, tot reach voorbij je lijf) weg, ze wankelen
// stagger s en krijgen dmg schade. cd = wachttijd.
const BASH = { cd: 3, reach: 24, arc: 1.1, knock: 240, stagger: .6, dmg: 1 };
const BLOCK = { arc: 1.4, shieldSpeed: .5, heavy: 200, break: .6, perfect: .28, stagger: .8, window: .35, recover: .3, cd: .55, riposte: 1.2, riposteMul: 2 };   // iets makkelijker gemaakt (14-11): arc 1.2, perfect .2, window .25, recover .35, cd .7

/* ---------- Toestand ---------- */
const S = { ammo: 0, melee: 'fists', ranged: null, active: 'melee', switching: 0, switchTo: null, arrows: [], mode: 'fight', stage: 0, inStage: 0, finished: false, round: 0, dealt: 0, poolHp: 0, money: 0, delta: 0, owned: ['fists'], gear: { body: null, head: null, shield: null, mount: null, quiver: null }, townSeen: false, xp: 0, xpStart: 0, pointsStart: 0, orbs: [], collect: 0, gained: 0, levelUps: 0, stats: { strength: 0, agility: 0, vitality: 0, haste: 0 }, points: 0, foes: [], floats: [], dust: [], paused: true, over: null, overT: 0, freeze: 0, shake: 0, intro: 0, shout: 0 };
const W = { rx: 280, ry: 220, area: 66000 };
const view = { cw: 1, ch: 1, dpr: 1, scale: 1 };
const P = { side: 'hero', x: 0, y: 0, vx: 0, vy: 0, face: -Math.PI / 2, hp: PLAYER.hp, cd: 0, swing: 0, swingDir: 1, hurt: 0, flash: 0, target: null, dead: false };
const car = P;   // arena.js laat Caesar kijken naar 'car'; hier is dat de speler
const steer = { active: false, down: false, x: 0, y: 0 };
const keys = new Set();

const ROMAN = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
function toRoman(n) { if (n <= 0) return 'nulla'; let s = ''; for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; } return s; }
const pick = a => a[Math.floor(Math.random() * a.length)];
const denarii = n => `${n} ${n === 1 ? 'denarius' : 'denarii'}`;
const fmt = n => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
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
    if (g.needsBow && !S.ranged) return 'Buy a bow first: the chariot only works with a bow.';
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
  get speed() { return (PLAYER.speed + STAT_RULES.speed * S.stats.agility + gearSum('speed')) * (S.active === 'ranged' && S.ranged ? ARMS.speedMul : 1) * (P.slow > 0 ? P.slowMul : 1) * (P.guard ? BLOCK.shieldSpeed : 1) * (P.crowdMul || 1); },   // drukte remt   // brul van de leeuw: trager; achter je schild: langzaam
  get armor() { return gearSum('armor'); },
  get riding() { return !!S.gear.mount && S.active === 'ranged' && !!S.ranged; },   // op de wagen alleen met de boog in je handen
  get ammoMax() { return S.gear.quiver ? GEAR[S.gear.quiver].capacity : AMMO.base; },
  get mount() { return GEAR[S.gear.mount] || {}; },
  get netMul() { const g = GEAR[S.gear.head]; return g && g.netMul || 1; },
  get shield() { return !!S.gear.shield && S.active === 'melee'; },
  get haste() { return Math.max(STAT_RULES.hasteMin, 1 - STAT_RULES.haste * (S.stats.haste || 0)); },
  get meleeCd() { return WEAPONS[S.melee].cooldown * me.haste; },
  get shootCd() { const w = WEAPONS[PLAYER.weapon]; return w.cooldown * Math.max(STAT_RULES.shootMin, 1 - STAT_RULES.shoot * S.stats.agility) * me.haste; },
  get canParry() { const w = WEAPONS[S.melee]; return S.active === 'melee' && w.kind !== 'fists' && !me.riding; },
  get invuln() { return PLAYER.invuln * Object.values(S.gear).reduce((k, g) => k * (g && GEAR[g].invuln || 1), 1); },   // helm: langer onaantastbaar na een klap
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
  // Zoom: alsof het zandveld VIEW_AREA groot was. Het stadion achter de camera (bw × bh) is minstens zo groot als het scherm.
  const vrx = Math.sqrt(Math.min(W.area, VIEW_AREA) * aspect), vry = Math.sqrt(Math.min(W.area, VIEW_AREA) / aspect);
  view.scale = Math.min(view.cw / (2 * (vrx + CAMERA.edgeX)), view.ch / (2 * (vry + CAMERA.edgeY)));
  view.bw = Math.max(view.cw, 2 * (W.rx + CAMERA.edgeX) * view.scale);
  view.bh = Math.max(view.ch, 2 * (W.ry + CAMERA.edgeY) * view.scale);
  AR.dirtyEmpty = true;   // ook de versie met lege tribunes opnieuw
  if (reset) snapCam(); else clampCam();
  AR.dirty = true;
}
// Camera: midden van het scherm in wereld-eenheden. Volgt jou, maar niet verder dan de rand van het stadion.
const cam = { x: 0, y: 0 };
function clampCam() {
  const mx = Math.max(0, (view.bw - view.cw) / 2 / view.scale), my = Math.max(0, (view.bh - view.ch) / 2 / view.scale);
  cam.x = clamp(cam.x, -mx, mx); cam.y = clamp(cam.y, -my, my);
}
function snapCam() { cam.x = P.x; cam.y = P.y; clampCam(); }
function updateCam(dt) {
  const k = 1 - Math.exp(-dt * CAMERA.follow), x0 = cam.x, y0 = cam.y;
  cam.x += (P.x - cam.x) * k; cam.y += (P.y - cam.y) * k; clampCam();
  // de muis staat stil op het scherm, maar de wereld eronder schuift mee
  const dx = cam.x - x0, dy = cam.y - y0;
  steer.hx = (steer.hx || 0) + dx; steer.hy = (steer.hy || 0) + dy;
  if (steer.down) { steer.x += dx; steer.y += dy; }
}
function contain(o, ex, ey) {
  const k = (o.x / ex) ** 2 + (o.y / ey) ** 2; if (k <= 1) return;
  const s = 1 / Math.sqrt(k); o.x *= s; o.y *= s;
  let nx = o.x / (ex * ex), ny = o.y / (ey * ey); const l = Math.hypot(nx, ny); nx /= l; ny /= l;
  const vn = o.vx * nx + o.vy * ny; if (vn > 0) { o.vx -= vn * nx; o.vy -= vn * ny; }
}

// Keuze in de arena (town.js): de straat even weg, de lege arena erachter, geen HUD.
function arenaView(on) {
  S.emptyArena = on;
  $('town').classList.toggle('away', on);
  document.body.classList.toggle('arena-pick', on);
}
const CROWD = { min: .1, max: .6, test: .35 };
function startFight() {
  const def = fightDef(); S.emptyArena = false; document.body.classList.remove('arena-pick');
  const tour = def.kind === 'tournament' && !S.test, r = Math.abs(Math.sin(fightNumber() * 12.9898) * 43758.5453) % 1;   // vaste vulling per gevecht
  const fill = tour ? 1 : S.test ? CROWD.test : CROWD.min + (CROWD.max - CROWD.min) * r;
  setArenaCrowd(fill, tour); SFX.crowdSize(fill);   // legere arena: zachter publiek
  hideHint(); SFX.win(false);
  W.area = FIGHT_AREA; fitWorld(true);
  Object.assign(P, { crowdMul: 1, bash: 0, bashCd: 0, hooked: 0, guard: false, guardT: 0, guardPress: false, guardBroken: 0, parryT: 0, parryCd: 0, parryLock: 0, parried: 0, riposte: 0, atkBuf: 0, bleed: null, slow: 0, slowMul: 1, roll: 0, rollInv: 0, rollCd: 0, netted: 0, heading: -Math.PI / 2, spd: 0, punch: 0, x: 0, y: W.ry * .45, vx: 0, vy: 0, face: -Math.PI / 2, hp: me.maxHp, cd: 0, swing: 0, hurt: 0, flash: 0, target: null, dead: false });
  steer.active = false;
  S.foes = []; S.floats = []; S.dust = []; S.arrows = []; S.nets = []; S.javs = []; S.wrecks = []; S.calls = []; S.over = null; S.overT = 0; S.freeze = 0; S.shake = 0;
  S.intro = INTRO.step * INTRO.count; S.shout = 0; snapCam();
  S.orbs = []; S.collect = 0; S.gained = 0; S.levelUps = 0; S.xpStart = S.xp; S.pointsStart = S.points;
  S.round = 0; S.dealt = 0; S.switching = 0;
  if (S.gear.mount && S.ranged) S.active = 'ranged';   // met een strijdwagen begin je op de wagen
  syncWeapon(); P.cdMax = 0;
  S.poolHp = [...roundsOf(def), ...extraOf(def).filter(Boolean).map(e => e.foes)].flat().reduce((n, [t, c]) => n + foeHpOf(t) * c, 0);
  S.bonus = 0; S.captures = 0; S.excite = 0; S.breads = []; S.hitCount = 0;
  spawnRound();
}
// De tegenstanders van de huidige ronde (een gewoon gevecht heeft één ronde).
function spawnRound() {
  const list = testCount ? [['slave', testCount]] : roundsOf(fightDef())[S.round];
  S.foes = []; S.extra = testCount ? null : extraOf(fightDef())[S.round]; S.extraDone = false; S.roundT = 0;
  const c = S.cfg = roundCfg(fightDef(), S.round);
  S.goalT = 0; S.holdT = 0; S.trampled = 0; S.goalShown = null;   // null: de tekst bovenin wordt sowieso ververst
  S.netsLeft = c.nets ?? (c.type === 'hunt' ? HUNT.nets : 0);
  S.firstCount = list.reduce((n, [, c]) => n + c, 0);
  let i = 0, total = list.reduce((n, [, c]) => n + c, 0);
  for (const [type, count, mod] of list) for (let k = 0; k < count; k++, i++) {
    let f;
    if (c.type === 'ffa') {   // ieder voor zich: in een kring om het midden, iedereen zijn eigen kant
      const a = Math.PI * .85 + (i + .5) / total * Math.PI * 1.3;
      f = mkFoe(type, Math.cos(a) * W.rx * .62, Math.sin(a) * W.ry * .62); f.side = 'ffa' + i;
    } else {   // tegenstanders staan links en rechts, een eind van je af, en komen meteen op je af
      const side = i % 2 ? 1 : -1, spread = (Math.floor(i / 2) - (Math.ceil(total / 2) - 1) / 2) * 26;
      f = mkFoe(type, side * W.rx * .5, spread - W.ry * .1);
    }
    if (mod && mod.speed) f.d.speed *= mod.speed;   // derde veld: aanpassing voor deze ene, bv. { speed: .7 } = 30% trager
    S.foes.push(f); call(type);
  }
  // Jouw kant: maten (team) of de bestiarius (escort) staan naast je.
  const mates = [...(c.allies || []), ...(c.type === 'escort' ? [['bestiarius', 1]] : [])];
  let j = 0; const nm = mates.reduce((n, [, k]) => n + k, 0);
  for (const [type, count] of mates) for (let k = 0; k < count; k++, j++) {
    const f = mkFoe(type, (j - (nm - 1) / 2) * 34 + (nm === 1 ? 30 : 0), P.y - 8);
    f.side = 'hero'; f.face = -Math.PI / 2; S.foes.push(f);
  }
  // Luiken en golven: wat er wanneer binnenkomt.
  S.hatches = c.hatches ? HATCH.spots.map(([x, y]) => ({ fx: x, fy: y, state: 'closed', t: 0 })) : [];   // luiken alleen als er iets uit komt
  S.queue = [];
  const plan = (src, how) => {
    if (!src) return;
    for (const e of Array.isArray(src) ? src : [src]) {
      if (e.every) for (let k = 1; k <= (e.max ?? (c.goal && c.goal.kind === 'survive' ? 99 : 3)); k++) S.queue.push({ at: e.every * k, foes: e.foes, how, every: true });
      else S.queue.push({ at: e.after || 0, foes: e.foes, how });
    }
  };
  plan(c.hatches, 'hatch'); plan(c.waves, 'gate');
  S.teamColors = S.foes.some(f => f.side === 'hero');   // er is een team: kleuren aan
  for (const f of S.foes) teamTint(f);
  showGoalIntro();
  updateUI();
}
// Teamkleuren: in een gevecht met maten krijgen jouw kant groene en de tegenstanders rode kleding/harnas (dieren niet).
const TEAM = { mix: .65 };
function teamTint(f) {
  if (!S.teamColors || f.d.animal || f.tinted) return;
  f.d = { ...f.d, tunic: mix(f.d.tunic, f.side === 'hero' ? C.laurel : C.blood, TEAM.mix) };
  if (f.d.foot) f.d.foot = { ...f.d.foot };
  f.tinted = true;
}
// Instellingen van de huidige ronde: wat in de ronde staat, gaat voor wat in het gevecht staat.
function roundCfg(def, i) {
  const r = def.rounds && !Array.isArray(def.rounds[i]) ? def.rounds[i] : {};
  const c = {};
  for (const k of ['type', 'goal', 'allies', 'hatches', 'waves', 'nets']) c[k] = r[k] ?? def[k];
  if (c.goal && GOALS_DEFAULT[c.goal.kind]) c.goal = { ...GOALS_DEFAULT[c.goal.kind], ...c.goal };
  return c;
}
const GOALS_DEFAULT = { survive: { time: 40 }, trample: { count: 4 }, champion: {}, timed: { time: 60 }, hold: { time: 20, radius: 34 } };
const foeHpOf = t => Math.round((foeBase(t).hp + (foeBase(t).mount ? foeBase(t).mount.hp : 0)) * ATTACK.foeHp);
// Nieuwe tegenstanders door de poorten links en rechts.
function gateSpawn(list) {
  S.gate = 1.2; let i = 0;
  for (const [type, count] of list) for (let k = 0; k < count; k++, i++) {
    const side = i % 2 ? 1 : -1, f = mkFoe(type, side * (W.rx - 18), (Math.floor(i / 2) - .5) * 22);
    f.face = side > 0 ? Math.PI : 0; f.cd = .8; teamTint(f); S.foes.push(f); call(type); S.poolHp += foeHpOf(type);
    for (let j = 0; j < 6; j++) S.dust.push({ x: f.x + (Math.random() - .5) * 16, y: f.y + (Math.random() - .5) * 16, t: 1 });
  }
  arenaCheer(); SFX.cheer(.8); S.shake = Math.max(S.shake, 4);
}
// Luiken en golven bijhouden: een luik schudt eerst (rode cirkel), gaat open en het dier springt eruit.
function updateArena(dt) {
  for (const h of S.hatches || []) {
    if (h.state === 'closed') continue;
    h.t -= dt;
    if (h.state === 'warn' && h.t <= 0) {
      h.state = 'open'; h.t = HATCH.open;
      const x = h.fx * W.rx, y = h.fy * W.ry; let i = 0;
      for (const [type, count] of h.foes) for (let k = 0; k < count; k++, i++) {
        const a = i * 2.4, f = mkFoe(type, x + Math.cos(a) * i * 6, y + Math.sin(a) * i * 6);
        f.cd = .6; f.vx = Math.cos(a) * 60; f.vy = Math.sin(a) * 60; teamTint(f); S.foes.push(f); call(type); S.poolHp += foeHpOf(type);
      }
      for (let j = 0; j < 10; j++) S.dust.push({ x: x + (Math.random() - .5) * 26, y: y + (Math.random() - .5) * 26, t: 1 });
      arenaCheer(); SFX.cheer(.8); SFX.fx('woodBreak'); S.shake = Math.max(S.shake, 4);
    } else if (h.state === 'open' && h.t <= 0) h.state = 'closed';
  }
  if (S.collect > 0 || S.over) return;
  for (const q of S.queue || []) {
    if (q.done || S.roundT < q.at) continue;
    if (q.how === 'gate') { q.done = true; gateSpawn(q.foes); continue; }
    // luik: het dichte luik het verst van jou
    const free = S.hatches.filter(h => h.state === 'closed');
    if (!free.length) continue;
    const far = free.sort((a, b) => Math.hypot(b.fx * W.rx - P.x, b.fy * W.ry - P.y) - Math.hypot(a.fx * W.rx - P.x, a.fy * W.ry - P.y));
    const h = far[Math.floor(Math.random() * Math.min(2, far.length))];
    h.state = 'warn'; h.t = HATCH.warn; h.foes = q.foes; q.done = true; SFX.fx('netCharge');
  }
}

/* ---------- Kanten en doelwitten ----------
   Iedereen heeft een kant (side): jij en je maten 'hero', tegenstanders 'foe', bij ieder-voor-zich elk zijn eigen.
   Tegenstanders kiezen het dichtstbijzijnde doelwit van een andere kant. TG = het doelwit van wie nu aan de beurt is. */
let TG = P;
const hostile = (a, b) => a !== b && a.side !== b.side;
const targetable = f => f.state !== 'dead' && f.state !== 'yield';
const liveTarget = t => t === P ? !P.dead : !!t && targetable(t);
const rad = t => t === P ? PLAYER.radius : t.d.radius;
const maxHp = t => t === P ? me.maxHp : t.d.hp;
const knockOf = t => t === P ? me.knock : t.d.heavy ? 0 : 1;
const blockOf = t => t === P ? me.block : 0;
// Doelwit kiezen voelt 'organisch': afstand telt, maar ook hoeveel anderen al op hetzelfde doelwit afgaan (crowd: elke
// aanvaller erbij maakt het zoveel minder aantrekkelijk; boogschutters tellen half) en een eigen voorkeur per paar
// (jitter: vaste factor tussen 1 − jitter en 1 + jitter). Zo pakt niet iedereen meteen dezelfde, maar ook niet perfect verdeeld.
const TARGETING = { crowd: .55, jitter: .3, stick: 1.3 };
let uidNext = 1;
const pairBias = (a, b) => 1 + TARGETING.jitter * (2 * (Math.abs(Math.sin((a.uid || 0) * 12.9898 + (b.uid || 0) * 78.233) * 43758.5453) % 1) - 1);
function pickTarget(f) {
  const escort = S.cfg && S.cfg.type === 'escort' && f.d.animal;
  if (!f.uid) f.uid = uidNext++;
  const crowdOn = t => { let n = 0; for (const o of S.foes) if (o !== f && o.tg === t && targetable(o)) n += o.d.ranged || o.d.ai === 'sagittarius' ? .5 : 1; return n; };
  const weight = t => {
    if (t !== P && !t.uid) t.uid = uidNext++;
    return Math.hypot(t.x - f.x, t.y - f.y) * (escort && t.d && t.d.ai === 'bestiarius' ? HUNT.prefer : 1)
      * (1 + TARGETING.crowd * crowdOn(t)) * pairBias(f, t);
  };
  let best = null, bs = Infinity;
  if (!P.dead && hostile(f, P)) { bs = weight(P); best = P; }
  for (const o of S.foes) if (o !== f && targetable(o) && hostile(f, o)) { const w = weight(o); if (w < bs) { bs = w; best = o; } }
  if (f.tg && f.tg !== best && liveTarget(f.tg) && hostile(f, f.tg) && weight(f.tg) < bs * TARGETING.stick) return f.tg;   // niet steeds wisselen
  return best;
}
// Een klap van een tegenstander op zijn doelwit TG.
function strike(att) { if (TG === P) hitPlayer(att); else if (TG) hitUnit(TG, att); }
// Een tegenstander of maat raakt een ander (niet jou).
function hitUnit(t, att, dmg = att.d.dmg) {
  if (!targetable(t)) return;
  if (t.mount) { t.mount.hp -= dmg; t.flash = FEEL.flash; float(t.x, t.y - 22, '−' + fmt(dmg), C.muted); SFX.hit(); if (t.mount.hp <= 0) dismount(t); return; }
  if (!(t.netted > 0) && shieldBlocks(t, att)) { crack(t, 1, att); return; }
  if (t.state === 'parry') { t.parried = .35; SFX.block(); return; }   // de Thraciër pareert ook anderen (zonder tegenaanval)
  const real = Math.max(1, dmg - (t.state === 'stunned' ? 0 : t.d.armor));
  t.hp -= real; t.flash = FEEL.flash;
  const dx = t.x - att.x, dy = t.y - att.y, l = Math.hypot(dx, dy) || 1, kb = (60 + (att.d.knock || 0) * .5) * knockOf(t);
  t.vx += dx / l * kb; t.vy += dy / l * kb;
  float(t.x, t.y - 18, '−' + fmt(real), t.side === 'hero' ? C.blood : C.muted);
  // anderen onder elkaar: hoogstens elke 0,12 s een klapgeluid (in een vrij gevecht slaan ze elkaar heel vaak)
  const nowS = performance.now(); if (t === P || att === P || t.hp <= 0 || nowS - (S.unitSfx || 0) > 120) { SFX.hit(); S.unitSfx = nowS; }
  SFX.cheer(t.hp <= 0 ? .6 : .25); arenaCheerAt(t.x, t.y, t.hp <= 0 ? .9 : .55);
  if (t.hp <= 0) foeDown(t);
}
// Iemand anders dan jij gaat neer.
function foeDown(f) {
  f.state = 'dead'; f.dead = 1; f.vx *= 1.6; f.vy *= 1.6; f.netted = 0;
  if (f.side !== 'hero') { dropXp(f); excite(f.d.swarm ? .3 : 1); }
  checkExtra(); checkWin();
}
// Gewonnen? Verloren? Hangt af van het doel en het rondetype.
function checkWin() {
  if (S.over || S.collect > 0 || S.intro > 0 || !S.cfg) return;
  const c = S.cfg, g = c.goal || {};
  const up = S.foes.filter(f => f.side !== 'hero' && targetable(f));
  const pending = (S.extra && !S.extraDone) || (S.queue || []).some(q => !q.done) || (S.hatches || []).some(h => h.state === 'warn');
  if (c.type === 'escort' && S.foes.some(f => f.d.ai === 'bestiarius' && f.state === 'dead')) { lose(); return; }
  if (g.kind === 'trample' && S.trampled < g.count && !S.foes.some(f => f.d.ai === 'elephant' && targetable(f))) { lose(); return; }
  if (g.kind === 'timed' && S.goalT >= g.time) { lose(); return; }
  const cleared = !up.length && !pending;
  const won = g.kind === 'survive' ? S.goalT >= g.time || cleared
    : g.kind === 'trample' ? S.trampled >= g.count
    : g.kind === 'champion' ? !S.foes.some(f => f.d.champ && f.side !== 'hero' && targetable(f)) && !(S.extra && !S.extraDone && S.extra.foes.some(([t]) => t.startsWith('champion:')))
    : g.kind === 'hold' ? S.holdT >= g.time || cleared
    : cleared;
  if (!won) return;
  for (const f of S.foes) if (f.side !== 'hero' && targetable(f)) { f.state = 'yield'; f.vx = 0; f.vy = 0; }   // de rest geeft zich over
  for (const q of S.queue || []) q.done = true;
  S.extraDone = true;
  const last = testCount || S.round + 1 >= roundsOf(fightDef()).length;
  S.collect = XP.collect; arenaCheer();
  if (last) SFX.win(); else SFX.cheer(1);   // het hele gevecht gewonnen: groot overwinningsgejuich
}
function lose() { if (!S.over) { arenaJeer(); endFight(false); } }
// Uitleg van het doel (keuzescherm in de stad en het begin van een gevecht): kop en één zin hoe je wint.
function goalInfo(c) {
  const g = c.goal || {}, t = c.type;
  if (g.kind === 'survive') return { title: `Survive ${g.time} seconds`, sub: 'Stay alive until the time runs out.' };
  if (g.kind === 'timed') return { title: `Win within ${g.time} seconds`, sub: 'Defeat everyone before the time runs out.' };
  if (g.kind === 'trample') return { title: `Let the elephant trample ${g.count}`, sub: 'Lure it into the others. If the elephant dies first, you lose.' };
  if (g.kind === 'champion') return { title: 'Defeat the champion', sub: 'The others surrender when he falls.' };
  if (g.kind === 'hold') return { title: 'Hold the center', sub: `Stand in the golden circle for ${g.time} seconds.` };
  if (t === 'hunt') return { title: 'Hunt', sub: 'Defeat or capture every animal. A net catches a weakened animal.' };
  if (t === 'escort') return { title: 'Protect the bestiarius', sub: 'Keep him alive. If he dies, you lose.' };
  if (t === 'team') return { title: 'Team fight', sub: 'You and your allies in green against the reds.' };
  if (t === 'ffa') return { title: 'Free for all', sub: 'Everyone fights everyone. Be the last one standing.' };
  return { title: 'Defeat all enemies', sub: '' };
}
// Begin van een ronde: groot in het midden wat je moet doen; na het aftellen zweeft het naar zijn plek bovenin (flyGoal).
function showGoalIntro() {
  const el = $('goalIntro'), t = $('giTitle'), info = goalInfo(S.cfg || {}), rounds = roundsOf(fightDef()).length;
  for (const a of t.getAnimations()) a.cancel();
  $('giEyebrow').textContent = fightTitle() + (rounds > 1 ? ` · Round ${toRoman(S.round + 1)} of ${toRoman(rounds)}` : '');
  t.textContent = info.title; $('giSub').textContent = info.sub;
  el.classList.remove('gone'); el.hidden = false;
  $('goalText').classList.add('waiting');
}
/* ---------- Uitleg in beeld bij iets nieuws ----------
   Na het aftellen: heb je iets nieuws (wapen, boog, schild, strijdwagen, netten), dan staat onderin even met welke knop
   je het pakt, gebruikt en richt. De iconen passen zich aan: toetsenbord en muis, of je soort controller (PAD.icon).
   Elk ding één keer per spel (S.seen). time = zo lang blijft het staan. */
// Uitleg in beeld staat vlak onder je (gap px onder je voeten), of boven je als je onderaan het scherm staat.
// Geraakt terwijl je had kunnen blokken: kort de bloktoets (hurt s), hoogstens elke 'every' s, tot je learned keer goed geblokt hebt.
// De bloktip komt alleen bij de zoveelste klap per gevecht (at), met en zonder schild.
const HINT = { time: 8, gap: 26, hurt: 2.2, learned: 5, at: [1, 3] };
function newThings() {
  const seen = S.seen || (S.seen = {}), list = [];
  const add = (key, title, rows) => { if (!seen[key]) { seen[key] = true; list.push({ title, rows }); } };
  add('basics', 'Fight', [['move', 'move'], ['aim', 'aim'], ['attack', 'strike'], ...(me.shield || me.canParry ? [['block', 'block']] : [])]);
  if (S.melee !== 'fists') add('m:' + S.melee, `New: ${WEAPONS[S.melee].name}`,
    [...(S.ranged ? [['switch1', 'take it in hand']] : []), ['attack', 'strike'], ...(S.gear.shield ? [] : [['block', 'parry: just before the hit']])]);
  if (S.ranged) add('r:' + S.ranged, `New: ${WEAPONS[S.ranged].name}`, [['switch2', 'take your bow'], ['aim', 'aim'], ['attack', 'shoot']]);
  if (S.gear.shield) add('s:' + S.gear.shield, `New: ${GEAR[S.gear.shield].name}`, [['block', 'hold: blocks hits from the front'], ['attack', 'while blocking: shield bash']]);
  if (S.gear.mount && S.ranged) add('mount:' + S.gear.mount, `New: ${GEAR[S.gear.mount].name}`, [['switch2', 'ride (with your bow)'], ['move', 'steer']]);
  if (S.netsLeft > 0) add('net', 'Nets', [['net', 'throw a net'], ['aim', 'aim']]);
  return list;
}
function showHints() {
  const list = newThings(), el = $('hint');
  if (!list.length || typeof PAD === 'undefined') return;
  el.innerHTML = list.slice(0, 3).map(h => `<section><h4>${h.title}</h4>${h.rows.map(([a, t]) => `<span class="hint-ico">${PAD.icon(a)}</span><span>${t}</span>`).join('')}</section>`).join('');
  el.classList.remove('gone'); el.hidden = false; S.hintT = HINT.time; placeHint();
}
// Bloktoets laten zien als je geraakt wordt (en kon blokken), tot je het een paar keer goed gedaan hebt.
function blockHint() {
  const seen = S.seen || (S.seen = {}), el = $('hint');
  if (typeof PAD === 'undefined' || (seen.blockOk || 0) >= HINT.learned || !(me.shield || me.canParry)) return;
  // alleen de 1e en 3e keer dat je in een gevecht geraakt wordt (met en zonder schild)
  S.hitCount = (S.hitCount || 0) + 1;
  if (!HINT.at.includes(S.hitCount)) return;
  if (!el.hidden && S.hintT > 0 && !el.classList.contains('hurt-hint')) return;   // er staat al uitleg
  el.innerHTML = `<section><span class="hint-ico">${PAD.icon('block')}</span><span>${me.shield ? 'block' : 'parry: just before the hit'}</span></section>`;
  el.classList.add('hurt-hint'); el.classList.remove('gone'); el.hidden = false; S.hintT = HINT.hurt; placeHint();
}
function blockedOk() { const seen = S.seen || (S.seen = {}); seen.blockOk = (seen.blockOk || 0) + 1; }
// De uitleg volgt je: vlak onder je, of boven je als je onderin het beeld staat.
function placeHint() {
  const el = $('hint'); if (el.hidden) return;
  const sx = (P.x - cam.x) * view.scale + view.cw / 2, sy = (P.y - cam.y) * view.scale + view.ch / 2;
  const h = el.offsetHeight, w = el.offsetWidth, r = PLAYER.radius * view.scale;
  const below = sy + r + HINT.gap + h < view.ch - 90;   // onderin staat de weg-tablet
  el.style.left = Math.max(8 + w / 2, Math.min(view.cw - 8 - w / 2, sx)) + 'px';
  el.style.top = (below ? sy + r + HINT.gap : sy - r - HINT.gap - h) + 'px';
}
function hideHint() { const el = $('hint'); el.hidden = true; el.classList.remove('gone', 'hurt-hint'); S.hintT = 0; }
function flyGoal() {
  showHints();
  const el = $('goalIntro'), t = $('giTitle'), dest = $('goalText'), gt = goalText();
  S.goalShown = gt; dest.textContent = gt; dest.hidden = !gt;
  el.classList.add('gone');   // bovenregel en uitleg vervagen
  const a = t.getBoundingClientRect(), b = dest.getBoundingClientRect();
  if (!gt || !a.height || !b.height) { el.hidden = true; dest.classList.remove('waiting'); return; }
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2), s = b.height / a.height;
  const anim = t.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 1, offset: .85 }, { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0 }],
                         { duration: INTRO.fly, easing: 'cubic-bezier(.5,0,.25,1)', fill: 'forwards' });
  setTimeout(() => dest.classList.remove('waiting'), INTRO.fly * .8);   // de tekst bovenin neemt het over
  anim.onfinish = () => { el.hidden = true; anim.cancel(); };
}
// Tekst bovenin: wat je moet doen, met de stand (tijd, aantal).
function goalText() {
  const c = S.cfg || {}, g = c.goal || {};
  if (g.kind === 'survive') return `Survive · ${Math.max(0, Math.ceil(g.time - S.goalT))}`;
  if (g.kind === 'timed') return `Win in ${Math.max(0, Math.ceil(g.time - S.goalT))}`;
  if (g.kind === 'trample') return `Let the elephant trample · ${Math.min(S.trampled, g.count)}/${g.count}`;
  if (g.kind === 'champion') return 'Defeat the champion';
  if (g.kind === 'hold') return `Hold the center · ${Math.floor(Math.min(S.holdT, g.time))}/${g.time}`;
  const all = S.foes.filter(f => f.side !== 'hero'), down = all.filter(f => !targetable(f)).length;
  if (c.type === 'hunt') return `Hunt · ${down}/${all.length}`;
  return TYPES[c.type] || `Defeat all · ${down}/${all.length}`;
}
// Versterking: de poorten links en rechts gaan open en de nieuwe tegenstanders lopen het zand op.
function checkExtra() {
  const e = S.extra; if (!e || S.extraDone) return;
  const them = S.foes.filter(f => f.side !== 'hero'), dead = them.filter(f => f.state === 'dead').length, allDead = dead >= them.length;
  if (!(e.at !== undefined ? dead >= Math.ceil(S.firstCount * e.at) : S.roundT >= e.after || allDead)) return;
  S.extraDone = true; S.poolHp -= e.foes.reduce((n, [t, c]) => n + foeHpOf(t) * c, 0);   // stond al in de pot
  gateSpawn(e.foes);
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
// Moeilijkheid: vooral hoe snel tegenstanders slaan. windup = langer aanzetten (meer tijd om weg te stappen),
// cooldown = langer wachten tussen twee aanvallen, arrow = pijlsnelheid. Zwaar = de waarden in FOES.
const DIFFICULTY = {
  easy:   { nl: 'Easy', windup: 1.8,  cooldown: 1.6,  arrow: .7 },
  normal: { nl: 'Normal',    windup: 1.35, cooldown: 1.25, arrow: .85 },
  hard:   { nl: 'Hard',      windup: 1,    cooldown: 1,    arrow: 1 }
};
let difficulty = 'normal';
try { difficulty = localStorage.getItem('rn-difficulty') || 'normal'; } catch (e) {}
function mkFoe(type, x, y) {
  const base = foeBase(type), m = DIFFICULTY[difficulty] || DIFFICULTY.hard;
  // Moeilijkheid geldt ook voor de speciale aanvallen: elk subobject met 'windup' of 'cd' wordt meegeschaald.
  const scaled = {};
  for (const [k, v] of Object.entries(base)) if (v && typeof v === 'object' && !Array.isArray(v) && ('windup' in v || 'cd' in v) && !['after', 'foot'].includes(k))
    scaled[k] = { ...v, ...('windup' in v ? { windup: v.windup * m.windup } : {}), ...('cd' in v ? { cd: v.cd * m.cooldown } : {}) };
  const d = { ...base, ...scaled, windup: base.windup * m.windup, cooldown: base.cooldown * m.cooldown, dash: base.dash && { ...base.dash },
              after: base.after && { ...base.after, windup: base.after.windup * m.windup, cooldown: base.after.cooldown * m.cooldown },
              foot: base.foot && { ...base.foot, windup: base.foot.windup * m.windup, cooldown: base.foot.cooldown * m.cooldown },
              ranged: base.ranged && { ...base.ranged, arrow: base.ranged.arrow * m.arrow } };
  d.hp = Math.round(base.hp * ATTACK.foeHp);   // je slaat zelf en vaak: twee keer zoveel leven
  if (base.speedVar) d.speed = base.speed * (base.speedVar[0] + Math.random() * (base.speedVar[1] - base.speedVar[0]));
  if (d.mount) d.mount = { ...d.mount, hp: Math.round(d.mount.hp * ATTACK.foeHp) };
  return { side: 'foe', type, d, x, y, vx: 0, vy: 0, face: Math.atan2(P.y - y, P.x - x), hp: d.hp, state: 'walk', t: 0, cd: .2 + Math.random() * .4,
           flash: 0, lunge: 0, dead: 0, wob: Math.random() * 10, cracks: 0, shieldOn: !!d.shield, spear: d.weapon === 'spear', parryCd: 1.5, hasNet: d.ai === 'retiarius', breath: d.breath || 0, mount: d.mount ? { ...d.mount, max: d.mount.hp } : null, heading: Math.atan2(P.y - y, P.x - x) };
}

/* ---------- Gevecht ---------- */
// soft = omverrijden: geen hit-stop en weinig schudden, anders schokt het als je door een groep rijdt.
function hitFoe(f, dmg, from, soft, crit) {
  const w = WEAPONS[PLAYER.weapon];
  if (f.mount) {   // bereden: het paard of de wagen vangt de klap
    const real = Math.max(0, dmg);
    S.dealt += Math.min(real, f.mount.hp); f.mount.hp -= real; f.flash = FEEL.flash;
    S.shake = Math.max(S.shake, soft ? 1.5 : FEEL.shake); if (!soft) S.freeze = FEEL.hitstop * .6;
    float(f.x, f.y - 22, '−' + fmt(real), C.ink);
    const now = performance.now(); if (!soft || now - (S.lastRamSfx || 0) > 120) { SFX.hit(); S.lastRamSfx = now; }
    SFX.cheer(.35);
    if (f.mount.hp <= 0) dismount(f);
    return;
  }
  if (!soft && !(f.netted > 0) && shieldBlocks(f, from)) { crack(f, dmg >= f.d.shield.heavy || w.kind === 'spear' ? 2 : 1, from); return; }
  if (!soft && f.state === 'parry' && !(f.netted > 0)) { parried(f); return; }                  // Thraciër stapt opzij en snijdt terug
  if (P.bleed && P.bleed.src === f) P.bleed = null;                          // raak je de Thraciër, dan stopt het bloeden
  const breaks = !soft && f.spear && (f.state === 'windup' || f.state === 'thrust');   // hoplomachus: speer breekt
  if (f.state === 'spent') dmg *= 2;                                         // secutor op zijn knieën: dubbele schade
  let real = Math.max(0, dmg - (f.state === 'stunned' ? 0 : f.d.armor));   // olifant verdoofd: armor telt niet
  S.dealt += Math.min(real, Math.max(0, f.hp));
  f.hp -= real; f.flash = FEEL.flash;
  const dx = f.x - from.x, dy = f.y - from.y, l = Math.hypot(dx, dy) || 1;
  const kb = soft || f.d.heavy ? 0 : w.knock * (f.state === 'windup' ? .2 : 1);   // tijdens de aanzet zet hij zich schrap
  f.vx += dx / l * kb; f.vy += dy / l * kb;
  if (soft) S.shake = Math.max(S.shake, 1.5);
  else { S.freeze = FEEL.hitstop; S.shake = Math.max(S.shake, FEEL.shake); }
  if (crit) S.floats.push({ x: f.x, y: f.y - 20, text: '−' + fmt(real), color: C.coin, t: 1.2, size: 14 });   // na een parade: dubbel, goud
  else float(f.x, f.y - 18, real ? '−' + fmt(real) : '0', C.ink);
  const now = performance.now();
  if (!soft || now - (S.lastRamSfx || 0) > 120) { SFX.hit(); S.lastRamSfx = now; }   // niet tien klappen tegelijk
  SFX.cheer(f.hp <= 0 ? .75 : .35);   // het publiek juicht bij elke rake klap, harder als hij valt
  arenaCheerAt(f.x, f.y, f.hp <= 0 ? 1 : .7);   // en wie dichtbij zit, springt op
  if (breaks && f.hp > 0) breakSpear(f);
  if (!soft && f.d.flinch && f.hp > 0 && (f.state === 'windup' || f.state === 'combo')) { f.state = 'stagger'; f.t = f.d.flinch; f.combo = 0; }   // dimachaerus: raak je hem tijdens zijn aanval, dan breekt zijn combo
  if (f.hp <= 0) foeDown(f);
  else if (f.netted > 0 && f.d.animal && f.netBy === P && f.hp <= f.d.hp * HUNT.capture) capture(f);   // vastgebonden en zwak genoeg: gevangen
}
// Murmillo-schild: blokt als het nog heel is, hij in dekking staat (lopen of aanzetten) en de klap van voren komt.
function shieldBlocks(f, from) {
  if (!f.shieldOn || (f.state !== 'walk' && f.state !== 'windup')) return false;
  const a = Math.atan2(from.y - f.y, from.x - f.x);
  return Math.abs(((a - f.face + Math.PI * 3) % TAU2) - Math.PI) <= f.d.shield.arc;
}
function crack(f, n, from) {
  f.cracks += n; f.block = .3; f.blockA = Math.atan2(from.y - f.y, from.x - f.x);
  S.freeze = FEEL.hitstop * .6; S.shake = Math.max(S.shake, 2); SFX.block();
  if (f.cracks >= f.d.shield.cracks) {   // schild kapot: stukken hout op het zand, hij wankelt
    f.shieldOn = false; f.state = 'stagger'; f.t = f.d.shield.stagger; f.flash = FEEL.flash;
    for (let k = 0; k < 10; k++) S.dust.push({ x: f.x + Math.cos(f.face) * 12 + (Math.random() - .5) * 18, y: f.y + Math.sin(f.face) * 12 + (Math.random() - .5) * 18, t: 1.2, chip: true });
    S.shake = Math.max(S.shake, 5); arenaCheer(); SFX.cheer(.8); SFX.fx('shieldBreak');
  }
}
// Dieren en paarden laten zich horen als ze de arena in komen. Bij de start pas na het aftellen.
const CALLS = { tiger: 'tiger', lion: 'lion', bear: 'bear', elephant: 'elephant', hyena: 'hyena', eques: 'horse', sagittarius: 'horse', essedarius: 'horse', essedarius2: 'horse' };
function call(type) {
  const k = CALLS[type.replace('champion:', '')]; if (!k) return;
  S.calls = S.calls || [];
  if (S.calls.some(c => c.k === k && c.t > 0)) return;   // een roedel hyena's: één keer
  S.calls.push({ k, t: S.intro > 0 ? S.intro + .3 : .15 + Math.random() * .2 });
}
function updateCalls(dt) {
  for (const c of S.calls || []) { c.t -= dt; if (c.t <= 0 && !c.done) { c.done = true; SFX.fx(c.k); } }
  if (S.calls) S.calls = S.calls.filter(c => !c.done);
}
// Afstijgen: het paard valt (of de wagen breekt) en hij vecht te voet verder met de waarden uit 'foot'.
function dismount(f) {
  S.wrecks.push({ x: f.x, y: f.y, face: f.heading, kind: f.mount.kind, horses: f.mount.horses || 1, color: f.mount.color, deco: f.mount.deco });
  dropXp({ x: f.x, y: f.y, type: 'slave' });   // een paar bolletjes voor het paard
  f.mount = null; f.d = { ...f.d, ...f.d.foot }; f.state = 'stagger'; f.t = .7; f.vx = Math.cos(f.heading) * 120; f.vy = Math.sin(f.heading) * 120;
  for (let k = 0; k < 10; k++) S.dust.push({ x: f.x + (Math.random() - .5) * 26, y: f.y + (Math.random() - .5) * 26, t: 1 });
  S.shake = Math.max(S.shake, 6); arenaCheer(); SFX.cheer(1); SFX.fx(f.mount && f.mount.kind === 'chariot' ? 'crash' : 'horseFall');
}
// Werpspeer: vliegt naar een plek (rode cirkel); sta je daar als hij landt, dan raakt hij.
function throwJav(f, x, y, dmg) {
  S.javs.push({ side: f.side, x0: f.x, y0: f.y, x, y, t: 0, T: JAVELIN.flight / (DIFFICULTY[difficulty] || DIFFICULTY.hard).arrow, dmg }); SFX.fx('javelin');   // makkelijk: langer in de lucht
}
function updateJavs(dt) {
  for (const j of S.javs) {
    j.t += dt;
    if (j.t >= j.T && !j.done) {
      j.done = true; j.stuck = 1.2;
      const att = { x: j.x0, y: j.y0, d: { dmg: j.dmg, knock: 40 } };
      if (!P.dead && j.side !== P.side && Math.hypot(P.x - j.x, P.y - j.y) <= JAVELIN.radius + PLAYER.radius * .5) hitPlayer(att);
      for (const o of S.foes) if (targetable(o) && o.side !== j.side && Math.hypot(o.x - j.x, o.y - j.y) <= JAVELIN.radius + o.d.radius * .5) hitUnit(o, att);
    }
    if (j.done) j.stuck -= dt;
  }
  S.javs = S.javs.filter(j => !j.done || j.stuck > 0);
}
// Sturen te paard of op de wagen: draaien met hoogstens f.d.turn rad/s; dicht bij de muur buigt hij naar het midden.
function ride(f, goal, speed, dt) {
  const rr = Math.hypot(f.x / W.rx, f.y / W.ry);
  if (rr > .8) goal = lerpAngle(goal, Math.atan2(-f.y, -f.x), clamp((rr - .8) * 5, 0, 1));
  const diff = ((goal - f.heading + Math.PI * 3) % TAU2) - Math.PI;
  f.heading += clamp(diff, -f.d.turn * dt, f.d.turn * dt); f.face = f.heading;
  f.gallop = (f.gallop || 0) + dt * speed * .08;
  return [Math.cos(f.heading) * speed, Math.sin(f.heading) * speed];
}
// Hoplomachus: zijn speer breekt. Hij wankelt even en trekt dan zijn korte zwaard (de waarden uit 'after').
function breakSpear(f) {
  f.spear = false; f.d = { ...f.d, ...f.d.after }; f.state = 'stagger'; f.t = f.d.breakStagger;
  for (let k = 0; k < 8; k++) S.dust.push({ x: f.x + Math.cos(f.face) * 20 + (Math.random() - .5) * 14, y: f.y + Math.sin(f.face) * 20 + (Math.random() - .5) * 14, t: 1.2, chip: true, color: '#7a5232' });
  S.shake = Math.max(S.shake, 4); arenaCheer(); SFX.cheer(.8); SFX.fx('woodBreak');
}
// Thraciër pareert: geen schade, hij stapt opzij (zilveren flits) en snijdt meteen terug.
function parried(f) {
  const a = Math.atan2(P.y - f.y, P.x - f.x), side = Math.random() < .5 ? 1 : -1, st = f.d.parry.step;
  f.vx += Math.cos(a + side * Math.PI / 2) * st * 9; f.vy += Math.sin(a + side * Math.PI / 2) * st * 9;   // glijdt opzij (geen sprong)
  f.face = Math.atan2(P.y - f.y, P.x - f.x); f.lunge = 1; f.parried = .35;
  f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown; f.parryCd = f.d.parry.cd;
  S.freeze = FEEL.hitstop * .6; S.shake = Math.max(S.shake, 2); SFX.block(); SFX.whoosh();
  hitPlayer(f);
}
// Blokken: korte bronzen flits aan de kant van de aanvaller, geen schade.
function blocked(def, att) {
  def.block = .3; def.blockA = Math.atan2(att.y - def.y, att.x - def.x);
  S.freeze = FEEL.hitstop * .6; S.shake = Math.max(S.shake, 2);
  float(def.x, def.y - 20, 'blocked', C.bronze);
  SFX.block();
}
function hitPlayer(f) {
  if (P.hurt > 0 || P.dead || P.rollInv > 0) return;   // tijdens het begin van de rol raakt niets je
  // Schild: geldt alleen als de klap of pijl van voren komt (binnen 60° van waar je naar kijkt).
  const toward = Math.abs(((Math.atan2(f.y - P.y, f.x - P.x) - P.face + Math.PI * 3) % TAU2) - Math.PI);
  // Blokken (K / Shift): schild omhoog houdt klappen van voren tegen; zonder schild een getimede parade met je wapen.
  let mul = 1;
  const src = realFoe(f), heavy = !f.arrow && ((f.d.knock || 0) >= BLOCK.heavy || !!f.d.heavy);
  if (toward < BLOCK.arc) {
    if (P.guard && f.d.hook && !f.arrow) {   // de sica haakt om je schild: je wordt meegetrokken en staat open
      const a = Math.atan2(f.y - P.y, f.x - P.x);
      P.guard = false; P.guardBroken = HOOK.open; P.hooked = HOOK.open;
      P.vx += Math.cos(a) * HOOK.pull; P.vy += Math.sin(a) * HOOK.pull;
      S.shake = Math.max(S.shake, 3); SFX.whoosh(); SFX.block();
      return;
    }
    if (P.guard && !f.d.hook && !(f.arrow && GEAR[S.gear.shield].arrows === false)) {   // de sica haakt om je schild; de parma houdt geen pijlen
      if (heavy) {   // te zwaar: je schild wordt opzij geslagen, je wankelt en krijgt de helft
        P.guard = false; P.guardBroken = BLOCK.break; mul = .5;
        float(P.x, P.y - 30, '!', C.blood); SFX.block();
      } else {
        P.block = .3; P.blockA = Math.atan2(f.y - P.y, f.x - P.x);
        S.freeze = FEEL.hitstop * .6; S.shake = Math.max(S.shake, 2); SFX.block(); blockedOk();
        if (!f.arrow && P.guardT <= BLOCK.perfect && src) { staggerFoe(src); P.riposte = BLOCK.riposte; arenaCheer(); SFX.cheer(.6); excite(.4); }   // net op tijd: hij wankelt
        return;
      }
    } else if (P.parryT > 0 && !f.arrow && !heavy) {   // parade op het goede moment
      P.parryT = 0; P.parried = .35; P.block = .3; P.blockA = Math.atan2(f.y - P.y, f.x - P.x); excite(.6); blockedOk();
      S.freeze = FEEL.hitstop; S.shake = Math.max(S.shake, 3); SFX.block(); SFX.whoosh();
      if (src) staggerFoe(src);
      P.riposte = BLOCK.riposte; arenaCheer(); SFX.cheer(.7);
      return;
    }
  }
  const front = me.shield && !f.d.hook && toward < Math.PI / 3 ? GEAR[S.gear.shield].front : 0;   // de sica haakt om je schild heen
  if (front && f.arrow && GEAR[S.gear.shield].arrows !== false) {   // pijl op het schild (de parma houdt geen pijlen tegen)
    P.block = .3; P.blockA = Math.atan2(f.y - P.y, f.x - P.x);
    SFX.block(); return;
  }
  const real = Math.max(1, Math.ceil((f.d.dmg - me.armor - front) * mul));   // harnas en schild: altijd minstens 1
  P.hp = Math.max(S.god ? 1 : 0, P.hp - real); P.hurt = me.invuln; P.flash = FEEL.flash;   // S.god: onsterfelijk (testmenu)
  const dx = P.x - f.x, dy = P.y - f.y, l = Math.hypot(dx, dy) || 1;
  const push = (170 + (f.d.knock || 0)) * me.knock;
  P.vx += dx / l * push; P.vy += dy / l * push;
  S.freeze = FEEL.hitstop * 1.4; S.shake = Math.max(S.shake, FEEL.playerShake);
  float(P.x, P.y - 20, real ? '−' + fmt(real) : '0', C.blood);
  if (f.d.bleed) P.bleed = { t: f.d.bleed.time, tick: 1, dmg: f.d.bleed.dmg, src: f };   // sica: je bloedt
  if (!f.arrow || me.shield) blockHint();
  SFX.hurt(); if (typeof PAD !== 'undefined') PAD.rumble(Math.min(1, .35 + real / me.maxHp), 140);   // controller trilt
  if (P.hp > 0) SFX.cheer(Math.min(.8, .35 + real / me.maxHp));
  arenaCheerAt(P.x, P.y, Math.min(1, .55 + real / me.maxHp));   // het publiek geniet ook als jíj bloedt, harder bij een flinke klap
  $('stage').classList.remove('hurt'); void $('stage').offsetWidth; $('stage').classList.add('hurt');
  updateUI();
  if (P.hp <= 0) { P.dead = true; endFight(false); }
}
// Ontwijkrol: altijd zijwaarts ten opzichte van waar je kijkt.
function tryRoll() {
  if (!ROLL.enabled) return;
  if (P.dead || S.over || S.paused || S.intro > 0 || me.riding || P.netted > 0 || P.rollCd > 0) return;
  let dx = 0, dy = 0;
  if (keys.has('ArrowLeft') || keys.has('a')) dx--; if (keys.has('ArrowRight') || keys.has('d')) dx++;
  if (keys.has('ArrowUp') || keys.has('w')) dy--; if (keys.has('ArrowDown') || keys.has('s')) dy++;
  if (!dx && !dy && (typeof PAD !== 'undefined' && PAD.active) && PAD.move) [dx, dy] = PAD.move;   // controller: de linkerstick
  // Kant: loop je (een beetje) naar links of rechts van je kijkrichting, dan die kant; anders dezelfde kant als vorige keer.
  const lateral = dx || dy ? Math.sin(Math.atan2(dy, dx) - P.face) : 0;
  const side = lateral > .15 ? 1 : lateral < -.15 ? -1 : (P.rollSide || 1);
  P.rollSide = side; P.rollDir = P.face + side * Math.PI / 2;
  P.roll = ROLL.time; P.rollInv = ROLL.inv;
  P.rollCd = Math.max(ROLL.cdMin, ROLL.cd - ROLL.cdAgi * S.stats.agility) * (1 - gearSum('roll'));   // parma: sneller weer rollen
  for (let j = 0; j < 4; j++) S.dust.push({ x: P.x + (Math.random() - .5) * 10, y: P.y + (Math.random() - .5) * 10, t: 1 });
  SFX.fx('roll');
}
/* ---------- Zelf slaan en blokken ---------- */
// Slaan met je melee-wapen (of je vuisten) in richting aim. Wie geraakt wordt: zie 'hit' bij WEAPONS.
function swingMelee(w, aim) {
  P.cd = P.cdMax = me.meleeCd; P.swing = w.swing; P.swingDir *= -1;
  const hits = S.foes.filter(f => {
    if (!targetable(f) || !hostile(P, f)) return false;
    const dx = f.x - P.x, dy = f.y - P.y, dist = Math.hypot(dx, dy);
    if (dist - f.d.radius - PLAYER.radius > w.reach) return false;
    const along = dx * Math.cos(aim) + dy * Math.sin(aim), side = -dx * Math.sin(aim) + dy * Math.cos(aim);
    if (w.hit === 'pierce') return along > 0 && Math.abs(side) <= f.d.radius + w.width;
    return Math.abs(((Math.atan2(dy, dx) - aim + Math.PI * 3) % TAU2) - Math.PI) <= (w.arc || .7) || dist < f.d.radius + PLAYER.radius + 2;
  });
  const near = o => Math.hypot(o.x - P.x, o.y - P.y);
  const list = w.hit === 'sweep' || w.hit === 'pierce' ? hits : hits.sort((a, b) => near(a) - near(b)).slice(0, 1);   // vuisten: één
  if (w.kind === 'stick' || !list.length) SFX.whoosh();   // mis: alleen een zwiep
  const crit = P.riposte > 0 && list.length > 0;
  if (crit) P.riposte = 0;
  for (const t of list) hitFoe(t, me.dmg * (crit ? BLOCK.riposteMul : 1), P, false, crit);
}
// Schieten in richting aim; met een doelwit richt je een tikje voor (waar hij heen loopt).
function shoot(w, aim, target) {
  if (S.ammo <= 0) {   // koker leeg: vak 2 knippert rood
    if (!(P.noAmmo > 0)) { P.noAmmo = 2.5; const b = $('slot_ranged'); b.classList.remove('empty'); void b.offsetWidth; b.classList.add('empty'); }
    return;
  }
  let a = aim;
  if (target) {
    const t = Math.hypot(target.x - P.x, target.y - P.y) / w.arrow, mv = target.state === 'walk' ? target.d.speed * t * .6 : 0;
    a = Math.atan2(target.y + Math.sin(target.face) * mv - P.y, target.x + Math.cos(target.face) * mv - P.x);
  }
  S.arrows.push({ x: P.x + Math.cos(a) * (PLAYER.radius + 4), y: P.y + Math.sin(a) * (PLAYER.radius + 4), vx: Math.cos(a) * w.arrow, vy: Math.sin(a) * w.arrow, t: 0, life: w.range / w.arrow * 1.15, dmg: w.dmg, stuck: 0, mine: true });
  P.cd = P.cdMax = me.shootCd; P.swing = w.swing; S.ammo--; updateUI();
}
// Blokken: K of Shift. Met schild zolang je hem vasthoudt; zonder schild (met een wapen) een korte parade bij het indrukken.
function updateGuard(dt) {
  const held = keys.has('k') || keys.has('Shift') || steer.block || (typeof PAD !== 'undefined' && PAD.active) && PAD.block;
  P.parryCd = Math.max(0, (P.parryCd || 0) - dt); P.parryLock = Math.max(0, (P.parryLock || 0) - dt);
  P.bashCd = Math.max(0, (P.bashCd || 0) - dt); P.bash = Math.max(0, (P.bash || 0) - dt);
  P.guardBroken = Math.max(0, (P.guardBroken || 0) - dt); P.hooked = Math.max(0, (P.hooked || 0) - dt); P.parried = Math.max(0, (P.parried || 0) - dt);
  if (P.parryT > 0) { P.parryT -= dt; if (P.parryT <= 0) { P.parryT = 0; P.parryLock = BLOCK.recover; } }   // niets geraakt: even open
  const able = !P.dead && !S.over && S.switching <= 0 && !(P.roll > 0) && !(P.netted > 0) && !(P.guardBroken > 0);
  const was = P.guard;
  P.guard = able && held && me.shield;
  P.guardT = P.guard ? (was ? P.guardT + dt : 0) : 0;
  if (P.guardPress) {
    P.guardPress = false;
    if (able && !me.shield && me.canParry && P.parryCd === 0 && !(P.parryLock > 0) && !(P.swing > 0)) { P.parryT = BLOCK.window; P.parryCd = BLOCK.cd + BLOCK.window; SFX.whoosh(); }
  }
}
// Schildstoot: alles voor je wordt weggeduwd en wankelt even.
function shieldBash() {
  P.bashCd = BASH.cd; P.bash = .3;
  let n = 0;
  for (const f of S.foes) {
    if (!targetable(f) || !hostile(P, f)) continue;
    const dx = f.x - P.x, dy = f.y - P.y, dist = Math.hypot(dx, dy) || 1;
    if (dist - f.d.radius - PLAYER.radius > BASH.reach) continue;
    if (Math.abs(((Math.atan2(dy, dx) - P.face + Math.PI * 3) % TAU2) - Math.PI) > BASH.arc && dist > f.d.radius + PLAYER.radius + 2) continue;
    hitFoe(f, BASH.dmg, P, true);
    if (f.state === 'dead') { n++; continue; }
    const push = f.d.heavy || f.mount ? 0 : BASH.knock; f.vx += dx / dist * push; f.vy += dy / dist * push;
    staggerFoe(f, BASH.stagger); n++;
  }
  S.freeze = FEEL.hitstop; S.shake = Math.max(S.shake, 4 + n); SFX.block(); SFX.whoosh();
  if (n) { arenaCheerAt(P.x + Math.cos(P.face) * 20, P.y + Math.sin(P.face) * 20, .7); excite(.15 * n); }
}
// Opwinding van het publiek: genoeg = brood.
function excite(k) {
  if (S.over || S.collect > 0) return;
  S.excite = (S.excite || 0) + k * (.4 + .6 * (AR.fill ?? 1));
}
function throwBread() {
  const n = (AR.fill ?? 1) >= .8 ? 2 : 1;
  for (let i = 0; i < n && S.breads.filter(b => b.state !== 'gone').length < BREAD.max; i++) {
    // vlak bij de actie (bij jou in de buurt, maar niet op je hoofd), binnen het zand
    const a = Math.random() * TAU2, r = 35 + Math.random() * 55;
    let x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r;
    const k = Math.hypot(x / (W.rx - 18), y / (W.ry - 18)); if (k > 1) { x /= k; y /= k; }
    const from = Math.atan2(y / W.ry, x / W.rx) + (Math.random() - .5) * .5;   // van de tribune achter die plek
    const x0 = Math.cos(from) * (W.rx + 34), y0 = Math.sin(from) * (W.ry + 34);
    S.breads.push({ x0, y0, x, y, t: 0, T: BREAD.flight, state: 'fly', life: BREAD.life, spin: Math.random() * 6 });
    arenaCheerAt(x0, y0, .8);
  }
  SFX.whoosh();
}
function updateBread(dt) {
  if (!S.breads) return;
  if (!S.over && !(S.collect > 0)) {
    S.excite = Math.max(0, (S.excite || 0) - BREAD.decay * dt);
    if (S.excite >= BREAD.need) { S.excite = 0; throwBread(); }
  }
  for (const b of S.breads) {
    if (b.state === 'fly') { b.t += dt; if (b.t >= b.T) { b.state = 'ground'; for (let j = 0; j < 3; j++) S.dust.push({ x: b.x + (Math.random() - .5) * 8, y: b.y + (Math.random() - .5) * 8, t: .6 }); } continue; }
    if (b.state !== 'ground') continue;
    b.life -= dt; if (b.life <= 0) { b.state = 'gone'; continue; }
    if (!P.dead && Math.hypot(P.x - b.x, P.y - b.y) < PLAYER.radius + BREAD.pick) {   // oprapen: leven terug
      b.state = 'gone';
      const heal = Math.min(BREAD.heal, me.maxHp - P.hp); P.hp += heal;
      S.floats.push({ x: P.x, y: P.y - 24, text: '+' + BREAD.heal, color: '#7ee36a', t: 1.1, size: 15 });
      SFX.fx('roll'); updateUI();
    }
  }
  S.breads = S.breads.filter(b => b.state !== 'gone');
}
// Vrij gevecht: een tegenstander rent naar het dichtstbijzijnde brood op het zand en eet het op.
function goForBread(f, dt) {
  let b = null, bd = BREAD.foeRange;
  for (const o of S.breads || []) { if (o.state !== 'ground') continue; const dd = Math.hypot(o.x - f.x, o.y - f.y); if (dd < bd) { bd = dd; b = o; } }
  if (!b) return false;
  if (bd < f.d.radius + BREAD.pick) {
    b.state = 'gone';
    const heal = BREAD.heal * ATTACK.foeHp; f.hp = Math.min(f.d.hp, f.hp + heal);
    S.floats.push({ x: f.x, y: f.y - 22, text: '+' + fmt(heal), color: '#7ee36a', t: 1.1, size: 12 });
    arenaCheerAt(f.x, f.y, .6); SFX.cheer(.3);
    return false;
  }
  const a = Math.atan2(b.y - f.y, b.x - f.x), sl = f.slow > 0 ? f.slowMul || .5 : 1;
  f.face = lerpAngle(f.face, a, 1 - Math.exp(-dt * 10));
  f.x += (Math.cos(a) * f.d.speed * sl + f.vx) * dt; f.y += (Math.sin(a) * f.d.speed * sl + f.vy) * dt;
  contain(f, W.rx - f.d.radius - 4, W.ry - f.d.radius - 4);
  return true;
}
// Brood: een rond brood met inkepingen (panis quadratus), met schaduw; in de lucht in een boog van de tribune.
function drawBread(now) {
  for (const b of S.breads || []) {
    let x = b.x, y = b.y, h = 0, s = 1, a = 1;
    if (b.state === 'fly') { const k = b.t / b.T; x = b.x0 + (b.x - b.x0) * k; y = b.y0 + (b.y - b.y0) * k; h = Math.sin(k * Math.PI) * 40; s = 1 + .35 * Math.sin(k * Math.PI); }
    else if (b.life < 2) a = Math.floor(now / 120) % 2 ? .35 : 1;   // bijna weg: knippert
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(40,20,8,.28)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 3, 6 * s, 4.5 * s, 0, 0, TAU2); ctx.fill();
    ctx.save(); ctx.translate(x, y - h); ctx.rotate(b.spin + (b.state === 'fly' ? b.t * 8 : 0)); ctx.scale(s, s);
    ctx.fillStyle = '#c99a5a'; ctx.strokeStyle = EDGE; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,210,.25)'; ctx.beginPath(); ctx.arc(-1.5, -1.5, 3.2, 0, TAU2); ctx.fill();
    ctx.strokeStyle = '#8a5a32'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { const r = i / 4 * Math.PI; ctx.beginPath(); ctx.moveTo(Math.cos(r) * 1.5, Math.sin(r) * 1.5); ctx.lineTo(Math.cos(r) * 5, Math.sin(r) * 5); ctx.stroke(); }
    ctx.restore(); ctx.globalAlpha = 1;
  }
}

// Een tegenstander wankelt (door jouw blok of parade): hij doet even niets, witte rand.
function staggerFoe(f, t = BLOCK.stagger) {
  if (!f || f.state === 'dead' || f.mount || f.d.heavy) return;
  f.state = 'stagger'; f.t = t; f.combo = 0; f.hitP = true;
  const a = Math.atan2(f.y - P.y, f.x - P.x); f.vx += Math.cos(a) * 90; f.vy += Math.sin(a) * 90;
}
// Sommige klappen komen als kopie van de tegenstander binnen ({ ...f, d: ... }); zoek dan de echte.
const realFoe = f => S.foes.includes(f) ? f : S.foes.find(o => o.state !== 'dead' && o.x === f.x && o.y === f.y && o.type === f.type) || null;

// Net: vliegt van de retiarius naar een plek (rode cirkel); wie er dan in staat, zit vast.
function throwNet(f, x, y) {
  const n = { side: f.side, x0: f.x, y0: f.y, x, y, t: 0, T: NET.flight / (DIFFICULTY[difficulty] || DIFFICULTY.hard).arrow, state: 'fly', owner: f };   // makkelijk: langer in de lucht
  S.nets.push(n); f.hasNet = false; f.myNet = n; SFX.fx('netThrow');
}
function releaseNet() {
  P.netted = 0;
  const n = S.nets.find(n => n.state === 'held' && n.on === P);
  if (n) { n.state = 'ground'; n.x = P.x; n.y = P.y; n.on = null; }
}
// Een tegenstander komt los uit een net: het net valt op het zand.
function freeFoe(f) {
  f.netted = 0;
  const n = S.nets.find(n => n.state === 'held' && n.on === f);
  if (n) { n.state = 'ground'; n.x = f.x; n.y = f.y; n.on = null; }
}
// Gevangen (jacht): telt als verslagen, hij blijft vastgebonden liggen. XP en een beloning.
function capture(f) {
  f.state = 'dead'; f.dead = 1; f.captured = true; f.vx = 0; f.vy = 0; f.netted = 0;
  dropXp(f); excite(1); S.captures++; S.bonus += HUNT.captureBonus;
  S.floats.push({ x: f.x, y: f.y - 24, text: `+${HUNT.captureBonus} d`, color: C.coin, t: 1.4, size: 15 });
  arenaCheer(); SFX.cheer(1); S.shake = Math.max(S.shake, 3);
  checkExtra(); checkWin();
}
// Net gooien (toets E): naar je muis, anders naar de dichtstbijzijnde tegenstander (een tikje voor hem), anders recht vooruit.
function throwPlayerNet() {
  if (!(S.netsLeft > 0) || P.dead || S.over || S.paused || S.intro > 0 || P.netted > 0 || P.roll > 0 || S.switching > 0 || me.riding) return;
  let x, y; const mouse = steer.mouse && !(typeof PAD !== 'undefined' && PAD.active);
  if (mouse) { x = steer.hx; y = steer.hy; }
  else if (P.target && Math.hypot(P.target.x - P.x, P.target.y - P.y) <= HUNT.range) { const t = P.target; x = t.x + t.vx * .25 + (t.state === 'walk' ? Math.cos(t.face) * t.d.speed * .3 : 0); y = t.y + t.vy * .25 + (t.state === 'walk' ? Math.sin(t.face) * t.d.speed * .3 : 0); }
  else { x = P.x + Math.cos(P.face) * 80; y = P.y + Math.sin(P.face) * 80; }
  const dx = x - P.x, dy = y - P.y, dd = Math.hypot(dx, dy) || 1;
  if (dd > HUNT.range) { x = P.x + dx / dd * HUNT.range; y = P.y + dy / dd * HUNT.range; }
  const r = Math.hypot(x / (W.rx - 20), y / (W.ry - 20)); if (r > 1) { x /= r; y /= r; }
  P.face = Math.atan2(y - P.y, x - P.x); P.swing = .25;
  S.nets.push({ mine: true, side: P.side, owner: P, x0: P.x, y0: P.y, x, y, t: 0, T: NET.flight * .8, state: 'fly' });
  S.netsLeft--; SFX.fx('netThrow'); updateUI();
}
function updateNets(dt) {
  for (const n of S.nets) {
    if (n.state === 'ground' && n.mine && !P.dead && Math.hypot(P.x - n.x, P.y - n.y) < NET.pick + PLAYER.radius) {   // je eigen net oprapen
      n.state = 'gone'; S.netsLeft++; SFX.fx('roll'); updateUI(); continue;
    }
    if (n.state !== 'fly') continue;
    n.t += dt;
    if (n.t < n.T) continue;
    n.state = 'ground';
    if (n.side !== P.side && !P.dead && !(P.rollInv > 0) && Math.hypot(P.x - n.x, P.y - n.y) <= NET.radius + PLAYER.radius * .5) {
      n.state = 'held'; n.on = P; P.netted = NET.hold * me.netMul; P.roll = 0; arenaCheer(); SFX.cheer(.7); SFX.fx('net'); S.shake = Math.max(S.shake, 2);
      continue;
    }
    // een ander in het net
    const f = S.foes.find(o => targetable(o) && o.side !== n.side && !(o.netted > 0) && Math.hypot(o.x - n.x, o.y - n.y) <= NET.radius + o.d.radius * .5);
    if (!f) continue;
    if (f.mount || f.d.heavy) { float(f.x, f.y - 24, '✗', C.muted); continue; }   // olifant of ruiter: glijdt eraf
    n.state = 'held'; n.on = f; f.netBy = n.owner; f.state = 'walk'; f.lunge = 0;
    SFX.fx('net'); arenaCheer(); SFX.cheer(.7); S.shake = Math.max(S.shake, 2);
    if (n.mine && f.d.animal && f.hp <= f.d.hp * HUNT.capture) capture(f);
    else f.netted = f.d.animal ? HUNT.hold : NET.hold;
  }
  S.nets = S.nets.filter(n => n.state !== 'gone' && (n.state !== 'held' || !n.on || n.on === P || n.on.state !== 'dead' || n.on.captured));
}
function endFight(won) {
  if (S.over) return;
  S.over = won ? 'won' : 'lost'; S.overT = 0;
  const def = fightDef(), reward = def.reward || 0;
  if (won) {
    S.delta = reward + (S.bonus || 0); S.money += S.delta;
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
  const n = foeXp(f.type), a0 = Math.random() * TAU2;
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
    // groene LVL UP naast je poppetje, die met je meeloopt en langzaam opstijgt
    S.floats.push({ text: 'LVL UP', color: '#7ee36a', t: 1.6, follow: true, dx: 12, dy: -12, size: 8.5 });
  }
  updateUI();
}
function float(x, y, text, color) { S.floats.push({ x, y, text, color, t: 1 }); }


/* ---------- Gedrag per klasse ----------
   Elke functie krijgt de tegenstander f, dt, de richting naar jou (ex, ey), de afstand d en de ruimte ertussen (gap),
   regelt zijn toestand (f.state, f.t, f.cd) en geeft terug hoe hard hij loopt: [mx, my]. Lopen, knockback en binnen
   de muren blijven doet de lus in update(). Een nieuwe klasse: zet ai: '<naam>' in FOES en voeg hier een functie toe. */
const AI = {
  // Leeuw: sluipen, in elkaar duiken en richten (richting ligt vast), stormen, uitrusten.
  dash(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const D = f.d.dash;
    if (f.state === 'walk') {
      f.face = lerpAngle(f.face, Math.atan2(ey, ex), 1 - Math.exp(-dt * 6));
      mx = Math.cos(f.face) * f.d.speed; my = Math.sin(f.face) * f.d.speed;
      if (!TG.dead && f.cd === 0 && d <= D.range) { f.state = 'windup'; f.t = f.d.windup; f.aim = Math.atan2(ey, ex); }
    } else if (f.state === 'windup') {
      f.t -= dt; f.face = f.aim;
      if (f.t <= 0) { f.state = 'dash'; f.t = D.time; f.hitP = false; SFX.cheer(.5); }
    } else if (f.state === 'dash') {
      f.t -= dt; mx = Math.cos(f.aim) * D.speed; my = Math.sin(f.aim) * D.speed;
      if (!f.hitP && gap <= 2) { f.hitP = true; strike(f); }
      if (f.t <= 0) { f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown; }
    } else if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; }
    return [mx, my];
  },
  // Boogschutter: afstand houden, richten, schieten.
  ranged(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const R = f.d.ranged, K = f.d.dagger;
    if (K) {   // boogschutter: vlakbij wisselt hij naar zijn dolk, op afstand weer naar zijn boog
      const close = gap <= K.near;
      // Hoe lang is hij al niet geraakt? (leven gezakt = geraakt)
      if (f.hpSeen === undefined || f.hp < f.hpSeen) f.calm = 0; else f.calm = (f.calm || 0) + dt;
      f.hpSeen = f.hp;
      if (f.dagger && f.state === 'walk' && f.calm >= K.leave) { f.state = 'retreat'; f.t = K.run; f.wob = Math.random() * 10; }
      if (f.state === 'retreat') {   // weg van het gevecht, een plek zoeken om te schieten
        f.t -= dt;
        if (f.calm === 0 && close) f.state = 'walk';   // toch geraakt en je staat vlakbij: terugvechten
        else if (gap > K.far || f.t <= 0) { f.dagger = false; f.state = 'swap'; f.t = K.swap; f.cd = Math.max(f.cd, .6); f.calm = 0; }
        else {
          const away = Math.atan2(-ey, -ex), side = Math.sin(performance.now() / 700 + f.wob) * .6;
          // bij de muur: meer langs de muur dan erin
          const wall = Math.hypot(f.x / W.rx, f.y / W.ry), a = away + side + (wall > .8 ? Math.sign(side || 1) * .9 : 0);
          f.face = lerpAngle(f.face, a, 1 - Math.exp(-dt * 10));
          return [Math.cos(a) * f.d.speed * 1.1, Math.sin(a) * f.d.speed * 1.1];
        }
      }
      if (!f.dagger && (f.state === 'walk' && close || f.state === 'windup' && gap <= K.near * .6)) { f.dagger = true; f.state = 'swap'; f.t = K.swap; }
      else if (f.dagger && f.state === 'walk' && gap > K.far) { f.dagger = false; f.state = 'swap'; f.t = K.swap; f.cd = Math.max(f.cd, .6); }
      if (f.state === 'swap') { f.t -= dt; f.face = lerpAngle(f.face, Math.atan2(ey, ex), 1 - Math.exp(-dt * 8)); if (f.t <= 0) f.state = 'walk'; return [0, 0]; }
      if (f.dagger) return AI.stab(f, dt, ex, ey, d, gap, K);
    }
    f.face = lerpAngle(f.face, Math.atan2(ey, ex), 1 - Math.exp(-dt * (f.state === 'windup' ? 3 : 8)));
    if (f.state === 'walk') {
      let dir = 0;
      if (d < R.flee + f.d.radius) dir = -1;          // te dichtbij: weglopen
      else if (d > R.max) dir = 1;                     // te ver: dichterbij
      const side = Math.sin(performance.now() / 900 + f.wob) > 0 ? 1 : -1;   // anders langzaam opzij stappen
      if (dir) { mx = ex / d * f.d.speed * dir; my = ey / d * f.d.speed * dir; }
      else { mx = -ey / d * f.d.speed * .35 * side; my = ex / d * f.d.speed * .35 * side; }
      if (!TG.dead && f.cd === 0 && d <= R.max + 30) { f.state = 'windup'; f.t = f.d.windup; }   // ook als je dichtbij staat (maar niet vlakbij: dan de dolk)
    } else if (f.state === 'windup') {
      f.t -= dt;
      if (f.t <= 0) {
        const a = Math.atan2(ey, ex);
        S.arrows.push({ x: f.x + Math.cos(a) * (f.d.radius + 4), y: f.y + Math.sin(a) * (f.d.radius + 4), vx: Math.cos(a) * R.arrow, vy: Math.sin(a) * R.arrow, t: 0, life: R.life, dmg: f.d.dmg, stuck: 0, side: f.side });
        f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown;
      }
    } else if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; }
    return [mx, my];
  },
  // Dolk van de boogschutter: als 'melee', maar met de waarden uit K (en K.dmg als schade).
  stab(f, dt, ex, ey, d, gap, K) {
    let mx = 0, my = 0;
    if (f.state === 'walk') {
      f.face = lerpAngle(f.face, Math.atan2(ey, ex), 1 - Math.exp(-dt * 8));
      if (gap > K.reach * .6) { mx = Math.cos(f.face) * f.d.speed; my = Math.sin(f.face) * f.d.speed; }
      if (!TG.dead && gap <= K.reach && f.cd === 0) { f.state = 'windup'; f.t = K.windup; }
    } else if (f.state === 'windup') {
      f.face = lerpAngle(f.face, Math.atan2(ey, ex), 1 - Math.exp(-dt * 4));
      f.t -= dt;
      if (f.t <= 0) {
        f.lunge = 1; f.state = 'recover'; f.t = K.recover; f.cd = K.cooldown;
        if (gap > K.reach + K.lunge) { /* ontweken */ }
        else if (Math.random() >= hitChance(f.d.attack)) { /* mis */ }
        else if (Math.random() < blockOf(TG)) blocked(TG, f);
        else { const keep = f.d.dmg; f.d.dmg = K.dmg; strike(f); f.d.dmg = keep; }
      }
    } else if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; }
    return [mx, my];
  },
  // Slaaf, tiro: oplopen, aanzetten, uithalen, herstellen.
  melee(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0;
    if (f.state === 'walk') {
      f.face = lerpAngle(f.face, Math.atan2(ey, ex), 1 - Math.exp(-dt * 8));
      if (gap > f.d.reach * .6) { const wob = Math.sin(performance.now() / 300 + f.wob) * .25; mx = Math.cos(f.face + wob) * f.d.speed; my = Math.sin(f.face + wob) * f.d.speed; }
      if (!TG.dead && gap <= f.d.reach && f.cd === 0) { f.state = 'windup'; f.t = f.d.windup; }
    } else if (f.state === 'windup') {
      f.face = lerpAngle(f.face, Math.atan2(ey, ex), 1 - Math.exp(-dt * 4));
      f.t -= dt;
      if (f.t <= 0) {
        f.lunge = 1; f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown;
        // Uithalen: raakt als je nog binnen bereik staat (met een klein beetje speling voor de uitval).
        if (gap > f.d.reach + f.d.lunge) { /* ontweken: buiten bereik gestapt */ }
        else if (Math.random() >= hitChance(f.d.attack)) { /* mis */ }
        else if (Math.random() < blockOf(TG)) blocked(TG, f);
        else strike(f);
      }
    } else if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; }
    return [mx, my];
  },
  // Murmillo: langzaam en in dekking oplopen; aanzetten → schildstoot → steek → open staan. Zonder schild: hetzelfde, maar alles raakt.
  murmillo(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const B = f.d.bash;
    if (f.state === 'stagger') { f.t -= dt; if (f.t <= 0) { f.state = 'recover'; f.t = .3; } return [0, 0]; }
    if (f.state === 'walk') {
      f.face = lerpAngle(f.face, Math.atan2(ey, ex), 1 - Math.exp(-dt * 6));
      if (gap > f.d.reach * .6) { mx = Math.cos(f.face) * f.d.speed; my = Math.sin(f.face) * f.d.speed; }
      if (!TG.dead && gap <= f.d.reach + 4 && f.cd === 0) { f.state = 'windup'; f.t = f.d.windup; }
    } else if (f.state === 'windup') {
      f.face = lerpAngle(f.face, Math.atan2(ey, ex), 1 - Math.exp(-dt * 4));
      f.t -= dt;
      if (f.t <= 0) {   // schildstoot: duwt je weg, geen schade
        f.state = 'thrust'; f.t = B.gap; f.lunge = .6;
        if (!TG.dead && !(TG.hurt > 0) && gap <= f.d.reach + 4) { TG.vx += ex / d * B.push * knockOf(TG); TG.vy += ey / d * B.push * knockOf(TG); S.shake = Math.max(S.shake, 2); SFX.block(); }
      }
    } else if (f.state === 'thrust') {   // de steek: hij stapt naar voren
      f.t -= dt; mx = Math.cos(f.face) * f.d.speed * 2.2; my = Math.sin(f.face) * f.d.speed * 2.2;
      if (f.t <= 0) {
        f.lunge = 1; f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown;
        if (gap > f.d.reach + f.d.lunge) { /* ontweken */ }
        else if (Math.random() >= hitChance(f.d.attack)) { /* mis */ }
        else if (Math.random() < blockOf(TG)) blocked(TG, f);
        else strike(f);
      }
    } else if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; }
    return [mx, my];
  },
  // Thraciër: cirkelen op afstand, soms pareren als je dichtbij bent en je klap eraan komt, anders naar binnen schieten
  // (dart) voor een snelle snee en weer weg.
  thraex(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const at = Math.atan2(ey, ex);
    if (f.state === 'parry') { f.t -= dt; f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 10)); if (f.t <= 0) { f.state = 'walk'; f.parryCd = f.d.parry.cd; } return [0, 0]; }
    if (f.state === 'walk') {
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 10));
      if (!TG.dead && f.parryCd === 0 && gap < f.d.parry.near && TG.cd < .35) { f.state = 'parry'; f.t = f.d.parry.time; return [0, 0]; }
      const want = f.d.reach + f.d.orbit, side = Math.sin(performance.now() / 1300 + f.wob) > 0 ? 1 : -1;
      const radial = gap > want + 6 ? 1 : gap < want - 6 ? -.8 : 0;   // op zijn afstand blijven en eromheen draaien
      mx = (ex / d * radial - ey / d * side * .9) * f.d.speed; my = (ey / d * radial + ex / d * side * .9) * f.d.speed;
      if (!TG.dead && f.cd === 0 && gap < want + 12) { f.state = 'windup'; f.t = f.d.windup; }
    } else if (f.state === 'windup') {
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 6)); f.t -= dt;
      if (f.t <= 0) { f.state = 'dart'; f.t = f.d.dart.time; f.aim = at; }
    } else if (f.state === 'dart') {   // naar binnen schieten
      f.t -= dt; f.face = f.aim; mx = Math.cos(f.aim) * f.d.dart.speed; my = Math.sin(f.aim) * f.d.dart.speed;
      if (gap <= f.d.reach || f.t <= 0) {
        f.lunge = 1; f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown;
        if (gap <= f.d.reach + f.d.lunge && Math.random() < hitChance(f.d.attack)) strike(f);   // geen blok: de sica haakt erom
      }
    } else if (f.state === 'recover') {   // na de snee weer weg
      f.t -= dt; mx = -ex / d * f.d.speed * .7; my = -ey / d * f.d.speed * .7;
      if (f.t <= 0) f.state = 'walk';
    }
    return [mx, my];
  },
  // Retiarius: afstand houden en het net gooien; zit je vast, dan de drietand; net kwijt: terughalen of met de drietand vechten.
  retiarius(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const at = Math.atan2(ey, ex), T = f.d.toss, K = f.d.pugio;
    f.stabCd = Math.max(0, (f.stabCd || 0) - dt); f.tossCd = Math.max(0, (f.tossCd || 0) - dt);
    const net = f.myNet, onGround = !f.hasNet && net && net.state === 'ground';
    if (f.hasNet === false && net && !S.nets.includes(net)) f.hasNet = true;
    if (f.state === 'toss') {   // net gooien: arm omhoog, dan werpen naar waar je heen loopt
      f.t -= dt; f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 8));
      if (f.t <= 0) {
        let x = TG.x + TG.vx * T.lead, y = TG.y + TG.vy * T.lead; const r = Math.hypot(x / (W.rx - 20), y / (W.ry - 20));
        if (r > 1) { x /= r; y /= r; }
        throwNet(f, x, y); f.state = 'recover'; f.t = .4; f.tossCd = T.cd;
      }
      return [0, 0];
    }
    if (f.state === 'stab') {   // dolk: snel
      f.t -= dt; if (f.t <= 0) { f.lunge = 1; f.state = 'recover'; f.t = .35; f.stabCd = K.cd; if (gap <= K.near + 6) strike({ ...f, d: { ...f.d, dmg: K.dmg, knock: 0 } }); }
      return [0, 0];
    }
    if (f.state === 'windup') {   // drietand: richten, richting ligt vast
      f.t -= dt; f.face = f.aim; if (f.t <= 0) { f.state = 'thrust'; f.t = .14; f.lunge = 1; } return [0, 0];
    }
    if (f.state === 'thrust') {
      f.t -= dt; f.face = f.aim;
      if (f.t <= 0) {
        f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown;
        const along = ex * Math.cos(f.aim) + ey * Math.sin(f.aim), side = Math.abs(-ex * Math.sin(f.aim) + ey * Math.cos(f.aim));
        if (along > 0 && along <= f.d.reach + f.d.radius + rad(TG) + f.d.lunge && side <= rad(TG) + f.d.width) {
          if (Math.random() >= hitChance(f.d.attack)) { /* mis */ } else if (Math.random() < blockOf(TG)) blocked(TG, f); else strike(f);
        }
      }
      return [0, 0];
    }
    if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; return [0, 0]; }
    // lopen: wat is het plan?
    if (!TG.dead && gap < K.near && f.stabCd === 0) { f.state = 'stab'; f.t = K.windup; f.face = at; return [0, 0]; }
    const fight = TG.netted > 0 || (onGround && Math.hypot(TG.x - net.x, TG.y - net.y) < NET.block) || (!f.hasNet && !onGround);
    if (fight) {   // drietand: op je af en steken
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 8));
      if (gap > f.d.reach * .8) { mx = Math.cos(f.face) * f.d.speed; my = Math.sin(f.face) * f.d.speed; }
      if (!TG.dead && f.cd === 0 && gap <= f.d.reach) { f.state = 'windup'; f.t = TG.netted > 0 ? f.d.windup * .7 : f.d.windup; f.aim = at; }
    } else if (onGround) {   // net terughalen
      const nx = net.x - f.x, ny = net.y - f.y, nd = Math.hypot(nx, ny) || 1;
      f.face = lerpAngle(f.face, Math.atan2(ny, nx), 1 - Math.exp(-dt * 8));
      mx = nx / nd * f.d.speed; my = ny / nd * f.d.speed;
      if (nd < NET.pick) { S.nets = S.nets.filter(n => n !== net); f.hasNet = true; f.myNet = null; f.state = 'recover'; f.t = .3; }
    } else {   // met net: afstand houden, eromheen draaien, gooien
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 8));
      const side = Math.sin(performance.now() / 1500 + f.wob) > 0 ? 1 : -1, radial = d > f.d.keep + 15 ? 1 : d < f.d.keep - 15 ? -1 : 0;
      mx = (ex / d * radial - ey / d * side * .6) * f.d.speed; my = (ey / d * radial + ex / d * side * .6) * f.d.speed;
      if (!TG.dead && f.tossCd === 0 && d <= T.range && d >= T.min) { f.state = 'toss'; f.t = T.windup; SFX.fx('netCharge'); }
    }
    return [mx, my];
  },
  // Secutor: oplopen; op afstand richten en sprinten; na 'breath' sprints op zijn knieën; zie je hem niet meer, dan zoekt hij.
  secutor(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const at = Math.atan2(ey, ex), R = f.d.sprint;
    f.sprintCd = Math.max(0, (f.sprintCd || 0) - dt);
    if (f.state === 'spent') { f.t -= dt; if (f.t <= 0) { f.breath = f.d.breath; f.state = 'walk'; } return [0, 0]; }
    if (f.state === 'search') { f.t -= dt; f.face += dt * 2.2; if (f.t <= 0) f.state = 'walk'; return [0, 0]; }
    if (f.state === 'aim') { f.t -= dt; f.face = f.aim; if (f.t <= 0) { f.state = 'sprint'; f.t = R.time; f.hitP = false; } return [0, 0]; }
    if (f.state === 'sprint') {
      f.t -= dt; mx = Math.cos(f.aim) * R.speed; my = Math.sin(f.aim) * R.speed;
      if (!f.hitP && gap <= 3) { f.hitP = true; if (Math.random() < blockOf(TG)) blocked(TG, f); else strike(f); }
      if (f.t <= 0) {
        f.breath--; f.sprintCd = R.cd;
        const off = Math.abs(((at - f.face + Math.PI * 3) % TAU2) - Math.PI);
        if (f.breath <= 0) { f.state = 'spent'; f.t = f.d.spent; }                   // op: dubbele schade
        else if (off > f.d.view) { f.state = 'search'; f.t = f.d.search; }          // kwijt: zoeken
        else { f.state = 'recover'; f.t = .35; }
      }
      return [mx, my];
    }
    if (f.state === 'walk') {
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 6));
      if (gap > f.d.reach * .6) { mx = Math.cos(f.face) * f.d.speed; my = Math.sin(f.face) * f.d.speed; }
      if (!TG.dead && f.breath > 0 && f.sprintCd === 0 && gap > f.d.reach + 10 && d <= R.range) { f.state = 'aim'; f.t = R.windup; f.aim = at; return [0, 0]; }
      if (!TG.dead && gap <= f.d.reach && f.cd === 0) { f.state = 'windup'; f.t = f.d.windup; }
    } else if (f.state === 'windup') {
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 4)); f.t -= dt;
      if (f.t <= 0) {
        f.lunge = 1; f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown;
        if (gap > f.d.reach + f.d.lunge) { /* ontweken */ } else if (Math.random() >= hitChance(f.d.attack)) { /* mis */ }
        else if (Math.random() < blockOf(TG)) blocked(TG, f); else strike(f);
      }
    } else if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; }
    return [mx, my];
  },
  // Eques te paard: rijden, richten (rode pijl), charge in een rechte lijn. Te voet: zie throwThen.
  eques(f, dt, ex, ey, d, gap) {
    const at = Math.atan2(ey, ex), C2 = f.d.charge;
    if (f.state === 'windup') { f.t -= dt; f.face = f.heading = f.aim; f.gallop += dt * 6; if (f.t <= 0) { f.state = 'charge'; f.t = C2.time; f.hitP = false; SFX.fx('gallop'); } return [Math.cos(f.aim) * f.d.speed * .5, Math.sin(f.aim) * f.d.speed * .5]; }
    if (f.state === 'charge') {
      f.t -= dt; f.gallop += dt * 25;
      if (!f.hitP && gap <= 4) { f.hitP = true; if (Math.random() < blockOf(TG)) blocked(TG, f); else strike(f); }
      if (f.t <= 0) { f.state = 'walk'; f.cd = f.d.cooldown; }
      return [Math.cos(f.aim) * C2.speed, Math.sin(f.aim) * C2.speed];
    }
    if (f.state === 'recover') f.state = 'walk';
    const off = Math.abs(((at - f.heading + Math.PI * 3) % TAU2) - Math.PI);
    if (!TG.dead && f.cd === 0 && off < .45 && d >= C2.min && d <= C2.max) { f.state = 'windup'; f.t = f.d.windup; f.aim = f.heading; }
    // na een charge eerst een stuk doorrijden voordat hij weer omdraait
    return ride(f, f.cd > f.d.cooldown * .4 ? f.heading : d < C2.min ? at + Math.PI * .6 : at, f.d.speed, dt);
  },
  // Eques te voet: eerst zijn lans gooien (rode cirkel), daarna gewoon met de gladius.
  throwThen(f, dt, ex, ey, d, gap) {
    if (f.thrown) return AI.melee(f, dt, ex, ey, d, gap);
    if (f.state !== 'aimJav') { f.state = 'aimJav'; f.t = f.d.hasta.windup; f.target = { x: TG.x, y: TG.y }; }
    f.t -= dt; f.face = lerpAngle(f.face, Math.atan2(f.target.y - f.y, f.target.x - f.x), 1 - Math.exp(-dt * 8));
    if (f.t <= 0) { throwJav(f, f.target.x, f.target.y, f.d.hasta.dmg); f.thrown = true; f.state = 'recover'; f.t = .4; }
    return [0, 0];
  },
  // Sagittarius: rondjes rijden op afstand en al rijdend schieten.
  sagittarius(f, dt, ex, ey, d, gap) {
    const at = Math.atan2(ey, ex), R = f.d.ranged, side = f.wob > 5 ? 1 : -1;
    const radial = d > f.d.keep + 30 ? .5 : d < f.d.keep - 30 ? -.5 : 0;
    const goal = at + side * (Math.PI / 2 - radial);
    if (f.state === 'windup') {
      f.t -= dt;
      if (f.t <= 0) {
        S.arrows.push({ x: f.x + Math.cos(at) * (f.d.radius + 4), y: f.y + Math.sin(at) * (f.d.radius + 4), vx: Math.cos(at) * R.arrow, vy: Math.sin(at) * R.arrow, t: 0, life: R.life, dmg: f.d.dmg, stuck: 0, side: f.side });
        f.state = 'walk'; f.cd = f.d.cooldown;
      }
    } else if (!TG.dead && f.cd === 0 && d >= R.min && d <= R.max) { f.state = 'windup'; f.t = f.d.windup; }
    f.aimAt = at;
    return ride(f, goal, f.d.speed, dt);
  },
  // Essedarius: rondjes langs de rand (loop), af en toe recht op je af (hunt); gooit werpsperen; overrijdt je.
  essedarius(f, dt, ex, ey, d, gap) {
    const at = Math.atan2(ey, ex), H = f.d.hunt, J = f.d.jav;
    f.huntT = (f.huntT === undefined ? H.every * .5 : f.huntT - dt);
    if (f.huntT < -H.time) f.huntT = H.every;
    f.ramCd2 = Math.max(0, (f.ramCd2 || 0) - dt);
    if (!TG.dead && f.ramCd2 === 0 && gap <= 2) { f.ramCd2 = .8; strike(f); }   // overreden
    if (f.state === 'aimJav') {
      f.t -= dt;
      if (f.t <= 0) { throwJav(f, f.target.x, f.target.y, f.d.dmg); f.state = 'walk'; f.cd = f.d.cooldown; }
    } else if (!TG.dead && f.cd === 0 && d >= J.min && d <= J.max) {
      f.state = 'aimJav'; f.t = f.d.windup;
      let x = TG.x + TG.vx * J.lead, y = TG.y + TG.vy * J.lead; const r = Math.hypot(x / (W.rx - 20), y / (W.ry - 20)); if (r > 1) { x /= r; y /= r; }
      f.target = { x, y };
    }
    let goal;
    if (f.huntT < 0) goal = at;   // recht op je af
    else {
      const th = Math.atan2(f.y / W.ry, f.x / W.rx) + (f.wob > 5 ? 1 : -1) * .7;
      goal = Math.atan2(Math.sin(th) * W.ry * f.d.loop - f.y, Math.cos(th) * W.rx * f.d.loop - f.x);
    }
    return ride(f, goal, f.d.speed, dt);
  },
  // Beer: oplopen, op de achterpoten (rode waaier), brede uithaal. Woest onder rage.at van zijn leven.
  bear(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const at = Math.atan2(ey, ex), R = f.d.rage;
    if (!f.raged && f.hp <= f.d.hp * R.at) { f.raged = true; f.d = { ...f.d, speed: R.speed, windup: R.windup }; SFX.fx('bear'); S.shake = Math.max(S.shake, 4); }
    if (f.state === 'walk') {
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 5));
      if (gap > f.d.reach * .5) { mx = Math.cos(f.face) * f.d.speed; my = Math.sin(f.face) * f.d.speed; }
      if (!TG.dead && gap <= f.d.reach && f.cd === 0) { f.state = 'windup'; f.t = f.d.windup; f.aim = at; }
    } else if (f.state === 'windup') {   // op de achterpoten: de richting ligt vast
      f.t -= dt; f.face = f.aim;
      if (f.t <= 0) {
        f.lunge = 1; f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown;
        const off = Math.abs(((at - f.aim + Math.PI * 3) % TAU2) - Math.PI);
        if (gap <= f.d.reach + f.d.lunge && off <= f.d.swipe.arc + .2) { if (Math.random() < blockOf(TG)) blocked(TG, f); else strike(f); }
      }
    } else if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; }
    return [mx, my];
  },
  // Olifant: sjokken, slurf als je dichtbij bent, stormloop als je verder weg bent. Tegen de muur: verdoofd.
  elephant(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const at = Math.atan2(ey, ex), T = f.d.trunk, St = f.d.stampede;
    f.runCd = (f.runCd === undefined ? St.cd * .4 : Math.max(0, f.runCd - dt));
    if (f.state === 'stunned') { f.t -= dt; if (f.t <= 0) { f.state = 'walk'; f.runCd = St.cd; } return [0, 0]; }
    if (f.state === 'aim') { f.t -= dt; f.face = f.aim; if (f.t <= 0) { f.state = 'run'; f.t = St.time; f.hitP = false; f.hitFoes = new Set(); SFX.fx('elephant'); SFX.cheer(.8); } return [0, 0]; }
    if (f.state === 'run') {
      f.t -= dt; mx = Math.cos(f.aim) * St.speed; my = Math.sin(f.aim) * St.speed;
      if (!f.hitP && gap <= 2) { f.hitP = true; strike(f); }
      for (const o of S.foes) {   // vertrapt ook andere vijanden
        if (o === f || o.state === 'dead' || f.hitFoes.has(o)) continue;
        if (Math.hypot(o.x - f.x, o.y - f.y) <= f.d.radius + o.d.radius) {
          f.hitFoes.add(o); o.vx += Math.cos(f.aim) * 260; o.vy += Math.sin(f.aim) * 260;
          hitFoe(o, St.trample, f, true); S.trampled++; checkWin();   // doel 'trample'
        }
      }
      const nx = f.x + mx * dt, ny = f.y + my * dt, rr = Math.hypot(nx / (W.rx - f.d.radius - 4), ny / (W.ry - f.d.radius - 4));
      if (rr >= 1) { f.state = 'stunned'; f.t = f.d.stun; S.shake = Math.max(S.shake, 8); arenaCheer(); SFX.cheer(1); SFX.fx('crash'); return [0, 0]; }   // boem, tegen de muur
      if (f.t <= 0) { f.state = 'walk'; f.runCd = St.cd; }
      return [mx, my];
    }
    if (f.state === 'windup') {   // slurf
      f.t -= dt; f.face = f.aim;
      if (f.t <= 0) {
        f.lunge = 1; f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown;
        const off = Math.abs(((at - f.aim + Math.PI * 3) % TAU2) - Math.PI);
        if (gap <= f.d.reach + f.d.lunge && off <= T.arc + .2) strike({ ...f, d: { ...f.d, dmg: T.dmg, knock: T.knock } });
      }
      return [0, 0];
    }
    if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; return [0, 0]; }
    f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 2.5));
    if (gap > f.d.reach * .6) { mx = Math.cos(f.face) * f.d.speed; my = Math.sin(f.face) * f.d.speed; }
    if (!TG.dead && f.runCd === 0 && d >= St.min) { f.state = 'aim'; f.t = St.windup; f.aim = at; return [0, 0]; }
    if (!TG.dead && gap <= f.d.reach && f.cd === 0) { f.state = 'windup'; f.t = f.d.windup; f.aim = at; }
    return [mx, my];
  },
  // Dimachaerus: oplopen, aanzetten, dan 'combo' klappen kort na elkaar.
  dimachaerus(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const at = Math.atan2(ey, ex);
    if (f.state === 'walk') {
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 9));
      if (gap > f.d.reach * .6) { mx = Math.cos(f.face) * f.d.speed; my = Math.sin(f.face) * f.d.speed; }
      if (!TG.dead && gap <= f.d.reach + 4 && f.cd === 0) { f.state = 'windup'; f.t = f.d.windup; }
    } else if (f.state === 'windup') {
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 5)); f.t -= dt;
      if (f.t <= 0) { f.state = 'combo'; f.combo = f.d.combo; f.t = 0; }
    } else if (f.state === 'combo') {   // klap, klap, klap: telkens een stapje naar voren
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 6)); f.t -= dt;
      mx = Math.cos(f.face) * f.d.speed * .5; my = Math.sin(f.face) * f.d.speed * .5;
      if (f.t <= 0) {
        f.lunge = 1; f.side = -(f.side || 1); f.combo--; f.t = f.d.gap;
        if (gap <= f.d.reach + f.d.lunge && Math.random() < hitChance(f.d.attack)) { if (Math.random() < blockOf(TG)) blocked(TG, f); else strike(f); }
        if (f.combo <= 0) { f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown; }
      }
    } else if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; }
    return [mx, my];
  },
  // Leeuw: sluipen in een cirkel, brullen (vertraagt je), springen als je met een ander bezig bent.
  lion(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const at = Math.atan2(ey, ex), R = f.d.roar, J = f.d.pounce;
    f.roarCd = (f.roarCd === undefined ? 2 + Math.random() * 2 : Math.max(0, f.roarCd - dt));
    f.jumpCd = (f.jumpCd === undefined ? J.cd * .6 : Math.max(0, f.jumpCd - dt));
    if (f.state === 'roar') {
      f.t -= dt; f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 6));
      if (f.t <= 0) {
        f.state = 'recover'; f.t = .4; f.roarCd = R.cd; f.roared = .5; SFX.fx('lion'); S.shake = Math.max(S.shake, 3);
        if (!TG.dead && d <= R.radius) { TG.slow = f.d.slow.time; TG.slowMul = f.d.slow.mul; }
      }
      return [0, 0];
    }
    if (f.state === 'windup') { f.t -= dt; f.face = f.aim; if (f.t <= 0) { f.state = 'dash'; f.t = J.time; f.hitP = false; } return [0, 0]; }
    if (f.state === 'dash') {
      f.t -= dt; mx = Math.cos(f.aim) * J.speed; my = Math.sin(f.aim) * J.speed;
      if (!f.hitP && gap <= 2) { f.hitP = true; strike(f); }
      if (f.t <= 0) { f.state = 'recover'; f.t = f.d.recover; f.jumpCd = J.cd; }
      return [mx, my];
    }
    if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; return [0, 0]; }
    // sluipen: op afstand eromheen draaien
    f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 5));
    const side = f.wob > 5 ? 1 : -1, radial = d > f.d.orbit + 12 ? 1 : d < f.d.orbit - 12 ? -.7 : 0;
    mx = (ex / d * radial - ey / d * side * .75) * f.d.speed; my = (ey / d * radial + ex / d * side * .75) * f.d.speed;
    const busy = TG.target && TG.target !== f && TG.target.state !== 'dead' && TG.cd > 0;   // jij slaat een ander
    if (!TG.dead && f.roarCd === 0 && d <= R.radius * 1.2) { f.state = 'roar'; f.t = R.windup; return [0, 0]; }
    if (!TG.dead && d <= J.range && (f.jumpCd === 0 || (busy && f.jumpCd < J.cd - J.busy))) { f.state = 'windup'; f.t = f.d.windup; f.aim = at; return [0, 0]; }
    return [mx, my];
  },
  // Hyena: XP-bolletjes eten als die er liggen, anders bijten en wegrennen; ben jij zwak of gevangen, dan doorbijten.
  hyena(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const at = Math.atan2(ey, ex), frenzy = TG.netted > 0 || TG.hp <= maxHp(TG) * f.d.weak;
    if (f.state === 'windup') {
      f.t -= dt; f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 8));
      if (f.t <= 0) { f.lunge = 1; f.cd = frenzy ? f.d.cooldown * .5 : f.d.cooldown; if (gap <= f.d.reach + f.d.lunge) strike(f); f.state = frenzy ? 'recover' : 'flee'; f.t = frenzy ? f.d.recover : f.d.flee; }
      return [0, 0];
    }
    if (f.state === 'flee') { f.t -= dt; f.face = lerpAngle(f.face, at + Math.PI, 1 - Math.exp(-dt * 8)); mx = -ex / d * f.d.speed; my = -ey / d * f.d.speed; if (f.t <= 0) f.state = 'walk'; return [mx, my]; }
    if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; return [0, 0]; }
    // een bolletje in de buurt? Opeten (behalve als ze bloed ruiken).
    let orb = null, od = f.d.smell;
    if (!frenzy) for (const o of S.orbs) if (o.state === 'free') { const q = Math.hypot(o.x - f.x, o.y - f.y); if (q < od) { od = q; orb = o; } }
    if (orb) {
      const a = Math.atan2(orb.y - f.y, orb.x - f.x); f.face = lerpAngle(f.face, a, 1 - Math.exp(-dt * 10));
      mx = Math.cos(a) * f.d.speed; my = Math.sin(a) * f.d.speed;
      if (od < f.d.radius) { orb.state = 'gone'; f.chew = .4; SFX.fx('hyena'); }
      return [mx, my];
    }
    f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 10));
    if (gap > f.d.reach * .6) { const wob = Math.sin(performance.now() / 250 + f.wob) * .5; mx = Math.cos(f.face + wob) * f.d.speed; my = Math.sin(f.face + wob) * f.d.speed; }
    if (!TG.dead && gap <= f.d.reach && f.cd === 0) { f.state = 'windup'; f.t = f.d.windup; }
    return [mx, my];
  },
  // Bestiarius (escort): bij jou in de buurt blijven, terugdeinzen voor een dier dat te dichtbij komt, prikken als het binnen bereik is.
  bestiarius(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const at = Math.atan2(ey, ex);
    if (f.state === 'windup') {
      f.t -= dt; f.face = f.aim;
      if (f.t <= 0) { f.lunge = 1; f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown; if (gap <= f.d.reach + f.d.lunge) strike(f); }
      return [0, 0];
    }
    if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; }
    if (f.state === 'walk' && !TG.dead && gap <= f.d.reach && f.cd === 0) { f.state = 'windup'; f.t = f.d.windup; f.aim = at; return [0, 0]; }
    const px = P.x - f.x, py = P.y - f.y, pd = Math.hypot(px, py) || 1;
    if (!P.dead && pd > f.d.keep) { mx += px / pd; my += py / pd; }               // naar jou toe
    if (gap < f.d.fear) { const k = 1.4 * (1 - gap / f.d.fear); mx -= ex / d * k; my -= ey / d * k; }   // weg van het dier
    const l = Math.hypot(mx, my);
    if (l > .15) { mx = mx / l * f.d.speed; my = my / l * f.d.speed; } else { mx = 0; my = 0; }
    f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 6));
    return [mx, my];
  },
  // Hoplomachus: op speerafstand blijven, richten (rode lijn) en stoten. Te dichtbij: schild-ram of achteruit.
  hoplomachus(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const at = Math.atan2(ey, ex), R = f.d.ram;
    f.ramCd = Math.max(0, (f.ramCd || 0) - dt);
    if (f.state === 'walk') {
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 7));
      if (!TG.dead && gap < R.near && f.ramCd === 0) { f.state = 'ram'; f.t = R.time; f.aim = at; f.hitP = false; return [0, 0]; }
      const want = f.d.reach * .8;
      if (gap > want + 4) { mx = Math.cos(f.face) * f.d.speed; my = Math.sin(f.face) * f.d.speed; }
      else if (gap < want - 8) { mx = -ex / d * f.d.speed * .8; my = -ey / d * f.d.speed * .8; }   // achteruit naar speerafstand
      if (!TG.dead && f.cd === 0 && gap <= f.d.reach) { f.state = 'windup'; f.t = f.d.windup; f.aim = at; }
    } else if (f.state === 'windup') {   // richten: de richting ligt vast
      f.t -= dt; f.face = f.aim;
      if (f.t <= 0) { f.state = 'thrust'; f.t = .14; f.lunge = 1; }
    } else if (f.state === 'thrust') {
      f.t -= dt; f.face = f.aim;
      if (f.t <= 0) {
        f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown;
        const along = ex * Math.cos(f.aim) + ey * Math.sin(f.aim), side = Math.abs(-ex * Math.sin(f.aim) + ey * Math.cos(f.aim));
        if (along > 0 && along <= f.d.reach + f.d.radius + rad(TG) + f.d.lunge && side <= rad(TG) + f.d.width) {
          if (Math.random() >= hitChance(f.d.attack)) { /* mis */ } else if (Math.random() < blockOf(TG)) blocked(TG, f); else strike(f);
        }
      }
    } else if (f.state === 'ram') {   // schild-ram: korte stoot naar voren, duwt je terug naar speerafstand
      f.t -= dt; mx = Math.cos(f.aim) * 240; my = Math.sin(f.aim) * 240;
      if (!f.hitP && gap <= 3) { f.hitP = true; TG.vx += Math.cos(f.aim) * R.push * knockOf(TG); TG.vy += Math.sin(f.aim) * R.push * knockOf(TG); S.shake = Math.max(S.shake, 2.5); SFX.block(); }
      if (f.t <= 0) { f.state = 'walk'; f.ramCd = R.cd; }
    } else if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; }
    return [mx, my];
  }
};

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

  updateCalls(dt);
  P.slow = Math.max(0, (P.slow || 0) - dt);
  P.roll = Math.max(0, (P.roll || 0) - dt); P.rollInv = Math.max(0, (P.rollInv || 0) - dt); P.rollCd = Math.max(0, (P.rollCd || 0) - dt);
  if (P.netted > 0) { P.netted -= dt; if (P.netted <= 0) releaseNet(); }
  // Speler: sturen met toetsen of slepen.
  let dx = 0, dy = 0, tx = 0, ty = 0;
  if (!P.dead) {
    if (keys.has('ArrowLeft') || keys.has('a')) dx--;
    if (keys.has('ArrowRight') || keys.has('d')) dx++;
    if (keys.has('ArrowUp') || keys.has('w')) dy--;
    if (keys.has('ArrowDown') || keys.has('s')) dy++;
    if (dx || dy) { const l = Math.hypot(dx, dy); tx = dx / l * me.speed; ty = dy / l * me.speed; steer.active = false; }
    else if ((typeof PAD !== 'undefined' && PAD.active) && PAD.move) { tx = PAD.move[0] * me.speed; ty = PAD.move[1] * me.speed; steer.active = false; }   // linkerstick: hoe verder, hoe sneller
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
    const top = CHARIOT.speed * (me.mount.mountSpeed || 1) + STAT_RULES.speed * S.stats.agility;   // quadriga: sneller
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
  if (P.roll > 0) { const rs = ROLL.speed * (1 + ROLL.speedAgi * S.stats.agility); tx = Math.cos(P.rollDir) * rs; ty = Math.sin(P.rollDir) * rs; k = 1; }   // rollen (Behendigheid: sneller)
  if (P.netted > 0) { tx = 0; ty = 0; k = 1 - Math.exp(-dt * 20); }                                          // in het net: vast
  P.vx += (tx - P.vx) * k; P.vy += (ty - P.vy) * k;
  P.x += P.vx * dt; P.y += P.vy * dt;
  P.walk = ((P.walk || 0) + Math.hypot(P.vx, P.vy) * dt * .16) % TAU2;   // stappen
  contain(P, W.rx - PLAYER.radius - 4, W.ry - PLAYER.radius - 4);
  updateCam(dt);
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
    if (S.intro <= 0) { S.shout = INTRO.shout; arenaCheer(); SFX.cheer(.6); SFX.mood('fight'); flyGoal(); }
    for (const f of S.foes) f.face = lerpAngle(f.face, Math.atan2(P.y - f.y, P.x - f.x), 1 - Math.exp(-dt * 6));
    return;
  }
  S.shout = Math.max(0, S.shout - dt);
  if (S.hintT > 0) { S.hintT -= dt; if (S.hintT <= 0) { $('hint').classList.add('gone'); setTimeout(() => { if (!(S.hintT > 0)) { $('hint').hidden = true; $('hint').classList.remove('hurt-hint'); } }, 600); } }   // uitleg vervaagt
  S.roundT = (S.roundT || 0) + dt; checkExtra(); S.gate = Math.max(0, (S.gate || 0) - dt);
  updateNets(dt); updateJavs(dt); updateArena(dt); updateBread(dt);
  if (!S.over && !(S.collect > 0)) {   // klok voor doelen; in de cirkel staan (hold)
    S.goalT += dt;
    const g = S.cfg && S.cfg.goal;
    if (g && g.kind === 'hold' && !P.dead && Math.hypot(P.x, P.y) <= g.radius) S.holdT += dt;
    checkWin();
  }
  const gt = goalText(); if (gt !== S.goalShown) { S.goalShown = gt; const el = $('goalText'); el.textContent = gt; el.hidden = !gt; }
  // Automatisch slaan: de dichtstbijzijnde levende tegenstander binnen bereik.
  P.block = Math.max(0, (P.block || 0) - dt);
  if (P.bleed && !P.dead && !S.over) {   // bloeden: elke seconde schade, tot de tijd op is of je de Thraciër raakt
    P.bleed.t -= dt; P.bleed.tick -= dt;
    if (P.bleed.tick <= 0) {
      P.bleed.tick += 1; P.hp = Math.max(S.god ? 1 : 0, P.hp - P.bleed.dmg); float(P.x, P.y - 20, '−' + fmt(P.bleed.dmg), C.blood); updateUI();
      if (P.hp <= 0) { P.dead = true; endFight(false); }
    }
    if (P.bleed && P.bleed.t <= 0) P.bleed = null;
  }
  P.cd = Math.max(0, P.cd - dt); P.swing = Math.max(0, P.swing - dt); P.hurt = Math.max(0, P.hurt - dt); P.flash = Math.max(0, P.flash - dt);
  P.atkBuf = Math.max(0, (P.atkBuf || 0) - dt); P.riposte = Math.max(0, (P.riposte || 0) - dt);
  updateGuard(dt);
  let best = null, bd = Infinity;
  for (const f of S.foes) if (targetable(f) && hostile(P, f)) { const d = Math.hypot(f.x - P.x, f.y - P.y); if (d < bd) { bd = d; best = f; } }
  P.target = best;
  const bow = w.kind === 'bow';
  const inReach = !bow && best && bd - best.d.radius - PLAYER.radius <= w.reach;
  const inRange = bow && best && bd <= w.range;
  // Kijkrichting. Blok je (schild omhoog of parade), dan draai je vanzelf naar de dichtstbijzijnde tegenstander (muis, toetsen en controller).
  // Anders: rechterstick, of je muis; zonder muis naar wie binnen bereik staat, anders waar je heen loopt.
  const guardFace = (P.guard || P.parryT > 0) && !P.dead && best && bd - best.d.radius - PLAYER.radius <= 60;
  if (guardFace) P.face = lerpAngle(P.face, Math.atan2(best.y - P.y, best.x - P.x), 1 - Math.exp(-dt * 14));
  else if ((typeof PAD !== 'undefined' && PAD.active) && PAD.aim !== null && !P.dead && !(P.netted > 0)) P.face = lerpAngle(P.face, PAD.aim, 1 - Math.exp(-dt * 30));   // rechterstick
  else if (steer.mouse && !(typeof PAD !== 'undefined' && PAD.active) && !P.dead && !(P.netted > 0)) P.face = lerpAngle(P.face, Math.atan2(steer.hy - P.y, steer.hx - P.x), 1 - Math.exp(-dt * 30));
  else if (inReach || inRange) P.face = lerpAngle(P.face, Math.atan2(best.y - P.y, best.x - P.x), 1 - Math.exp(-dt * 20));
  else if (sp > 20) P.face = lerpAngle(P.face, Math.atan2(P.vy, P.vx), 1 - Math.exp(-dt * 12));
  P.punch = Math.max(0, (P.punch || 0) - dt); P.noAmmo = Math.max(0, (P.noAmmo || 0) - dt);
  // Zelf slaan: alleen als je drukt (P.atkBuf), en niet tijdens wisselen, rollen, in het net, achter je schild of na een gemiste parade.
  const busy = S.switching > 0 || P.roll > 0 || P.netted > 0 || P.guard || P.parryLock > 0 || P.parryT > 0 || P.dead;
  if (P.atkBuf > 0 && P.guard && me.shield && !(P.bashCd > 0) && !P.dead) { P.atkBuf = 0; shieldBash(); }   // slaan achter je schild: schildstoot
  if (P.atkBuf > 0 && P.cd === 0 && !busy) {
    P.atkBuf = 0;
    // Richting: met de muis naar je muis, anders naar wie het dichtst bij staat (binnen bereik), anders recht vooruit.
    const aimMouse = steer.mouse && !(typeof PAD !== 'undefined' && PAD.active);
    const aim = aimMouse ? Math.atan2(steer.hy - P.y, steer.hx - P.x) : (inReach || inRange) ? Math.atan2(best.y - P.y, best.x - P.x) : P.face;
    P.face = aim;
    if (bow) shoot(w, aim, aimMouse ? null : inRange ? best : null);
    else swingMelee(w, aim);
  }

  // Tegenstanders: aanlopen, aanzetten, uithalen, herstellen.
  for (const f of S.foes) {
    f.flash = Math.max(0, f.flash - dt); f.lunge = Math.max(0, f.lunge - dt * 5); f.block = Math.max(0, (f.block || 0) - dt);
    const fr = Math.exp(-dt * 7); f.vx *= fr; f.vy *= fr;   // knockback dooft uit
    if (f.state === 'dead') { if (!f.captured) f.dead = Math.max(0, f.dead - dt * .35); f.x += f.vx * dt; f.y += f.vy * dt; continue; }
    f.slow = Math.max(0, (f.slow || 0) - dt); f.hurt = Math.max(0, (f.hurt || 0) - dt);
    if (f.netted > 0 || f.state === 'yield') {   // in een net (spartelt) of overgegeven: niets doen
      if (f.netted > 0) { f.netted -= dt; f.wob += dt * 20; if (f.netted <= 0) freeFoe(f); }
      f.x += f.vx * dt; f.y += f.vy * dt; contain(f, W.rx - f.d.radius - 4, W.ry - f.d.radius - 4); continue;
    }
    // Doelwit: de dichtstbijzijnde van een andere kant (meestal jij). Elke halve seconde opnieuw kijken.
    f.tgT = (f.tgT || 0) - dt;
    if (f.tgT <= 0 || !liveTarget(f.tg)) { f.tg = pickTarget(f); f.tgT = .5; }
    TG = f.tg;
    if (!TG) {   // niemand om aan te vallen: maten lopen met je mee, de rest wacht
      let mx = 0, my = 0;
      if (f.side === 'hero' && !P.dead) { const px = P.x - f.x, py = P.y - f.y, pd = Math.hypot(px, py) || 1; if (pd > 45) { mx = px / pd * f.d.speed * .8; my = py / pd * f.d.speed * .8; f.face = lerpAngle(f.face, Math.atan2(py, px), 1 - Math.exp(-dt * 6)); } }
      if (f.state !== 'walk' && f.state !== 'stagger') f.state = 'walk';
      f.cd = Math.max(0, f.cd - dt); f.x += (mx + f.vx) * dt; f.y += (my + f.vy) * dt; contain(f, W.rx - f.d.radius - 4, W.ry - f.d.radius - 4); TG = P; continue;
    }
    const ex = TG.x - f.x, ey = TG.y - f.y, d = Math.hypot(ex, ey) || 1, gap = d - f.d.radius - rad(TG);
    f.cd = Math.max(0, f.cd - dt);
    f.parryCd = Math.max(0, (f.parryCd || 0) - dt); f.parried = Math.max(0, (f.parried || 0) - dt); f.roared = Math.max(0, (f.roared || 0) - dt); f.chew = Math.max(0, (f.chew || 0) - dt);
    if (f.state === 'stagger') {   // wankelen (kapot schild, gebroken speer): niets doen
      f.t -= dt; if (f.t <= 0) { f.state = 'recover'; f.t = .3; }
      f.x += f.vx * dt; f.y += f.vy * dt; contain(f, W.rx - f.d.radius - 4, W.ry - f.d.radius - 4); continue;
    }
    if (S.cfg && (S.cfg.type === 'ffa' || S.cfg.type === 'team') && f.state === 'walk' && !f.d.animal && !f.mount && f.side !== 'hero' && goForBread(f, dt)) continue;   // ieder voor zich: brood!
    const ai = AI[f.d.ai || (f.d.dash ? 'dash' : f.d.ranged ? 'ranged' : 'melee')];
    const [mx, my] = ai(f, dt, ex, ey, d, gap), sl = f.slow > 0 ? f.slowMul || .5 : 1;   // brul van de leeuw: trager
    f.x += (mx * sl + f.vx) * dt; f.y += (my * sl + f.vy) * dt;
    contain(f, W.rx - f.d.radius - 4, W.ry - f.d.radius - 4);
  }
  TG = P;
  // Drukte remt: tel het voetvolk dat tegen je aan staat
  let touching = 0;
  for (const f of S.foes) if (f.d.swarm && targetable(f) && hostile(f, P) && Math.hypot(f.x - P.x, f.y - P.y) <= f.d.radius + PLAYER.radius + CROWDED.touch) touching++;
  P.crowdMul = Math.max(CROWDED.min, 1 - CROWDED.per * touching); P.crowded = touching;
  // Strijdwagen: wie je met vaart raakt, gaat omver.
  if (me.riding && !P.dead && S.intro <= 0) {
    const spd = Math.hypot(P.vx, P.vy);
    for (const f of S.foes) {
      f.ramCd = Math.max(0, (f.ramCd || 0) - dt);
      if (!targetable(f) || !hostile(P, f) || f.ramCd > 0 || spd < CHARIOT.ramSpeed) continue;
      // de paarden lopen voorop: geraakt wordt wie bij de paarden of de wagen staat
      const hx = P.x + Math.cos(P.heading) * CHARIOT.reach, hy = P.y + Math.sin(P.heading) * CHARIOT.reach;
      const near = Math.min(Math.hypot(f.x - hx, f.y - hy) - 14, Math.hypot(f.x - P.x, f.y - P.y) - PLAYER.radius - 6) - f.d.radius;
      if (near > 0) continue;
      const ex = f.x - P.x, ey = f.y - P.y, d = Math.hypot(ex, ey) || 1;
      f.ramCd = CHARIOT.ramCd; f.vx += ex / d * CHARIOT.ramPush; f.vy += ey / d * CHARIOT.ramPush;
      if (f.state === 'windup') { f.state = 'recover'; f.t = f.d.recover; }   // omvergereden: zijn klap gaat niet door
      hitFoe(f, CHARIOT.ram * (me.mount.ramMul || 1), P, true);
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
      const f = S.foes.find(f => targetable(f) && hostile(P, f) && Math.hypot(a.x - f.x, a.y - f.y) < f.d.radius + 2);
      if (f) { hitFoe(f, a.dmg, { x: a.x - a.vx * .05, y: a.y - a.vy * .05 }); a.stuck = -1; continue; }
    } else {
      const from = { x: a.x - a.vx * .05, y: a.y - a.vy * .05, d: { dmg: a.dmg }, arrow: true };
      if (!P.dead && P.hurt <= 0 && (a.side || 'foe') !== P.side && Math.hypot(a.x - P.x, a.y - P.y) < PLAYER.radius + 2) { hitPlayer(from); a.stuck = -1; continue; }
      const o = S.foes.find(o => targetable(o) && o.side !== (a.side || 'foe') && Math.hypot(a.x - o.x, a.y - o.y) < o.d.radius + 2);
      if (o) { hitUnit(o, from); a.stuck = -1; continue; }
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
  for (const f of S.floats) {
    f.t -= dt * .9;
    if (f.follow) { f.dy -= dt * 14; f.x = P.x + f.dx; f.y = P.y + f.dy; } else f.y -= dt * 30;
  }
  S.floats = S.floats.filter(f => f.t > 0);
  for (const p of S.dust) p.t -= dt * (p.chip ? .5 : 2);
  S.dust = S.dust.filter(p => p.t > 0);
}

/* ---------- Tekenen ---------- */
function draw(now) {
  const { cw, ch, dpr, scale } = view;
  if (S.emptyArena ? AR.dirtyEmpty !== false : AR.dirty) buildArena(!!S.emptyArena);   // keuzescherm: lege tribunes
  if (S.emptyArena) {   // keuzescherm: de camera dwaalt langzaam over de lege arena, met de keizersloge in beeld
    const mx = Math.max(0, (view.bw - cw) / 2 / scale), my = Math.max(0, (view.bh - ch) / 2 / scale);
    cam.x = Math.sin(now / 9000) * mx; cam.y = -my * .55 + Math.sin(now / 13000) * my * .35;
  }
  // Camera: het stadion schuift mee; op hele pixels, zodat het niet trilt.
  const ox = Math.round((cw / 2 - cam.x * scale) * dpr) / dpr, oy = Math.round((ch / 2 - cam.y * scale) * dpr) / dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = C.night; ctx.fillRect(0, 0, cvs.width, cvs.height);
  ctx.drawImage(S.emptyArena ? AR.bgEmpty : AR.bg, Math.round((ox - view.bw / 2) * dpr), Math.round((oy - view.bh / 2) * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = (Math.random() - .5) * S.shake, sy = (Math.random() - .5) * S.shake;
  ctx.save(); ctx.translate(ox + sx, oy + sy); ctx.scale(scale, scale);
  drawArenaLive(ctx, now, !!S.emptyArena);
  if (S.emptyArena) { ctx.restore(); return; }   // keuzescherm: alleen het stadion en het publiek

  if (steer.active && !P.dead) {
    ctx.strokeStyle = C.porphyry; ctx.lineWidth = 2; ctx.globalAlpha = .5;
    ctx.beginPath(); ctx.arc(steer.x, steer.y, 8 + Math.sin(now / 150) * 2, 0, TAU2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  for (const p of S.dust) {
    if (p.chip) { ctx.fillStyle = p.color || '#6e2a22'; ctx.globalAlpha = Math.min(1, p.t); ctx.fillRect(p.x - 2, p.y - 1, 4, 2.5); continue; }   // stukken van een kapot schild
    ctx.fillStyle = C['sand-2']; ctx.globalAlpha = p.t * .45; ctx.beginPath(); ctx.arc(p.x, p.y, 3 + (1 - p.t) * 5, 0, TAU2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  const ents = [...S.foes].sort((a, b) => (a.state === 'dead' ? -1 : 0) - (b.state === 'dead' ? -1 : 0));
  drawHatches(now);
  const g = S.cfg && S.cfg.goal;
  if (g && g.kind === 'hold') {   // de cirkel in het midden: goud gestippeld, voller als je erin staat
    const inside = Math.hypot(P.x, P.y) <= g.radius;
    ctx.fillStyle = `rgba(226,179,94,${inside ? .2 : .08})`; ctx.beginPath(); ctx.arc(0, 0, g.radius, 0, TAU2); ctx.fill();
    ctx.strokeStyle = `rgba(226,179,94,${inside ? .9 : .55})`; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]); ctx.lineDashOffset = -now / 60;
    ctx.beginPath(); ctx.arc(0, 0, g.radius, 0, TAU2); ctx.stroke(); ctx.setLineDash([]);
    const k = Math.min(1, S.holdT / g.time); ctx.lineWidth = 4; ctx.strokeStyle = C.coin;
    ctx.beginPath(); ctx.arc(0, 0, g.radius + 5, -Math.PI / 2, -Math.PI / 2 + TAU2 * k); ctx.stroke();
  }
  for (const f of S.foes) if (f.side === 'hero' && f.state !== 'dead') {   // jouw kant: groen ringetje om de voeten
    ctx.strokeStyle = 'rgba(166,200,90,.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(f.x, f.y + 2, f.d.radius + 4, (f.d.radius + 4) * .8, 0, 0, TAU2); ctx.stroke();
  }
  drawWrecks();
  drawOrbs(now);
  drawBread(now);
  for (const f of ents) {
    if (f.state === 'yield') ctx.globalAlpha = .6;   // overgegeven
    drawFoe(f, now); ctx.globalAlpha = 1;
    if (f.state === 'stagger' && f.d.animal) {   // dier wankelt: witte rand (kwetsbaar)
      ctx.strokeStyle = `rgba(255,255,255,${.55 + .25 * Math.sin(now / 60)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(f.x, f.y, f.d.radius + 6, 0, TAU2); ctx.stroke();
    }
  }
  drawJavs();
  drawArrows();
  drawPlayer(now);
  drawNets(now);
  if (P.rollCd > 0 && !P.dead) {   // rol laadt op: dunne ring om je voeten
    const k = 1 - P.rollCd / Math.max(ROLL.cdMin, ROLL.cd - ROLL.cdAgi * S.stats.agility);
    ctx.strokeStyle = 'rgba(245,234,214,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P.x, P.y, PLAYER.radius + 3, -Math.PI / 2, -Math.PI / 2 + k * TAU2); ctx.stroke();
  }
  if (P.slow > 0 && !P.dead) {   // vertraagd door de brul: twee golflijntjes boven je hoofd
    ctx.strokeStyle = 'rgba(245,234,214,.8)'; ctx.lineWidth = 1.5;
    for (const dy of [0, 4]) { ctx.beginPath(); ctx.moveTo(P.x - 7, P.y - 27 - dy); ctx.quadraticCurveTo(P.x - 3, P.y - 30 - dy, P.x, P.y - 27 - dy); ctx.quadraticCurveTo(P.x + 3, P.y - 24 - dy, P.x + 7, P.y - 27 - dy); ctx.stroke(); }
  }
  if (P.bleed && !P.dead) {   // bloeden: drie rode druppels boven je hoofd
    ctx.fillStyle = C.blood;
    for (let i = 0; i < 3; i++) { const x = P.x - 6 + i * 6, y = P.y - 22 + ((now / 300 + i * .33) % 1) * 4; ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.quadraticCurveTo(x + 2.4, y + 1, x, y + 2); ctx.quadraticCurveTo(x - 2.4, y + 1, x, y - 3); ctx.fill(); }
  }
  for (const o of [P, ...S.foes]) if (o.block > 0) {   // blok: bronzen boog aan de kant van de aanvaller
    ctx.strokeStyle = `rgba(226,179,94,${o.block / .3})`; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(o.x, o.y, 15, o.blockA - .7, o.blockA + .7); ctx.stroke(); ctx.lineCap = 'butt';
  }
  drawOffscreen(view.cw, view.ch, scale);
  for (const f of S.foes) if (f.state !== 'dead' && f.state !== 'yield' && (f.hp < f.d.hp || f.d.ai === 'bestiarius')) drawBar(f.x, f.y - f.d.radius - 10, f.hp / f.d.hp);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of S.floats) {
    const fs = f.size || 11;   // schadecijfers: 11 (was 16)
    ctx.globalAlpha = Math.min(1, f.t * 1.5); ctx.font = `700 ${fs}px Cinzel, Georgia, serif`;
    if (f.follow) ctx.textAlign = 'left';
    ctx.lineWidth = Math.max(2.5, fs * .26); ctx.strokeStyle = C.night; ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    ctx.textAlign = 'center';
  }
  ctx.globalAlpha = 1;
  if (S.intro > 0 || S.shout > 0) {   // III, II, I, Pugnate!
    const txt = S.intro > 0 ? toRoman(Math.ceil(S.intro / INTRO.step)) : 'Pugnate!';
    const f = S.intro > 0 ? (S.intro / INTRO.step) % 1 : S.shout / INTRO.shout, k = 1 + .3 * f * f;
    ctx.save(); ctx.translate(cam.x, cam.y + ch / 2 / scale * .22); ctx.scale(k, k);   // onder het doel in het midden
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
    // knipperen: helemaal aan en uit, steeds sneller
    ctx.globalAlpha = fade < 1 ? (Math.sin(now / (35 + 110 * fade)) > 0 ? .25 + .75 * fade : .08) : 1;
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
  if (opts.feet !== undefined && opts.stride) ctx.translate(0, Math.sin(opts.feet * 2) * .5 * opts.stride);   // wiegen bij het lopen
  const fl = opts.flash > 0;
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)';
  if (opts.feet !== undefined) {   // sandalen: stappen om en om als je loopt
    const st = Math.sin(opts.feet) * r * .85 * (opts.stride ?? 1);
    for (const side of [-1, 1]) {
      ctx.fillStyle = fl ? '#fff' : '#6b4526'; ctx.beginPath(); ctx.ellipse(side * st, side * r * .32, r * .36, r * .2, 0, 0, TAU2); ctx.fill(); ctx.stroke();
    }
  }
  if (opts.quiver) {   // pijlkoker op de rug, veren steken uit
    ctx.fillStyle = fl ? '#fff' : '#5a3a26'; ctx.beginPath(); ctx.roundRect(-r * 1.05, -r * .55, r * .5, r * .9, 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#8e1f1a'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-r * 1.05, -r * .4 + i * r * .28); ctx.lineTo(-r * 1.35, -r * .5 + i * r * .28); ctx.stroke(); }
    ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)';
  }
  // armen (handen) links en rechts voor de schouders
  for (const side of [-1, 1]) {
    const reach = side === 1 ? (opts.armR ?? 0) : (opts.armL ?? 0);
    ctx.fillStyle = fl ? '#fff' : skin; ctx.beginPath(); ctx.arc(r * .35 + reach, side * r * .78, r * .3, 0, TAU2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = fl ? '#fff' : tunic; ctx.beginPath(); ctx.ellipse(0, 0, r * .62, r, 0, 0, TAU2); ctx.fill(); ctx.stroke();
  if (opts.armor === 'leather' && !fl) {   // leren harnas: schouderstukken en riemen
    ctx.fillStyle = '#5e3c22';
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(-r * .05, side * r * .72, r * .34, r * .26, 0, 0, TAU2); ctx.fill(); ctx.stroke(); }
    ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 1.2;
    for (const y of [-.45, 0, .45]) { ctx.beginPath(); ctx.moveTo(-r * .5, y * r); ctx.lineTo(r * .45, y * r); ctx.stroke(); }
    ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)';
  }
  if (opts.armor === 'lorica' && !fl) {   // lorica segmentata: ijzeren banden over de schouders
    ctx.strokeStyle = '#5c5a62'; ctx.lineWidth = 2;
    for (const k of [-.55, -.18, .18, .55]) { ctx.beginPath(); ctx.ellipse(0, 0, r * .62, r * Math.abs(k) + r * .2, 0, k < 0 ? Math.PI : 0, k < 0 ? TAU2 : Math.PI); ctx.stroke(); }
    ctx.fillStyle = '#b8b2a6';
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(-r * .05, side * r * .74, r * .36, r * .28, 0, 0, TAU2); ctx.fill(); ctx.stroke(); }
    ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)';
  }
  if (opts.belt) { ctx.strokeStyle = opts.belt; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * .2, -r * .9); ctx.lineTo(r * .2, r * .9); ctx.stroke(); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)'; }
  ctx.fillStyle = fl ? '#fff' : skin; ctx.beginPath(); ctx.arc(r * .12, 0, r * .48, 0, TAU2); ctx.fill(); ctx.stroke();
  if (opts.helmet === 'secutorHelm') drawSecutorHelmet(r, fl, false);
  else if (opts.helmet) {   // galea: bronzen helm met wangstukken en een rode pluim van voor naar achter
    ctx.fillStyle = fl ? '#fff' : C.bronze; ctx.beginPath(); ctx.arc(r * .06, 0, r * .52, 0, TAU2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = fl ? '#fff' : '#a8742f';
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(r * .32, side * r * .38, r * .2, r * .12, side * .5, 0, TAU2); ctx.fill(); }
    ctx.strokeStyle = fl ? '#fff' : '#b8352c'; ctx.lineWidth = r * .32; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(r * .42, 0); ctx.lineTo(-r * .55, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,15,8,.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { const x = r * (.3 - i * .25); ctx.beginPath(); ctx.moveTo(x, -r * .14); ctx.lineTo(x - r * .08, r * .14); ctx.stroke(); }
    ctx.lineCap = 'butt'; ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)';
  } else {
    ctx.fillStyle = fl ? '#fff' : hair; ctx.beginPath(); ctx.arc(-r * .02, 0, r * .42, Math.PI * .5, Math.PI * 1.5); ctx.fill();
  }
  if (opts.shield) {   // scutum aan de linkerarm: gebogen, rood met bronzen rand en knop
    const k = opts.shieldUp ? 1 : 0;   // bij het slaan iets naar voren
    ctx.save(); ctx.translate(r * (.5 + .25 * k), -r * .9); ctx.rotate(-.2 + .25 * k);
    ctx.fillStyle = fl ? '#fff' : '#8e1f1a'; ctx.strokeStyle = fl ? '#fff' : C.bronze; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(r * .05, -r * .85); ctx.quadraticCurveTo(r * .45, 0, r * .05, r * .85); ctx.lineTo(-r * .45, r * .8); ctx.quadraticCurveTo(-r * .1, 0, -r * .45, -r * .8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.bronze; ctx.beginPath(); ctx.arc(-r * .05, 0, r * .17, 0, TAU2); ctx.fill();
    ctx.strokeStyle = 'rgba(226,179,94,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r * .2, -r * .55); ctx.lineTo(-r * .2, r * .55); ctx.stroke();
    ctx.restore(); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)';
  }
  if (opts.item) opts.item(r);
  ctx.restore();
}
// Hoe de speler eruitziet met zijn uitrusting.
function playerLook() {
  const b = S.gear.body;
  const moving = Math.hypot(P.vx, P.vy);
  const own = b === 'lorica' ? '#8f8a80' : b === 'leather' ? '#7a5230' : C.blood;
  return { tunic: S.teamColors ? mix(own, C.laurel, TEAM.mix) : own,   // met maten: jij ook groen
           belt: b === 'lorica' ? null : C.bronze, hair: C['hair-1'], shield: me.shield,
           // voor drawBody: uitrusting en lopen
           hero: { armor: b, helmet: S.gear.head || false, quiver: !!S.gear.quiver && !!S.ranged, feet: me.riding ? undefined : P.walk || 0,
                   stride: Math.min(1, moving / 60), forward: Math.min(1.5, moving / 60) } };
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
  if (P.dead) { drawFallen(P, PLAYER.radius, look.tunic, C.skin, 1); return; }
  if (P.hurt > 0 && Math.floor(now / 70) % 2 === 0) ctx.globalAlpha = .45;
  if (me.riding) drawChariot(now);
  if (!S.switching && P.cdMax && !me.riding) {   // klaar om te slaan? een ring die volloopt, met een flits als hij vol is
    const t = 1 - P.cd / P.cdMax, rr = PLAYER.radius + 5;
    if (t < 1) {
      ctx.strokeStyle = 'rgba(245,234,214,.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P.x, P.y, rr, 0, TAU2); ctx.stroke();
      ctx.strokeStyle = 'rgba(245,234,214,.65)'; ctx.beginPath(); ctx.arc(P.x, P.y, rr, -Math.PI / 2, -Math.PI / 2 + TAU2 * t); ctx.stroke();
      P.readyFlash = .25;
    } else if (P.readyFlash > 0) {
      ctx.strokeStyle = `rgba(240,197,106,${P.readyFlash * 3})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(P.x, P.y, rr + 2 * (1 - P.readyFlash * 4), 0, TAU2); ctx.stroke();
      P.readyFlash -= 1 / 60;
    }
  }
  if (S.switching > 0) {   // wisselen: een ring die volloopt
    const t = 1 - S.switching / ARMS.switchTime;
    ctx.strokeStyle = 'rgba(245,234,214,.8)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(P.x, P.y, PLAYER.radius + 7, -Math.PI / 2, -Math.PI / 2 + TAU2 * t); ctx.stroke();
  }
  const sw = P.swing > 0 ? 1 - P.swing / w.swing : -1;   // 0..1 tijdens een slag, anders -1
  if (P.hooked > 0) {   // schild weggehaakt: witte rand (kwetsbaar)
    ctx.strokeStyle = `rgba(255,255,255,${.5 + .3 * Math.sin(now / 60)})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(P.x, P.y, PLAYER.radius + 6, 0, TAU2); ctx.stroke();
  }
  if (P.bash > 0) {   // schildstoot: bronzen golf naar voren
    const k = 1 - P.bash / .3;
    ctx.strokeStyle = `rgba(226,179,94,${.8 * (1 - k)})`; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(P.x, P.y, PLAYER.radius + 6 + BASH.reach * k, P.face - BASH.arc * .8, P.face + BASH.arc * .8); ctx.stroke(); ctx.lineCap = 'butt';
  }
  if (P.guard) {   // achter je schild: gele rand aan de voorkant (blokt)
    ctx.strokeStyle = 'rgba(226,179,94,.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(P.x, P.y, PLAYER.radius + 7, P.face - BLOCK.arc * .8, P.face + BLOCK.arc * .8); ctx.stroke(); ctx.lineCap = 'butt';
  }
  if (P.parryT > 0 || P.parried > 0) {   // parade: zilveren flits aan de voorkant
    ctx.strokeStyle = `rgba(220,228,240,${P.parried > 0 ? .9 : .6})`; ctx.lineWidth = P.parried > 0 ? 4 : 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(P.x, P.y, PLAYER.radius + 8, P.face - BLOCK.arc * .7, P.face + BLOCK.arc * .7); ctx.stroke(); ctx.lineCap = 'butt';
  }
  if (P.riposte > 0) {   // je volgende klap telt dubbel: goud om je wapen
    ctx.strokeStyle = `rgba(240,197,106,${.35 + .3 * Math.sin(now / 60)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(P.x, P.y, PLAYER.radius + 4, 0, TAU2); ctx.stroke();
  }
  if (w.kind === 'bow') {
    // Boog: pees naar achteren vlak voor het schot; met je vuisten als iemand tegen je aan staat.
    const pull = P.cd > 0 && P.cd < .35 ? 1 - P.cd / .35 : 0, punch = P.punch > 0 ? Math.sin((1 - P.punch / WEAPONS.fists.swing) * Math.PI) : 0;
    drawBody(P, PLAYER.radius, look.tunic, C.skin, look.hair, {
      ...look.hero, flash: P.flash, belt: look.belt, armR: 4 + 9 * punch, armL: 4,
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
      ...look.hero, flash: P.flash, belt: look.belt, shield: look.shield, shieldUp: P.guard, forward: 3 * punch,
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
  const ang = sw >= 0 ? P.swingDir * (-1.1 + 2.2 * sw) : P.parryT > 0 ? -.25 : .55;   // parade: wapen dwars voor je
  const len = PLAYER.radius + w.reach + 2;
  drawBody(P, PLAYER.radius, look.tunic, C.skin, look.hair, {
    ...look.hero, flash: P.flash, belt: look.belt, shield: look.shield, shieldUp: sw >= 0 || P.guard, armR: sw >= 0 ? 3 : P.parryT > 0 ? 5 : 0,
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
  if (f.state === 'dead' && d.animal) { drawDeadAnimal(f, now); return; }
  if (f.state === 'dead') { drawFallen(f, d.radius, d.tunic, C[d.skin], f.dead); return; }
  const wind = f.state === 'windup' ? 1 - f.t / (f.dagger ? d.dagger.windup : d.windup) : 0;
  if (f.mount) { drawMounted(f, wind, now); return; }
  if (d.ranged) { drawArcher(f, wind); return; }
  if (f.state === 'aimJav') drawJavTarget(f.target.x, f.target.y, 1 - f.t / (d.hasta ? d.hasta.windup : d.windup));
  if (d.dash) { drawTiger(f, wind, now); return; }
  if (d.ai === 'lion') { drawLion(f, wind, now); return; }
  if (d.ai === 'hyena') { drawHyena(f, wind, now); return; }
  if (d.ai === 'bear') { drawBear(f, wind, now); return; }
  if (d.ai === 'elephant') { drawElephant(f, wind, now); return; }
  // Aanzet: rode gloed en arm naar achteren; uitval: arm en lijf naar voren.
  if (wind > 0) {
    ctx.fillStyle = `rgba(212,70,59,${.15 + .3 * wind})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, d.radius + 4 + 3 * wind, 0, TAU2); ctx.fill();
  }
  const tunic = wind > 0 ? mix(d.tunic, C.blood, .55 * wind) : d.tunic;
  if (f.state === 'stagger' || (d.ai === 'murmillo' && f.state === 'recover')) {   // open: witte rand (nu kwetsbaar)
    const k = f.state === 'stagger' ? .55 + .25 * Math.sin(now / 60) : .45;
    ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(f.x, f.y, d.radius + 5, 0, TAU2); ctx.stroke();
  }
  if (f.state === 'parry' || f.parried > 0) {   // pareren: zilveren flits
    ctx.strokeStyle = `rgba(220,228,240,${.5 + .35 * Math.sin(now / 50)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, d.radius + 6, 0, TAU2); ctx.stroke();
  }
  if (f.state === 'aim') drawChargeArrow(f, f.d.sprint.speed * f.d.sprint.time, 1 - f.t / f.d.sprint.windup);   // secutor gaat sprinten
  if (f.state === 'spent') {   // secutor op: witte rand (kwetsbaar)
    ctx.strokeStyle = `rgba(255,255,255,${.55 + .25 * Math.sin(now / 80)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(f.x, f.y, d.radius + 5, 0, TAU2); ctx.stroke();
  }
  if ((f.spear || d.weapon === 'trident') && f.state === 'windup') {   // speer- of drietandstoot: rode lijn in de richting waarin hij gaat steken
    const len = d.reach + d.radius + d.lunge + PLAYER.radius;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.aim);
    ctx.strokeStyle = `rgba(212,70,59,${.25 + .6 * wind})`; ctx.lineWidth = 2 + 4 * wind; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(d.radius + 4, 0); ctx.lineTo(len, 0); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }
  if (d.breath && (f.breath < d.breath || f.state === 'spent')) {   // secutor: zweetdruppels = hoe moe hij is
    const n = f.state === 'spent' ? 4 : d.breath - f.breath;
    ctx.fillStyle = '#bfe3f0';
    for (let i = 0; i < n; i++) { const x = f.x - (n - 1) * 3 + i * 6, y = f.y - d.radius - 9 + ((now / 260 + i * .4) % 1) * 5; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU2); ctx.fill(); }
  }
  const sway = f.state === 'stagger' ? Math.sin(now / 90) * .35 : f.state === 'spent' ? Math.sin(now / 200) * .2 : 0;
  drawBody(f, d.radius, tunic, C[d.skin], C[d.hair], {
    flash: f.flash, belt: d.belt, armR: -5 * wind + 9 * f.lunge, forward: 5 * f.lunge, lean: -.25 * wind + sway,
    item: r => {
      const fl = f.flash > 0;
      if (d.cap) drawCap(r, fl);
      if (d.helmet === 'murmillo') drawMurmilloHelmet(r, fl, d.champ);
      if (d.helmet === 'thraex') drawThraexHelmet(r, fl, d.champ);
      if (d.helmet === 'hoplo') drawHoploHelmet(r, fl, d.champ);
      if (d.helmet === 'secutor') drawSecutorHelmet(r, fl, d.champ);
      if (d.helmet === 'dima') drawDimaHelmet(r, fl, d.champ);
      if (d.galerus) { ctx.fillStyle = fl ? '#fff' : C.bronze; ctx.beginPath(); ctx.ellipse(-r * .05, -r * .78, r * .38, r * .26, -.2, 0, TAU2); ctx.fill(); ctx.stroke(); }   // galerus op de linkerschouder
      if (d.scutum) drawScutumFoe(f, r, false);
      if (f.shieldOn) drawScutumFoe(f, r);
      if (d.parmula) drawParmula(r, fl || f.state === 'parry', f.state === 'parry');
      if (d.roundShield) drawRoundShield(r, fl || f.block > 0, f.state === 'ram');
    }
  });
  if (d.weapon === 'trident') {   // drietand (fuscina): lange steel met drie punten
    const out = f.state === 'thrust' || f.lunge > .5 ? 10 * f.lunge : wind > 0 ? -5 * wind : 0, len = d.reach + d.radius;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.face);
    const y = d.radius * .55, tx = len + out, ty = y * .6;
    ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-8 + out, y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = C.iron; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(tx, ty - 4); ctx.lineTo(tx, ty + 4); ctx.moveTo(tx, ty - 4); ctx.lineTo(tx + 7, ty - 4); ctx.moveTo(tx, ty); ctx.lineTo(tx + 8, ty); ctx.moveTo(tx, ty + 4); ctx.lineTo(tx + 7, ty + 4); ctx.stroke();
    if (f.hasNet) {   // net in de linkerhand
      ctx.strokeStyle = 'rgba(220,206,170,.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(d.radius * .5, -d.radius * 1.05, d.radius * .45, 0, TAU2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(d.radius * .1, -d.radius * 1.05); ctx.lineTo(d.radius * .9, -d.radius * 1.05); ctx.moveTo(d.radius * .5, -d.radius * 1.45); ctx.lineTo(d.radius * .5, -d.radius * .65); ctx.stroke();
    }
    ctx.lineCap = 'butt'; ctx.restore();
  } else if (d.weapon === 'javelin') {   // korte werpspeer als steekwapen
    const out = f.lunge > .3 ? 8 * f.lunge : wind > 0 ? -4 * wind : 0, len = d.reach + d.radius;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.face); ctx.lineCap = 'round';
    const y = d.radius * .55;
    ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-4 + out, y); ctx.lineTo(len + out, y * .6); ctx.stroke();
    ctx.fillStyle = C.iron; ctx.beginPath(); ctx.moveTo(len + out + 6, y * .6); ctx.lineTo(len + out - 1, y * .6 - 2.6); ctx.lineTo(len + out - 1, y * .6 + 2.6); ctx.fill();
    ctx.lineCap = 'butt'; ctx.restore();
  } else if (d.weapon === 'twin') {   // dimachaerus: in elke hand een kort zwaard; bij de combo zwaaien ze om en om
    const len = d.radius + d.reach;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.face); ctx.lineCap = 'round';
    for (const hand of [1, -1]) {
      const active = f.lunge > 0 && (f.side || 1) === hand, ang = hand * (wind > 0 ? .55 + .6 * wind : active ? 1.2 - 2 * (1 - f.lunge) : .45);
      const hx = d.radius * .35, hy = hand * d.radius * .78, ex = Math.cos(ang) * len, ey = Math.sin(ang) * len;
      ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 3.8; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = '#e4e0d4'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
      if (active && f.lunge > .3) { ctx.strokeStyle = `rgba(212,70,59,${f.lunge * .7})`; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, len * .9, hand > 0 ? -.4 : -1.2, hand > 0 ? 1.2 : .4); ctx.stroke(); }
    }
    ctx.lineCap = 'butt'; ctx.restore();
  } else if (d.weapon === 'spear' && f.spear) {   // speer: recht naar voren, schiet uit bij de stoot
    const out = f.state === 'thrust' || f.lunge > .5 ? 10 * f.lunge : wind > 0 ? -5 * wind : 0, len = d.reach + d.radius;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.face);
    const y = d.radius * .55;
    ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-8 + out, y); ctx.lineTo(len + out, y * .6); ctx.stroke();
    ctx.fillStyle = C.iron; ctx.beginPath(); ctx.moveTo(len + out + 8, y * .6 - .3); ctx.lineTo(len + out - 1, y * .6 - 3.2); ctx.lineTo(len + out - 1, y * .6 + 3); ctx.fill();
    ctx.lineCap = 'butt'; ctx.restore();
  } else if (d.weapon === 'sica') {   // sica: kort gebogen zwaard
    const ang = wind > 0 ? .5 + .8 * wind : f.lunge > 0 ? 1.3 - 2.4 * (1 - f.lunge) : .5, len = d.radius + d.reach;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.face);
    const hx = d.radius * .35, hy = d.radius * .78, ex = Math.cos(ang) * len, ey = Math.sin(ang) * len, mx = (hx + ex) / 2 - Math.sin(ang) * 5, my = (hy + ey) / 2 + Math.cos(ang) * 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
    ctx.strokeStyle = '#e4e0d4'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
    ctx.strokeStyle = C.bronze; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx - 2, hy - 1); ctx.lineTo(hx + 2, hy + 1); ctx.stroke();
    if (f.lunge > .3) { ctx.strokeStyle = `rgba(212,70,59,${f.lunge * .7})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, len * .9, -1, 1.2); ctx.stroke(); }
    ctx.lineCap = 'butt'; ctx.restore();
  } else if (d.weapon) {   // stok of gladius: naar achteren bij het aanzetten, zwaai naar voren bij de uitval
    const ang = wind > 0 ? .55 + .7 * wind : f.lunge > 0 ? 1.25 - 2.3 * (1 - f.lunge) : .55, len = d.radius + d.reach;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.face);
    const hx = d.radius * .35, hy = d.radius * .78, ex = Math.cos(ang) * len, ey = Math.sin(ang) * len;
    ctx.lineCap = 'round';
    if (d.weapon === 'rudis') {   // houten oefenzwaard: lichtbruin lemmet, donker gevest
      const dx = ex - hx, dy = ey - hy, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, gx = hx + ux * 4, gy = hy + uy * 4;
      ctx.strokeStyle = '#5a3a26'; ctx.lineWidth = 4.4; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = '#b88a58'; ctx.lineWidth = 2.8; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx - ux * 2, hy - uy * 2); ctx.lineTo(gx, gy); ctx.stroke();
    } else if (d.weapon === 'sword') {
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
// Thraciër-helm: brede rand, bronzen koepel en een gebogen kam met een griffioenkop vooraan; twee veren opzij.
function drawThraexHelmet(r, fl, champ) {
  ctx.fillStyle = fl ? '#fff' : '#a8742f'; ctx.beginPath(); ctx.ellipse(r * .05, 0, r * .66, r * .62, 0, 0, TAU2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = fl ? '#fff' : C.bronze; ctx.beginPath(); ctx.arc(r * .05, 0, r * .44, 0, TAU2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = fl ? '#fff' : champ ? '#f0c56a' : '#c9a24a'; ctx.lineWidth = r * .16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r * .5, 0); ctx.quadraticCurveTo(0, -r * .08, r * .45, 0); ctx.stroke();                     // kam
  ctx.fillStyle = fl ? '#fff' : champ ? '#f0c56a' : '#c9a24a'; ctx.beginPath(); ctx.arc(r * .5, 0, r * .16, 0, TAU2); ctx.fill();   // griffioenkop
  ctx.strokeStyle = fl ? '#fff' : '#efe6d4'; ctx.lineWidth = r * .1;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-r * .05, s * r * .42); ctx.lineTo(-r * .45, s * r * .62); ctx.stroke(); }  // veren
  ctx.lineCap = 'butt'; ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)';
}
// Hoplomachus-helm: brede rand, koepel en twee hoge witte veren opzij; een korte kam.
function drawHoploHelmet(r, fl, champ) {
  ctx.fillStyle = fl ? '#fff' : '#a8742f'; ctx.beginPath(); ctx.ellipse(r * .05, 0, r * .68, r * .64, 0, 0, TAU2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = fl ? '#fff' : C.bronze; ctx.beginPath(); ctx.arc(r * .05, 0, r * .45, 0, TAU2); ctx.fill(); ctx.stroke();
  ctx.lineCap = 'round';
  ctx.strokeStyle = fl ? '#fff' : champ ? '#f0c56a' : '#2a3a5a'; ctx.lineWidth = r * .18; ctx.beginPath(); ctx.moveTo(-r * .4, 0); ctx.lineTo(r * .25, 0); ctx.stroke();
  ctx.strokeStyle = fl ? '#fff' : '#f4efe4'; ctx.lineWidth = r * .14;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * .1, s * r * .38); ctx.quadraticCurveTo(-r * .3, s * r * .75, -r * .7, s * r * .5); ctx.stroke(); }
  ctx.lineCap = 'butt'; ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)';
}
// Parmula van de Thraciër: klein vierkant schildje links voor hem. Zilver als hij pareert.
function drawParmula(r, fl, parry) {
  ctx.save(); ctx.translate(r * .75, -r * .7); ctx.rotate(.3);
  ctx.fillStyle = fl ? (parry ? '#e8edf4' : '#fff') : '#5a3a6a'; ctx.strokeStyle = parry ? '#dfe6f0' : C.bronze; ctx.lineWidth = parry ? 2.4 : 1.6;
  ctx.beginPath(); ctx.rect(-r * .25, -r * .45, r * .5, r * .9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.bronze; ctx.beginPath(); ctx.arc(0, 0, r * .12, 0, TAU2); ctx.fill();
  ctx.restore(); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)';
}
// Rond hol schild van de hoplomachus: bronzen schijf met een donkere rand en een lichtere binnenring.
function drawRoundShield(r, fl, ram) {
  ctx.save(); ctx.translate(r * (ram ? 1.05 : .8), -r * .65);
  ctx.fillStyle = fl ? '#fff' : C.bronze; ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(0, 0, r * .6, 0, TAU2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = fl ? '#fff' : '#e8c27a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(-r * .06, r * .04, r * .36, 0, TAU2); ctx.stroke();
  ctx.restore(); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)';
}
// Secutor-helm: glad en eivormig (geen rand, geen pluim), twee kleine kijkgaatjes vooraan en een lage kam.
// Ook gebruikt voor jouw eigen secutor-helm.
function drawSecutorHelmet(r, fl, champ) {
  ctx.fillStyle = fl ? '#fff' : '#cdb98a'; ctx.beginPath(); ctx.ellipse(r * .05, 0, r * .58, r * .52, 0, 0, TAU2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r * .05, -r * .16, r * .3, r * .14, -.3, 0, TAU2); ctx.fill();   // glans
  ctx.strokeStyle = fl ? '#fff' : champ ? '#f0c56a' : '#9a8250'; ctx.lineWidth = r * .14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r * .45, 0); ctx.lineTo(r * .3, 0); ctx.stroke(); ctx.lineCap = 'butt';
  if (!fl) { ctx.fillStyle = '#1a0c08'; for (const y of [-.16, .16]) { ctx.beginPath(); ctx.arc(r * .5, r * y, r * .06, 0, TAU2); ctx.fill(); } }
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)';
}
// Dimachaerus-helm: bronzen koepel met een smalle rand en een korte rode pluim.
function drawDimaHelmet(r, fl, champ) {
  ctx.fillStyle = fl ? '#fff' : '#a8742f'; ctx.beginPath(); ctx.ellipse(r * .05, 0, r * .58, r * .55, 0, 0, TAU2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = fl ? '#fff' : C.bronze; ctx.beginPath(); ctx.arc(r * .05, 0, r * .45, 0, TAU2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = fl ? '#fff' : champ ? '#f0c56a' : '#b8352c'; ctx.lineWidth = r * .2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(r * .1, 0); ctx.lineTo(-r * .55, 0); ctx.stroke(); ctx.lineCap = 'butt';
  if (!fl) { ctx.fillStyle = '#1a0c08'; ctx.fillRect(r * .38, -r * .2, r * .08, r * .4); }   // kijkspleet
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)';
}
// Paard van bovenaf: lijf, nek en kop naar voren, staart; galop = de pootjes bewegen. deco: rood dekkleed en pluim.
function drawHorse(x, y, face, color, deco, gallop, fl, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(face); ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(40,20,8,.28)'; ctx.beginPath(); ctx.ellipse(3, 4, 20, 9, 0, 0, TAU2); ctx.fill();
  ctx.strokeStyle = 'rgba(30,15,8,.75)'; ctx.lineWidth = 1.4;
  const g = Math.sin(gallop) * 3;
  ctx.fillStyle = fl ? '#fff' : mix(color, '#000000', .25);
  for (const [px, py, k] of [[10, -5, 1], [10, 5, -1], [-10, -5, -1], [-10, 5, 1]]) { ctx.beginPath(); ctx.ellipse(px + g * k, py * 1.2, 3.4, 2, 0, 0, TAU2); ctx.fill(); }   // poten
  ctx.strokeStyle = fl ? '#fff' : '#3b2a1e'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-17, 0); ctx.quadraticCurveTo(-23, Math.sin(gallop * .7) * 3, -26, 1); ctx.stroke(); ctx.lineCap = 'butt';   // staart
  ctx.strokeStyle = 'rgba(30,15,8,.75)'; ctx.lineWidth = 1.4;
  ctx.fillStyle = fl ? '#fff' : color; ctx.beginPath(); ctx.ellipse(-2, 0, 17, 8, 0, 0, TAU2); ctx.fill(); ctx.stroke();   // lijf
  if (deco && !fl) { ctx.fillStyle = '#8e1f1a'; ctx.fillRect(-9, -8.5, 12, 17); ctx.fillStyle = C.bronze; ctx.fillRect(-9, -8.5, 12, 1.5); ctx.fillRect(-9, 7, 12, 1.5); }   // dekkleed
  ctx.fillStyle = fl ? '#fff' : color; ctx.beginPath(); ctx.ellipse(16, 0, 9, 4.6, 0, 0, TAU2); ctx.fill(); ctx.stroke();   // nek en kop
  ctx.fillStyle = fl ? '#fff' : '#2a1a12'; ctx.fillRect(10, -1, 6, 2);   // manen
  for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.ellipse(19, s2 * 3, 1.8, 1, 0, 0, TAU2); ctx.fill(); }   // oren
  if (deco && !fl) { ctx.fillStyle = '#b8352c'; ctx.beginPath(); ctx.arc(19, 0, 2.4, 0, TAU2); ctx.fill(); }   // pluim
  ctx.restore();
}
// Bereden vijand: paard (of wagen met paarden), de ruiter erop, levensbalk van het paard, en de telegraaf.
function drawMounted(f, wind, now) {
  const d = f.d, m = f.mount, fl = f.flash > 0;
  if (f.state === 'windup' && d.charge) drawChargeArrow(f, d.charge.speed * d.charge.time, wind);
  if (f.state === 'aimJav') drawJavTarget(f.target.x, f.target.y, 1 - f.t / d.windup);
  if (f.state === 'windup' && d.ranged) {   // sagittarius richt: rode stippellijn naar je toe
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.aimAt);
    ctx.strokeStyle = `rgba(212,70,59,${.15 + .55 * wind})`; ctx.lineWidth = 1.5 + wind; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(d.radius + 6, 0); ctx.lineTo(d.ranged.arrow * d.ranged.life * .5, 0); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }
  const g = f.gallop || 0;
  if (m.kind === 'horse') drawHorse(f.x, f.y, f.heading, m.color, m.deco, g, fl);
  else {   // strijdwagen: paard(en) voorop, bak met twee wielen erachter
    const c = Math.cos(f.heading), s2 = Math.sin(f.heading), px = -s2, py = c;
    for (let i = 0; i < m.horses; i++) { const o = m.horses === 1 ? 0 : (i ? 7 : -7); drawHorse(f.x + c * 20 + px * o, f.y + s2 * 20 + py * o, f.heading, m.color, false, g + i, fl, .8); }
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.heading);
    ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(12, 0); ctx.stroke();   // disselboom
    ctx.fillStyle = '#2a1a12'; for (const sy of [-11, 11]) ctx.fillRect(-9, sy - 1.6, 12, 3.2);   // wielen
    ctx.fillStyle = fl ? '#fff' : '#8e1f1a'; ctx.strokeStyle = C.bronze; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(4, -10); ctx.quadraticCurveTo(10, 0, 4, 10); ctx.lineTo(-8, 10); ctx.lineTo(-8, -10); ctx.closePath(); ctx.fill(); ctx.stroke();   // bak
    ctx.restore();
    // menner voorin
    drawBody({ x: f.x + Math.cos(f.heading) * 1 - Math.sin(f.heading) * 4, y: f.y + Math.sin(f.heading) * 1 + Math.cos(f.heading) * 4, face: f.heading }, 7, '#9c8a6c', C['skin-2'], C['hair-2'], { flash: f.flash });
  }
  // de ruiter (of de essedarius achter de menner)
  const rx = m.kind === 'horse' ? f.x - Math.cos(f.heading) * 2 : f.x - Math.sin(f.heading) * -5 - Math.cos(f.heading) * 3;
  const ry = m.kind === 'horse' ? f.y - Math.sin(f.heading) * 2 : f.y + Math.cos(f.heading) * -5 - Math.sin(f.heading) * 3;
  const face = d.ranged ? f.aimAt || f.face : f.state === 'aimJav' && f.target ? Math.atan2(f.target.y - ry, f.target.x - rx) : f.heading;
  drawBody({ x: rx, y: ry, face }, 8, d.tunic, C[d.skin], C[d.hair], {
    flash: f.flash, belt: d.belt, armR: 4, armL: 4,
    item: r => { if (d.helmet === 'hoplo') drawHoploHelmet(r, fl, d.champ); if (d.roundShield) drawRoundShield(r, fl, false); }
  });
  ctx.save(); ctx.translate(rx, ry); ctx.rotate(face); ctx.lineCap = 'round';
  if (d.charge) {   // lans
    const out = f.state === 'charge' ? 6 : 0;
    ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-10, 6); ctx.lineTo(30 + out, 4); ctx.stroke();
    ctx.fillStyle = C.iron; ctx.beginPath(); ctx.moveTo(37 + out, 4); ctx.lineTo(29 + out, 1.4); ctx.lineTo(29 + out, 6.6); ctx.fill();
  } else if (d.ranged) {   // boog
    ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(4, 0, 9, -1.1, 1.1); ctx.stroke();
  } else {   // werpspeer in de hand
    ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(16, 5); ctx.stroke();
    ctx.fillStyle = C.iron; ctx.beginPath(); ctx.moveTo(21, 5); ctx.lineTo(15, 3); ctx.lineTo(15, 7); ctx.fill();
  }
  ctx.lineCap = 'butt'; ctx.restore();
  // levensbalk van het paard of de wagen
  const w = 26, k = Math.max(0, m.hp / m.max);
  ctx.fillStyle = 'rgba(20,10,8,.6)'; ctx.fillRect(f.x - w / 2, f.y - d.radius - 12, w, 4);
  ctx.fillStyle = k > .5 ? '#c9a24a' : '#d4463b'; ctx.fillRect(f.x - w / 2, f.y - d.radius - 12, w * k, 4);
}
// Waar een werpspeer gaat landen: rode cirkel die voller wordt.
function drawJavTarget(x, y, k) {
  ctx.fillStyle = `rgba(212,70,59,${.08 + .25 * k})`; ctx.strokeStyle = `rgba(212,70,59,${.35 + .5 * k})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, JAVELIN.radius + PLAYER.radius * .5, 0, TAU2); ctx.fill(); ctx.stroke();
}
function drawJavs() {
  for (const j of S.javs) {
    const k = Math.min(1, j.t / j.T);
    if (!j.done) drawJavTarget(j.x, j.y, .6 + .4 * k);
    const x = j.x0 + (j.x - j.x0) * k, y = j.y0 + (j.y - j.y0) * k - (j.done ? 0 : Math.sin(k * Math.PI) * 26), a = Math.atan2(j.y - j.y0, j.x - j.x0);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = j.done ? Math.min(1, j.stuck) : 1;
    ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(8, 0); ctx.stroke();
    ctx.fillStyle = C.iron; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(7, -2.5); ctx.lineTo(7, 2.5); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
  }
}
// Gevallen paarden en kapotte wagens blijven liggen.
function drawWrecks() {
  for (const w of S.wrecks) {
    ctx.save(); ctx.globalAlpha = .85;
    if (w.kind === 'horse') { drawHorse(w.x, w.y, w.face + .4, mix(w.color, '#6b5a4a', .3), w.deco, 0, false); }
    else {
      for (let i = 0; i < w.horses; i++) drawHorse(w.x + Math.cos(w.face) * 22 + i * 10, w.y + Math.sin(w.face) * 22 + i * 6, w.face + .5 + i * .4, mix(w.color, '#6b5a4a', .3), false, 0, false, .8);
      ctx.translate(w.x, w.y); ctx.rotate(w.face - .6);
      ctx.fillStyle = '#5a2a22'; ctx.fillRect(-8, -9, 11, 18);
      ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(-14, 6, 6, 0, TAU2); ctx.stroke();   // los wiel
    }
    ctx.restore();
  }
}
// Rode pijl voor een charge (leeuw, secutor): de richting ligt vast.
function drawChargeArrow(f, len, wind) {
  const r = f.d.radius;
  ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.aim);
  ctx.strokeStyle = `rgba(212,70,59,${.2 + .6 * wind})`; ctx.lineWidth = 3 + 3 * wind; ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.moveTo(r + 4, 0); ctx.lineTo(len, 0); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = `rgba(212,70,59,${.2 + .6 * wind})`; ctx.beginPath(); ctx.moveTo(len + 10, 0); ctx.lineTo(len - 4, -8); ctx.lineTo(len - 4, 8); ctx.fill();
  ctx.restore();
}
// Netten: in de lucht (rode cirkel waar het landt), op de grond, of over jou heen.
// Buiten beeld: een driehoekje aan de rand van het scherm, in de richting van wie daar is.
// Tegenstanders lichtbeige, je eigen kant groen, een luik dat opengaat rood (gevaar).
function drawOffscreen(cw, ch, scale) {
  const hw = cw / 2 / scale, hh = ch / 2 / scale, pad = 16 / scale;
  const mark = (x, y, color) => {
    const dx = x - cam.x, dy = y - cam.y;
    if (Math.abs(dx) < hw - 4 && Math.abs(dy) < hh - 4) return;
    const k = Math.min((hw - pad) / Math.abs(dx || 1e-6), (hh - pad) / Math.abs(dy || 1e-6)), a = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(cam.x + dx * k, cam.y + dy * k); ctx.rotate(a); ctx.scale(1 / scale, 1 / scale);
    ctx.fillStyle = color; ctx.strokeStyle = EDGE; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -7); ctx.lineTo(-3, 0); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  };
  for (const f of S.foes) if (targetable(f)) mark(f.x, f.y, f.side === 'hero' ? 'rgba(166,200,90,.9)' : 'rgba(245,234,214,.85)');
  for (const h of S.hatches || []) if (h.state === 'warn') mark(h.fx * W.rx, h.fy * W.ry, C.blood);
}
// Luiken: houten luik in het zand. Schudt met een rode cirkel als er iets uit komt; open = donker gat met het luik opzij.
function drawHatches(now) {
  for (const h of S.hatches || []) {
    const x = h.fx * W.rx, y = h.fy * W.ry, s = HATCH.size;
    ctx.save(); ctx.translate(x, y);
    if (h.state === 'warn') {
      const k = 1 - h.t / HATCH.warn;
      ctx.fillStyle = `rgba(212,70,59,${.1 + .2 * k})`; ctx.strokeStyle = `rgba(212,70,59,${.45 + .45 * k})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, s + 8 + 3 * Math.sin(now / 90), 0, TAU2); ctx.fill(); ctx.stroke();
      ctx.translate((Math.random() - .5) * 2.4 * k, (Math.random() - .5) * 2.4 * k);
    }
    ctx.fillStyle = 'rgba(40,20,8,.25)'; ctx.beginPath(); ctx.roundRect(-s + 2, -s + 3, s * 2, s * 2, 3); ctx.fill();
    ctx.strokeStyle = EDGE; ctx.lineWidth = 1.4;
    if (h.state === 'open') {   // gat, luik klapt naar achteren
      ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.roundRect(-s, -s, s * 2, s * 2, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7a5232'; ctx.beginPath(); ctx.roundRect(-s, -s * 2.1, s * 2, s * 1.05, 2); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = '#8a6440'; ctx.beginPath(); ctx.roundRect(-s, -s, s * 2, s * 2, 3); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(30,15,8,.45)'; ctx.lineWidth = 1;
      for (const k of [-.33, .33]) { ctx.beginPath(); ctx.moveTo(-s, k * s * 2 / 1.33); ctx.lineTo(s, k * s * 2 / 1.33); ctx.stroke(); }   // planken
      ctx.fillStyle = C.iron; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * s * .6, 0, 1.3, 0, TAU2); ctx.fill(); }   // ijzeren ring/spijkers
    }
    ctx.restore();
  }
}
function drawNets(now) {
  for (const n of S.nets) {
    let x = n.x, y = n.y, r = NET.radius, a = 1;
    if (n.state === 'fly') {
      const k = n.t / n.T;
      if (n.mine) { ctx.strokeStyle = `rgba(226,179,94,${.4 + .5 * k})`; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(n.x, n.y, NET.radius, 0, TAU2); ctx.stroke(); ctx.setLineDash([]); }
      else {
        ctx.fillStyle = `rgba(212,70,59,${.12 + .25 * k})`; ctx.strokeStyle = `rgba(212,70,59,${.4 + .5 * k})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(n.x, n.y, NET.radius + PLAYER.radius * .5, 0, TAU2); ctx.fill(); ctx.stroke();
      }
      x = n.x0 + (n.x - n.x0) * k; y = n.y0 + (n.y - n.y0) * k - Math.sin(k * Math.PI) * 30; r = NET.radius * (.4 + .6 * k);
    } else if (n.state === 'held') { const o = n.on || P; x = o.x; y = o.y; r = rad(o) + 5; }
    else a = .8;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
    ctx.strokeStyle = '#d8c79c'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU2); ctx.stroke();
    ctx.beginPath(); ctx.rect(-r, -r, r * 2, r * 2); ctx.clip();
    ctx.lineWidth = .8;
    for (let i = -r; i <= r; i += 5) { ctx.beginPath(); ctx.moveTo(i - r, -r); ctx.lineTo(i + r, r); ctx.moveTo(i + r, -r); ctx.lineTo(i - r, r); ctx.stroke(); }
    ctx.restore(); ctx.globalAlpha = 1;
  }
}
// Leren kap van een tiro: bruin, met een naad over het midden.
function drawCap(r, fl) {
  ctx.fillStyle = fl ? '#fff' : '#6b4526'; ctx.beginPath(); ctx.arc(r * .06, 0, r * .5, 0, TAU2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(30,15,8,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r * .5, 0); ctx.lineTo(-r * .4, 0); ctx.stroke();
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)';
}
// Murmillo-helm van bovenaf: brede rand, bronzen koepel, rooster voor het gezicht en een hoge vissenvin van voor naar achter.
// Kampioen: gouden vin.
function drawMurmilloHelmet(r, fl, champ) {
  ctx.fillStyle = fl ? '#fff' : '#a8742f'; ctx.beginPath(); ctx.ellipse(r * .05, 0, r * .7, r * .66, 0, 0, TAU2); ctx.fill(); ctx.stroke();   // rand
  ctx.fillStyle = fl ? '#fff' : C.bronze; ctx.beginPath(); ctx.arc(r * .05, 0, r * .48, 0, TAU2); ctx.fill(); ctx.stroke();                 // koepel
  if (!fl) { ctx.fillStyle = '#3b2a1e'; for (const y of [-.22, 0, .22]) for (const x of [.4, .52]) { ctx.beginPath(); ctx.arc(r * x, r * y, r * .05, 0, TAU2); ctx.fill(); } }   // rooster
  ctx.strokeStyle = fl ? '#fff' : champ ? '#f0c56a' : '#5a1c16'; ctx.lineWidth = r * .22; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(r * .3, 0); ctx.lineTo(-r * .62, 0); ctx.stroke();                                                         // vin
  ctx.strokeStyle = 'rgba(30,15,8,.4)'; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) { const x = r * (.18 - i * .2); ctx.beginPath(); ctx.moveTo(x, -r * .1); ctx.lineTo(x - r * .08, r * .1); ctx.stroke(); }
  ctx.lineCap = 'butt'; ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)';
}
// Scutum van een murmillo: groot, gebogen, links voor hem. Gele rand = in dekking (blokt). Barsten als donkere zigzaglijnen.
function drawScutumFoe(f, r, blocks = true) {
  const guard = blocks && (f.state === 'walk' || f.state === 'windup'), fl = f.flash > 0 || f.block > 0;
  ctx.save(); ctx.translate(r * .8, -r * .25);
  ctx.fillStyle = fl ? '#fff' : '#6e2a22'; ctx.strokeStyle = guard ? '#f0c56a' : C.bronze; ctx.lineWidth = guard ? 2.6 : 1.8;
  ctx.beginPath(); ctx.moveTo(r * .1, -r * 1.25); ctx.quadraticCurveTo(r * .55, -r * .25, r * .1, r * .85); ctx.lineTo(-r * .3, r * .8);
  ctx.quadraticCurveTo(r * .1, -r * .25, -r * .3, -r * 1.2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.bronze; ctx.beginPath(); ctx.arc(r * .12, -r * .2, r * .17, 0, TAU2); ctx.fill();   // knop
  ctx.strokeStyle = '#1a0c08'; ctx.lineWidth = 1.2;
  for (let i = 0; i < f.cracks; i++) {   // barsten
    const y = -r * 1 + i * r * .45;
    ctx.beginPath(); ctx.moveTo(r * .25, y); ctx.lineTo(r * .05, y + r * .12); ctx.lineTo(r * .2, y + r * .22); ctx.lineTo(-r * .05, y + r * .33); ctx.stroke();
  }
  ctx.restore(); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(30,15,8,.75)';
}
// Leeuw van bovenaf: lang lijf, manen om de kop, staart. Bij het richten een rode pijl in de richting waarin hij gaat springen.
// Katachtige van bovenaf (tijger en leeuw): lang lijf, kop, staart. opts: kleur, strepen, manen.
/* ---------- Dieren, van bovenaf getekend met de kop naar +x ---------- */
const EDGE = 'rgba(30,15,8,.8)';
// Loopbeweging van een dier: fase van de poten en hoeveel het nu loopt (0–1), uit hoe ver het sinds de vorige frame bewoog.
function gait(f, stride) {
  const d = f.lx === undefined || S.paused ? 0 : Math.hypot(f.x - f.lx, f.y - f.ly);
  f.lx = f.x; f.ly = f.y;
  f.gph = (f.gph || 0) + Math.min(d, 12) / stride * Math.PI;
  f.gamt = (f.gamt || 0) * .85 + Math.min(1, d * .8) * .15;
  return [f.gph, f.state === 'dead' ? 0 : f.gamt];
}
// Eén silhouet uit een paar ellipsen: eerst de rand van alles, dan de vulling, zodat er binnenin geen lijnen staan.
function blob(parts, fill, lw = 2.6) {
  const p = new Path2D();
  for (const [x, y, rx, ry, rot = 0] of parts) { p.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot)); p.ellipse(x, y, rx, ry, rot, 0, TAU2); }
  ctx.lineWidth = lw; ctx.strokeStyle = EDGE; ctx.stroke(p); ctx.fillStyle = fill; ctx.fill(p);
  return p;
}
// Vier poten die onder het lijf uitsteken; schuin tegenover elkaar lopen ze gelijk op.
function paws(list, ph, amt, swing, color, rx, ry) {
  ctx.fillStyle = color; ctx.strokeStyle = EDGE; ctx.lineWidth = 1.2;
  for (const [x, y, k] of list) { ctx.beginPath(); ctx.ellipse(x + Math.sin(ph + k) * swing * amt, y, rx, ry, 0, 0, TAU2); ctx.fill(); ctx.stroke(); }
}
// Staart als kromme vanaf het achterlijf; geeft het puntje terug.
function tailPath(x0, len, sway) {
  ctx.beginPath(); ctx.moveTo(x0, 0); ctx.bezierCurveTo(x0 - len * .4, sway * .2, x0 - len * .7, sway, x0 - len, sway * .7);
  return [x0 - len, sway * .7];
}
function eyes(x, y, dead, size = 1.3) {
  size = Math.max(.8, size);
  ctx.fillStyle = '#1a0e08'; ctx.strokeStyle = '#1a0e08'; ctx.lineWidth = 1;
  for (const s of [-1, 1]) {
    if (dead) { ctx.beginPath(); ctx.moveTo(x - size, s * y); ctx.lineTo(x + size, s * y); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(x, s * y, size, 0, TAU2); ctx.fill(); }
  }
}
// Grote kat (tijger en leeuw): lang lijf met schouders en heupen, staart, poten die meelopen, brede kop.
function drawCat(f, wind, o, now) {
  const d = f.d, r = d.radius, fl = f.flash > 0, dead = f.state === 'dead', wf = c => fl ? '#fff' : c;
  const [ph, amt] = gait(f, r * 1.1);
  ctx.save(); ctx.translate(f.x, f.y);
  ctx.fillStyle = 'rgba(40,20,8,.28)'; ctx.beginPath(); ctx.ellipse(3, 4, r * 1.6, r * .85, f.face, 0, TAU2); ctx.fill();
  ctx.rotate(f.face);
  const crouch = wind > 0 ? 1 - .15 * wind : 1, stretch = f.state === 'dash' ? 1.15 : 1;
  ctx.scale(stretch, crouch);
  const body = wind > 0 ? mix(o.body, C.blood, .4 * wind) : o.body, dark = mix(o.body, '#000000', .28);
  // staart
  const sway = dead ? r * .4 : Math.sin(now / 260 + (f.seed ??= Math.random() * 6)) * r * .5;
  ctx.lineCap = 'round';
  const [tx, ty] = tailPath(-r * 1.05, r * 1.3, sway);
  ctx.strokeStyle = EDGE; ctx.lineWidth = 4.8; ctx.stroke();
  ctx.strokeStyle = wf(o.tail); ctx.lineWidth = 2.8; ctx.stroke();
  if (o.stripes && !fl) { ctx.strokeStyle = '#1e1410'; ctx.lineWidth = 2.4; ctx.setLineDash([1.6, 3.6]); ctx.stroke(); ctx.setLineDash([]); }
  ctx.lineCap = 'butt';
  if (o.tuft) { ctx.fillStyle = wf(o.tuft); ctx.strokeStyle = EDGE; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(tx - 1, ty, r * .2, r * .15, 0, 0, TAU2); ctx.fill(); ctx.stroke(); }
  else if (!fl) { ctx.fillStyle = '#1e1410'; ctx.beginPath(); ctx.arc(tx, ty, 1.6, 0, TAU2); ctx.fill(); }
  // poten
  paws([[r * .72, -r * .5, 0], [r * .72, r * .5, Math.PI], [-r * .78, -r * .45, Math.PI], [-r * .78, r * .45, 0]], ph, amt, r * .3, wf(dark), r * .22, r * .15);
  // lijf: heupen, middel, schouders
  const p = blob([[-r * .62, 0, r * .52, r * .44], [-r * .1, 0, r * .8, r * .4], [r * .4, 0, r * .55, r * .5]], wf(body));
  if (!fl) {
    ctx.save(); ctx.clip(p);
    ctx.fillStyle = 'rgba(0,0,0,.09)'; ctx.beginPath(); ctx.ellipse(-r * .1, 0, r * 1.2, r * .16, 0, 0, TAU2); ctx.fill();   // ruglijn
    ctx.fillStyle = 'rgba(255,240,210,.12)'; ctx.beginPath(); ctx.ellipse(0, -r * .32, r * 1.1, r * .14, 0, 0, TAU2); ctx.fill();   // licht op de flank
    if (o.stripes) {   // strepen als wiggen vanaf de ruggengraat naar de flank
      ctx.fillStyle = '#1e1410';
      for (const [x, l, w] of [[-1.08, .45, .05], [-.84, .62, .045], [-.62, .4, .04], [-.42, .6, .05], [-.2, .45, .04], [.02, .62, .05], [.25, .42, .04], [.46, .58, .045], [.66, .4, .035]]) for (const s of [-1, 1]) {
        const xx = x + (s > 0 ? .1 : 0), ll = s > 0 ? .95 - l : l + .05, bend = s > 0 ? .1 : .06;   // links en rechts verspringen en verschillen in lengte
        ctx.beginPath(); ctx.moveTo(r * (xx - w), s * r * .08);
        ctx.quadraticCurveTo(r * (xx + bend), s * r * ll * .55, r * (xx - .04), s * r * (ll + .04));
        ctx.quadraticCurveTo(r * (xx + bend - w * 1.4), s * r * ll * .5, r * (xx + w), s * r * .08); ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }
  const hx = r * 1.05;
  // manen van de leeuw: ruige krans om de kop
  if (o.mane) {
    const parts = [];
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU2; parts.push([hx - r * .12 + Math.cos(a) * r * .5, Math.sin(a) * r * .55, r * .26, r * .2, a]); }
    const m = blob(parts, wf(o.mane));
    if (!fl) {
      ctx.save(); ctx.clip(m); ctx.strokeStyle = mix(o.mane, '#000000', .3); ctx.lineWidth = 1; ctx.lineCap = 'round';
      for (let i = 0; i < 18; i++) { const a = i / 18 * TAU2 + .1; ctx.beginPath(); ctx.moveTo(hx - r * .12 + Math.cos(a) * r * .45, Math.sin(a) * r * .5); ctx.lineTo(hx - r * .12 + Math.cos(a + .12) * r * .78, Math.sin(a + .12) * r * .8); ctx.stroke(); }
      ctx.lineCap = 'butt'; ctx.restore();
    }
  }
  // oren (achter de kop)
  for (const s of [-1, 1]) {
    ctx.fillStyle = wf(o.mane ? mix(o.head, '#000000', .2) : '#1e1410'); ctx.strokeStyle = EDGE; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(hx - r * .2, s * r * .33, r * .14, r * .12, 0, 0, TAU2); ctx.fill(); ctx.stroke();
    if (o.stripes && !fl) { ctx.fillStyle = '#f4ead8'; ctx.beginPath(); ctx.arc(hx - r * .22, s * r * .34, r * .05, 0, TAU2); ctx.fill(); }   // witte vlek achter op het oor
  }
  // kop met wangen en snuit
  const hp = blob([[hx, 0, r * .4, r * .37], [hx + r * .3, 0, r * .2, r * .22]].concat(o.ruff ? [[hx + r * .02, -r * .28, r * .22, r * .15, -.4], [hx + r * .02, r * .28, r * .22, r * .15, .4]] : []), wf(o.head));
  if (!fl) {
    ctx.save(); ctx.clip(hp);
    if (o.ruff) { ctx.fillStyle = '#f4ead8'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + r * .08, s * r * .34, r * .2, r * .12, s * .4, 0, TAU2); ctx.fill(); } }   // witte wangen
    if (o.stripes) {   // strepen op het voorhoofd
      ctx.strokeStyle = '#1e1410'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
      ctx.lineWidth = .8;
      for (const s of [-1, 1]) for (const k of [0, 1]) { ctx.beginPath(); ctx.moveTo(hx - r * (.32 - k * .1), s * r * (.1 + k * .04)); ctx.lineTo(hx - r * (.2 - k * .1), s * r * (.17 + k * .05)); ctx.stroke(); }
      ctx.lineCap = 'butt';
    }
    ctx.fillStyle = o.muzzle; ctx.beginPath(); ctx.ellipse(hx + r * .32, 0, r * .17, r * .2, 0, 0, TAU2); ctx.fill();   // lichte snuit
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = .5;   // snorharen
    for (const s of [-1, 1]) for (const k of [-.05, .05]) { ctx.beginPath(); ctx.moveTo(hx + r * .38, s * r * .15); ctx.lineTo(hx + r * (.46 + k), s * r * (.32 + k)); ctx.stroke(); }
  }
  if (o.roar) {   // open bek met tanden
    ctx.fillStyle = '#5a1c16'; ctx.beginPath(); ctx.ellipse(hx + r * .5, 0, r * .12 * o.roar, r * .14, 0, 0, TAU2); ctx.fill();
    ctx.fillStyle = '#f4ead8'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + r * .5, s * r * .1, 1, 0, TAU2); ctx.fill(); }
  }
  ctx.fillStyle = wf('#4a2a22'); ctx.beginPath(); ctx.moveTo(hx + r * .5, 0); ctx.lineTo(hx + r * .42, -r * .07); ctx.lineTo(hx + r * .42, r * .07); ctx.closePath(); ctx.fill();   // neus
  eyes(hx + r * .1, r * .15, dead, r * .085);
  ctx.restore();
}
function drawTiger(f, wind, now) {
  if (wind > 0) drawChargeArrow(f, f.d.dash.speed * f.d.dash.time, wind);
  drawCat(f, wind, { body: f.d.tunic, head: '#e08a3e', tail: '#d9782e', muzzle: '#f4ead8', stripes: true, ruff: true }, now);
}
// Leeuw: bij het brullen een ring om hem heen (zo ver reikt de brul); bij de sprong een korte rode pijl.
function drawLion(f, wind, now) {
  const d = f.d;
  if (f.state === 'roar') {
    const k = 1 - f.t / d.roar.windup;
    ctx.strokeStyle = `rgba(212,70,59,${.15 + .5 * k})`; ctx.lineWidth = 2 + 2 * k; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.arc(f.x, f.y, d.roar.radius, 0, TAU2); ctx.stroke(); ctx.setLineDash([]);
  }
  if (f.roared > 0 && f.state !== 'dead') {   // de brul: een golf die naar buiten gaat
    const k = 1 - f.roared / .5;
    ctx.strokeStyle = `rgba(245,234,214,${.6 * (1 - k)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, d.roar.radius * (.3 + .7 * k), 0, TAU2); ctx.stroke();
  }
  if (f.state === 'windup') drawChargeArrow(f, d.pounce.speed * d.pounce.time, 1 - f.t / d.windup);
  drawCat(f, wind, { body: d.tunic, head: '#d8a45a', tail: '#c08a48', tuft: '#5a3416', mane: '#7a4a1e', muzzle: '#ecd6ae', roar: f.state === 'roar' ? 1 + Math.sin(now / 60) * .3 : 0 }, now);
}
// Rode waaier voor een brede klap (beer, slurf van de olifant).
function drawFan(f, len, arc, k) {
  ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.aim);
  ctx.fillStyle = `rgba(212,70,59,${.1 + .3 * k})`; ctx.strokeStyle = `rgba(212,70,59,${.3 + .5 * k})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, len, -arc, arc); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
// Beer van bovenaf: ruige vacht, schouderbult, ronde kop met oortjes en snuit. Op de achterpoten: groter, klauwen naar voren.
function drawBear(f, wind, now) {
  const d = f.d, r = d.radius, fl = f.flash > 0, dead = f.state === 'dead', up = f.state === 'windup', wf = c => fl ? '#fff' : c;
  const [ph, amt] = gait(f, r * .9);
  if (up) drawFan(f, d.reach + r + d.lunge + PLAYER.radius, d.swipe.arc, wind);
  ctx.save(); ctx.translate(f.x, f.y);
  ctx.fillStyle = 'rgba(40,20,8,.28)'; ctx.beginPath(); ctx.ellipse(3, 4, r * 1.3, r * .95, f.face, 0, TAU2); ctx.fill();
  ctx.rotate(f.face); const sc = up ? 1 + .15 * wind : 1; ctx.scale(sc, sc);
  const body = f.raged ? mix(d.tunic, '#8e1f1a', .3) : d.tunic, dark = mix(body, '#000000', .3);
  paws([[-r * .85, -r * .55, Math.PI], [-r * .85, r * .55, 0]], ph, amt, r * .25, wf(dark), r * .26, r * .2);   // achterpoten
  const paw = up ? r * .8 : f.lunge > 0 ? r * (.6 + .6 * f.lunge) : r * .45;   // voorpoten
  for (const s of [-1, 1]) {
    const px = paw + (up || f.lunge > 0 ? 0 : Math.sin(ph + (s > 0 ? Math.PI : 0)) * r * .22 * amt);
    ctx.fillStyle = wf(dark); ctx.strokeStyle = EDGE; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(px, s * r * .72, r * .3, r * .24, 0, 0, TAU2); ctx.fill(); ctx.stroke();
    if (!fl) { ctx.strokeStyle = '#f4ead8'; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(px + r * .26, s * r * .72 + k * 2.4); ctx.lineTo(px + r * .42, s * r * .72 + k * 2.9); ctx.stroke(); } ctx.lineCap = 'butt'; }
  }
  // lijf met ruige rand; woedend staan de haren meer overeind
  const p = new Path2D(), jag = f.raged ? .1 : .06, n = 40;
  for (let i = 0; i <= n; i++) {
    const a = i / n * TAU2, k = 1 + (i % 2 ? jag : 0) + Math.sin(i * 2.3) * .02;
    const x = -r * .15 + Math.cos(a) * r * 1.12 * k, y = Math.sin(a) * r * .86 * k;
    i ? p.lineTo(x, y) : p.moveTo(x, y);
  }
  ctx.lineWidth = 2.6; ctx.strokeStyle = EDGE; ctx.lineJoin = 'round'; ctx.stroke(p); ctx.fillStyle = wf(body); ctx.fill(p); ctx.lineJoin = 'miter';
  if (!fl) {
    ctx.save(); ctx.clip(p);
    ctx.fillStyle = mix(body, '#e8c890', .22); ctx.beginPath(); ctx.ellipse(r * .25, 0, r * .48, r * .55, 0, 0, TAU2); ctx.fill();   // schouderbult, lichter
    ctx.strokeStyle = mix(body, '#000000', .25); ctx.lineWidth = 1; ctx.lineCap = 'round';   // vachtplukken
    for (const [x, y] of [[-.9, -.4], [-.7, .3], [-.5, -.15], [-.3, .45], [-.15, -.45], [0, .1], [-.85, .05], [-.45, .15], [-.6, -.5], [.05, -.2]]) {
      ctx.beginPath(); ctx.moveTo(r * x, r * y); ctx.quadraticCurveTo(r * (x - .1), r * (y + .05), r * (x - .2), r * y); ctx.stroke();
    }
    ctx.lineCap = 'butt'; ctx.restore();
  }
  // kop
  const hx = r * .78, head = mix(body, '#000000', .12);
  for (const s of [-1, 1]) { ctx.fillStyle = wf(head); ctx.strokeStyle = EDGE; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(hx - r * .2, s * r * .4, r * .16, 0, TAU2); ctx.fill(); ctx.stroke();
    if (!fl) { ctx.fillStyle = mix(body, '#000000', .45); ctx.beginPath(); ctx.arc(hx - r * .19, s * r * .41, r * .08, 0, TAU2); ctx.fill(); } }   // oortjes
  blob([[hx, 0, r * .5, r * .48], [hx + r * .4, 0, r * .25, r * .2]], wf(head));
  if (!fl) {
    ctx.fillStyle = '#b08a62'; ctx.beginPath(); ctx.ellipse(hx + r * .45, 0, r * .2, r * .17, 0, 0, TAU2); ctx.fill();   // lichte snuit
    if (up || f.raged) { ctx.fillStyle = '#5a1c16'; ctx.beginPath(); ctx.ellipse(hx + r * .62, 0, r * .07, r * .1, 0, 0, TAU2); ctx.fill(); }   // bek open
  }
  ctx.fillStyle = '#1a0c08'; ctx.beginPath(); ctx.ellipse(hx + r * .6, 0, r * .07, r * .09, 0, 0, TAU2); ctx.fill();   // neus
  eyes(hx + r * .15, r * .2, dead, 1.5);
  ctx.restore();
}
// Olifant van bovenaf: groot grijs lijf met rimpels, kop met twee bulten, flaporen, slagtanden en een slurf die smaller wordt.
function drawElephant(f, wind, now) {
  const d = f.d, r = d.radius, fl = f.flash > 0, dead = f.state === 'dead', wf = c => fl ? '#fff' : c;
  const [ph, amt] = gait(f, r * .7);
  if (f.state === 'aim') {   // rode baan tot de muur
    const k = 1 - f.t / d.stampede.windup;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.aim);
    ctx.fillStyle = `rgba(212,70,59,${.08 + .22 * k})`; ctx.strokeStyle = `rgba(212,70,59,${.3 + .5 * k})`; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
    let len = 0; while (len < 900 && Math.hypot((f.x + Math.cos(f.aim) * len) / W.rx, (f.y + Math.sin(f.aim) * len) / W.ry) < 1) len += 6;   // tot de muur
    ctx.beginPath(); ctx.rect(r * .5, -r, Math.max(0, len - r * .5), r * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }
  if (f.state === 'windup') drawFan(f, d.reach + r + d.lunge + PLAYER.radius, d.trunk.arc, wind);
  if (f.state === 'stunned') {   // verdoofd: witte rand en sterretjes
    ctx.strokeStyle = `rgba(255,255,255,${.55 + .25 * Math.sin(now / 80)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, r + 6, 0, TAU2); ctx.stroke();
    ctx.fillStyle = '#f0c56a'; for (let i = 0; i < 4; i++) { const a = now / 300 + i * TAU2 / 4; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * r * .7, f.y - r * .6 + Math.sin(a) * r * .3, 2.4, 0, TAU2); ctx.fill(); }
  }
  ctx.save(); ctx.translate(f.x, f.y);
  ctx.fillStyle = 'rgba(40,20,8,.3)'; ctx.beginPath(); ctx.ellipse(4, 5, r * 1.3, r * .95, f.face, 0, TAU2); ctx.fill();
  ctx.rotate(f.face);
  const skin = d.tunic, dark = mix(skin, '#000000', .25);
  // staart met kwastje
  const sway = dead ? 3 : Math.sin(now / 300) * 4;
  ctx.strokeStyle = wf(dark); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * 1.15, 0); ctx.quadraticCurveTo(-r * 1.35, sway * .5, -r * 1.5, sway); ctx.stroke(); ctx.lineCap = 'butt';
  ctx.fillStyle = wf('#3a3a36'); ctx.beginPath(); ctx.ellipse(-r * 1.53, sway, 3, 2, 0, 0, TAU2); ctx.fill();
  // poten: ronde voeten met teennagels
  const run = f.state === 'run' ? 1 : amt;
  for (const [x, y, k] of [[r * .5, -r * .66, 0], [r * .5, r * .66, Math.PI], [-r * .7, -r * .62, Math.PI], [-r * .7, r * .62, 0]]) {
    const px = x + Math.sin(ph + k) * r * .18 * run;
    ctx.fillStyle = wf(dark); ctx.strokeStyle = EDGE; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(px, y, r * .22, 0, TAU2); ctx.fill(); ctx.stroke();
    if (!fl) { ctx.fillStyle = '#e8e0cc'; for (const t of [-.5, 0, .5]) { ctx.beginPath(); ctx.arc(px + Math.cos(t) * r * .18, y + Math.sin(t) * r * .18, 1.4, 0, TAU2); ctx.fill(); } }
  }
  // lijf met rimpels en een ruggengraat
  const p = blob([[-r * .2, 0, r * 1.05, r * .82]], wf(skin), 3);
  if (!fl) {
    ctx.save(); ctx.clip(p);
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.ellipse(-r * .2, -r * .45, r * .9, r * .3, 0, 0, TAU2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath(); ctx.ellipse(-r * .2, r * .5, r * .95, r * .3, 0, 0, TAU2); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,15,.22)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-r * 1.15, 0); ctx.quadraticCurveTo(-r * .3, -r * .04, r * .5, 0); ctx.stroke();   // ruggengraat
    ctx.lineWidth = .9;
    for (const x of [-.95, -.7, -.45, -.2, .05]) for (const s of [-1, 1]) {   // rimpels dwars over de rug
      ctx.beginPath(); ctx.moveTo(r * x, s * r * .12); ctx.quadraticCurveTo(r * (x + .08), s * r * .4, r * (x - .02), s * r * .7); ctx.stroke();
    }
    ctx.restore();
  }
  // flaporen
  const flap = f.state === 'run' || f.state === 'aim' ? Math.sin(now / 70) * .25 : Math.sin(now / 500) * .08;
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(r * .55, s * r * .35); ctx.rotate(s * (.5 + flap));
    const e = blob([[-r * .1, s * r * .36, r * .36, r * .52]], wf(mix(skin, '#ffffff', .08)), 2.6);
    if (!fl) {
      ctx.save(); ctx.clip(e);
      ctx.strokeStyle = 'rgba(160,110,105,.55)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(-r * .1, s * r * .36, r * .33, r * .49, 0, 0, TAU2); ctx.stroke();   // roze rand
      ctx.strokeStyle = 'rgba(30,20,15,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r * .1, s * r * .05); ctx.quadraticCurveTo(-r * .2, s * r * .3, -r * .1, s * r * .7); ctx.stroke();   // vouw
      ctx.restore();
    }
    ctx.restore();
  }
  // kop met twee bulten op het voorhoofd
  const hx = r * .72;
  blob([[hx, 0, r * .42, r * .38], [hx - r * .08, -r * .16, r * .3, r * .24], [hx - r * .08, r * .16, r * .3, r * .24]], wf(skin));
  if (!fl) { ctx.strokeStyle = 'rgba(30,20,15,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx - r * .35, 0); ctx.lineTo(hx + r * .1, 0); ctx.stroke(); }
  eyes(hx + r * .12, r * .32, dead, 1.6);
  // slagtanden
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(r * 1, s * r * .2); ctx.quadraticCurveTo(r * 1.35, s * r * .32, r * 1.48, s * r * .14);
    ctx.strokeStyle = EDGE; ctx.lineWidth = 4.2; ctx.stroke(); ctx.strokeStyle = wf('#f4ead8'); ctx.lineWidth = 2.6; ctx.stroke();
  }
  // slurf: smaller naar het puntje, met ringen
  const sw = f.lunge > 0 ? Math.sin(f.lunge * Math.PI) * 1.2 : f.state === 'windup' ? -wind * .8 : dead ? .4 : Math.sin(now / 400) * .2;
  const P0 = [r * 1.02, 0], P1 = [r * 1.5, sw * r * .4], P2 = [r * 1.78, sw * r * .9], q = t => [(1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0], (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1]];
  const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([...q(t), r * (.15 - .07 * t)]); }
  ctx.fillStyle = EDGE; for (const [x, y, w] of pts) { ctx.beginPath(); ctx.arc(x, y, w + 1.3, 0, TAU2); ctx.fill(); }
  ctx.fillStyle = wf(mix(skin, '#000000', .08)); for (const [x, y, w] of pts) { ctx.beginPath(); ctx.arc(x, y, w, 0, TAU2); ctx.fill(); }
  if (!fl) {
    ctx.strokeStyle = 'rgba(30,20,15,.3)'; ctx.lineWidth = .8;
    for (let i = 2; i < 14; i += 2) { const [x, y, w] = pts[i], [x2, y2] = pts[i + 1], a = Math.atan2(y2 - y, x2 - x) + Math.PI / 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * w * .9, y + Math.sin(a) * w * .9); ctx.lineTo(x - Math.cos(a) * w * .9, y - Math.sin(a) * w * .9); ctx.stroke(); }
  }
  ctx.lineCap = 'butt'; ctx.restore();
}
// Hyena van bovenaf: hoge schouders en een smal achterlijf, gevlekt, borstelige manen over de rug, grote ronde oren, donkere snuit.
function drawHyena(f, wind, now) {
  const d = f.d, r = d.radius, fl = f.flash > 0, dead = f.state === 'dead', wf = c => fl ? '#fff' : c;
  const [ph, amt] = gait(f, r * .9);
  ctx.save(); ctx.translate(f.x, f.y);
  ctx.fillStyle = 'rgba(40,20,8,.25)'; ctx.beginPath(); ctx.ellipse(2, 3, r * 1.5, r * .8, f.face, 0, TAU2); ctx.fill();
  ctx.rotate(f.face);
  const body = wind > 0 ? mix(d.tunic, C.blood, .5 * wind) : d.tunic, dark = '#3e3024';
  // korte borstelige staart
  const sway = dead ? 2 : Math.sin(now / 120 + (f.seed ??= Math.random() * 6)) * r * .25;
  ctx.fillStyle = wf('#4a3a2a'); ctx.strokeStyle = EDGE; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(-r * 1.3, sway, r * .38, r * .17, sway * .05, 0, TAU2); ctx.fill(); ctx.stroke();
  paws([[r * .62, -r * .5, 0], [r * .62, r * .5, Math.PI], [-r * .7, -r * .38, Math.PI], [-r * .7, r * .38, 0]], ph, amt, r * .3, wf('#5a4a36'), r * .22, r * .14);
  const p = blob([[-r * .6, 0, r * .45, r * .36], [-r * .05, 0, r * .72, r * .42], [r * .38, 0, r * .48, r * .5]], wf(body), 2);
  if (!fl) {
    ctx.save(); ctx.clip(p); ctx.fillStyle = dark;
    for (const [x, y, s] of [[-.95, -.2, .1], [-.8, .22, .12], [-.6, -.32, .11], [-.5, .1, .09], [-.35, .38, .12], [-.3, -.15, .1], [-.1, .25, .11], [-.05, -.38, .12], [.15, .05, .09], [.25, -.3, .11], [.35, .4, .1], [-.7, -.05, .08], [.5, -.12, .08]]) {
      ctx.beginPath(); ctx.ellipse(r * x, r * y, r * s, r * s * .8, x * 3, 0, TAU2); ctx.fill();   // vlekken
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(42,32,24,.75)'; ctx.beginPath(); ctx.moveTo(r * .8, 0);   // borstelige manen over nek en rug, aflopend naar achteren
    for (let i = 0; i <= 8; i++) ctx.lineTo(r * (.75 - i * .15), -r * (i % 2 ? .13 : .07) * (1 - i / 10));
    for (let i = 8; i >= 0; i--) ctx.lineTo(r * (.75 - i * .15), r * (i % 2 ? .13 : .07) * (1 - i / 10));
    ctx.closePath(); ctx.fill();
  }
  const hx = r * .98;
  for (const s of [-1, 1]) {   // grote ronde oren
    ctx.fillStyle = wf('#6e5a3e'); ctx.strokeStyle = EDGE; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(hx - r * .18, s * r * .36, r * .2, 0, TAU2); ctx.fill(); ctx.stroke();
    if (!fl) { ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(hx - r * .16, s * r * .37, r * .1, 0, TAU2); ctx.fill(); }
  }
  blob([[hx, 0, r * .38, r * .33], [hx + r * .35, 0, r * .25, r * .2]], wf('#a8936c'), 2);
  ctx.fillStyle = wf('#2a2018'); ctx.beginPath(); ctx.ellipse(hx + r * .45, 0, r * .18 + (f.chew > 0 ? Math.sin(now / 40) * 1 : 0), r * .16, 0, 0, TAU2); ctx.fill();   // donkere snuit, kauwt
  eyes(hx + r * .12, r * .13, dead, r * .085);
  ctx.restore();
}
// Dood dier: plas bloed, het dier ligt stil en vervaagt.
function drawDeadAnimal(f, now) {
  const r = f.d.radius, a = Math.max(0, Math.min(1, f.dead * 1.4));
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(90,20,15,.35)'; ctx.beginPath(); ctx.ellipse(f.x + 2, f.y + 2, r * 1.4, r * .95, f.face, 0, TAU2); ctx.fill();
  const draw = { tiger: drawTiger, lion: drawLion, hyena: drawHyena, bear: drawBear, elephant: drawElephant }[ANIMAL_KIND(f.d)];
  ctx.translate(f.x, f.y); ctx.rotate(f.face); ctx.scale(1, .78); ctx.rotate(-f.face + .45); ctx.translate(-f.x, -f.y);   // op zijn zij
  ctx.filter = 'saturate(.55) brightness(.92)';
  if (draw) draw(f, 0, now);
  ctx.filter = 'none';
  ctx.restore();
}
const ANIMAL_KIND = d => d.dash ? 'tiger' : d.ai;
// Boogschutter: boog voor het lijf; bij het richten een rode stippellijn naar je toe die steeds feller wordt.
function drawArcher(f, wind) {
  const d = f.d, r = d.radius;
  if (f.dagger || f.state === 'swap') {   // dolk in de hand, boog op de rug
    drawBody(f, r, wind > 0 ? mix(d.tunic, C.blood, .4 * wind) : d.tunic, C[d.skin], C[d.hair], { flash: f.flash, belt: d.belt, armR: 4, armL: 4 });
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.face);
    ctx.strokeStyle = '#5a3a26'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-r + 4, 0, 8, Math.PI - 1, Math.PI + 1); ctx.stroke();   // boog op de rug
    if (f.dagger) {
      const k = f.state === 'swap' ? 1 - f.t / d.dagger.swap : 1;   // trekt hem tijdens het wisselen
      const off = f.state === 'windup' ? -3 * wind : (f.lunge || 0) * 5, x0 = r - 2 + off;
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#4a2f1e'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x0, 3); ctx.lineTo(x0 + 3, 3); ctx.stroke();   // heft
      ctx.strokeStyle = EDGE; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(x0 + 3, 3); ctx.lineTo(x0 + 10, 3); ctx.stroke();
      ctx.strokeStyle = '#e4e0d4'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x0 + 3, 3); ctx.lineTo(x0 + 10, 3); ctx.stroke();   // lemmet
      ctx.globalAlpha = 1;
    }
    ctx.lineCap = 'butt'; ctx.restore();
    return;
  }
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
  try { if (typeof PAD !== 'undefined') PAD.poll(); if (!S.paused) update(dt); draw(now); placeHint(); } catch (err) { console.error(err); }   // PAD: controller (pad.js)
}

/* ---------- Interface ---------- */
function foeSummary() {
  return listSummary(testCount ? [['slave', testCount]] : roundsOf(fightDef())[S.round] || []);
}
function updateUI() {
  $('fightTitle').textContent = fightTitle();
  const def = fightDef(), rounds = roundsOf(def).length;
  $('foeText').textContent = def.kind === 'tournament' ? `· Round ${toRoman(S.round + 1)}/${toRoman(rounds)}` : '';
  $('money').textContent = S.money;
  for (const slot of ['melee', 'ranged']) {   // vakken in de wastablet: icoon van het wapen, en bij de boog hoeveel pijlen
    const b = $('slot_' + slot), key = S[slot], ico = b.querySelector('.slot-ico');
    if (ico.dataset.key !== (key || '') && typeof SHOPART !== 'undefined') { ico.dataset.key = key || ''; ico.innerHTML = key ? SHOPART.icon(key) : ''; }   // shops.js laadt na dit bestand
    b.querySelector('span').textContent = key && slot === 'ranged' ? `${S.ammo}/${me.ammoMax}` : '';
    b.title = `${key ? WEAPONS[key].name : slot === 'ranged' ? 'No bow' : ''} (key ${slot === 'melee' ? 1 : 2})`;
    b.disabled = !key; b.classList.toggle('on', S.active === slot && !S.switching); b.classList.toggle('to', S.switching > 0 && S.switchTo === slot);
  }
  const nb = $('slot_net'); nb.hidden = !(S.netsLeft > 0 || (S.cfg && S.cfg.type === 'hunt')); nb.querySelector('span').textContent = S.netsLeft || 0; nb.disabled = !(S.netsLeft > 0);
  $('armor').textContent = me.armor;
  $('hpText').textContent = `${P.hp} / ${me.maxHp}`;
  $('hpFill').style.transform = `scaleX(${P.hp / me.maxHp})`;
  $('hpBar').classList.toggle('low', P.hp / me.maxHp <= .3);
  const lv = levelOf(S.xp), lo = LEVELS[lv - 2] || 0, hi = LEVELS[lv - 1];
  $('lvlText').textContent = toRoman(lv); $('lvlText').title = `Level ${toRoman(lv)}`;
  $('xpText').textContent = hi ? `${S.xp} / ${hi}` : `${S.xp}`;
  $('xpFill').style.transform = `scaleX(${hi ? (S.xp - lo) / (hi - lo) : 1})`;
}
function openResult() {
  SFX.mood('calm');
  S.paused = true; keys.clear(); steer.down = false;
  const won = S.over === 'won', def = fightDef();
  if (!won && def.kind === 'tournament') { openMercy(); return; }
  $('resultEyebrow').textContent = fightTitle();
  $('resultTitle').textContent = won ? 'Victory' : 'Defeat';
  const total = S.orbs.length;
  $('resultText').textContent = won
    ? `You had ${P.hp} of ${me.maxHp} health left and picked up ${S.gained} of ${total} XP. `
      + (S.levelUps ? `Level ${toRoman(levelOf(S.xp))}: you have ${S.points} ${S.points === 1 ? 'point' : 'points'} to spend.` : `${LEVELS[levelOf(S.xp) - 1] - S.xp} XP to the next level.`)
      + (def.kind === 'tournament' ? ` You survived all ${toRoman(def.rounds.length)} rounds of the tournament.` : '')
    : 'The crowd jeers. You may try again. The XP from this fight is lost; your stats stay as they were.';
  $('resultMoney').textContent = won ? `+${S.delta} d` : S.delta ? `−${-S.delta} d` : '';
  $('resultMoney').classList.toggle('loss', !won);
  $('resultBtn').textContent = 'Continue';
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
  d.hidden = true; d.innerHTML = `<dt>Round</dt><dd>${toRoman(S.round + 1)} of ${toRoman(def.rounds.length)}</dd>
    <dt>Damage dealt</dt><dd>${fmt(S.dealt)} of ${S.poolHp}</dd>
    <dt>Favor of the crowd</dt><dd>${Math.round(chance * 100)}%</dd>
    <dt>Verdict</dt><dd class="${ok ? 'good' : 'bad'}">${ok ? 'You live. The tournament is over, no reward.' : 'Mors. You start over at fight I.'}</dd>`;
  b.textContent = ok ? 'Continue' : 'Start over'; b.dataset.ok = ok ? '1' : '';
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
  if (S.test) { S.test = null; S.xp = S.xpStart; S.points = S.pointsStart; if (S.over === 'won') S.over = 'done'; return; }   // testarena telt niet mee
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
  S.seen = {};   // uitleg over nieuwe spullen weer tonen
  S.mode = 'fight'; S.stage = 0; S.inStage = 0; S.finished = false;
  S.xp = 0; S.points = POINTS.start; for (const k in S.stats) S.stats[k] = 0;
  S.money = 0; S.delta = 0; S.owned = ['fists']; S.gear = { body: null, head: null, shield: null, mount: null, quiver: null }; S.townSeen = false; S.ammo = 0; S.melee = 'fists'; S.ranged = null; S.active = 'melee'; S.switching = 0; PLAYER.weapon = 'fists'; S.over = null;
  startFight(); S.paused = false;
}
$('startBtn').onclick = () => { SFX.init(); $('start').hidden = true; newRun(); };
// Titelscherm: Play opent de instellingen (moeilijkheid, volume, toetsen), Credits de naamsvermelding
const showOnly = id => { for (const o of ['title', 'settings', 'credits', 'start']) $(o).hidden = o !== id; };
$('titlePlay').onclick = () => { SFX.init(); showOnly('start'); $('startBtn').focus(); };
$('titleCredits').onclick = () => { showOnly('credits'); $('creditsBack').focus(); };
$('titleSettings').onclick = () => { SFX.init(); showOnly('settings'); $('volume').focus(); };
$('settingsBack').onclick = () => { showOnly('title'); $('titleSettings').focus(); };
$('creditsBack').onclick = () => { showOnly('title'); $('titleCredits').focus(); };
$('startBack').onclick = () => { showOnly('title'); $('titlePlay').focus(); };
// Volume: schuifjes op het startscherm en in de straat. Bij het schuiven hoor je meteen hoe hard het is.
let volPreview = 0;
function showVolume() {
  const v = SFX.muted ? 0 : Math.round(SFX.volume * 100);
  for (const id of ['volume', 'pauseVolume']) $(id).value = v;
  $('volumeOut').textContent = v; showMute();
}
for (const id of ['volume', 'pauseVolume']) $(id).addEventListener('input', ev => {
  SFX.init(); SFX.setVolume(ev.target.value / 100);
  if (+ev.target.value === 0) SFX.setMuted(true);
  showVolume();
  const now = performance.now(); if (now - volPreview > 350) { volPreview = now; SFX.cheer(.4); }   // proefje
});
// Moeilijkheid kiezen op het startscherm (onthouden in de browser).
function showDifficulty() { document.querySelectorAll('#diff button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.d === difficulty))); }
document.querySelectorAll('#diff button').forEach(b => b.onclick = () => {
  difficulty = b.dataset.d; try { localStorage.setItem('rn-difficulty', difficulty); } catch (e) {}
  showDifficulty();
});
showDifficulty();
// Geluid aan/uit: knop rechtsboven, of de toets M.
function showMute() { const b = $('mute'); b.setAttribute('aria-pressed', String(!SFX.muted)); b.title = (SFX.muted ? 'Sound off' : 'Sound on') + ' (M)'; }
$('slot_melee').onclick = () => { switchTo('melee'); $('slot_melee').blur(); };
$('slot_ranged').onclick = () => { switchTo('ranged'); $('slot_ranged').blur(); };
$('slot_net').onclick = () => { throwPlayerNet(); $('slot_net').blur(); };
$('mute').onclick = () => { SFX.init(); SFX.setMuted(!SFX.muted); if (!SFX.muted && SFX.volume === 0) SFX.setVolume(.6); showVolume(); };
showMute(); showVolume();

/* ---------- Punten verdelen ---------- */
// mode 'toTown' = na de uitslag, op weg naar de stad; 'town' = vanuit de straat (Klaar = terug de straat in); 'arena' = op weg naar het gevecht.
let added = {}, statsMode = 'town';
function openStats(mode = 'town') {
  S.paused = true; added = {}; statsMode = mode;
  for (const k in STATS) added[k] = 0;
  $('statsBack').hidden = mode !== 'arena';
  $('stats').classList.toggle('over-arena', mode === 'toTown');   // net uit een gevecht: de arena blijft erachter zichtbaar
  renderStats(); $('stats').hidden = false; $('statsBtn').focus();
}
function statEffect(k, n) {
  const v = { ...S.stats, [k]: n };
  return { strength: `${fmt(WEAPONS[S.melee].dmg + STAT_RULES.dmg * v.strength)} damage`,
           agility: `speed ${PLAYER.speed + STAT_RULES.speed * v.agility}`,
           vitality: `${PLAYER.hp + STAT_RULES.hp * v.vitality} health`,
           haste: `${fmt(Math.round(WEAPONS[S.melee].cooldown * Math.max(STAT_RULES.hasteMin, 1 - STAT_RULES.haste * v.haste) * 100) / 100)} s per attack` }[k];
}
function renderStats() {
  const list = $('statList'); list.innerHTML = '';
  for (const [k, d] of Object.entries(STATS)) {
    const li = document.createElement('li');
    li.innerHTML = `<div><b>${d.nl}</b><span class="eff">${statEffect(k, S.stats[k])}</span></div>
      <div class="stepper"><button aria-label="${d.nl} down" ${added[k] ? '' : 'disabled'}>−</button><output aria-label="${S.stats[k]}">${S.stats[k] ? toRoman(S.stats[k]) : '–'}</output><button aria-label="${d.nl} up" ${S.points ? '' : 'disabled'}>+</button></div>`;
    const [minus, plus] = li.querySelectorAll('button');
    minus.onclick = () => { added[k]--; S.stats[k]--; S.points++; renderStats(); };
    plus.onclick = () => { added[k]++; S.stats[k]++; S.points--; renderStats(); };
    list.appendChild(li);
  }
  $('statsBtn').textContent = statsMode === 'arena' ? 'To the arena' : 'Continue';
  $('statsTitle').textContent = S.points ? toRoman(S.points) : '';
}
$('statsBtn').onclick = () => {
  $('stats').hidden = true;
  if (statsMode === 'arena') enterArena(); else if (statsMode === 'toTown') openTown(); else TOWN.purse();
};
$('statsBack').onclick = () => { $('stats').hidden = true; openTown(); };

function toWorld(ev) {
  const r = cvs.getBoundingClientRect();
  steer.x = (ev.clientX - r.left - view.cw / 2) / view.scale + cam.x;
  steer.y = (ev.clientY - r.top - view.ch / 2) / view.scale + cam.y;
}
cvs.addEventListener('contextmenu', ev => ev.preventDefault());
// Muis: je kijkt altijd naar je muis; linkermuisknop = slaan, rechtermuisknop vasthouden = blokken (of pareren zonder schild).
// Aanraakscherm: slepen om te lopen (zoals vroeger).
function mouseAt(ev) {
  const r = cvs.getBoundingClientRect();
  steer.hx = (ev.clientX - r.left - view.cw / 2) / view.scale + cam.x; steer.hy = (ev.clientY - r.top - view.ch / 2) / view.scale + cam.y;
  steer.mouse = true;
}
cvs.addEventListener('pointerdown', ev => {
  if (S.paused) return;
  if (ev.pointerType === 'touch') { cvs.setPointerCapture(ev.pointerId); steer.down = steer.active = true; toWorld(ev); return; }
  mouseAt(ev); ev.preventDefault();
  if (ev.button === 0) { P.atkBuf = ATTACK.buffer; P.atkMouse = true; }           // slaan
  else if (ev.button === 2) { steer.block = true; P.guardPress = true; }          // blokken
});
cvs.addEventListener('pointermove', ev => {
  if (ev.pointerType === 'touch') { if (steer.down) toWorld(ev); return; }
  mouseAt(ev);
});
addEventListener('pointerup', ev => { if (ev.button === 2) steer.block = false; if (ev.pointerType === 'touch') steer.down = false; });
cvs.addEventListener('pointercancel', () => { steer.down = false; steer.block = false; });
const anyOverlay = () => ['title', 'settings', 'credits', 'start', 'result', 'stats', 'town', 'shop', 'pick', 'judge'].some(id => !$(id).hidden);
// Pauze: Escape tijdens een gevecht, nog eens Escape (of Verder) om door te gaan.
const inFight = () => !S.paused && !anyOverlay();
// In de stad werkt Escape hetzelfde (geluid en, alleen daar, de stats); de stad blijft gewoon gepauzeerd.
const inTown = () => !$('town').hidden;
function pause() {
  S.paused = true; keys.clear(); steer.down = false; steer.block = false; showVolume();
  if (!inTown()) SFX.mood('calm');
  const st = $('pauseStats'); st.hidden = !inTown();
  st.textContent = S.points ? `Stats · ${toRoman(S.points)}` : 'Stats'; st.classList.toggle('has-points', S.points > 0);
  $('pause').hidden = false; $('pauseBtn').focus();
}
function resume() {
  $('pause').hidden = true; keys.clear();
  if (inTown()) return;
  S.paused = false; if (S.intro <= 0) SFX.mood('fight');
}
$('pauseBtn').onclick = resume;
$('pauseStats').onclick = () => { $('pause').hidden = true; openStats('town'); };
addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && !(ev.target.closest && ev.target.closest('#dev'))) {
    if (!$('pause').hidden) { ev.preventDefault(); resume(); return; }
    if (!$('credits').hidden) { ev.preventDefault(); $('creditsBack').click(); return; }
    if (!$('settings').hidden) { ev.preventDefault(); $('settingsBack').click(); return; }
    if (!$('start').hidden) { ev.preventDefault(); $('startBack').click(); return; }
    if (inTown()) {   // de straat: winkel of arenakeuze eerst dicht, anders pauzemenu
      ev.preventDefault();
      if (!$('shop').hidden) $('shopBack').click();
      else if (!$('pick').hidden) $('pickBack').click();
      else if ($('stats').hidden) pause();
      return;
    }
    if (inFight()) { ev.preventDefault(); pause(); return; }
  }
  if (anyOverlay() || !$('pause').hidden) return;
  const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  if (k === 'm') { $('mute').click(); return; }
  if (k === '1') { switchTo('melee'); return; }
  if (k === '2') { switchTo('ranged'); return; }
  if (k === ' ') { tryRoll(); ev.preventDefault(); return; }
  if (k === 'e') { throwPlayerNet(); return; }   // net (jacht)
  if (k === 'j') { P.atkBuf = ATTACK.buffer; P.atkMouse = false; ev.preventDefault(); return; }   // slaan
  if (k === 'k' || k === 'Shift') { if (!ev.repeat) P.guardPress = true; keys.add(k); ev.preventDefault(); return; }   // blokken
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s'].includes(k)) {
    if (P.netted > 0 && !ev.repeat) { P.netted -= NET.mash; if (P.netted <= 0) releaseNet(); }   // losrammelen
    keys.add(k); ev.preventDefault();
  }
});
addEventListener('keyup', ev => keys.delete(ev.key.length === 1 ? ev.key.toLowerCase() : ev.key));
addEventListener('blur', () => { keys.clear(); steer.block = false; if (inFight()) pause(); });   // ander venster: vanzelf pauze
new ResizeObserver(() => fitWorld(false)).observe(stage);

startFight();
requestAnimationFrame(loop);

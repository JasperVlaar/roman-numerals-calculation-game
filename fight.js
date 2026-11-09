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
const LEVELS = [4, 12, 24, 40, 60, 85, 115, 150, 190, 235, 285, 340, 400, 470, 550, 640, 740, 850, 970, 1100, 1240, 1390, 1550, 1720, 1900, 2090, 2300];   // tot niveau XXVIII: genoeg voor alle 5 blokken
// life = na zoveel seconden verdwijnt een bolletje; de laatste 'fade' seconden knippert en vervaagt het.
const XP = { life: 7.8, fade: 3, perFoe: { slave: 5, archer: 5, tiro: 10, tiroStick: 12, murmillo: 15, thraex: 14, hoplomachus: 15, retiarius: 15, secutor: 16, dimachaerus: 14, tiger: 15, lion: 16, hyena: 2, eques: 18, sagittarius: 16, essedarius: 18, essedarius2: 22, bear: 20, elephant: 40 } /* kampioen: ×CHAMPION.xp van zijn klasse */, speed: [70, 150], friction: 3.5, settle: .3, pickup: 6, magnet: 26, pull: 160, collect: 5 };
const levelOf = xp => 1 + LEVELS.filter(t => xp >= t).length;
const hitChance = att => Math.min(STAT_RULES.hitMax, STAT_RULES.hitBase + STAT_RULES.hit * att);
const blockChance = def => Math.min(STAT_RULES.blockMax, STAT_RULES.blockBase + STAT_RULES.block * def);
// reach = hoe ver voorbij je eigen lijf je raakt; cooldown = seconden tussen twee slagen; price = in denarii bij de wapensmid.
// Je begint met je vuisten, net als een slaaf: zelfde schade, zelfde bereik, ongeveer even vaak.
const WEAPONS = {
  fists: { name: 'Vuisten', kind: 'fists', dmg: 2, reach: 10, cooldown: 2, swing: .22, knock: 0, price: 0 },   // vuisten duwen niet terug
  // hit: 'single' = één tegenstander; 'sweep' = iedereen binnen bereik in een boog voor je (arc = halve breedte, rad);
  // 'pierce' = iedereen op een smalle lijn recht voor je (width = halve breedte).
  stick: { name: 'Stok', kind: 'stick', dmg: 2, reach: 21, cooldown: 2, swing: .22, knock: 85, price: 12, hit: 'sweep', arc: 1.6 },
  gladius: { name: 'Gladius', kind: 'sword', dmg: 5, reach: 19, cooldown: 2, swing: .2, knock: 60, price: 40, hit: 'sweep', arc: .52 },   // arc .52 = ca. 60° breed
  // Hasta: speer. Groot bereik en duwt ver, maar trager.
  hasta: { name: 'Hasta', kind: 'spear', dmg: 6, reach: 22, cooldown: 2.3, swing: .26, knock: 120, price: 70, hit: 'pierce', width: 7 },
  // Bogen: schieten vanzelf op de dichtstbijzijnde tegenstander binnen range. Staat er iemand tegen je aan, dan sla je met je vuisten.
  // Behendigheid: per punt STAT_RULES.shoot korter wachten tussen twee pijlen (hoogstens tot shootMin × cooldown). Niet samen met een schild.
  bow: { name: 'Korte boog', kind: 'bow', dmg: 2, range: 150, arrow: 300, reach: 0, cooldown: 1.8, swing: .25, knock: 20, price: 60 },
  composite: { name: 'Composietboog', kind: 'bow', dmg: 3, range: 190, arrow: 340, reach: 0, cooldown: 1.4, swing: .25, knock: 30, price: 140 },
  // Late wapens (after = pas te koop na zoveel gewonnen toernooien).
  // Sica: kort gebogen zwaard van de Thraciërs. Minder schade dan de gladius, maar veel sneller.
  sica: { name: 'Sica', kind: 'sword', dmg: 4, reach: 17, cooldown: 1.3, swing: .16, knock: 30, price: 150, hit: 'sweep', arc: .6, after: 2 },
  // Spatha: lang zwaard van de ruiterij. Zwaar, lang bereik, brede zwaai.
  spatha: { name: 'Spatha', kind: 'sword', dmg: 7, reach: 23, cooldown: 2.2, swing: .24, knock: 90, price: 240, hit: 'sweep', arc: .75, after: 3 },
  // Scythische boog: ver, hard en snel.
  scythian: { name: 'Scythische boog', kind: 'bow', dmg: 4, range: 220, arrow: 380, reach: 0, cooldown: 1.3, swing: .25, knock: 40, price: 260, after: 3 }
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
  slave: { name: 'slaaf', plural: 'slaven', hp: 14, dmg: 2, armor: 0, attack: 0, defense: 0, speed: 68, radius: 10, reach: 10, windup: .36, recover: .45, cooldown: 1.6, lunge: 9,
           tunic: '#9c8a6c', hair: 'hair-2', skin: 'skin-2' },
  // Tiro: een nieuweling uit de gladiatorenschool, met slechte uitrusting (een leren kap, armor 1).
  // Vecht met een rudis, het houten oefenzwaard. Sneller en harder dan een slaaf, zet korter aan.
  tiro: { name: 'tiro', plural: "tiro's", hp: 16, dmg: 3, armor: 1, attack: 0, defense: 0, speed: 74, radius: 11, reach: 13, windup: .32, recover: .4, cooldown: 1.4, lunge: 10, weapon: 'rudis',
           tunic: '#8a6a48', belt: '#3b2a1e', hair: 'bronze', skin: 'skin-3', cap: true },
  // Tiro met stok: langer bereik en zijn klap duwt je ver weg (knock).
  tiroStick: { name: 'tiro met stok', plural: "tiro's met stok", hp: 22, dmg: 3, armor: 1, attack: 0, defense: 0, speed: 72, radius: 11, reach: 16, windup: .4, recover: .45, cooldown: 1.7, lunge: 10, knock: 140, weapon: 'stick',
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
  thraex: { name: 'Thraciër', plural: 'Thraciërs', hp: 14, dmg: 3, armor: 0, attack: 0, defense: 0, speed: 70, radius: 11, reach: 13, windup: .35, recover: .55, cooldown: 1.4, lunge: 14, weapon: 'sica', ai: 'thraex',
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
  archer: { name: 'boogschutter', plural: 'boogschutters', hp: 10, dmg: 2, armor: 0, attack: 0, defense: 0, speed: 60, radius: 10, reach: 0, windup: .7, recover: .35, cooldown: 2.6, lunge: 0,
           ranged: { min: 90, max: 180, flee: 60, arrow: 240, life: 1.4 },
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
  essedarius2: { name: 'essedarius met twee paarden', plural: 'essedarii met twee paarden', hp: 12, dmg: 4, armor: 0, attack: 0, defense: 0, speed: 150, radius: 20, reach: 0, windup: .5, recover: .4, cooldown: 1.8, lunge: 0, knock: 240, ai: 'essedarius',
           mount: { kind: 'chariot', horses: 2, hp: 26, color: '#5a3a26' }, turn: 1.5, loop: .62, hunt: { every: 6, time: 1.6 }, jav: { min: 60, max: 240, lead: .3 },
           foot: { ai: 'melee', weapon: 'javelin', radius: 11, reach: 18, speed: 72, windup: .4, recover: .5, cooldown: 1.5, lunge: 8, dmg: 3 },
           tunic: '#4a6a4a', belt: '#d49a48', hair: 'hair-2', skin: 'skin-2' },
  // Beer: traag en taai. Gaat op zijn achterpoten staan (rear: rode waaier voor hem, windup s) en haalt dan breed uit
  // (swipe.arc = halve hoek) met veel terugstoot. Onder rage van zijn leven wordt hij woest: sneller en korter aanzetten.
  bear: { name: 'beer', plural: 'beren', hp: 40, dmg: 5, armor: 1, attack: 0, defense: 0, speed: 55, radius: 15, reach: 16, windup: .8, recover: .9, cooldown: 1.2, lunge: 8, knock: 300, animal: true, ai: 'bear',
          swipe: { arc: .75 }, rage: { at: .5, speed: 85, windup: .55 }, tunic: '#6b4a2e', hair: 'hair-2', skin: 'skin-2' },
  // Olifant: baas-dier. Kan niet weggeduwd worden (heavy). Slurf: dichtbij een brede zwiep (trunk) die je ver wegslaat.
  // Stormloop: richten (rode baan, stampede.windup s) en dan rechtdoor tot de muur; vertrapt jou en ook andere vijanden
  // (stampede.trample schade). Tegen de muur: stun seconden verdoofd, en dan telt zijn armor niet.
  elephant: { name: 'olifant', plural: 'olifanten', hp: 70, dmg: 6, armor: 2, attack: 0, defense: 0, speed: 42, radius: 24, reach: 20, windup: .6, recover: .8, cooldown: 1.6, lunge: 6, knock: 320, animal: true, heavy: true, ai: 'elephant',
          trunk: { dmg: 3, arc: 1, knock: 360 }, stampede: { windup: 1, speed: 250, time: 2.6, cd: 6, min: 70, trample: 10 }, stun: 2.2, tunic: '#8a8a86', hair: 'hair-2', skin: 'skin-2' },
  // Tijger: komt later binnen (door de poort) en springt op je af. Hij duikt eerst in elkaar en kijkt in een vaste
  // richting (rode pijl, windup seconden); dan stormt hij die kant op (dash), heel ver. Stap of rol opzij.
  tiger: { name: 'tijger', plural: 'tijgers', hp: 26, dmg: 4, armor: 0, attack: 0, defense: 0, speed: 62, radius: 12, reach: 0, windup: .8, recover: 1.1, cooldown: 1.2, lunge: 0, knock: 160, animal: true,
          dash: { range: 190, speed: 380, time: .5 }, tunic: '#d9782e', hair: 'hair-2', skin: 'skin-2' },
  // Leeuw: sluipt in een cirkel om je heen (orbit). Brult af en toe (roar): een ring om hem heen; sta je erin, dan loop
  // je slow.time seconden half zo snel. Springt (pounce: rode pijl, kort) als je met een ander bezig bent, of na
  // pounce.cd seconden. De sprong is kort: rol erdoorheen of stap opzij.
  lion: { name: 'leeuw', plural: 'leeuwen', hp: 26, dmg: 5, armor: 0, attack: 0, defense: 0, speed: 66, radius: 13, reach: 0, windup: .5, recover: 1, cooldown: 1, lunge: 0, knock: 180, animal: true, ai: 'lion',
          orbit: 85, roar: { windup: .7, radius: 115, cd: 6 }, slow: { time: 1.2, mul: .5 }, pounce: { range: 140, speed: 340, time: .32, cd: 2.8, busy: 1.2 },
          tunic: '#c9934a', hair: 'hair-2', skin: 'skin-2' },
  // Hyena: in een roedel. Bijten en wegrennen (flee s). Ruikt bloed: zit je in een net of heb je minder dan 'weak' van je
  // leven, dan bijten ze steeds door. En ze eten je XP-bolletjes op (smell = zo ver ruiken ze een bolletje) als ze kunnen.
  hyena: { name: 'hyena', plural: "hyena's", hp: 6, dmg: 1, armor: 0, attack: 0, defense: 0, speed: 96, radius: 9, reach: 8, windup: .22, recover: .25, cooldown: 1.1, lunge: 6, animal: true, ai: 'hyena',
           flee: .8, weak: .35, smell: 90, tunic: '#9a8460', hair: 'hair-2', skin: 'skin-2' },
};
// Kampioen (primus palus): de beste van zijn school. Schrijf 'champion:<klasse>' (bijv. 'champion:murmillo') in STAGES:
// dezelfde klasse en hetzelfde gedrag, maar met meer leven, schade en armor, groter en met een gouden kam.
const CHAMPION = { hp: 1.8, dmg: 1.3, armor: 1, size: 1.2, xp: 2.5 };
function foeBase(type) {
  if (!type.startsWith('champion:')) return FOES[type];
  const b = FOES[type.slice(9)];
  return { ...b, name: `kampioen (${b.name})`, plural: `kampioenen (${b.plural})`, hp: Math.round(b.hp * CHAMPION.hp), dmg: Math.round(b.dmg * CHAMPION.dmg),
           armor: b.armor + CHAMPION.armor, radius: Math.round(b.radius * CHAMPION.size), reach: Math.round(b.reach * CHAMPION.size), champ: true,
           mount: b.mount && { ...b.mount, hp: Math.round(b.mount.hp * CHAMPION.hp) } };
}
const foeXp = t => t.startsWith('champion:') ? Math.round((XP.perFoe[t.slice(9)] || 3) * CHAMPION.xp) : XP.perFoe[t] || 3;
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
      { kind: 'normal', foes: [['tiro', 1], ['archer', 1], ['slave', 2]], reward: 18 },
      { kind: 'boss', foes: [['murmillo', 1], ['slave', 2]], reward: 25 } ],
    tourney: { kind: 'tournament', rounds: [[['slave', 3]], [['slave', 2], ['archer', 2]], [['champion:murmillo', 1]]], reward: 60 } },
  // Blok 2: de Thraciër en de hoplomachus komen erbij, en de klassieke paringen met de murmillo.
  { fights: [
      { kind: 'normal', foes: [['thraex', 1], ['slave', 2]], reward: 20 },
      { kind: 'normal', foes: [['hoplomachus', 1], ['archer', 2]], extra: { at: .5, foes: [['tiro', 2]] }, reward: 22 },
      { kind: 'normal', foes: [['slave', 10]], extra: { at: .5, foes: [['hyena', 4]] }, reward: 25 },
      { kind: 'normal', foes: [['murmillo', 1], ['thraex', 1]], extra: { at: .5, foes: [['tiro', 2]] }, reward: 30 },
      { kind: 'boss', foes: [['hoplomachus', 1], ['thraex', 1]], extra: { at: .5, foes: [['murmillo', 1]] }, reward: 40 } ],
    tourney: { kind: 'tournament', rounds: [[['tiro', 2], ['archer', 2]], [['murmillo', 1], ['slave', 4]], { foes: [['champion:hoplomachus', 1]], extra: { after: 8, foes: [['tiger', 1]] } }], reward: 120 } },
  // Blok 3: na toernooi II gaan de stallen open. De retiarius en de secutor (zijn vaste tegenstander) komen erbij.
  { fights: [
      { kind: 'normal', foes: [['retiarius', 1], ['slave', 2]], reward: 35 },
      { kind: 'normal', foes: [['secutor', 1], ['archer', 2]], extra: { at: .5, foes: [['dimachaerus', 1]] }, reward: 40 },
      { kind: 'normal', foes: [['slave', 8], ['archer', 2]], extra: { at: .4, foes: [['lion', 1], ['tiger', 1], ['hyena', 4]] }, reward: 45 },
      { kind: 'normal', foes: [['retiarius', 1], ['secutor', 1], ['archer', 1]], extra: { at: .4, foes: [['dimachaerus', 1], ['tiger', 1]] }, reward: 55 },
      { kind: 'boss', foes: [['murmillo', 1], ['retiarius', 1]], extra: { at: .5, foes: [['secutor', 1], ['hoplomachus', 1]] }, reward: 70 } ],
    tourney: { kind: 'tournament', rounds: [[['thraex', 1], ['hoplomachus', 1]], [['slave', 10], ['archer', 3]], { foes: [['champion:secutor', 1], ['retiarius', 1]], extra: { after: 8, foes: [['lion', 2]] } }], reward: 200 } },
  // Blok 4: de bereden vechters. Ruiters en strijdwagens: ontwijken (rollen) en het paard of de wagen raken.
  { fights: [
      { kind: 'normal', foes: [['eques', 1], ['tiro', 2]], reward: 80 },
      { kind: 'normal', foes: [['sagittarius', 1], ['slave', 4]], extra: { at: .5, foes: [['hyena', 3]] }, reward: 90 },
      { kind: 'normal', foes: [['essedarius', 1], ['archer', 2]], extra: { at: .5, foes: [['thraex', 1]] }, reward: 100 },
      { kind: 'normal', foes: [['eques', 2]], extra: { at: .5, foes: [['essedarius2', 1]] }, reward: 110 },
      { kind: 'boss', foes: [['essedarius2', 1], ['sagittarius', 1]], extra: { at: .5, foes: [['eques', 1], ['dimachaerus', 1]] }, reward: 130 } ],
    tourney: { kind: 'tournament', rounds: [[['murmillo', 1], ['thraex', 1]], [['sagittarius', 2], ['slave', 4]], { foes: [['champion:eques', 1], ['essedarius', 1]], extra: { after: 8, foes: [['lion', 1], ['tiger', 1]] } }], reward: 320 } },
  // Blok 5: de grote dieren en de beste gladiatoren. Het slottoernooi eindigt met een olifant.
  { fights: [
      { kind: 'normal', foes: [['bear', 1], ['tiro', 2]], reward: 150 },
      { kind: 'normal', foes: [['murmillo', 1], ['secutor', 1], ['retiarius', 1]], extra: { at: .5, foes: [['bear', 1]] }, reward: 160 },
      { kind: 'normal', foes: [['elephant', 1], ['slave', 6]], reward: 170 },
      { kind: 'normal', foes: [['eques', 1], ['sagittarius', 1], ['thraex', 1]], extra: { at: .5, foes: [['bear', 1], ['hyena', 4]] }, reward: 185 },
      { kind: 'boss', foes: [['elephant', 1], ['dimachaerus', 1]], extra: { at: .5, foes: [['champion:murmillo', 1]] }, reward: 220 } ],
    tourney: { kind: 'tournament', rounds: [[['champion:thraex', 1], ['champion:hoplomachus', 1]], [['essedarius2', 1], ['sagittarius', 2]], { foes: [['elephant', 1], ['champion:secutor', 1]], extra: { after: 10, foes: [['lion', 1], ['bear', 1]] } }], reward: 500 } }
];
const KINDS = { normal: 'Gevecht', boss: 'Tussenbaas', tournament: 'Toernooi' };
// Tussen de rondes krijg je heal × je maximale leven terug. Ga je neer, dan beslist Caesar.
// Kans op duim omhoog = mercyBase + mercyFavor × (schade die je uitdeelde / alle leven van alle tegenstanders), hoogstens mercyMax.
// Duim omhoog: je leeft, maar het toernooi en de beloning zijn weg (geen boete); je mag het opnieuw proberen. Duim omlaag: dood, alles opnieuw vanaf gevecht I.
const TOURNAMENT = { heal: 0, mercyBase: .15, mercyFavor: .8, mercyMax: .95 };
// Waar je bent: S.stage (welk blok), S.inStage (zoveel gevechten van dat blok gewonnen), S.finished (alle toernooien gewonnen).
const stageOf = () => STAGES[Math.min(S.stage, STAGES.length - 1)];
const fightIdx = () => S.finished ? stageOf().fights.length - 1 : Math.min(S.inStage, stageOf().fights.length - 1);
const fightNumber = () => STAGES.slice(0, Math.min(S.stage, STAGES.length - 1)).reduce((n, st) => n + st.fights.length, 0) + fightIdx() + 1;
const fightOpen = () => S.finished || S.inStage < stageOf().fights.length;   // na 5 gevechten: eerst het toernooi
const fightDef = () => S.test ? { kind: 'normal', foes: S.test, reward: 0 } : S.mode === 'tournament' ? stageOf().tourney : stageOf().fights[fightIdx()];   // S.test = testarena (spqr-menu)
const fightTitle = () => S.test ? 'Testarena' : S.mode === 'tournament' ? `Toernooi ${toRoman(Math.min(S.stage, STAGES.length - 1) + 1)}` : `Gevecht ${toRoman(fightNumber())}`;
// Een ronde is een lijst [[type, aantal], ...] of { foes, extra }. extra = versterking die door de poort binnenkomt:
// { foes, at: 0,5 } = als de helft van de eerste groep verslagen is; { foes, after: 8 } = na 8 seconden.
const roundsOf = def => (def.rounds || [def.extra ? { foes: def.foes, extra: def.extra } : def.foes]).map(r => Array.isArray(r) ? r : r.foes);
const extraOf = def => def.rounds ? def.rounds.map(r => Array.isArray(r) ? null : r.extra || null) : [def.extra || null];
const listSummary = list => list.map(([t, n]) => `${n} ${n > 1 ? foeBase(t).plural : foeBase(t).name}`).join(' en ');
// Na elk gevecht ga je de stad in; terug naar de arena door op de arena te klikken.
const MONEY = { lossShare: .5 };
// Uitrusting naast je wapen, in vakken: body (harnas), head (helm), shield (schild). Eén ding per vak.
// armor = elke klap doet zoveel minder (maar altijd minstens 1); speed = loopsnelheid erbij of eraf;
// knock = hoe ver je wordt weggeduwd (× dit getal); front = schild: pijlen van voren houdt het tegen, klappen van voren doen 1 minder.
const GEAR = {
  leather: { slot: 'body',   name: 'Leren harnas',      price: 35,  armor: 1, short: 'armor 1', desc: 'armor 1: elke klap 1 minder' },
  galea:   { slot: 'head',   name: 'Galea',             price: 30,  knock: .5, short: '−50% wegduwen', desc: 'je wordt half zo ver weggeduwd' },
  scutum:  { slot: 'shield', name: 'Scutum',            price: 50,  front: 1, short: 'van voren −1 · pijlen 0', desc: 'pijlen van voren houdt hij tegen; klappen van voren 1 minder' },
  secutorHelm: { slot: 'head', name: 'Secutor-helm', price: 70, netMul: .5, speed: -8, short: '−50% net · −8 snelheid', desc: 'glad en rond: een net glijdt er twee keer zo snel af, maar je krijgt weinig lucht (−8 loopsnelheid)' },
  lorica:  { slot: 'body',   name: 'Lorica segmentata', price: 120, armor: 2, speed: -8, short: 'armor 2 · −8 snelheid', desc: 'armor 2, maar −8 loopsnelheid' },
  // Late uitrusting (after = pas te koop na zoveel gewonnen toernooien).
  parma:   { slot: 'shield', name: 'Parma', price: 90, front: 1, arrows: false, roll: .25, after: 1, short: 'van voren −1 · rol 25% sneller', desc: 'klein rond schild: klappen van voren 1 minder (pijlen niet) en je kunt 25% sneller weer rollen' },
  squamata: { slot: 'body', name: 'Lorica squamata', price: 300, armor: 3, speed: -6, after: 3, short: 'armor 3 · −6 snelheid', desc: 'schubbenharnas: armor 3, maar −6 loopsnelheid' },
  quadriga: { slot: 'mount', name: 'Quadriga', price: 500, needsBow: true, mountSpeed: 1.2, ramMul: 1.6, after: 3, short: 'met boog (2) · sneller, harder omver', desc: 'vier paarden: 20% sneller en je rijdt 60% harder omver' },
  quiver:  { slot: 'quiver', name: 'Pijlkoker', price: 30, capacity: 15, short: '15 pijlen', desc: '15 pijlen mee in plaats van 5' },
  chariot: { slot: 'mount',  name: 'Strijdwagen', price: 250, needsBow: true, short: 'met boog (2)', desc: 'veel sneller en je rijdt tegenstanders omver; stilstaan kan niet; je rijdt als je de boog vasthoudt (vak 2), met je melee-wapen sta je naast de wagen' }
};
const SLOTS = { body: 'Harnas', head: 'Helm', shield: 'Schild', quiver: 'Pijlkoker', mount: 'Rijdier' };
// Pijlen koop je bij de boogmaker: price denarii per stuk. Zonder pijlkoker kun je er base meenemen.
const AMMO = { base: 5, price: 2 };
// De winkels in de straat. after = open na zoveel gewonnen toernooien (0 = vanaf het begin); wares = sleutels uit WEAPONS of GEAR.
const SHOPS = {
  smith:   { nl: 'Wapensmid',   la: 'Faber',      after: 0, wares: ['stick', 'gladius', 'hasta', 'sica', 'spatha'] },
  armorer: { nl: 'Harnasmaker', la: 'Loricarius', after: 0, wares: ['leather', 'galea', 'secutorHelm', 'parma', 'scutum', 'lorica', 'squamata'] },
  bowyer:  { nl: 'Boogmaker',   la: 'Arcuarius',  after: 1, wares: ['arrows', 'bow', 'composite', 'scythian', 'quiver'] },
  stable:  { nl: 'Stallen',     la: 'Stabulum',   after: 2, wares: ['chariot', 'quadriga'] }
};
// Hoeveel toernooien je gewonnen hebt (voor winkels en spullen met 'after').
const tourneysWon = () => S.finished ? STAGES.length : S.stage;
const itemOpen = k => ((GEAR[k] || WEAPONS[k] || {}).after || 0) <= tourneysWon();
const shopOpen = id => SHOPS[id].wares.length > 0 && (S.finished ? STAGES.length : S.stage) >= SHOPS[id].after;
const FEEL = { hitstop: .06, shake: 5, playerShake: 9, flash: .12 };
// Aftellen aan het begin (III, II, I, Pugnate!): je kunt al lopen, tegenstanders wachten nog.
const INTRO = { step: .8, count: 3, shout: .7 };
// Grootte van het zandveld (oppervlak in wereld-eenheden). Kleiner = de camera zit dichter op het gevecht.
const FIGHT_AREA = 30000;
// Ontwijkrol (Spatie): time = hoe lang de rol duurt, inv = de eerste zoveel seconden kun je niet geraakt worden,
// speed = vaart tijdens de rol, cd = wachttijd daarna (Behendigheid: −cdAgi per punt, nooit onder cdMin).
// Niet op de strijdwagen en niet als je in een net zit.
const ROLL = { time: .3, inv: .25, speed: 240, cd: 1.2, cdAgi: .05, cdMin: .6 };
// Net van de retiarius: flight = vliegtijd (zo lang zie je de rode cirkel), radius = hoe groot het net is,
// hold = zo lang zit je vast, mash = elke druk op een looptoets maakt het zoveel korter,
// pick = zo dichtbij moet hij komen om zijn net op te rapen, block = sta jij zo dichtbij het net, dan kan hij het niet pakken.
// Werpsperen (hasta van de eques, speren van de essedarius): een rode cirkel waar hij landt, flight seconden vliegen.
const JAVELIN = { flight: .6, radius: 16 };
const NET = { flight: .6, radius: 20, hold: 1.5, mash: .12, pick: 12, block: 18 };

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
  get speed() { return (PLAYER.speed + STAT_RULES.speed * S.stats.agility + gearSum('speed')) * (S.active === 'ranged' && S.ranged ? ARMS.speedMul : 1) * (P.slow > 0 ? P.slowMul : 1); },   // brul van de leeuw: trager
  get armor() { return gearSum('armor'); },
  get riding() { return !!S.gear.mount && S.active === 'ranged' && !!S.ranged; },   // op de wagen alleen met de boog in je handen
  get ammoMax() { return S.gear.quiver ? GEAR[S.gear.quiver].capacity : AMMO.base; },
  get mount() { return GEAR[S.gear.mount] || {}; },
  get netMul() { const g = GEAR[S.gear.head]; return g && g.netMul || 1; },
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
  Object.assign(P, { bleed: null, slow: 0, slowMul: 1, roll: 0, rollInv: 0, rollCd: 0, netted: 0, heading: -Math.PI / 2, spd: 0, punch: 0, x: 0, y: W.ry * .45, vx: 0, vy: 0, face: -Math.PI / 2, hp: me.maxHp, cd: 0, swing: 0, hurt: 0, flash: 0, target: null, dead: false });
  steer.active = false;
  S.foes = []; S.floats = []; S.dust = []; S.arrows = []; S.nets = []; S.javs = []; S.wrecks = []; S.calls = []; S.over = null; S.overT = 0; S.freeze = 0; S.shake = 0;
  S.intro = INTRO.step * INTRO.count; S.shout = 0;
  S.orbs = []; S.collect = 0; S.gained = 0; S.levelUps = 0; S.xpStart = S.xp; S.pointsStart = S.points;
  S.round = 0; S.dealt = 0; S.switching = 0;
  if (S.gear.mount && S.ranged) S.active = 'ranged';   // met een strijdwagen begin je op de wagen
  syncWeapon(); P.cdMax = 0;
  S.poolHp = [...roundsOf(def), ...extraOf(def).filter(Boolean).map(e => e.foes)].flat().reduce((n, [t, c]) => n + (foeBase(t).hp + (foeBase(t).mount ? foeBase(t).mount.hp : 0)) * c, 0);
  spawnRound();
}
// De tegenstanders van de huidige ronde (een gewoon gevecht heeft één ronde).
function spawnRound() {
  const list = testCount ? [['slave', testCount]] : roundsOf(fightDef())[S.round];
  S.foes = []; S.extra = testCount ? null : extraOf(fightDef())[S.round]; S.extraDone = false; S.roundT = 0;
  S.firstCount = list.reduce((n, [, c]) => n + c, 0);
  let i = 0, total = list.reduce((n, [, c]) => n + c, 0);
  for (const [type, count] of list) for (let k = 0; k < count; k++, i++) {
    // Tegenstanders staan links en rechts, een eind van je af, en komen meteen op je af.
    const side = i % 2 ? 1 : -1, spread = (Math.floor(i / 2) - (Math.ceil(total / 2) - 1) / 2) * 26;
    S.foes.push(mkFoe(type, side * W.rx * .5, spread - W.ry * .1)); call(type);
  }
  updateUI();
}
// Versterking: de poorten links en rechts gaan open en de nieuwe tegenstanders lopen het zand op.
function checkExtra() {
  const e = S.extra; if (!e || S.extraDone) return;
  const dead = S.foes.filter(f => f.state === 'dead').length, allDead = dead >= S.foes.length;
  if (!(e.at !== undefined ? dead >= Math.ceil(S.firstCount * e.at) : S.roundT >= e.after || allDead)) return;
  S.extraDone = true; S.gate = 1.2;
  let i = 0;
  for (const [type, count] of e.foes) for (let k = 0; k < count; k++, i++) {
    const side = i % 2 ? 1 : -1, f = mkFoe(type, side * (W.rx - 18), (Math.floor(i / 2) - .5) * 22);
    f.face = side > 0 ? Math.PI : 0; f.cd = .8; S.foes.push(f); call(type);
    for (let j = 0; j < 6; j++) S.dust.push({ x: f.x + (Math.random() - .5) * 16, y: f.y + (Math.random() - .5) * 16, t: 1 });
  }
  arenaCheer(); SFX.cheer(.8); S.shake = Math.max(S.shake, 4);
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
  easy:   { nl: 'Makkelijk', windup: 1.8,  cooldown: 1.6,  arrow: .7 },
  normal: { nl: 'Normaal',   windup: 1.35, cooldown: 1.25, arrow: .85 },
  hard:   { nl: 'Zwaar',     windup: 1,    cooldown: 1,    arrow: 1 }
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
  return { type, d, x, y, vx: 0, vy: 0, face: Math.atan2(P.y - y, P.x - x), hp: d.hp, state: 'walk', t: 0, cd: .2 + Math.random() * .4,
           flash: 0, lunge: 0, dead: 0, wob: Math.random() * 10, cracks: 0, shieldOn: !!d.shield, spear: d.weapon === 'spear', parryCd: 1.5, hasNet: d.ai === 'retiarius', breath: d.breath || 0, mount: d.mount ? { ...d.mount, max: d.mount.hp } : null, heading: Math.atan2(P.y - y, P.x - x) };
}

/* ---------- Gevecht ---------- */
// soft = omverrijden: geen hit-stop en weinig schudden, anders schokt het als je door een groep rijdt.
function hitFoe(f, dmg, from, soft) {
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
  if (!soft && shieldBlocks(f, from)) { crack(f, dmg >= f.d.shield.heavy || w.kind === 'spear' ? 2 : 1, from); return; }
  if (!soft && f.state === 'parry') { parried(f); return; }                  // Thraciër stapt opzij en snijdt terug
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
  float(f.x, f.y - 18, real ? '−' + fmt(real) : '0', C.ink);
  const now = performance.now();
  if (!soft || now - (S.lastRamSfx || 0) > 120) { SFX.hit(); S.lastRamSfx = now; }   // niet tien klappen tegelijk
  SFX.cheer(f.hp <= 0 ? .75 : .35);   // het publiek juicht bij elke rake klap, harder als hij valt
  if (breaks && f.hp > 0) breakSpear(f);
  if (!soft && f.d.flinch && f.hp > 0 && (f.state === 'windup' || f.state === 'combo')) { f.state = 'stagger'; f.t = f.d.flinch; f.combo = 0; }   // dimachaerus: raak je hem tijdens zijn aanval, dan breekt zijn combo
  if (f.hp <= 0) {
    f.state = 'dead'; f.dead = 1; f.vx *= 1.6; f.vy *= 1.6;
    dropXp(f);
    checkExtra();
    if (S.foes.every(o => o.state === 'dead') && (!S.extra || S.extraDone)) { S.collect = XP.collect; arenaCheer(); SFX.cheer(1); }   // nog even oprapen
  }
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
  S.javs.push({ x0: f.x, y0: f.y, x, y, t: 0, T: JAVELIN.flight / (DIFFICULTY[difficulty] || DIFFICULTY.hard).arrow, dmg }); SFX.fx('javelin');   // makkelijk: langer in de lucht
}
function updateJavs(dt) {
  for (const j of S.javs) {
    j.t += dt;
    if (j.t >= j.T && !j.done) {
      j.done = true; j.stuck = 1.2;
      if (!P.dead && Math.hypot(P.x - j.x, P.y - j.y) <= JAVELIN.radius + PLAYER.radius * .5) hitPlayer({ x: j.x0, y: j.y0, d: { dmg: j.dmg, knock: 40 } });
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
  float(def.x, def.y - 20, 'geblokt', C.bronze);
  SFX.block();
}
function hitPlayer(f) {
  if (P.hurt > 0 || P.dead || P.rollInv > 0) return;   // tijdens het begin van de rol raakt niets je
  // Schild: geldt alleen als de klap of pijl van voren komt (binnen 60° van waar je naar kijkt).
  const toward = Math.abs(((Math.atan2(f.y - P.y, f.x - P.x) - P.face + Math.PI * 3) % TAU2) - Math.PI);
  const front = me.shield && !f.d.hook && toward < Math.PI / 3 ? GEAR[S.gear.shield].front : 0;   // de sica haakt om je schild heen
  if (front && f.arrow && GEAR[S.gear.shield].arrows !== false) {   // pijl op het schild (de parma houdt geen pijlen tegen)
    P.block = .3; P.blockA = Math.atan2(f.y - P.y, f.x - P.x);
    SFX.block(); return;
  }
  const real = Math.max(1, f.d.dmg - me.armor - front);   // harnas en schild: altijd minstens 1
  P.hp = Math.max(S.god ? 1 : 0, P.hp - real); P.hurt = PLAYER.invuln; P.flash = FEEL.flash;   // S.god: onsterfelijk (testmenu)
  const dx = P.x - f.x, dy = P.y - f.y, l = Math.hypot(dx, dy) || 1;
  const push = (170 + (f.d.knock || 0)) * me.knock;
  P.vx += dx / l * push; P.vy += dy / l * push;
  S.freeze = FEEL.hitstop * 1.4; S.shake = Math.max(S.shake, FEEL.playerShake);
  float(P.x, P.y - 20, real ? '−' + fmt(real) : '0', C.blood);
  if (f.d.bleed) P.bleed = { t: f.d.bleed.time, tick: 1, dmg: f.d.bleed.dmg, src: f };   // sica: je bloedt
  SFX.hurt();
  if (P.hp > 0) SFX.cheer(Math.min(.8, .35 + real / me.maxHp));   // het publiek geniet ook als jíj bloedt, harder bij een flinke klap
  $('stage').classList.remove('hurt'); void $('stage').offsetWidth; $('stage').classList.add('hurt');
  updateUI();
  if (P.hp <= 0) { P.dead = true; endFight(false); }
}
// Ontwijkrol: in de richting van je toetsen (of waar je naar kijkt).
function tryRoll() {
  if (P.dead || S.over || S.paused || S.intro > 0 || me.riding || P.netted > 0 || P.rollCd > 0) return;
  let dx = 0, dy = 0;
  if (keys.has('ArrowLeft') || keys.has('a')) dx--; if (keys.has('ArrowRight') || keys.has('d')) dx++;
  if (keys.has('ArrowUp') || keys.has('w')) dy--; if (keys.has('ArrowDown') || keys.has('s')) dy++;
  // Richting: naar je muis (als die boven de arena is), anders je toetsen, anders waar je naar kijkt.
  const mouse = steer.hoverT && performance.now() - steer.hoverT < 4000;
  P.rollDir = mouse ? Math.atan2(steer.hy - P.y, steer.hx - P.x) : dx || dy ? Math.atan2(dy, dx) : P.face;
  P.roll = ROLL.time; P.rollInv = ROLL.inv;
  P.rollCd = Math.max(ROLL.cdMin, ROLL.cd - ROLL.cdAgi * S.stats.agility) * (1 - gearSum('roll'));   // parma: sneller weer rollen
  for (let j = 0; j < 4; j++) S.dust.push({ x: P.x + (Math.random() - .5) * 10, y: P.y + (Math.random() - .5) * 10, t: 1 });
  SFX.fx('roll');
}
// Net: vliegt van de retiarius naar een plek (rode cirkel); wie er dan in staat, zit vast.
function throwNet(f, x, y) {
  const n = { x0: f.x, y0: f.y, x, y, t: 0, T: NET.flight / (DIFFICULTY[difficulty] || DIFFICULTY.hard).arrow, state: 'fly', owner: f };   // makkelijk: langer in de lucht
  S.nets.push(n); f.hasNet = false; f.myNet = n; SFX.fx('netThrow');
}
function releaseNet() {
  P.netted = 0;
  const n = S.nets.find(n => n.state === 'held');
  if (n) { n.state = 'ground'; n.x = P.x; n.y = P.y; }
}
function updateNets(dt) {
  for (const n of S.nets) {
    if (n.state !== 'fly') continue;
    n.t += dt;
    if (n.t >= n.T) {
      n.state = 'ground';
      if (!P.dead && !(P.rollInv > 0) && Math.hypot(P.x - n.x, P.y - n.y) <= NET.radius + PLAYER.radius * .5) {
        n.state = 'held'; P.netted = NET.hold * me.netMul; P.roll = 0; arenaCheer(); SFX.cheer(.7); SFX.fx('net'); S.shake = Math.max(S.shake, 2);
      }
    }
  }
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
    S.floats.push({ text: 'LVL UP', color: '#7ee36a', t: 1.6, follow: true, dx: 13, dy: -14, size: 11 });
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
      if (!P.dead && f.cd === 0 && d <= D.range) { f.state = 'windup'; f.t = f.d.windup; f.aim = Math.atan2(ey, ex); }
    } else if (f.state === 'windup') {
      f.t -= dt; f.face = f.aim;
      if (f.t <= 0) { f.state = 'dash'; f.t = D.time; f.hitP = false; SFX.cheer(.5); }
    } else if (f.state === 'dash') {
      f.t -= dt; mx = Math.cos(f.aim) * D.speed; my = Math.sin(f.aim) * D.speed;
      if (!f.hitP && gap <= 2) { f.hitP = true; hitPlayer(f); }
      if (f.t <= 0) { f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown; }
    } else if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; }
    return [mx, my];
  },
  // Boogschutter: afstand houden, richten, schieten.
  ranged(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const R = f.d.ranged;
    f.face = lerpAngle(f.face, Math.atan2(ey, ex), 1 - Math.exp(-dt * (f.state === 'windup' ? 3 : 8)));
    if (f.state === 'walk') {
      let dir = 0;
      if (d < R.flee + f.d.radius) dir = -1;          // te dichtbij: weglopen
      else if (d > R.max) dir = 1;                     // te ver: dichterbij
      const side = Math.sin(performance.now() / 900 + f.wob) > 0 ? 1 : -1;   // anders langzaam opzij stappen
      if (dir) { mx = ex / d * f.d.speed * dir; my = ey / d * f.d.speed * dir; }
      else { mx = -ey / d * f.d.speed * .35 * side; my = ex / d * f.d.speed * .35 * side; }
      if (!P.dead && f.cd === 0 && d <= R.max + 30) { f.state = 'windup'; f.t = f.d.windup; }   // ook als je dichtbij staat
    } else if (f.state === 'windup') {
      f.t -= dt;
      if (f.t <= 0) {
        const a = Math.atan2(ey, ex);
        S.arrows.push({ x: f.x + Math.cos(a) * (f.d.radius + 4), y: f.y + Math.sin(a) * (f.d.radius + 4), vx: Math.cos(a) * R.arrow, vy: Math.sin(a) * R.arrow, t: 0, life: R.life, dmg: f.d.dmg, stuck: 0 });
        f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown;
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
    return [mx, my];
  },
  // Murmillo: langzaam en in dekking oplopen; aanzetten → schildstoot → steek → open staan. Zonder schild: hetzelfde, maar alles raakt.
  murmillo(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const B = f.d.bash;
    if (f.state === 'stagger') { f.t -= dt; if (f.t <= 0) { f.state = 'recover'; f.t = .3; } return [0, 0]; }
    if (f.state === 'walk') {
      f.face = lerpAngle(f.face, Math.atan2(ey, ex), 1 - Math.exp(-dt * 6));
      if (gap > f.d.reach * .6) { mx = Math.cos(f.face) * f.d.speed; my = Math.sin(f.face) * f.d.speed; }
      if (!P.dead && gap <= f.d.reach + 4 && f.cd === 0) { f.state = 'windup'; f.t = f.d.windup; }
    } else if (f.state === 'windup') {
      f.face = lerpAngle(f.face, Math.atan2(ey, ex), 1 - Math.exp(-dt * 4));
      f.t -= dt;
      if (f.t <= 0) {   // schildstoot: duwt je weg, geen schade
        f.state = 'thrust'; f.t = B.gap; f.lunge = .6;
        if (!P.dead && !(P.hurt > 0) && gap <= f.d.reach + 4) { P.vx += ex / d * B.push * me.knock; P.vy += ey / d * B.push * me.knock; S.shake = Math.max(S.shake, 2); SFX.block(); }
      }
    } else if (f.state === 'thrust') {   // de steek: hij stapt naar voren
      f.t -= dt; mx = Math.cos(f.face) * f.d.speed * 2.2; my = Math.sin(f.face) * f.d.speed * 2.2;
      if (f.t <= 0) {
        f.lunge = 1; f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown;
        if (gap > f.d.reach + f.d.lunge) { /* ontweken */ }
        else if (Math.random() >= hitChance(f.d.attack)) { /* mis */ }
        else if (Math.random() < me.block) blocked(P, f);
        else hitPlayer(f);
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
      if (!P.dead && f.parryCd === 0 && gap < f.d.parry.near && P.cd < .35) { f.state = 'parry'; f.t = f.d.parry.time; return [0, 0]; }
      const want = f.d.reach + f.d.orbit, side = Math.sin(performance.now() / 1300 + f.wob) > 0 ? 1 : -1;
      const radial = gap > want + 6 ? 1 : gap < want - 6 ? -.8 : 0;   // op zijn afstand blijven en eromheen draaien
      mx = (ex / d * radial - ey / d * side * .9) * f.d.speed; my = (ey / d * radial + ex / d * side * .9) * f.d.speed;
      if (!P.dead && f.cd === 0 && gap < want + 12) { f.state = 'windup'; f.t = f.d.windup; }
    } else if (f.state === 'windup') {
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 6)); f.t -= dt;
      if (f.t <= 0) { f.state = 'dart'; f.t = f.d.dart.time; f.aim = at; }
    } else if (f.state === 'dart') {   // naar binnen schieten
      f.t -= dt; f.face = f.aim; mx = Math.cos(f.aim) * f.d.dart.speed; my = Math.sin(f.aim) * f.d.dart.speed;
      if (gap <= f.d.reach || f.t <= 0) {
        f.lunge = 1; f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown;
        if (gap <= f.d.reach + f.d.lunge && Math.random() < hitChance(f.d.attack)) hitPlayer(f);   // geen blok: de sica haakt erom
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
        let x = P.x + P.vx * T.lead, y = P.y + P.vy * T.lead; const r = Math.hypot(x / (W.rx - 20), y / (W.ry - 20));
        if (r > 1) { x /= r; y /= r; }
        throwNet(f, x, y); f.state = 'recover'; f.t = .4; f.tossCd = T.cd;
      }
      return [0, 0];
    }
    if (f.state === 'stab') {   // dolk: snel
      f.t -= dt; if (f.t <= 0) { f.lunge = 1; f.state = 'recover'; f.t = .35; f.stabCd = K.cd; if (gap <= K.near + 6) hitPlayer({ ...f, d: { ...f.d, dmg: K.dmg, knock: 0 } }); }
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
        if (along > 0 && along <= f.d.reach + f.d.radius + PLAYER.radius + f.d.lunge && side <= PLAYER.radius + f.d.width) {
          if (Math.random() >= hitChance(f.d.attack)) { /* mis */ } else if (Math.random() < me.block) blocked(P, f); else hitPlayer(f);
        }
      }
      return [0, 0];
    }
    if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; return [0, 0]; }
    // lopen: wat is het plan?
    if (!P.dead && gap < K.near && f.stabCd === 0) { f.state = 'stab'; f.t = K.windup; f.face = at; return [0, 0]; }
    const fight = P.netted > 0 || (onGround && Math.hypot(P.x - net.x, P.y - net.y) < NET.block) || (!f.hasNet && !onGround);
    if (fight) {   // drietand: op je af en steken
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 8));
      if (gap > f.d.reach * .8) { mx = Math.cos(f.face) * f.d.speed; my = Math.sin(f.face) * f.d.speed; }
      if (!P.dead && f.cd === 0 && gap <= f.d.reach) { f.state = 'windup'; f.t = P.netted > 0 ? f.d.windup * .7 : f.d.windup; f.aim = at; }
    } else if (onGround) {   // net terughalen
      const nx = net.x - f.x, ny = net.y - f.y, nd = Math.hypot(nx, ny) || 1;
      f.face = lerpAngle(f.face, Math.atan2(ny, nx), 1 - Math.exp(-dt * 8));
      mx = nx / nd * f.d.speed; my = ny / nd * f.d.speed;
      if (nd < NET.pick) { S.nets = S.nets.filter(n => n !== net); f.hasNet = true; f.myNet = null; f.state = 'recover'; f.t = .3; }
    } else {   // met net: afstand houden, eromheen draaien, gooien
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 8));
      const side = Math.sin(performance.now() / 1500 + f.wob) > 0 ? 1 : -1, radial = d > f.d.keep + 15 ? 1 : d < f.d.keep - 15 ? -1 : 0;
      mx = (ex / d * radial - ey / d * side * .6) * f.d.speed; my = (ey / d * radial + ex / d * side * .6) * f.d.speed;
      if (!P.dead && f.tossCd === 0 && d <= T.range && d >= T.min) { f.state = 'toss'; f.t = T.windup; SFX.fx('netCharge'); }
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
      if (!f.hitP && gap <= 3) { f.hitP = true; if (Math.random() < me.block) blocked(P, f); else hitPlayer(f); }
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
      if (!P.dead && f.breath > 0 && f.sprintCd === 0 && gap > f.d.reach + 10 && d <= R.range) { f.state = 'aim'; f.t = R.windup; f.aim = at; return [0, 0]; }
      if (!P.dead && gap <= f.d.reach && f.cd === 0) { f.state = 'windup'; f.t = f.d.windup; }
    } else if (f.state === 'windup') {
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 4)); f.t -= dt;
      if (f.t <= 0) {
        f.lunge = 1; f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown;
        if (gap > f.d.reach + f.d.lunge) { /* ontweken */ } else if (Math.random() >= hitChance(f.d.attack)) { /* mis */ }
        else if (Math.random() < me.block) blocked(P, f); else hitPlayer(f);
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
      if (!f.hitP && gap <= 4) { f.hitP = true; if (Math.random() < me.block) blocked(P, f); else hitPlayer(f); }
      if (f.t <= 0) { f.state = 'walk'; f.cd = f.d.cooldown; }
      return [Math.cos(f.aim) * C2.speed, Math.sin(f.aim) * C2.speed];
    }
    if (f.state === 'recover') f.state = 'walk';
    const off = Math.abs(((at - f.heading + Math.PI * 3) % TAU2) - Math.PI);
    if (!P.dead && f.cd === 0 && off < .45 && d >= C2.min && d <= C2.max) { f.state = 'windup'; f.t = f.d.windup; f.aim = f.heading; }
    // na een charge eerst een stuk doorrijden voordat hij weer omdraait
    return ride(f, f.cd > f.d.cooldown * .4 ? f.heading : d < C2.min ? at + Math.PI * .6 : at, f.d.speed, dt);
  },
  // Eques te voet: eerst zijn lans gooien (rode cirkel), daarna gewoon met de gladius.
  throwThen(f, dt, ex, ey, d, gap) {
    if (f.thrown) return AI.melee(f, dt, ex, ey, d, gap);
    if (f.state !== 'aimJav') { f.state = 'aimJav'; f.t = f.d.hasta.windup; f.target = { x: P.x, y: P.y }; }
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
        S.arrows.push({ x: f.x + Math.cos(at) * (f.d.radius + 4), y: f.y + Math.sin(at) * (f.d.radius + 4), vx: Math.cos(at) * R.arrow, vy: Math.sin(at) * R.arrow, t: 0, life: R.life, dmg: f.d.dmg, stuck: 0 });
        f.state = 'walk'; f.cd = f.d.cooldown;
      }
    } else if (!P.dead && f.cd === 0 && d >= R.min && d <= R.max) { f.state = 'windup'; f.t = f.d.windup; }
    f.aimAt = at;
    return ride(f, goal, f.d.speed, dt);
  },
  // Essedarius: rondjes langs de rand (loop), af en toe recht op je af (hunt); gooit werpsperen; overrijdt je.
  essedarius(f, dt, ex, ey, d, gap) {
    const at = Math.atan2(ey, ex), H = f.d.hunt, J = f.d.jav;
    f.huntT = (f.huntT === undefined ? H.every * .5 : f.huntT - dt);
    if (f.huntT < -H.time) f.huntT = H.every;
    f.ramCd2 = Math.max(0, (f.ramCd2 || 0) - dt);
    if (!P.dead && f.ramCd2 === 0 && gap <= 2) { f.ramCd2 = .8; hitPlayer(f); }   // overreden
    if (f.state === 'aimJav') {
      f.t -= dt;
      if (f.t <= 0) { throwJav(f, f.target.x, f.target.y, f.d.dmg); f.state = 'walk'; f.cd = f.d.cooldown; }
    } else if (!P.dead && f.cd === 0 && d >= J.min && d <= J.max) {
      f.state = 'aimJav'; f.t = f.d.windup;
      let x = P.x + P.vx * J.lead, y = P.y + P.vy * J.lead; const r = Math.hypot(x / (W.rx - 20), y / (W.ry - 20)); if (r > 1) { x /= r; y /= r; }
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
      if (!P.dead && gap <= f.d.reach && f.cd === 0) { f.state = 'windup'; f.t = f.d.windup; f.aim = at; }
    } else if (f.state === 'windup') {   // op de achterpoten: de richting ligt vast
      f.t -= dt; f.face = f.aim;
      if (f.t <= 0) {
        f.lunge = 1; f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown;
        const off = Math.abs(((at - f.aim + Math.PI * 3) % TAU2) - Math.PI);
        if (gap <= f.d.reach + f.d.lunge && off <= f.d.swipe.arc + .2) { if (Math.random() < me.block) blocked(P, f); else hitPlayer(f); }
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
      if (!f.hitP && gap <= 2) { f.hitP = true; hitPlayer(f); }
      for (const o of S.foes) {   // vertrapt ook andere vijanden
        if (o === f || o.state === 'dead' || f.hitFoes.has(o)) continue;
        if (Math.hypot(o.x - f.x, o.y - f.y) <= f.d.radius + o.d.radius) {
          f.hitFoes.add(o); o.vx += Math.cos(f.aim) * 260; o.vy += Math.sin(f.aim) * 260;
          hitFoe(o, St.trample, f, true);
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
        if (gap <= f.d.reach + f.d.lunge && off <= T.arc + .2) hitPlayer({ ...f, d: { ...f.d, dmg: T.dmg, knock: T.knock } });
      }
      return [0, 0];
    }
    if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; return [0, 0]; }
    f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 2.5));
    if (gap > f.d.reach * .6) { mx = Math.cos(f.face) * f.d.speed; my = Math.sin(f.face) * f.d.speed; }
    if (!P.dead && f.runCd === 0 && d >= St.min) { f.state = 'aim'; f.t = St.windup; f.aim = at; return [0, 0]; }
    if (!P.dead && gap <= f.d.reach && f.cd === 0) { f.state = 'windup'; f.t = f.d.windup; f.aim = at; }
    return [mx, my];
  },
  // Dimachaerus: oplopen, aanzetten, dan 'combo' klappen kort na elkaar.
  dimachaerus(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const at = Math.atan2(ey, ex);
    if (f.state === 'walk') {
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 9));
      if (gap > f.d.reach * .6) { mx = Math.cos(f.face) * f.d.speed; my = Math.sin(f.face) * f.d.speed; }
      if (!P.dead && gap <= f.d.reach + 4 && f.cd === 0) { f.state = 'windup'; f.t = f.d.windup; }
    } else if (f.state === 'windup') {
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 5)); f.t -= dt;
      if (f.t <= 0) { f.state = 'combo'; f.combo = f.d.combo; f.t = 0; }
    } else if (f.state === 'combo') {   // klap, klap, klap: telkens een stapje naar voren
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 6)); f.t -= dt;
      mx = Math.cos(f.face) * f.d.speed * .5; my = Math.sin(f.face) * f.d.speed * .5;
      if (f.t <= 0) {
        f.lunge = 1; f.side = -(f.side || 1); f.combo--; f.t = f.d.gap;
        if (gap <= f.d.reach + f.d.lunge && Math.random() < hitChance(f.d.attack)) { if (Math.random() < me.block) blocked(P, f); else hitPlayer(f); }
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
        if (!P.dead && d <= R.radius) { P.slow = f.d.slow.time; P.slowMul = f.d.slow.mul; }
      }
      return [0, 0];
    }
    if (f.state === 'windup') { f.t -= dt; f.face = f.aim; if (f.t <= 0) { f.state = 'dash'; f.t = J.time; f.hitP = false; } return [0, 0]; }
    if (f.state === 'dash') {
      f.t -= dt; mx = Math.cos(f.aim) * J.speed; my = Math.sin(f.aim) * J.speed;
      if (!f.hitP && gap <= 2) { f.hitP = true; hitPlayer(f); }
      if (f.t <= 0) { f.state = 'recover'; f.t = f.d.recover; f.jumpCd = J.cd; }
      return [mx, my];
    }
    if (f.state === 'recover') { f.t -= dt; if (f.t <= 0) f.state = 'walk'; return [0, 0]; }
    // sluipen: op afstand eromheen draaien
    f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 5));
    const side = f.wob > 5 ? 1 : -1, radial = d > f.d.orbit + 12 ? 1 : d < f.d.orbit - 12 ? -.7 : 0;
    mx = (ex / d * radial - ey / d * side * .75) * f.d.speed; my = (ey / d * radial + ex / d * side * .75) * f.d.speed;
    const busy = P.target && P.target !== f && P.target.state !== 'dead' && P.cd > 0;   // jij slaat een ander
    if (!P.dead && f.roarCd === 0 && d <= R.radius * 1.2) { f.state = 'roar'; f.t = R.windup; return [0, 0]; }
    if (!P.dead && d <= J.range && (f.jumpCd === 0 || (busy && f.jumpCd < J.cd - J.busy))) { f.state = 'windup'; f.t = f.d.windup; f.aim = at; return [0, 0]; }
    return [mx, my];
  },
  // Hyena: XP-bolletjes eten als die er liggen, anders bijten en wegrennen; ben jij zwak of gevangen, dan doorbijten.
  hyena(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const at = Math.atan2(ey, ex), frenzy = P.netted > 0 || P.hp <= me.maxHp * f.d.weak;
    if (f.state === 'windup') {
      f.t -= dt; f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 8));
      if (f.t <= 0) { f.lunge = 1; f.cd = frenzy ? f.d.cooldown * .5 : f.d.cooldown; if (gap <= f.d.reach + f.d.lunge) hitPlayer(f); f.state = frenzy ? 'recover' : 'flee'; f.t = frenzy ? f.d.recover : f.d.flee; }
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
    if (!P.dead && gap <= f.d.reach && f.cd === 0) { f.state = 'windup'; f.t = f.d.windup; }
    return [mx, my];
  },
  // Hoplomachus: op speerafstand blijven, richten (rode lijn) en stoten. Te dichtbij: schild-ram of achteruit.
  hoplomachus(f, dt, ex, ey, d, gap) {
    let mx = 0, my = 0; const at = Math.atan2(ey, ex), R = f.d.ram;
    f.ramCd = Math.max(0, (f.ramCd || 0) - dt);
    if (f.state === 'walk') {
      f.face = lerpAngle(f.face, at, 1 - Math.exp(-dt * 7));
      if (!P.dead && gap < R.near && f.ramCd === 0) { f.state = 'ram'; f.t = R.time; f.aim = at; f.hitP = false; return [0, 0]; }
      const want = f.d.reach * .8;
      if (gap > want + 4) { mx = Math.cos(f.face) * f.d.speed; my = Math.sin(f.face) * f.d.speed; }
      else if (gap < want - 8) { mx = -ex / d * f.d.speed * .8; my = -ey / d * f.d.speed * .8; }   // achteruit naar speerafstand
      if (!P.dead && f.cd === 0 && gap <= f.d.reach) { f.state = 'windup'; f.t = f.d.windup; f.aim = at; }
    } else if (f.state === 'windup') {   // richten: de richting ligt vast
      f.t -= dt; f.face = f.aim;
      if (f.t <= 0) { f.state = 'thrust'; f.t = .14; f.lunge = 1; }
    } else if (f.state === 'thrust') {
      f.t -= dt; f.face = f.aim;
      if (f.t <= 0) {
        f.state = 'recover'; f.t = f.d.recover; f.cd = f.d.cooldown;
        const along = ex * Math.cos(f.aim) + ey * Math.sin(f.aim), side = Math.abs(-ex * Math.sin(f.aim) + ey * Math.cos(f.aim));
        if (along > 0 && along <= f.d.reach + f.d.radius + PLAYER.radius + f.d.lunge && side <= PLAYER.radius + f.d.width) {
          if (Math.random() >= hitChance(f.d.attack)) { /* mis */ } else if (Math.random() < me.block) blocked(P, f); else hitPlayer(f);
        }
      }
    } else if (f.state === 'ram') {   // schild-ram: korte stoot naar voren, duwt je terug naar speerafstand
      f.t -= dt; mx = Math.cos(f.aim) * 240; my = Math.sin(f.aim) * 240;
      if (!f.hitP && gap <= 3) { f.hitP = true; P.vx += Math.cos(f.aim) * R.push * me.knock; P.vy += Math.sin(f.aim) * R.push * me.knock; S.shake = Math.max(S.shake, 2.5); SFX.block(); }
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
  if (P.roll > 0) { tx = Math.cos(P.rollDir) * ROLL.speed; ty = Math.sin(P.rollDir) * ROLL.speed; k = 1; }   // rollen
  if (P.netted > 0) { tx = 0; ty = 0; k = 1 - Math.exp(-dt * 20); }                                          // in het net: vast
  P.vx += (tx - P.vx) * k; P.vy += (ty - P.vy) * k;
  P.x += P.vx * dt; P.y += P.vy * dt;
  P.walk = ((P.walk || 0) + Math.hypot(P.vx, P.vy) * dt * .16) % TAU2;   // stappen
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
  S.roundT = (S.roundT || 0) + dt; checkExtra(); S.gate = Math.max(0, (S.gate || 0) - dt);
  updateNets(dt); updateJavs(dt);
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
  let best = null, bd = Infinity;
  for (const f of S.foes) if (f.state !== 'dead') { const d = Math.hypot(f.x - P.x, f.y - P.y); if (d < bd) { bd = d; best = f; } }
  P.target = best;
  const bow = w.kind === 'bow', fists = WEAPONS.fists;
  const inReach = !bow && best && bd - best.d.radius - PLAYER.radius <= w.reach;
  const inRange = bow && best && bd <= w.range;
  if (inReach || inRange) P.face = lerpAngle(P.face, Math.atan2(best.y - P.y, best.x - P.x), 1 - Math.exp(-dt * 20));
  else if (sp > 20) P.face = lerpAngle(P.face, Math.atan2(P.vy, P.vx), 1 - Math.exp(-dt * 12));
  P.punch = Math.max(0, (P.punch || 0) - dt); P.noAmmo = Math.max(0, (P.noAmmo || 0) - dt);
  if (S.switching > 0 || P.roll > 0 || P.netted > 0) {   // wisselen, rollen of in het net: even niet slaan
  } else if (bow && !P.dead && P.cd === 0 && best && inRange && S.ammo <= 0) {
    if (!(P.noAmmo > 0)) { P.noAmmo = 2.5; const b = $('slot_ranged'); b.classList.remove('empty'); void b.offsetWidth; b.classList.add('empty'); }   // koker leeg: vak 2 knippert rood
  } else if (bow && !P.dead && P.cd === 0 && best && inRange) {
    // Schieten: richt een tikje voor (waar hij heen loopt), de pijl vliegt rechtdoor.
    const t = bd / w.arrow, ax = best.x + (best.state === 'walk' ? Math.cos(best.face) * best.d.speed * t * .6 : 0), ay = best.y + (best.state === 'walk' ? Math.sin(best.face) * best.d.speed * t * .6 : 0);
    const a = Math.atan2(ay - P.y, ax - P.x);
    S.arrows.push({ x: P.x + Math.cos(a) * (PLAYER.radius + 4), y: P.y + Math.sin(a) * (PLAYER.radius + 4), vx: Math.cos(a) * w.arrow, vy: Math.sin(a) * w.arrow, t: 0, life: w.range / w.arrow * 1.15, dmg: w.dmg, stuck: 0, mine: true });
    P.cd = P.cdMax = me.shootCd; P.swing = w.swing; S.ammo--; updateUI();
  } else if (!bow && !P.dead && inReach && P.cd === 0) {
    P.cd = P.cdMax = w.cooldown; P.swing = w.swing; P.swingDir *= -1;
    if (w.kind === 'stick') SFX.whoosh();
    // Wie wordt er geraakt: één (gladius, vuisten), iedereen in de zwaai (stok) of iedereen op de lijn (speer).
    const fa = P.face, targets = w.hit === 'sweep' || w.hit === 'pierce' ? S.foes.filter(f => {
      if (f.state === 'dead') return false;
      const dx = f.x - P.x, dy = f.y - P.y, dist = Math.hypot(dx, dy);
      if (dist - f.d.radius - PLAYER.radius > w.reach) return false;
      const along = dx * Math.cos(fa) + dy * Math.sin(fa), side = -dx * Math.sin(fa) + dy * Math.cos(fa);
      if (w.hit === 'pierce') return along > 0 && Math.abs(side) <= f.d.radius + w.width;
      return Math.abs(((Math.atan2(dy, dx) - fa + Math.PI * 3) % TAU2) - Math.PI) <= w.arc || dist < f.d.radius + PLAYER.radius + 2;
    }) : [best];
    if (!targets.includes(best)) targets.push(best);
    for (const t of targets) hitFoe(t, me.dmg, P);
  }

  // Tegenstanders: aanlopen, aanzetten, uithalen, herstellen.
  for (const f of S.foes) {
    f.flash = Math.max(0, f.flash - dt); f.lunge = Math.max(0, f.lunge - dt * 5); f.block = Math.max(0, (f.block || 0) - dt);
    const fr = Math.exp(-dt * 7); f.vx *= fr; f.vy *= fr;   // knockback dooft uit
    if (f.state === 'dead') { f.dead = Math.max(0, f.dead - dt * .35); f.x += f.vx * dt; f.y += f.vy * dt; continue; }
    const ex = P.x - f.x, ey = P.y - f.y, d = Math.hypot(ex, ey) || 1, gap = d - f.d.radius - PLAYER.radius;
    f.cd = Math.max(0, f.cd - dt);
    f.parryCd = Math.max(0, (f.parryCd || 0) - dt); f.parried = Math.max(0, (f.parried || 0) - dt); f.roared = Math.max(0, (f.roared || 0) - dt); f.chew = Math.max(0, (f.chew || 0) - dt);
    if (f.state === 'stagger') {   // wankelen (kapot schild, gebroken speer): niets doen
      f.t -= dt; if (f.t <= 0) { f.state = 'recover'; f.t = .3; }
      f.x += f.vx * dt; f.y += f.vy * dt; contain(f, W.rx - f.d.radius - 4, W.ry - f.d.radius - 4); continue;
    }
    const ai = AI[f.d.ai || (f.d.dash ? 'dash' : f.d.ranged ? 'ranged' : 'melee')];
    const [mx, my] = ai(f, dt, ex, ey, d, gap);
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
  for (const p of S.dust) {
    if (p.chip) { ctx.fillStyle = p.color || '#6e2a22'; ctx.globalAlpha = Math.min(1, p.t); ctx.fillRect(p.x - 2, p.y - 1, 4, 2.5); continue; }   // stukken van een kapot schild
    ctx.fillStyle = C['sand-2']; ctx.globalAlpha = p.t * .45; ctx.beginPath(); ctx.arc(p.x, p.y, 3 + (1 - p.t) * 5, 0, TAU2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  const ents = [...S.foes].sort((a, b) => (a.state === 'dead' ? -1 : 0) - (b.state === 'dead' ? -1 : 0));
  drawWrecks();
  drawOrbs(now);
  for (const f of ents) drawFoe(f, now);
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
  for (const f of S.foes) if (f.state !== 'dead' && f.hp < f.d.hp) drawBar(f.x, f.y - f.d.radius - 10, f.hp / f.d.hp);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of S.floats) {
    ctx.globalAlpha = Math.min(1, f.t * 1.5); ctx.font = `700 ${f.size || 16}px Cinzel, Georgia, serif`;
    if (f.follow) ctx.textAlign = 'left';
    ctx.lineWidth = 4; ctx.strokeStyle = C.night; ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    ctx.textAlign = 'center';
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
  return { tunic: b === 'lorica' ? '#8f8a80' : b === 'leather' ? '#7a5230' : C.blood,
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
      ...look.hero, flash: P.flash, belt: look.belt, shield: look.shield, forward: 3 * punch,
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
    ...look.hero, flash: P.flash, belt: look.belt, shield: look.shield, shieldUp: sw >= 0, armR: sw >= 0 ? 3 : 0,
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
  const wind = f.state === 'windup' ? 1 - f.t / d.windup : 0;
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
function drawNets(now) {
  for (const n of S.nets) {
    let x = n.x, y = n.y, r = NET.radius, a = 1;
    if (n.state === 'fly') {
      const k = n.t / n.T;
      ctx.fillStyle = `rgba(212,70,59,${.12 + .25 * k})`; ctx.strokeStyle = `rgba(212,70,59,${.4 + .5 * k})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(n.x, n.y, NET.radius + PLAYER.radius * .5, 0, TAU2); ctx.fill(); ctx.stroke();
      x = n.x0 + (n.x - n.x0) * k; y = n.y0 + (n.y - n.y0) * k - Math.sin(k * Math.PI) * 30; r = NET.radius * (.4 + .6 * k);
    } else if (n.state === 'held') { x = P.x; y = P.y; r = PLAYER.radius + 5; }
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
  S.mode = 'fight'; S.stage = 0; S.inStage = 0; S.finished = false;
  S.xp = 0; S.points = POINTS.start; for (const k in S.stats) S.stats[k] = 0;
  S.money = 0; S.delta = 0; S.owned = ['fists']; S.gear = { body: null, head: null, shield: null, mount: null, quiver: null }; S.townSeen = false; S.ammo = 0; S.melee = 'fists'; S.ranged = null; S.active = 'melee'; S.switching = 0; PLAYER.weapon = 'fists'; S.over = null;
  startFight(); S.paused = false;
}
$('startBtn').onclick = () => { SFX.init(); $('start').hidden = true; newRun(); };
// Volume: schuifjes op het startscherm en in de straat. Bij het schuiven hoor je meteen hoe hard het is.
let volPreview = 0;
function showVolume() {
  const v = SFX.muted ? 0 : Math.round(SFX.volume * 100);
  for (const id of ['volume', 'townVolume', 'pauseVolume']) $(id).value = v;
  $('volumeOut').textContent = v; showMute();
}
for (const id of ['volume', 'townVolume', 'pauseVolume']) $(id).addEventListener('input', ev => {
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
function showMute() { const b = $('mute'); b.textContent = SFX.muted ? 'Geluid uit' : 'Geluid aan'; b.setAttribute('aria-pressed', String(!SFX.muted)); }
$('slot_melee').onclick = () => { switchTo('melee'); $('slot_melee').blur(); };
$('slot_ranged').onclick = () => { switchTo('ranged'); $('slot_ranged').blur(); };
$('mute').onclick = () => { SFX.init(); SFX.setMuted(!SFX.muted); if (!SFX.muted && SFX.volume === 0) SFX.setVolume(.6); showVolume(); };
showMute(); showVolume();

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
cvs.addEventListener('pointermove', ev => {
  if (steer.down) toWorld(ev);
  const r = cvs.getBoundingClientRect();   // waar je muis is (voor de rol), ook zonder te klikken
  steer.hx = (ev.clientX - r.left - view.cw / 2) / view.scale; steer.hy = (ev.clientY - r.top - view.ch / 2) / view.scale; steer.hoverT = performance.now();
});
cvs.addEventListener('pointerleave', () => { steer.hoverT = 0; });
['pointerup', 'pointercancel'].forEach(t => cvs.addEventListener(t, () => steer.down = false));
const anyOverlay = () => ['start', 'result', 'stats', 'town', 'shop', 'pick', 'judge'].some(id => !$(id).hidden);
// Pauze: Escape tijdens een gevecht, nog eens Escape (of Verder) om door te gaan.
const inFight = () => !S.paused && !anyOverlay();
function pause() { S.paused = true; keys.clear(); steer.down = false; SFX.mood('calm'); showVolume(); $('pause').hidden = false; $('pauseBtn').focus(); }
function resume() { $('pause').hidden = true; S.paused = false; keys.clear(); if (S.intro <= 0) SFX.mood('fight'); }
$('pauseBtn').onclick = resume;
addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && !(ev.target.closest && ev.target.closest('#dev'))) {
    if (!$('pause').hidden) { ev.preventDefault(); resume(); return; }
    if (inFight()) { ev.preventDefault(); pause(); return; }
  }
  if (anyOverlay() || !$('pause').hidden) return;
  const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  if (k === 'm') { $('mute').click(); return; }
  if (k === '1') { switchTo('melee'); return; }
  if (k === '2') { switchTo('ranged'); return; }
  if (k === ' ') { tryRoll(); ev.preventDefault(); return; }
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s'].includes(k)) {
    if (P.netted > 0 && !ev.repeat) { P.netted -= NET.mash; if (P.netted <= 0) releaseNet(); }   // losrammelen
    keys.add(k); ev.preventDefault();
  }
});
addEventListener('keyup', ev => keys.delete(ev.key.length === 1 ? ev.key.toLowerCase() : ev.key));
addEventListener('blur', () => { keys.clear(); if (inFight()) pause(); });   // ander venster: vanzelf pauze
new ResizeObserver(() => fitWorld(false)).observe(stage);

startFight();
requestAnimationFrame(loop);

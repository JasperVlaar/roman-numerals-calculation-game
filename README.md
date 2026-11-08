# Roman Numerals

Een rekenspel in een Romeinse arena. Je stuurt een strijdwagen, vangt zwevende Romeinse cijfers en bouwt daarmee een doelgetal met + en ×. Daarna oordeelt Caesar met zijn duim.

Het oorspronkelijke idee staat in [docs/initieel-idee.md](docs/initieel-idee.md).

## Starten

Geen build of dependencies. Open `index.html` in een browser.

Voor live reload kun je een simpele server gebruiken, bijvoorbeeld:

```
npx serve .
```

## Bestanden

| Bestand | Inhoud |
|---|---|
| `index.html` | Opmaak: HUD, arena-canvas, controls en de drie overlays (start, oordeel, winkel) |
| `style.css` | Kleuren als CSS-variabelen in `:root` (ook die van de arena), plus layout |
| `game.js` | Spellogica, munten, wagen en de UI |
| `arena.js` | Het Colosseum bij nacht: tribunes met publiek, muur met fakkels, poorten, Caesars loge, zandvloer met mozaïekrand |
| `quadriga.js` | De vier paarden en de wagen: galop, rollende wielen, teugels, wielsporen en schaduw |
| `judge.js` | Caesars oordeel: de scène in de keizersloge, de hand die twijfelt en omslaat, deeltjes, en de reactie van publiek en arena |
| `assets/horse.svg`, `assets/chariot.svg` | De tekeningen van paard en wagen met menner, van bovenaf |
| `docs/initieel-idee.md` | Het idee zoals ik het opschreef |

## Besturing

| Actie | Toetsenbord | Touch / muis |
|---|---|---|
| Rijden | Pijltjes of WASD | Slepen of tikken in de arena |
| Oordeel vragen | Enter | Ik zeg: goed! |
| Augur gebruiken | | Augur-knop |

Tekens kies je niet meer met een knop: je vangt ze als munt. Wissen bestaat niet meer: zit je te hoog, trek er dan iets af.

## Huidige regels (demo)

| Onderdeel | Waarde |
|---|---|
| Tijd | 30 seconden per ronde (`time` in `cfg()`). Bij 0 oordeelt Caesar over wat je hebt; zonder som is het duim omlaag. |
| Munten | Groot goud = cijfer, purper = teken, klein goud = denarius |
| Vangen | Om en om: cijfer, teken, cijfer … Munten van het verkeerde soort zijn gedimd; daar rijd je doorheen. |
| Tekens | Ronde I: + en −. Vanaf ronde II: + − ×. Van elk teken ligt er altijd minstens één munt in het veld. |
| Rekenvolgorde | Van links naar rechts, dus X + V × II = 30. Tussenstanden mogen 0 (*nulla*) of negatief (−X) worden. |
| Denarii | 4 + ronde (max 8) kleine gouden munten van 2 denarii. Ze tellen direct bij je beurs en komen niet terug. |
| Lorica (armor) | 20 denarii, blokkeert 3 valse cijfers |
| Augur (power-up) | 12 denarii, licht de kortste route op (max. 4 cijfers) zonder volgorde of tekens te verraden |
| Kans op vals cijfer | 10% in ronde I, +7% per ronde, max 40%. Een vals cijfer telt meteen mee met zijn echte waarde. |
| Fout antwoord | Nieuwe poging met een nieuw doel, geen straf |

Moeilijkheid per ronde staat in `cfg(level)` in `game.js`: tijd, welke cijfers en tekens voorkomen, het bereik van het doelgetal, aantal termen, aantal munten en denarii, en grootte van de arena.

## Proef: gladiatorgevecht (branch `gladiator-direction-tryout`)

Op deze branch is de rekenmodus vervangen door gladiatorgevechten. `index.html` laadt `fight.js` in plaats van `game.js`; arena, Caesar en publiek worden hergebruikt.

**Nu:** drie blokken van 5 gevechten, elk gevolgd door een toernooi (5-1-5-1-5-1). Na 5 gevechten gaat het gewone gevecht op slot tot je het toernooi wint; dan komen de volgende 5 vrij. Het toernooi mag je ook eerder kiezen (win je het dan, dan sla je de rest van dat blok over). Na het laatste toernooi blijft gevecht XV beschikbaar als herhaling. Je begint met je vuisten. Punten verdien je met XP: verslagen tegenstanders laten 5 blauwwitte bolletjes wegspatten. Raap ze op: na 6 seconden verdwijnen ze (de laatste 2 seconden knipperen ze), en na de laatste klap heb je nog 5 seconden (of minder als alles al opgeraapt is), daarna doven ze. Een niveau hoger (bij 4, 12, 24, 40 … XP in totaal) geeft 2 punten voor je stats. Je begint zonder punten. Verlies je, dan vervalt de XP uit dat gevecht. Slaan gaat vanzelf als een tegenstander binnen bereik is. Een tegenstander kleurt rood als hij aanzet; stap weg voordat hij uithaalt. Ga je neer, dan probeer je hetzelfde gevecht opnieuw en blijven je stats staan.

| Stat | Per punt | Basis (0 punten, ook voor slaven) |
|---|---|---|
| Strength (Kracht) | +0,25 schade | Vuisten 2 |
| Agility (Behendigheid) | +3 loopsnelheid (later ook afstandswapens) | 85 (slaaf 68) |
| Vitality (Vitaliteit) | +1 leven | 8 (slaaf 14) |

Attack en Defense (raak- en blokkans) staan voorlopig uit; elke klap binnen bereik raakt. De code staat er nog (`STAT_RULES`). De getallen zijn bewust klein: je begint als een slaaf. Kracht is +0,25 per punt; kwarten nemen we voorlopig voor lief.

Balans (gesimuleerd, 20 gevechten per regel, bot die elke 0,2 s reageert):

| Gevecht | Punten (alles opgeraapt) | Winst |
|---|---|---|
| I (1 slaaf) | 0 | 100% |
| II (2 slaven) | 2 | 5–20% |
| III (3 slaven) | 4 | 0–5% |

Stilstaan zonder punten verliest altijd.

**Gevechten en toernooien:**

| # | Gevecht | Beloning |
|---|---|---|
| I | 1 slaaf | 5 d |
| II | 2 slaven | 8 d |
| III | 2 slaven en een boogschutter | 12 d |
| IV | gladiator, boogschutter en slaaf | 18 d |
| V | tussenbaas: gladiator met stok | 25 d |
| *Toernooi I* | | |
| VI | 2 gladiatoren | 20 d |
| VII | 3 boogschutters | 22 d |
| VIII | 10 slaven | 25 d |
| IX | gladiator met stok en 2 boogschutters | 30 d |
| X | tussenbaas: 2 gladiatoren met stok | 40 d |
| *Toernooi II* | | |
| XI | 5 boogschutters | 35 d |
| XII | 4 gladiatoren | 40 d |
| XIII | 15 slaven | 45 d |
| XIV | 2 gladiatoren met gladius en 3 boogschutters | 55 d |
| XV | tussenbaas: kampioen en 2 gladiatoren met stok | 70 d |
| *Toernooi III* | | |

| Toernooi | Rondes | Beloning |
|---|---|---|
| I | 2 slaven → slaaf + 2 boogschutters → **kampioen** | 60 d |
| II | gladiator + 2 boogschutters → gladiator met gladius + 2 slaven → **2 kampioenen** | 120 d |
| III | 2 gladiatoren met gladius → 10 slaven + 2 boogschutters → **3 kampioenen** | 200 d |

Een verloren gevecht kost de helft van de beloning. Bij een toernooi krijg je tussen de rondes 25% van je leven terug. Ga je neer, dan beslist Caesar (`judge.js`): kans op duim omhoog = 15% + 80% × (schade die je uitdeelde / al het leven van alle tegenstanders), hoogstens 95%. Omhoog: je leeft, geen beloning, geen boete, en je mag het toernooi opnieuw proberen. Omlaag: dood, alles opnieuw vanaf gevecht I. 

| Tegenstander | Leven | Schade | Armor | Snelheid | XP |
|---|---|---|---|---|---|
| Slaaf | 14 | 2 | 0 | 68 | 5 |
| Boogschutter (groen; schiet van afstand, richt eerst met een rode stippellijn, loopt weg als je dichtbij komt) | 10 | 2 per pijl | 0 | 60 | 5 |
| Gladiator (leer, bronzen helm) | 16 | 3 | 1 | 74 | 10 |
| Gladiator met stok (langer bereik, duwt je ver weg) | 22 | 3 | 1 | 72 | 12 |
| Gladiator met gladius (bronzen gordel, zwaard; pas in toernooi II) | 20 | 4 | 1 | 74 | 15 |
| Kampioen (ijzer, groter) | 28 | 3 | 2 | 74 | 25 |

Simulaties met de bot zeggen bij boogschutters en groepen weinig: de uitkomsten springen tussen 0% en 100% bij kleine wijzigingen. Speel het zelf om te balanceren.

**Geld en de stad:** elk gewonnen gevecht levert een vast bedrag op. Verlies je, dan betaal je de helft van die beloning als boete, nooit meer dan je hebt. Na elk gevecht (gewonnen of verloren) ga je de stad in. Daar verdeel je ook je punten (knop rechtsboven). Na gevecht I heb je nog te weinig geld voor een wapen, maar je ziet wel wat er te koop is. Je kijkt de straat in met de arena in de verte. Links de wapensmid (*Faber*, open) en de harnasmaker (*Loricarius*), rechts de boogmaker (*Arcuarius*) en de stallen (*Stabulum*); die drie zijn nog dicht. Klik op een winkel om naar binnen te gaan, en klik op de arena voor je volgende gevecht (of je herkansing). Heb je dan nog punten over, dan krijg je eerst het perkament, met de keuze om terug de straat in te gaan. De straat is een tijdelijke schets in SVG (`town.js`) tot er een getekende achtergrond is.

Winkels: wapensmid en harnasmaker zijn vanaf het begin open, de boogmaker na toernooi I, de stallen na toernooi II.

| Harnasmaker | Vak | Prijs | Effect |
|---|---|---|---|
| Leren harnas | harnas | 35 d | armor 1: elke klap 1 minder (altijd minstens 1) |
| Galea | helm | 30 d | je wordt half zo ver weggeduwd |
| Scutum | schild | 50 d | pijlen van voren houdt hij tegen; klappen van voren 1 minder. Geen kans: "van voren" = binnen 60° van waar je naar kijkt |
| Lorica segmentata | harnas | 120 d | armor 2, −8 loopsnelheid |

Eén stuk per vak; wat je gekocht hebt kun je in de winkel aan- en uitdoen. In de HUD staat je armor.

| Wapen | Prijs | Schade | Bereik | Terugslag |
|---|---|---|---|---|
| Vuisten | – | 2 | 10 | nee |
| Stok | 12 d | 3 | 13 | ja |
| Gladius | 40 d | 5 | 15 | ja |
| Hasta (speer) | 70 d | 4 | 20 | ver; trager (elke 2,3 s) |
| Korte boog (na toernooi I) | 60 d | 2 per pijl | 150 | elke 1,8 s |
| Composietboog (na toernooi I) | 140 d | 3 per pijl | 190 | elke 1,4 s |

**Twee wapenvakken:** vak 1 is je melee-wapen (vuisten, stok, gladius, hasta), vak 2 je boog. Wisselen met de toetsen 1 en 2 of de knoppen in de HUD duurt 1 seconde (een ring om je heen loopt vol); dan val je niet aan. Druk je tijdens het wisselen op het vak dat je al had, dan breek je het af. Met de boog in je handen loop je 60% langzamer (`ARMS.speedMul` = 0,4), dus wegrennen en schieten werkt niet: in een test met een bot die alleen wegrent en schiet won hij bij ×0,5 nog 30–40% tegen 2 slaven of een gladiator, bij ×0,4 niets. Een boog schiet vanzelf op de dichtstbijzijnde tegenstander binnen bereik, ook dichtbij (jouw pijlen hebben rode veren). Behendigheid: per punt 4% korter wachten tussen twee pijlen (hoogstens de helft). Je schild werkt alleen als je je melee-wapen vasthoudt. Kracht telt alleen voor je melee-wapen.

**Strijdwagen** (stallen, na toernooi II, 250 d): je hebt een boog nodig, en je rijdt alleen als je de boog vasthoudt (vak 2); met je melee-wapen sta je naast de wagen. Je stuurt een richting en de wagen draait daarheen (topsnelheid 120, plus behendigheid); in een scherpe bocht houdt hij in, en langzaam draait hij scherper. Laat je los, dan rijdt hij door op 55: stilstaan kan niet. Tegen de muur remt hij af. Wie je met meer dan 80 vaart raakt (bij de paarden of de wagen), gaat omver: 5 schade, ver weggeduwd, en zijn aanzet wordt afgebroken. Instellingen: `CHARIOT`.


Met de stok wordt gevecht III winbaar: gesimuleerd met 4 punten 20–27% winst, tegen 3–7% met je vuisten (gladius: ±37%).

| Wat | Waar in `fight.js` |
|---|---|
| Jouw leven, snelheid, onkwetsbaarheid na een treffer | `PLAYER` |
| Wapens (schade, bereik, slagen per seconde, terugslag) | `WEAPONS` |
| Tegenstanders (leven, schade, armor, snelheid, aanzet, herstel) | `FOES` |
| Stats: wat een punt doet, punten per niveau | `STATS`, `STAT_RULES`, `POINTS` |
| XP: drempels per niveau, bolletjes per tegenstander, oprapen, de 5 seconden aan het eind | `LEVELS`, `XP` |
| De blokken: 5 gevechten en het toernooi erna (soort, tegenstanders, rondes, beloning) | `STAGES` |
| Toernooi: leven terug tussen rondes, kans op Caesars genade | `TOURNAMENT` |
| Boete bij verlies | `MONEY` |
| De winkels in de straat (naam, wanneer open, wat ze verkopen) | `SHOPS` |
| Harnas, helm en schild (prijs, effect) | `GEAR` |
| Tekening van de straat, plek van de winkels | `town.js` (`SPOTS`, `VP`) |
| Geluid: welke bestanden (`SOUNDS`) en hoe hard (`MIX`) | bovenaan `sound.js` |
| Raakgevoel (even stilstaan bij een treffer, schudden, flits) | `FEEL` |
| Aftellen aan het begin (III, II, I, *Pugnate!*) | `INTRO` |
| Grootte van het zandveld (kleiner = camera dichterbij) | `FIGHT_AREA` |

Geluid: `sound.js` speelt echte opnames af uit `assets/sound/` (welke bestanden en waar je ze vindt: `assets/sound/LEESMIJ.md`). Het publiek roezemoest de hele tijd, juicht bij elke rake klap (groot gejuich als iemand valt, bij *Pugnate!* en als je wint) en joelt als je verliest. Ontbreekt een bestand, dan blijft dat geluid stil. Aan/uit met de knop rechtsboven of de toets M.

Testen met meer tegenstanders: open `index.html?n=3` (of een ander aantal slaven).

| Fase | Inhoud |
|---|---|
| 1 | Het gevoel: lopen, automatisch slaan, aanzet en ontwijken, leven, winnen en verliezen |
| 2 | De reeks: 1, 2, 3 slaven; 1 en 3 gladiatoren; 10 slaven; 5 slaven + 5 gladiatoren; Caesars duim na afloop |
| 3 | De stad: beloning per gevecht en boete bij verlies, straat met vier winkels, wapensmid open (stok, gladius). Later: harnasmaker, boogmaker, stallen; tussenbazen en toernooien tot de dood met Caesars duim |
| 4 | De strijdwagen: sneller, omverrijden, alleen met boog |
| 5 | Later: magie, andere tegenstanders, graphics als assets |

## Arena aanpassen

De arena wordt in code getekend, omdat de vorm per ronde en per schermformaat verandert. Alles wat stil staat (tribunes, zittend publiek, muur, vloer, mozaïek) wordt één keer naar een offscreen canvas getekend. Elk frame komen daar alleen het bewegende publiek, Caesar en de fakkels bij.

| Wat | Waar |
|---|---|
| Kleuren van steen, mozaïek, licht en publiek | `style.css`, blok `/* Arena */` (`--crowd-1` t/m `--crowd-7` zijn de kleding van het volk) |
| Maten, aantallen, hoe donker de tribune wordt | `ARENA` bovenaan `arena.js` |
| Het meanderpatroon van de mozaïekrand | `MEANDER` in `arena.js` (`#` = donker steentje) |
| De wave van het publiek | `arenaCheer()`, nu bij de start en bij duim omhoog |

## Quadriga aanpassen

Paard en wagen zijn gewone SVG's, te bewerken in Inkscape of Figma. Ze zijn van bovenaf getekend met de neus naar rechts, en 1 SVG-eenheid is 1 wereld-eenheid. Houd de grootte en de ankerpunten gelijk, of pas ze aan in `QUAD` bovenaan `quadriga.js`.

| Wat | Waar |
|---|---|
| Grootte van het hele span | `QUAD.scale` (nu 0,92) |
| Waar schoft, mond en handen van de menner zitten | `QUAD.horse.collar`, `QUAD.horse.mouth`, `QUAD.chariot.hands` (staat ook als commentaar in de SVG's) |
| Plaats van de paarden naast elkaar | `QUAD.horses` |
| Snelheid en reikwijdte van de galop | `QUAD.strides`, `QUAD.legs` |
| Hoe ver de paarden de bocht inzetten voor de wagen volgt | `QUAD.lead` |
| Hoe lang wielsporen blijven staan | `QUAD.trackLife` |

## Caesars oordeel aanpassen

Het oordeel is een scène van voren: Caesar zit onscherp op zijn troon onder de tent in de keizersloge, met wachters, fakkels en publiek erachter. Zijn hand staat groot en scherp op de voorgrond; de onderarm loopt naar zijn schouder en wordt daarheen onscherp.

| Wat | Waar |
|---|---|
| De hand | `assets/recraft free plan/hand.png`: opgeschoond, bijgesneden en warmer gekleurd, met een zachte schaduw onderaan de vuist; niet gespiegeld, dus een rechterhand. Draaipunt (midden van de vuist), duimtop en schaal staan in `JUDGE.hand`. |
| De onderarm | `assets/recraft free plan/arm.png`, afgesneden bij de armband. Eindigt achter het midden van de vuist, zodat de hand het uiteinde in elke stand bedekt. Staat stil terwijl de hand draait. Pols- en mouwpunt en hun plek in de scène staan in `JUDGE.arm`; judge.js rekent hoek en schaal zelf uit. |
| Hoe de duim heen en weer gaat | `JUDGE.waver`: hoeken in graden, 90 is opzij met de duim naar binnen (naar Caesar), 0 omhoog, 180 omlaag. De hand draait om het midden van de vuist (`JUDGE.handAt`). |
| Slagschaduw | `#handShadow`: een wazige kopie die meedraait en steeds naar rechtsonder valt |
| Timing | `JUDGE.think`, `JUDGE.snap`, `JUDGE.detail` (ms) |
| Hoe onscherp de achtergrond en Caesars hoofd zijn | `stdDeviation` van filters `#dof` en `#dofFace` in `index.html` |
| Juichen of joelen | CSS-animaties `crowdJump` en `crowdShake` (scène), `arenaCheer()` en `arenaJeer()` (arena) |

`limb.png` (arm en hand in één, van opzij) is geprobeerd en weer teruggedraaid; het bestand staat nog in de map. Ontbreken `hand.png` of `arm.png`, dan tekent het spel de oude SVG-hand en -arm.

Met *verminderde beweging* aan in het besturingssysteem slaat het spel de animaties over en toont het direct de uitslag.

## Open punten

- Rekenen van links naar rechts of met de schoolregel (× vóór +)?
- Andere tijden per ronde?
- De winkel: zie de voorstellen in het gesprek van 6 november.
- Straf voor een fout antwoord (tijd of denarii)?
- Is zelf de som bijhouden naast het sturen te zwaar? Optie: tussenstand kort in Romeinse cijfers tonen na elke vangst.
- Geluid, menigte die reageert, tijdslimiet per ronde.

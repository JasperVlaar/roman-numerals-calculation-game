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

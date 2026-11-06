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
| Operator wisselen | Spatie | + / × knoppen |
| Som wissen | Backspace | Wis |
| Oordeel vragen | Enter | Ik zeg: goed! |

## Huidige regels (demo)

| Onderdeel | Waarde |
|---|---|
| Rekenvolgorde | Van links naar rechts, dus X + V × II = 30 |
| Salaris | 10 + doelgetal, alleen bij een goed antwoord |
| Lorica (armor) | 20 denarii, blokkeert 3 valse cijfers |
| Augur (power-up) | 12 denarii, licht de kortste route op zonder volgorde of operator |
| Kans op vals cijfer | 10% in ronde I, +7% per ronde, max 40% |
| Fout antwoord | Nieuwe poging met een nieuw doel, geen straf |

Moeilijkheid per ronde staat in `cfg(level)` in `game.js`: welke cijfers voorkomen, het bereik van het doelgetal, aantal termen, aantal munten en grootte van de arena.

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
| Grootte van het hele span | `QUAD.scale` |
| Waar schoft, mond en handen van de menner zitten | `QUAD.horse.collar`, `QUAD.horse.mouth`, `QUAD.chariot.hands` (staat ook als commentaar in de SVG's) |
| Plaats van de paarden naast elkaar | `QUAD.horses` |
| Snelheid en reikwijdte van de galop | `QUAD.strides`, `QUAD.legs` |
| Hoe ver de paarden de bocht inzetten voor de wagen volgt | `QUAD.lead` |
| Hoe lang wielsporen blijven staan | `QUAD.trackLife` |

## Caesars oordeel aanpassen

Het oordeel is een scène van voren: Caesar zit onscherp op zijn troon onder de tent in de keizersloge, met wachters, fakkels en publiek erachter. Zijn hand staat scherp op de voorgrond. Zijn onderarm wijst naar de kijker, dus het draaien van de hand is ook echt het draaien van zijn pols.

| Wat | Waar |
|---|---|
| De scène en de hand | Inline SVG `#scene` in `index.html`. De achtergrond zit in `#sceneBg` (onscherp via filter `#dof`), de hand in `#hand`. |
| De hand als afbeelding | `assets/recraft free plan/hand.png`: een opgeschoonde, bijgesneden, gespiegelde (pols rechtsonder) en warmer gekleurde versie van een Recraft-asset, met een zachte schaduw onderaan de vuist ingebakken. Positie, draaipunt (midden van de vuist), duimtop en schaal staan in `JUDGE.hand` in `judge.js`. Vervang het bestand en pas die getallen aan om een andere hand te proberen. Ontbreekt het bestand, dan tekent het spel de oude SVG-hand (`#handDrawn`). De slagschaduw (`#handShadow`) is een wazige kopie die met de hand meedraait en steeds naar rechtsonder valt. |
| De onderarm als afbeelding | `assets/recraft free plan/arm.png` (opgeschoond, bijgesneden, warmer gekleurd). Staat stil terwijl de hand draait en wordt naar Caesar toe onscherp. Afgesneden bij de armband, zodat de hand er in elke stand uit lijkt te komen. Pols- en mouwpunt in de afbeelding en hun plek in de scène staan in `JUDGE.arm`; judge.js rekent hoek en schaal zelf uit. |
| Hoe onscherp de achtergrond is | `stdDeviation` van filter `#dof` in `index.html` |
| Hoe onscherp Caesars hoofd is | `stdDeviation` van filter `#dofFace` (iets scherper dan de rest, zodat zijn gezicht leesbaar blijft) |
| Huidtinten van de hand | Gradiënten `#gRoll`, `#gThumb` en `#gBack` in `index.html` |
| Hoe lang Caesar twijfelt | `JUDGE.think` (ms) in `judge.js` |
| Hoe de duim heen en weer gaat | `JUDGE.waver`: hoeken in graden, -90 is opzij (hand in het verlengde van de arm), 0 omhoog, -180 omlaag. De hand draait om de pols (`JUDGE.handAt`), zodat hij altijd aan de arm vast blijft. |
| Snelheid van het omslaan | `JUDGE.snap` |
| Wanneer uitslag en knop verschijnen | `JUDGE.detail` |
| Juichen of joelen in de scène | CSS-animaties `crowdJump` en `crowdShake` in `style.css` |
| Juichen of joelen in de arena | `arenaCheer()` en `arenaJeer()` in `arena.js` |

Met *verminderde beweging* aan in het besturingssysteem slaat het spel de animaties over en toont het direct de uitslag.

## Open punten

- Rekenen van links naar rechts of met de schoolregel (× vóór +)?
- Straf voor een fout antwoord of voor wissen (tijd of denarii)?
- Is zelf de som bijhouden naast het sturen te zwaar? Optie: tussenstand kort in Romeinse cijfers tonen na elke vangst.
- Geluid, menigte die reageert, tijdslimiet per ronde.

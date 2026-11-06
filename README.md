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
| `style.css` | Kleuren als CSS-variabelen in `:root`, plus layout |
| `game.js` | Alle spellogica en het tekenen op canvas |
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

## Open punten

- Rekenen van links naar rechts of met de schoolregel (× vóór +)?
- Straf voor een fout antwoord of voor wissen (tijd of denarii)?
- Is zelf de som bijhouden naast het sturen te zwaar? Optie: tussenstand kort in Romeinse cijfers tonen na elke vangst.
- Geluid, menigte die reageert, tijdslimiet per ronde.

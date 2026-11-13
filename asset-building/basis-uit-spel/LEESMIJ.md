# Basis om over te tekenen

Uit het spel geëxporteerd op 11-11-2026. Alles hier is in code getekend (fight.js en shops.js), dus van jou: vrij te gebruiken en te veranderen.

| Map | Wat | Formaat |
|---|---|---|
| `iconen-svg/` | De winkel-iconen: alle wapens, uitrusting en pijlen | SVG (vector), viewBox 40 × 40, opent als 400 × 400. Direct te bewerken in Affinity |
| `speler-png/` | Jouw gladiator van bovenaf, zoals in de arena: per wapen (`wapen-…`), per stuk uitrusting met een gladius (`uitrusting-…`), en één volledige set | PNG, transparant, 8× zo groot als in het spel (strijdwagens 5×) |
| `vijanden-png/` | Alle vijanden en dieren van bovenaf, in rust | PNG, transparant, 8× (grote dieren en ruiters 5×) |

Goed om te weten bij het overtekenen:
- **Kijkrichting**: de figuren in het spel kijken naar rechts (+x). De speler staat hier in zijn rusthouding, met het wapen schuin naar rechtsonder.
- **De schaduwellips** zit in de PNG's, maar tekent de code zelf. Teken hem dus niet in je eigen versie.
- **De arena-figuren zijn PNG**, omdat het spel ze op een canvas tekent. Een SVG-export daarvan bestaat niet. Gebruik ze als onderlaag en teken er in vector overheen.
- Zie de stijlgids in het project (`claude/stijlgids-roman-numerals.md`) voor palet, randkleur en regels.

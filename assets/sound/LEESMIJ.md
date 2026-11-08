# Geluiden voor de arena

## Wat er nu in staat

| Bestand | Uit | Bron en licentie |
|---|---|---|
| `crowd-loop.wav` | 1,5–34,8 s, met een overvloeier van 2 s zodat de loop naadloos herhaalt; 24 kHz, 31,3 s, op −20 dB (origineel stond net in het rood) | "Crowd Shouting" door freesound_community, via Pixabay (`sounds/pixaby content license/`). Pixabay Content License: geen naamsvermelding verplicht. Vervangt de eerdere loop van FlatHill. |
| `cheer-big.mp3` | 5,0–9,8 s (de piek), uitfaden 1,6 s | "Crowd Cheering - Strong Cheering and Strong Rhythmic Cheering" door GregorQuendel, [Freesound 481782](https://freesound.org/people/GregorQuendel/sounds/481782/), **CC BY 4.0: naamsvermelding verplicht** (staat op het startscherm) |
| `cheer-1.mp3` | 6,0–7,7 s | idem |
| `cheer-2.mp3` | 16,2–17,9 s (ritmisch) | idem |
| `cheer-3.mp3` | 21,0–22,7 s | idem |
| `hit-1.wav` | Alleen de klap: vanaf 0,609 s, 0,22 s lang, genormaliseerd | "Punch #1" door lewisisminted, [Freesound 162370](https://freesound.org/people/lewisisminted/sounds/162370/), CC0 |
| `hurt.wav` | Alleen het tweede geluid ("oof"): vanaf 2,462 s, 0,54 s lang; de piek zacht gecomprimeerd zodat hij even hard klinkt als de klap | "punchednoises" door shelbyshark, [Freesound 444703](https://freesound.org/people/shelbyshark/sounds/444703/). Licentie: controleer op de pagina. |
| `boo.mp3` | Vanaf 0,109 s, 2,6 s lang, piek getemd (origineel 1,2) en op −12 dB, even luid als het grote gejuich. Alleen als je verliest. | "11575 male group booing" door Robinhood76, [Freesound 687017](https://freesound.org/people/Robinhood76/sounds/687017/), **CC BY 4.0: naamsvermelding verplicht** (staat op het startscherm) |

De originelen staan in `sounds/` in de hoofdmap. Nog niet gevuld: `block.wav` (dat geluid blijft stil).

## Welke bestanden het spel verwacht

Zet de opnames in deze map, met precies deze bestandsnamen. Ontbreekt een bestand, dan blijft dat geluid stil. Klapgeluiden als `.wav` (een `.mp3` begint met een paar ms stilte). Andere namen of `.ogg` kan ook: pas dan `SOUNDS` bovenaan `sound.js` aan.

| Bestand | Wat | Lengte | Zoekterm |
|---|---|---|---|
| `crowd-loop.wav` | Publiek dat continu roezemoest, zonder grote uitschieters. Moet naadloos herhalen. | 20–60 s | *crowd ambience*, *stadium crowd loop*, *crowd murmur* |
| `cheer-1.mp3`, `cheer-2.mp3`, `cheer-3.mp3` | Kort gejuich, een "oooh!" of "yeah!" van een groep | 1–2 s | *crowd cheer short*, *crowd reaction* |
| `cheer-big.mp3` | Groot gejuich: iemand valt, *Pugnate!*, jij wint | 3–5 s | *stadium roar*, *crowd goal cheer* |
| `boo.mp3` | Gejoel van een groep | 2–3 s | *crowd boo*, *crowd booing* |
| `hit-1.wav` | Vuistslag of stomp, dof | < 0,5 s | *punch*, *body hit* |
| `hurt.wav` | Jij wordt geraakt: kreun of "oof" (de klap zelf komt uit `hit-1.wav`) | < 0,7 s | *grunt*, *oof*, *pain* |
| `block.wav` | Een klap wordt afgeweerd: houtige of leren tik | < 0,5 s | *block*, *wood hit*, *parry* |

Meer varianten (bijvoorbeeld `cheer-4.mp3`) kunnen ook: voeg ze toe aan de lijst in `sound.js`.

## Waar te vinden

| Bron | Licentie | Opmerking |
|---|---|---|
| [Pixabay sound effects](https://pixabay.com/sound-effects/) | Pixabay Content License: gratis, ook commercieel, geen naamsvermelding | Geen account nodig. Goed voor alles in de lijst. |
| [Mixkit](https://mixkit.co/free-sound-effects/) | Gratis, ook commercieel, geen naamsvermelding | Kleinere, verzorgde collectie |
| [Gregor Quendel – Free Crowd Cheering Sounds](https://gregor-quendel.itch.io/free-crowd-cheering-sounds) | Zie de licentie in het zip-bestand | Veldopnames van publiek, met losse sporen voor ambience en zacht/hard gejuich (260 MB) |
| [Sonniss GDC-bundels](https://sonniss.com/gameaudiogdc) | Royalty-free, ook commercieel, geen naamsvermelding | Professioneel, maar erg groot (gigabytes); verboden voor AI-training |
| [Freesound](https://freesound.org) | Per geluid verschillend | Filter op *Creative Commons 0*; dan geen naamsvermelding nodig. Account nodig. |

Vermijd BBC Sound Effects als je het spel ooit wilt verkopen: die licentie is alleen niet-commercieel.

## Tips

- **Loop:** knip het publiek zo dat begin en eind even hard zijn, anders hoor je een sprong bij het herhalen. `.ogg` of `.wav` herhaalt naadlozer dan `.mp3`.
- **Inkorten:** veel opnames hebben stilte aan het begin. Knip die eraf (bijvoorbeeld in Audacity), anders komt het gejuich te laat.
- **Controleren:** open de browserconsole en typ `SFX.found()`. Dan zie je per soort hoeveel bestanden het spel gevonden heeft.


## De straat en extra geluiden (toegevoegd)

Alle bronnen uit `sounds/Creative Commons/`; bewerkt met ffmpeg (ingekort, mono, op gelijk niveau gebracht, pieken zacht afgerond).

| Bestand | Uit | Gebruik |
|---|---|---|
| `hit-2.wav` | "punch_02" door thefsoundman (118513), stilte eraf, −17 dB zoals hit-1 | wisselt af met hit-1 bij elke klap |
| `whoosh.wav` | "whoosh" door qubodup (60013) | zwiep van de stok |
| `meow.wav` | "cat meow" door philsapphire (256452) | de kat in de straat |
| `purr-loop.wav` | "cat purr" door trautwein (260881), 2–15 s, overvloeier 1,5 s | de kat spint als je hem aait |
| `birds-loop.wav` | "birds singing 03" door dcpoke (387978), overvloeier 2 s | continu op straat |
| `smithy.mp3` | "blacksmith workshop" door thefilmbakery (137836), de stukken 3–22 s en 113–127 s (daar wordt gehamerd) | wapensmid: zacht op straat, hard binnen |
| `carve.mp3` | "knife carve wood" door timocoetzee200014 (594298) | boogmaker, met pauzes |
| `footsteps.mp3` | "footstep on wood foley" door martian (19292) | alleen binnen bij de harnasmaker |
| `horse.mp3` | "horse" door 3bagbrew (59569), eerste 6,5 s | stallen, af en toe; zacht op straat |
| `clopping.mp3` | "horse clip-clopping downhill" door swiftoid (182504), 3–25 s, langzaam in en uit | komt elke 20–45 s langs op straat |

Licenties: deze map heet "Creative Commons"; controleer per geluid op Freesound of het CC0 of CC BY is. De makers staan voor de zekerheid allemaal in de vermelding op het startscherm.

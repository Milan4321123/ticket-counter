# Artist intros

Short 16:9 (1920×1080) walk-on intros, played on the stage screen right
BEFORE each act enters, one video per artist: Sugam Pokhrel, Bajagaja, and
Binay Karki & Thunga Band, for Dashain 2026 in Heidelberg (NPJOE e.V. ×
Nepali Events Germany).

They are built like a concert entrance, not an ad: lights down (crowd murmur,
heartbeat, phone lights) → the hall claps along to stomp-stomp-clap while short
lines tell the artist's story over their silhouette → "Make some noise!" with a
noise meter → 3 · 2 · 1 (Tin · Dui · Ek) → the silhouette lights up with the
name, confetti and a rock riff, and the last chord rings out under the cheering
so the band can take over. `crowd.mjs` synthesizes the live sounds (hall, applause,
the crowd clapping on the beat, cheers, shouted counts, stomps, power chords).

The pipeline: cut the people out of each photo → upscale → draw the stage →
synthesise the soundtrack → encode. Each artist has three files: `<artist>.js`
(the edit: scene times, words, story lines, count, facts with their source),
`<artist>.html` (the stage: `?t=12` shows a moment, `?play` plays it with the
audio) and `<artist>.score.mjs` (the music), all reading the same times.

| artist | look | sound |
|---|---|---|
| `sugam` (main guest, ~33 s) | gold: warp through a tunnel of his hits → gold-particle portrait (phone lights up!) → claps that speed up → HANDS UP + WHOA-OH chant with bouncing-ball lyrics → "When I say SUGAM, you say POKHREL!" → particle 3·2·1 → fireworks + 3D gold name | D major stadium anthem, 128 bpm: choir, brass, timpani, the crowd singing the chant, bansuri, madal, firework sounds |
| `bajagaja` | neon cyan & red, instrument roll call (Baja 01–04) | A minor funk-rock, 120 bpm, sticks count-in, claps on 2 & 4 |
| `binay` | fire & smoke, "Shout HEY!", AIR GUITAR! over a 3D fretboard | D minor hard rock, 150 bpm, amp hum + feedback, guitar shred, madal |

```bash
cd tools/artist-intros
swiftc -O cutout.swift -o out/cutout                 # once: Apple Vision subject lift (macOS 14+)
for f in sing portrait stage; do ./out/cutout assets/sugam/$f.jpg assets/sugam/$f-cut.png; done
# group photos: both masks, then masks.py merges them, paints out a printed logo, trims
for f in studio club; do ./out/cutout assets/bajagaja/$f.jpg assets/bajagaja/$f-inst.png; ./out/cutout assets/bajagaja/$f.jpg assets/bajagaja/$f-people.png --people; done
python3 masks.py bajagaja
python3 points.py sugam sing-cut@2x.png 4200          # stipples the cut-out into the gold-particle portrait → assets/sugam/points.js
python3 prep.py sugam bajagaja                       # 2× Lanczos + sharpening → *@2x.jpg / *-cut@2x.png
node synth.mjs sugam                                 # → out/sugam/audio.wav (runs sugam.score.mjs)
python3 sections.py sugam                            # loudness per scene: should build from ~−21 dB to ~−13 dB at the reveal
JOBS=3 node render.mjs sugam                         # → out/sugam/frames (ONLY=4.8,14 samples; FRAMES=318-340 redo some)
ffmpeg -framerate 30 -i out/sugam/frames/%05d.jpg -i out/sugam/audio.wav \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p \
  -movflags +faststart -c:a aac -b:a 256k -ar 48000 -shortest out/sugam/sugam-pokhrel-walk-on.mp4
```

- `fx.js` is the shared drawing kit (blur-in words, dust, beams, sparks, rays,
  the 3D wave of dots, grain, spotlight, confetti, fireworks, lens flare, the
  crowd in silhouette with phones, claps and swaying); `crowd.mjs` adds live-show
  sounds (hall, applause, cheers, the crowd singing or shouting, fireworks) and
  instruments (choir, brass, timpani, lead and bass guitar, organ, sticks) to
  `../ad-videos/kit.mjs`.
- Every face is loaded in `setup()` before rendering: with `display=block`, text
  in a face that hasn't loaded yet is invisible, so its first frame would be missing.
- `assets/` (artists' photos) and `out/` are not committed. Sugam's "portrait"
  photo is Onlinekhabar's, Bajagaja's "studio" photo has a date and an "O2 years"
  logo printed on it, and Binay's "badge" has his name printed beside him; all
  three are only ever shown as cut-out black silhouettes.
  If either is shown in colour, keep the watermark and credit it.

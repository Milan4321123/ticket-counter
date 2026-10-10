# Event film

A 30-second, 16:9 (1920×1080) motion-graphics film about MartNepali for the big screen
at an event, to run behind a presenter. Roman Nepali up front, English underneath; an
original 128 bpm soundtrack (no licensed music).

It pitches to **sellers**, honest about today: two events are on sale (the Dashain shows
in Heidelberg and Lisbon) and the next one could be yours.

"Dashain Heidelberg ko ticket? MartNepali ma." → the two real tickets, then a hologram
ticket "Arko… tapai ko?" → "Program? Pasal? Restaurant?" → drop: "Yahi bechnus." →
0 % commission, the money flowing from the buyer's phone straight to the seller's
account → the real tools from the demo (kitchen board, shop page, QR scan, marked DEMO)
→ breakdown: "Custom app chahiyo? Hami banaidinchhau." with designs wiping into each
other → drop 2: "Kura garau." → end card with a big QR to martnepali.com/contact.

```bash
node synth.mjs        # soundtrack → out/audio.wav (~2 min)
node render.mjs       # frames → out/frames (~9 min; ONLY=4.5,10.2 renders samples into out/sample)
cd out
ffmpeg -framerate 30 -i frames/%05d.jpg -i audio.wav -af "afade=t=out:st=29.3:d=0.7,loudnorm=I=-14:TP=-1.5:LRA=9" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k -ar 48000 -shortest martnepali-event-film.mp4
```

- `film.js` is the edit: scene times on the bar grid, the copy, camera shakes and sound
  cues. The stage and the soundtrack both read it, so a change there moves picture and
  sound together. Every claim in it is a fact about the live site (the header lists
  where); there are no price, quote or budget words — the platform stays free.
- `stage.html` draws every moment from `render(t)` — three.js for the 3D (dot sea,
  tickets, hologram, burst, money stream, devices, swatches) through a bloom pass that
  only lights what is brighter than white, the DOM for type. It needs to be served from
  the repo root (three.js comes from `node_modules`); `render.mjs` does that.
  Gotcha: the 3D background colour is set as `scene.background`, not the renderer's clear
  colour — RenderPass clears with a colour converted outside the render, which comes out
  twice as bright (grey instead of black).
- `assets/`: the two posters (the Lisbon one from its live event page), phone shots of the
  live event page and checkout, screens from the demo recordings in
  `../story-videos/out/*/rec` (Didi's Momo Kitchen — an example shop).
  The QR on the end card is made at render time.
- Renders with puppeteer-core + Edge (from `../story-videos`), sound on the shared kit
  (`../ad-videos/kit.mjs`).

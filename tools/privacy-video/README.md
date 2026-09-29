# Datenschutz ad (DSGVO checklist)

A 44-second, 1080×1920 motion-graphics ad (Reels, WhatsApp Status, TikTok):
"Deine Daten. Wer passt darauf auf?" → MartNepali, "DSGVO ✓" → eight
checklist items, each ticked → the whole list, 8/8 → where to read it all.

    node render.mjs          # → out/frames/*.jpg   (ONLY=3,9.4 for samples, FROM=41 to redo the end)
    node synth.mjs           # → out/audio.wav      (synthesized, no licensed music)
    ffmpeg -framerate 30 -i out/frames/%05d.jpg -i out/audio.wav -c:v libx264 -crf 18 \
      -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k -shortest ~/Desktop/martnepali-datenschutz-ad.mp4

- `spec.js` — the timeline and the eight claims, shared by the picture and
  the sound. Every claim is a fact about the live site, with the file that
  makes it true listed at the top. **Change the site → check this list.**
  Deliberately no "100% DSGVO-konform", certificates or seals: a checklist of
  facts, not a promise nobody can audit.
- `stage.html` — the picture; `render(t)` draws second `t`. Open it in a
  browser with `?t=12` for one moment or `?play` to watch.
- `synth.mjs` — the sound, built on `../ad-videos/kit.mjs` (D major, 120 bpm;
  each tick is a bell one step higher up the scale).
- Rendering reuses puppeteer-core from `../story-videos` and the system's
  Microsoft Edge, like `../ad-videos`.
- Delete `out/frames` after encoding — 1,320 JPEGs are ~300 MB.

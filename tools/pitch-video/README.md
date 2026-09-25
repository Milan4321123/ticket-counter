# The pitch video

Makes `public/media/pitch.mp4`: one real journey through the demo (new shop with the
AI helper → preview → kitchen → confirm a payment → a buyer orders and gets a QR),
with a finger, camera zooms through each tap, captions and a generated soundtrack.

Needs: the dev server on :3000 (`npm run dev`), Microsoft Edge (or change
`executablePath`), ffmpeg, and `npm install` in this folder.

```bash
cd tools/pitch-video
node record.mjs        # films the demo → rec/ (frames) + events.json   (DEBUG=1 saves checkpoints to dbg/)
node timeline.mjs      # the edit: speed-ups, captions, camera → timeline.json
node synth.mjs         # soundtrack → audio.wav
node render2.mjs       # every frame → frames2/
ffmpeg -framerate 30 -i frames2/%05d.jpg -i audio.wav -af "loudnorm=I=-16:TP=-1.5:LRA=11" \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 160k -shortest pitch-full.mp4
# the website copy
ffmpeg -i pitch-full.mp4 -vf scale=720:-2 -c:v libx264 -crf 27 -maxrate 1400k -bufsize 2800k \
  -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 112k ../../public/media/pitch.mp4
```

Notes
- Starting a demo is limited to 4 per hour per IP; restart the dev server to reset it.
- The recorder rewrites `localhost:3000` and `@demo.invalid` addresses on screen.
- Captions, kickers and the outro text live in `record.mjs` (`mark('cap', …)`), `timeline.mjs`
  (`kickerFor`) and `stage2.html` (`#intro`, `#outro`).

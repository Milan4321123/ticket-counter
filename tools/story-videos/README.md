# Story videos

One business's day in the real app per video — the restaurant's Friday evening,
(next: the shop, the event organizer) — filmed through a fresh demo account, with
the explanation of each step beside the phone and a chapter list. The phone turns
into the counter tablet for the kitchen board and the live screen.

Each chapter names the tool button that plays it (`tool` in `stories/<id>.mjs`);
the site reads the chapter times from `src/lib/stories.ts`.

Needs: the dev server on :3000, Microsoft Edge, ffmpeg, `npm install` here.

```bash
node record.mjs restaurant      # films the story → out/restaurant/rec + events.json (DEBUG=1: screenshots in dbg/)
node timeline.mjs restaurant    # the edit → timeline.json + chapters.json
node synth.mjs restaurant       # soundtrack → audio.wav
node render.mjs restaurant      # frames → out/restaurant/frames (ONLY=12,40 renders samples)
cd out/restaurant
ffmpeg -framerate 30 -i frames/%05d.jpg -i audio.wav -af "loudnorm=I=-16:TP=-1.5:LRA=11" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 160k -shortest restaurant-full.mp4
ffmpeg -i restaurant-full.mp4 -vf scale=1280:-2 -c:v libx264 -preset slow -crf 26 -maxrate 1800k -bufsize 3600k \
  -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 112k ../../../../public/media/stories/restaurant.mp4
```

Then paste `out/restaurant/chapters.json` into the story's `chapters` in `src/lib/stories.ts`.

Notes
- Starting a demo is limited to 4 per hour per IP; restart the dev server to reset it.
- A new story: copy `stories/restaurant.mjs` — `meta` (intro/outro), `scenes` (chapter texts)
  and `run(h, listings)` (the taps). `h.scene(id)` starts a chapter, `h.device('tablet')` turns
  the screen round, `h.goto(path)` is a cut.

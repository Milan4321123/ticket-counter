# Ad videos

Vertical (9:16, 1080×1920) motion-graphics ads for one listing and its
organizer, built from the real sites. The first is the Dashain Heidelberg ad
for NPJOE e.V. × Nepali Events Germany (Sugam Pokhrel & Bajagaja, 10 Oct 2026).

The flow is: films the sites → draws the stage → synthesizes the soundtrack → encodes with ffmpeg.

```bash
node capture.mjs        # phone-sized shots of progressive-youth.de + the martnepali.com checkout, their photos, posters, logos → out/dashain/
node synth.mjs          # soundtrack → out/dashain/audio.wav (original, no licensed music)
node render.mjs         # frames → out/dashain/frames (ONLY=3.5,40 renders samples into out/dashain/sample)
cd out/dashain
ffmpeg -framerate 30 -i frames/%05d.jpg -i audio.wav -af "loudnorm=I=-14:TP=-1.5:LRA=9" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k -shortest dashain-heidelberg-ad.mp4
```

## The 15-second shorts

Five shorts for TikTok / Reels / Facebook, each a hook that sells the night
and then one way to the ticket: 1 the direct link, 2 typing martnepali.com,
3 scanning the poster's QR, 4 four tickets for the family, 5 how paying works
(no card, no fees). The edit for all five is `shorts.js`; `shorts.html?v=3`
draws one; `kit.mjs` is the shared sound kit.

```bash
node synth-shorts.mjs 1 2 3 4 5     # → out/dashain/shorts/v<n>/audio.wav (each in its own key)
node render-shorts.mjs 1 2 3 4 5    # → out/dashain/shorts/v<n>/frames (ONLY=3.5 for samples)
cd out/dashain/shorts
ffmpeg -framerate 30 -i v1/frames/%05d.jpg -i v1/audio.wav -af "loudnorm=I=-14:TP=-1.5:LRA=9" \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k -shortest dashain-short-1-link.mp4
```

## The five styled shorts (different look, music and pitch each)

| id | look | music | way to the ticket |
|---|---|---|---|
| hype | black & white kinetic type, glitch cuts on every beat | trap 140 | the direct link |
| warm | cream paper, marigolds, jamara, NPJOE's photos | Nepali folk in 6/8 (madal, sarangi, harmonium) | 4 tickets for the family |
| pov | full-screen phone, TikTok captions, hand-drawn circles | lo-fi 84 with a tape stop | typing martnepali.com |
| reasons | white Swiss infographic, 01·02·03, a ticking checklist | house 124 | "tickets in 4 steps" |
| neon | synthwave sun, neon Himalaya, flickering signs | synthwave 100 | scanning the poster's QR |

Each is `styles/<id>.html` (open with `?t=4` or `?play`), timed by `styles/specs.js`,
built on `stagekit.js` (phone, taps, ticket) and scored by `synth-styles.mjs`.
Needs the 3× shots: `DPR=3 node capture.mjs`.

```bash
node synth-styles.mjs              # → out/dashain/styles/<id>/audio.wav
node render-styles.mjs             # → out/dashain/styles/<id>/frames (ONLY=3.5 for samples)
```

## MartNepali brand ads (brand/)

Five 20-second ads for the platform itself — customer, shop seller, restaurant,
event organizer, general — in the style of a modern product promo (soft
morphing colour blobs on white, words sharpening out of a blur, a giant word the
camera flies through, a dark dot-matrix logo reveal, glass UI cards with a
cursor, a search-bar outro). Roman Nepali up front, English underneath.
The scripts and timings are `brand/ads.js`; `brand/stage.html?ad=seller&t=9`
shows a moment; `brand/art.js` holds the drawn illustrations (no photos).

```bash
node synth-brand.mjs               # → out/brand/<ad>/audio.wav (120 bpm, each ad in its own key)
node render-brand.mjs              # → out/brand/<ad>/frames (ONLY=9 for samples)
```

## Studio: 30 ads for daily posting (studio/)

Thirty 12–18 s ads — six each for buying, selling, events, restaurants and the
platform — each in its own tone and one of seven looks (skins), each look with
its own genre of music: blob (tech-house), kinetic (trap), paper (Nepali folk
6/8), swiss (house), neon (synthwave), pov (lo-fi), cinema (piano & strings).
Scripts, copy, timings and sound cues: `studio/scripts.js`. One stage draws
them all: `studio/stage.html?id=sell-2-kinetic-myth&t=4`.

```bash
node synth-studio.mjs              # → out/studio/<id>/audio.wav
JOBS=3 node render-studio.mjs      # → out/studio/<id>/frames (ONLY=4 for samples; ids to pick)
node make-plan.mjs                 # → out/studio/posting-plan.md (30-day order, captions, covers)
./encode-studio.sh                 # → out/studio/mp4/day-NN-<id>.mp4 + copies to ~/Desktop/martnepali-30-days
```

## Notes

- `timeline.js` is the edit: scene times, the buy scene's taps, the beat grid
  (112 bpm, beat 0 = the date slam) and the sound cues. The stage and the
  soundtrack both read it, so a change there moves picture and sound together.
- `stage.html` draws every moment from `render(t)`. Open it in a browser to look:
  `stage.html?t=12.5` for one moment, `stage.html?play` to watch (no QR codes there;
  render.mjs passes them in).
- Nothing is submitted on the live site: the capture only fills the form with a
  made-up buyer (Sita Gurung, example.com) and the "Reserve" tap is drawn. The
  chat/WhatsApp bubble (it carries a person's photo) and the consent banners
  are hidden in the shots.

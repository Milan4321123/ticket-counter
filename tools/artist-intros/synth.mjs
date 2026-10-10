// node synth.mjs <artist> → out/<artist>/audio.wav
// Each artist has their own score in <artist>.score.mjs (built on
// ../ad-videos/kit.mjs and ./crowd.mjs); this just runs it.
const id = process.argv[2] || 'sugam';
process.argv[2] = id;
await import(`./${id}.score.mjs`);

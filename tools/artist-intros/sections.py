# python3 sections.py <artist> — loudness (RMS / peak) of each scene of a walk-on's
# soundtrack (out/<artist>/audio.wav), to check it builds from the dark intro up to
# the reveal. Scene times come from <artist>.js.
import sys, json, wave, subprocess, numpy as np
aid = sys.argv[1] if len(sys.argv) > 1 else 'sugam'
A = json.loads(subprocess.check_output(['node', '-e', f"const a=require('./{aid}.js');console.log(JSON.stringify({{s:a.scenes,out:a.reveal.bandOut,total:a.TOTAL}}))"]))
w = wave.open(f'out/{aid}/audio.wav'); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, w.getnchannels()).astype(float) / 32768
secs = [(k, a, b) for k, (a, b) in A['s'].items()]
secs[-1] = (secs[-1][0], secs[-1][1], A['out']); secs.append(('ring', A['out'], A['total']))
for n, a, b in secs:
    s = x[int(a * sr):int(b * sr)]; rms = np.sqrt((s ** 2).mean()); pk = np.abs(s).max()
    print(f'{n:7s} {a:5.1f}–{b:5.1f}s  rms {20 * np.log10(rms + 1e-9):6.1f} dB  peak {20 * np.log10(pk + 1e-9):5.1f} dB')

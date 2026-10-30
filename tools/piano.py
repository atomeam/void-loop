# Rebuild Verse's grand piano (void-live-deploy/sounds/piano/) from the original recordings: a Steinway B played with the sustain pedal down,
# every 4 semitones from C3 to E5, a soft and a hard layer. Mono, 48 kHz, 16-bit, the onset moved to the start, cut at 3 s with a 0.5 s fade.
# One gain for both layers of a note, so the soft layer stays soft. Credits and license: sounds/piano/CREDITS.md.
#   python3 tools/piano.py <vcsl> <out>
#     <vcsl>   a checkout of https://github.com/sgossner/VCSL (CC0), with "Chordophones/Zithers/Grand Piano, Steinway B/Sus"
#     <out>    void-live-deploy/sounds/piano
# Needs ffmpeg and numpy. The notes and levels in lib/rap-piano.js (NOTES) follow what this prints.
import subprocess, numpy as np, os, sys, wave
if len(sys.argv) != 3: sys.exit('usage: python3 tools/piano.py <vcsl> <out>')
SRC = os.path.join(sys.argv[1], 'Chordophones', 'Zithers', 'Grand Piano, Steinway B', 'Sus')
OUT = sys.argv[2]
R, CAP, FADE = 48000, 3.0, 0.5
NOTES = [('C3', 48), ('E3', 52), ('G#3', 56), ('C4', 60), ('E4', 64), ('G#4', 68), ('C5', 72), ('E5', 76)]
LAYERS = [('soft', 2), ('hard', 4)]
def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(R), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)
def cut(x):
    pk = np.max(np.abs(x)); on = int(np.argmax(np.abs(x) > pk * 0.05)); s = max(0, on - int(0.001 * R)); x = x[s:s + int(CAP * R)].copy()
    fi = int(0.001 * R); x[:fi] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(fi) / fi)
    fo = int(FADE * R); x[-fo:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(fo) / fo)
    return x
os.makedirs(OUT, exist_ok=True)
for name, midi in NOTES:
    xs = {layer: cut(load(os.path.join(SRC, 'JHPiano_Sus_Close_%s_vl%d_rr1.wav' % (name, vl)))) for layer, vl in LAYERS}
    top = max(np.max(np.abs(x)) for x in xs.values())
    for layer, x in xs.items():
        y = np.clip(x / top * 0.89, -1, 1); d = (y * 32767).round().astype('<i2')
        with wave.open(os.path.join(OUT, '%d-%s.wav' % (midi, layer)), 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(R); w.writeframes(d.tobytes())
    print(midi, name, {layer: round(float(np.max(np.abs(x)) / top), 3) for layer, x in xs.items()})

# Rebuild Verse's recorded bass and electric guitar (void-live-deploy/sounds/bass/, sounds/guitar/) from the original recordings, the way
# tools/piano.py builds the piano. Both libraries are by Karoryfer Lecolds and CC0 1.0 (credits: CREDITS.md in each folder):
#   bass:   karoryfer.swagbass, a bass guitar on old flatwounds, recorded direct with no effects; every 3 semitones, a soft (p) and a hard (f) take
#   guitar: karoryfer.black-and-green-guitars, the green Gretsch Anniversary, recorded clean; every 3 semitones, a held note (ord, f) and a
#           short muted one (stac) in two takes, so fast chugs do not repeat the same sound
# Mono, 24 kHz, 16-bit (the bass sits under a 420 Hz filter and the guitar under a 3.2 kHz cabinet, so 12 kHz of bandwidth is plenty), the
# onset moved to the start, cut with a fade. One gain for every take of a note, so the soft take stays soft.
#   python3 tools/instruments.py <karoryfer> <out>
#     <karoryfer>  a folder holding checkouts of https://github.com/sfzinstruments/karoryfer.swagbass and
#                  https://github.com/sfzinstruments/karoryfer.black-and-green-guitars
#     <out>        void-live-deploy/sounds
# Needs ffmpeg and numpy. The notes and levels in lib/rap-strings.js (BASS, GUITAR) follow what this prints. It also prints the pitch it
# measures in each take, so a mapping mistake shows as a note that is not where its name says.
import subprocess, numpy as np, os, sys, wave
if len(sys.argv) != 3: sys.exit('usage: python3 tools/instruments.py <karoryfer> <out>')
SRC, OUT = sys.argv[1], sys.argv[2]
R = 24000
PC = {'c': 0, 'db': 1, 'd': 2, 'eb': 3, 'e': 4, 'f': 5, 'gb': 6, 'g': 7, 'ab': 8, 'a': 9, 'bb': 10, 'b': 11}
# Karoryfer names its notes one octave up from the usual: c4 is MIDI 48 (the sfz maps give pitch_keycenter=48 for c4)
def name_of(midi): return [k for k, v in PC.items() if v == midi % 12][0] + str(midi // 12)
def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(R), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)
def cut(x, cap, fade):
    pk = np.max(np.abs(x)); on = int(np.argmax(np.abs(x) > pk * 0.05)); s = max(0, on - int(0.001 * R)); x = x[s:s + int(cap * R)].copy()
    fi = int(0.001 * R); x[:fi] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(fi) / fi)
    fo = min(len(x), int(fade * R)); x[-fo:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(fo) / fo)
    return x
def pitch(x):
    # the fundamental by autocorrelation over 0.05 s to 0.35 s, searched between 25 Hz and 1200 Hz; returned as a (fractional) MIDI number
    a, b = int(0.05 * R), min(len(x), int(0.35 * R)); y = x[a:b] - np.mean(x[a:b]); n = len(y)
    f = np.fft.rfft(y, 2 * n); ac = np.fft.irfft(f * np.conj(f))[:n]; lo, hi = int(R / 1200), int(R / 25)
    lag = lo + int(np.argmax(ac[lo:hi]))
    # a strong second harmonic can make the lag twice the period (an octave low): take the half lag when it correlates almost as well
    h = lag // 2; k = max(lo, h - 2) + int(np.argmax(ac[max(lo, h - 2):h + 3])) if h - 2 > lo else None
    if k and ac[k] > 0.85 * ac[lag]: lag = k
    return 69 + 12 * np.log2(R / lag / 440)
def write(path, y):
    d = (np.clip(y, -1, 1) * 32767).round().astype('<i2')
    with wave.open(path, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(R); w.writeframes(d.tobytes())
def build(folder, notes, takes):
    # takes: [(label, source path for a note name, cap seconds, fade seconds)]; one gain for every take of a note
    os.makedirs(os.path.join(OUT, folder), exist_ok=True)
    for midi in notes:
        xs = {label: cut(load(src(name_of(midi))), cap, fade) for label, src, cap, fade in takes}
        top = max(np.max(np.abs(x)) for x in xs.values())
        for label, x in xs.items(): write(os.path.join(OUT, folder, '%d-%s.wav' % (midi, label)), x / top * 0.89)
        print(folder, midi, name_of(midi), {label: round(float(np.max(np.abs(x)) / top), 3) for label, x in xs.items()},
              'measured', {label: round(float(pitch(x)), 2) for label, x in xs.items()})
BASS = os.path.join(SRC, 'karoryfer.swagbass', 'notes')
build('bass', range(24, 46, 3), [('soft', lambda n: os.path.join(BASS, n + '_p_rr1.wav'), 2.5, 0.4), ('hard', lambda n: os.path.join(BASS, n + '_f_rr1.wav'), 2.5, 0.4)])
GTR = os.path.join(SRC, 'karoryfer.black-and-green-guitars', 'Samples', 'green')
build('guitar', range(40, 74, 3), [('held', lambda n: os.path.join(GTR, 'ord', 'twang_' + n + '_f_rr1.wav'), 2.5, 0.4)])
build('guitar', range(40, 65, 3), [('mute1', lambda n: os.path.join(GTR, 'stac', 'staccato_' + n + '_rr1.wav'), 0.5, 0.15),
                                   ('mute2', lambda n: os.path.join(GTR, 'stac', 'staccato_' + n + '_rr2.wav'), 0.5, 0.15)])

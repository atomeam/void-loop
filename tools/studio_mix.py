# Verse's studio mixer (tools/studio-make.mjs): the voices placed on one timeline, over a soft piano bed made from the CC0 Steinway
# samples in void-live-deploy/sounds/piano (VCSL, sounds/piano/CREDITS.md). The bed plays up front, ducks well under every spoken
# line, breathes back up in the gaps, and swells for the close. One stereo 44.1 kHz WAV out; ffmpeg sets the final loudness.
#   python3 tools/studio_mix.py <job.json>     job: { sr, out, total, intro, outro, piano, voices: [{ file, at }], seed }
import json, sys, math, random
import numpy as np
import soundfile as sf

SR = 44100
# a warm I - vi - IV - V in C, voiced low and open; each chord is a bar
PROG = [(48, [60, 64, 67, 72]), (45, [57, 60, 64, 69]), (41, [57, 60, 65, 69]), (43, [55, 59, 62, 67])]

def load(path, sr=SR):
    x, r = sf.read(path, dtype='float32', always_2d=True)
    x = x.mean(axis=1)
    if r != sr:
        n = int(round(len(x) * sr / r))
        x = np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype('float32')
    return x

def note(piano, midi, vel):
    base = min(range(36, 85, 4), key=lambda s: abs(s - midi))
    x = piano[(base, 'soft' if vel < 0.7 else 'hard')]
    ratio = 2 ** ((midi - base) / 12)
    n = int(len(x) / ratio)
    y = np.interp(np.arange(n) * ratio, np.arange(len(x)), x).astype('float32')
    return y * vel

def bed(piano, seconds, bpm=72, seed=1):
    rnd = random.Random(seed)
    beat = 60 / bpm
    out = np.zeros(int((seconds + 4) * SR), dtype='float32')
    t, bar = 0.0, 0
    while t < seconds:
        root, chord = PROG[bar % len(PROG)]
        hits = [(0, root - 12, 0.55), (0, root, 0.4)]
        for k, m in enumerate([chord[0], chord[1], chord[2], chord[3], chord[2], chord[1], chord[2], chord[3]]):
            hits.append((k * beat / 2 + rnd.uniform(-0.012, 0.012), m, (0.32 if k in (0, 2, 4, 6) else 0.22) + rnd.uniform(-0.03, 0.03)))
        for off, m, v in hits:
            y = note(piano, m, v)
            a = int((t + off) * SR)
            if a < 0 or a >= len(out):
                continue
            b = min(len(out), a + len(y))
            out[a:b] += y[:b - a]
        t += 4 * beat
        bar += 1
    # soft top end and a little room: a windowed-sinc lowpass and two quiet echoes
    fc = 3200 / SR
    n = np.arange(-32, 33)
    kern = np.sinc(2 * fc * n) * np.hamming(len(n))
    lp = np.convolve(out, (kern / kern.sum()).astype('float32'), mode='same').astype('float32')
    for d, g in ((0.19, 0.22), (0.37, 0.12)):
        n = int(d * SR)
        lp[n:] += lp[:-n] * g
    return lp[: int(seconds * SR)]

def envelope(x, attack=0.03, release=0.45):
    win = int(0.02 * SR)
    pad = np.pad(np.abs(x), (0, (-len(x)) % win))
    rms = np.sqrt((pad.reshape(-1, win) ** 2).mean(axis=1))
    act = (rms > 0.01).astype('float32')
    env = np.zeros_like(act); v = 0.0
    a, r = 1 - math.exp(-0.02 / attack), 1 - math.exp(-0.02 / release)
    for i, s in enumerate(act):
        v += (s - v) * (a if s > v else r)
        env[i] = v
    return np.repeat(env, win)[: len(x)]

def main():
    job = json.load(open(sys.argv[1]))
    total = float(job['total'])
    voice = np.zeros(int(total * SR) + SR, dtype='float32')
    for v in job['voices']:
        y = load(v['file'])
        a = int(float(v['at']) * SR)
        b = min(len(voice), a + len(y))
        voice[a:b] += y[: b - a]
    voice = voice[: int(total * SR)]
    piano = {}
    for s in range(36, 85, 4):
        for layer in ('soft', 'hard'):
            piano[(s, layer)] = load(f"{job['piano']}/{s}-{layer}.wav")
    music = bed(piano, total, seed=int(job.get('seed', 1)))
    music /= (np.abs(music).max() or 1)
    duck = envelope(voice)
    intro, outro = float(job.get('intro', 3)), float(job.get('outro', 3))
    t = np.arange(len(music)) / SR
    # loudness of the bed against the voice: about -26 dB under a line, -15 dB in a gap, -8 dB alone at the open and the close
    under, gap, alone = 10 ** (-26 / 20), 10 ** (-15 / 20), 10 ** (-8 / 20)
    level = gap + (under - gap) * duck
    level = np.where(t < intro, np.maximum(level, alone * np.clip((intro - t) / 1.2, 0, 1)), level)
    level = np.where(t > total - outro, np.maximum(level, alone * np.clip((t - (total - outro)) / 1.0, 0, 1)), level)
    fade = np.clip((total - t) / 1.5, 0, 1) * np.clip(t / 0.6, 0, 1)
    peak = np.abs(voice).max() or 1
    mix_l = voice / peak * 0.8 + music * level * fade * 0.8 * 0.92
    mix_r = voice / peak * 0.8 + music * level * fade * 0.8 * 1.0
    st = np.stack([mix_l, mix_r], axis=1)
    st /= max(1.0, np.abs(st).max() / 0.95)
    sf.write(job['out'], st, SR, subtype='PCM_16')
    print(json.dumps({'seconds': round(total, 3)}))

if __name__ == '__main__':
    main()

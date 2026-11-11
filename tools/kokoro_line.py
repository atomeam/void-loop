# One Kokoro line (Apache-2.0, hexgrad/kokoro via kokoro-onnx) plus word times.
# The times map the known words onto the speech energy, the same job WhisperX does with wav2vec when the transcript is already known.
import json, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

def align(samples, sr, text):
    words = text.split()
    if not len(words):
        return []
    frame = max(1, int(sr * 0.02))
    rms = []
    for i in range(0, len(samples), frame):
        sl = samples[i:i + frame]
        rms.append(float(np.sqrt(np.mean(np.square(sl)))) if len(sl) else 0.0)
    peak = max(rms) if rms else 1.0
    speech = [v > peak * 0.18 for v in rms]
    spans, i = [], 0
    while i < len(speech):
        if not speech[i]:
            i += 1
            continue
        j = i
        while j < len(speech) and speech[j]:
            j += 1
        spans.append((i * 0.02, j * 0.02))
        i = j
    if not spans:
        spans = [(0.0, len(samples) / sr)]
    total = sum(b - a for a, b in spans) or 0.01
    weights = [max(1, sum(c.isalpha() for c in w)) for w in words]
    tw = sum(weights) or 1
    out, cursor, pos = [], 0, spans[0][0]
    for w, wt in zip(words, weights):
        left, start = total * wt / tw, pos
        while left > 0 and cursor < len(spans):
            a, b = spans[cursor]
            if pos < a:
                pos = a
            room = b - pos
            if room >= left:
                pos += left
                left = 0
            else:
                left -= max(0.0, room)
                cursor += 1
                if cursor < len(spans):
                    pos = spans[cursor][0]
        out.append({'w': w, 'from': round(start, 3), 'to': round(max(start + 0.04, pos), 3)})
    return out

def speak(k, voice, lang, speed, text, out):
    samples, sr = k.create(text, voice=voice, speed=float(speed), lang=lang)
    sf.write(out, samples, sr)
    return {'sr': sr, 'seconds': round(len(samples) / sr, 3), 'words': align(samples, sr, text)}

def main():
    if len(sys.argv) > 2 and sys.argv[2] == '--batch':
        model, voices, jobs_path = sys.argv[1], sys.argv[3], sys.argv[4]
        k = Kokoro(model, voices)
        done = []
        for job in json.load(open(jobs_path)):
            done.append(speak(k, job['voice'], job['lang'], job['speed'], job['text'], job['out']))
        print(json.dumps(done))
        return
    model, voices, voice, lang, speed, text, out = sys.argv[1:8]
    k = Kokoro(model, voices)
    print(json.dumps(speak(k, voice, lang, speed, text, out)))

if __name__ == '__main__':
    main()

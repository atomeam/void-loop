# Rebuild Verse's drum kits (void-live-deploy/sounds/drums/) from the original recordings: mono, 48 kHz, 16-bit, the onset moved to the start,
# the tail cut at -54 dB and faded, one peak level per voice so a soft layer stays soft. Credits and licenses: sounds/drums/CREDITS.md.
#   python3 tools/drum-kits.py <vcsl> <tr808> <out>
#     <vcsl>   a checkout of https://github.com/sgossner/VCSL (CC0)
#     <tr808>  the TR808WAV folder of the npm package @fluid-music/tr-808 (Michael Fischer's TR-808 set, free, packaged under ISC)
#     <out>    void-live-deploy/sounds/drums
# Needs ffmpeg and numpy. The voice files in lib/rap-kit.js (KITS) follow the order of the takes below.
import subprocess, numpy as np, os, json, sys, wave
if len(sys.argv) != 4: sys.exit('usage: python3 tools/drum-kits.py <vcsl> <tr808> <out>')
V = os.path.join(sys.argv[1], '')
E = os.path.join(sys.argv[2], '')
OUT = sys.argv[3]
R = 48000
def load(p):
    raw = subprocess.run(['ffmpeg','-v','error','-i',p,'-ac','1','-ar',str(R),'-f','f32le','-'],capture_output=True,check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)
def cut(x, cap, gate=None):
    pk = np.max(np.abs(x)); on = int(np.argmax(np.abs(x) > pk*0.05)); s = max(0, on - int(0.0015*R)); x = x[s:]
    env = np.sqrt(np.convolve(x**2, np.ones(240)/240, 'same')); e = env/env.max(); end = len(e)-1
    while end > 0 and e[end] < 10**(-54/20): end -= 1
    n = min(len(x), end + int(0.03*R), int(cap*R)); x = x[:n].copy()
    if gate: # a drummer's choke: the tail dies away over `gate` seconds after the hit
        t = np.arange(n)/R; x *= np.where(t < gate*0.4, 1, np.exp(-(t-gate*0.4)/(gate*0.25)))
    fi = int(0.001*R); x[:fi] *= 0.5-0.5*np.cos(np.pi*np.arange(fi)/fi)
    fo = min(int(0.03*R), n//4); x[-fo:] *= 0.5+0.5*np.cos(np.pi*np.arange(fo)/fo)
    return x
def save(name, x, peak):
    p = os.path.join(OUT, name); os.makedirs(os.path.dirname(p), exist_ok=True)
    y = np.clip(x/peak*0.89, -1, 1); d = (y*32767).round().astype('<i2')
    with wave.open(p, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(R); w.writeframes(d.tobytes())
    return len(d)
KITS = {
 '808': {
  'kick':  [(E+'BD/BD1025.WAV',0.5), (E+'BD/BD2525.WAV',0.5)],
  'bass':  [(E+'BDTuned/BD2510-g1.wav',3.0), (E+'BDTuned/BD0010-g1.wav',3.0)],
  'snare': [(E+'SD/SD2525.WAV',0.4), (E+'SD/SD5050.WAV',0.4)],
  'clap':  [(E+'CP/CP.WAV',0.6)],
  'hat':   [(E+'CH/CH.WAV',0.3)],
  'ohat':  [(E+'OH/OH25.WAV',0.7), (E+'OH/OH75.WAV',0.9)],
  'crash': [(E+'CY/CY5050.WAV',2.6)],
  'rim':   [(E+'RS/RS.WAV',0.3)],
  'cowbell': [(E+'CB/CB.WAV',0.5)],
 },
 'kit': {
  'kick':  [(V+'Membranophones/Struck Membranophones/Bass Drum 1/BDrumNew_hit_v%s_rr%s_Sum.wav'%(v,r),0.6,0.42) for v in (7,5) for r in (1,2)],
  'snare': [(V+'Membranophones/Struck Membranophones/Snare Drum, Modern 1/Snare2_HitSN_v%s_rr%s_Mid.wav'%(v,r),0.7) for v in (9,7,5) for r in (1,2)],
  'rim':   [(V+'Membranophones/Struck Membranophones/Snare Drum, Modern 1/Snare2_stick_v1_rr%s_Mid.wav'%r,0.3) for r in (1,2)],
  'hat':   [(V+'Idiophones/Struck Idiophones/Hi-Hat Cymbal/HiHat_HitC_v%s_rr%s_Mid.wav'%(v,r),0.45) for v in (4,3,2) for r in (1,2)],
  'ohat':  [(V+'Idiophones/Struck Idiophones/Hi-Hat Cymbal/HiHat_HitO_rr%s_Mid.wav'%r,1.4,0.9) for r in (1,2)],
  'pedal': [(V+'Idiophones/Struck Idiophones/Hi-Hat Cymbal/HiHat_Close_rr%s_Mid.wav'%r,0.3) for r in (1,2)],
  'crash': [(V+'Idiophones/Struck Idiophones/Suspended Cymbal 1/susCymb1_hit_stick_f1.wav',3.0)],
  'ride':  [(V+'Idiophones/Struck Idiophones/Suspended Cymbal 1/susCymb1_hit_bell_mf1.wav',1.6)],
  'clap':  [(V+'Idiophones/Struck Idiophones/Claps/Clap_rr%s.wav'%r,0.5) for r in (1,2,3,4)],
  'tomhi': [(V+'Membranophones/Struck Membranophones/Tom 1/Stick/TomH_HitS_v4_rr%s_Mid.wav'%r,0.8,0.6) for r in (1,2)],
  'tomlo': [(V+'Membranophones/Struck Membranophones/Tom 2/Stick/TomL_HitS_v2_rr%s_Mid.wav'%r,0.9,0.7) for r in (1,2)],
  'tamb':  [(V+'Idiophones/Struck Idiophones/Tambourine 1/Tamb1_Hit_v2_rr1_Mid.wav',0.5)],
  'shaker':[(V+'Idiophones/Struck Idiophones/Shaker, Small/Mid_Shaker_Slap_rr%s.wav'%r,0.3) for r in (1,2)],
 }}
index = {}
for kit, voices in KITS.items():
    index[kit] = {}
    for voice, items in voices.items():
        xs = [cut(load(it[0]), it[1], it[2] if len(it) > 2 else None) for it in items]
        top = max(np.max(np.abs(x)) for x in xs)  # one gain for the whole voice, so softer layers stay softer
        files = []
        for i, x in enumerate(xs):
            name = f'{kit}/{voice}-{i+1}.wav'; n = save(name, x, top)
            files.append({'file': name, 'level': round(float(np.max(np.abs(x))/top), 3), 'seconds': round(n/R, 3)})
        index[kit][voice] = files
# the [file, level] pairs lib/rap-kit.js (KITS) carries for each voice, and each take's length
for kit, voices in index.items():
    for voice, fs in voices.items(): print(kit, voice, [[f['file'].split('/')[-1][:-4], f['level']] for f in fs], [f['seconds'] for f in fs])

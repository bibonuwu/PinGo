"""Оригинальный саундтрек трейлера Pingo, синтез на numpy. 96 BPM, ре мажор, 75 с, сведён под монтаж."""
import sys, wave
import numpy as np

SR = 48000
DUR = 75.0
N = int(SR * DUR)
BEAT = 60 / 96
BAR = BEAT * 4
rng = np.random.default_rng(42)

def mf(m):
    return 440.0 * 2 ** ((m - 69) / 12)

def idx(t):
    return int(round(t * SR))

def bus():
    return np.zeros((2, N))

def add(b, sig, t0, gain=1.0, pan=0.0):
    """sig: моно (n,) или стерео (2,n). pan -1..1."""
    i0 = idx(t0)
    if sig.ndim == 1:
        gl, gr = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
        sig = np.vstack([sig * gl, sig * gr]) * np.sqrt(2)
    n = sig.shape[1]
    s0, s1 = max(i0, 0), min(i0 + n, N)
    if s1 <= s0:
        return
    b[:, s0:s1] += gain * sig[:, s0 - i0:s1 - i0]

def fft_filter(x, lo=None, hi=None, order=2):
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    h = np.ones_like(f)
    if hi:
        h *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        with np.errstate(divide="ignore"):
            h *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    return np.fft.irfft(X * h, n)

# ---------- гармония ----------
CH = {"D": [50, 57, 61, 64, 66], "Bm": [47, 54, 57, 61, 62], "G": [43, 50, 59, 62, 66], "A": [45, 52, 57, 61, 64]}
ROOT = {"D": 38, "Bm": 35, "G": 31, "A": 33}
ARP = {"D": [62, 66, 69, 73, 74, 73, 69, 66], "Bm": [59, 62, 66, 69, 71, 69, 66, 62],
       "G": [59, 62, 66, 67, 71, 67, 66, 62], "A": [57, 61, 64, 69, 71, 69, 64, 61]}
SEQ = ["D", "D", "Bm", "A", "D", "Bm", "G", "A", "D", "Bm", "G", "A", "D", "Bm", "G", "A",
       "D", "Bm", "G", "A", "D", "Bm", "G", "A", "D", "A", "D", "Bm", "G", "D"]
assert len(SEQ) == 30

# ---------- инструменты ----------
TBL = 4096
_x = np.arange(TBL) / TBL
def table(roll, nh=24):
    w = sum(np.sin(2 * np.pi * k * _x) / k ** roll for k in range(1, nh + 1))
    return w / np.abs(w).max()
DARK, BRIGHT = table(2.7), table(1.55)

def pad_note(f, dur, attack, release, bright):
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros((2, n))
    for cents, pan in ((-7, -0.6), (0, 0.0), (7, 0.6)):
        ff = f * 2 ** (cents / 1200)
        ph = (ff * t + rng.random()) % 1.0
        i = (ph * TBL).astype(np.int32)
        b = bright if np.ndim(bright) == 0 else bright[:n]
        v = (1 - b) * DARK[i] + b * BRIGHT[i]
        out[0] += v * np.sqrt((1 - pan) / 2); out[1] += v * np.sqrt((1 + pan) / 2)
    env = np.minimum(1, t / attack) ** 2
    rel = np.clip((dur - t) / release, 0, 1)
    env *= np.sin(rel * np.pi / 2) ** 2
    return out * env / 3

def pluck(f, dur=1.6, bright=1.0, decay=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.zeros(n)
    for k in range(1, 10):
        fk = k * f * np.sqrt(1 + 0.00035 * k * k)
        if fk > 13000: break
        a = (1 / k ** 1.25) * (bright if k > 2 else 1)
        s += a * np.sin(2 * np.pi * fk * t + k) * np.exp(-(2.0 + 1.7 * k) * t / decay)
    s *= 1 - np.exp(-t * 900)
    s[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
    return s / 2.2

def kick_sample():
    n = int(0.6 * SR); t = np.arange(n) / SR
    f = 46 + 95 * np.exp(-t * 26)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.0)
    click = fft_filter(rng.standard_normal(n), hi=4000) * np.exp(-t * 350) * 0.35
    return np.tanh(1.3 * (s + click))
KICK = kick_sample()

def clap_sample():
    n = int(0.45 * SR); t = np.arange(n) / SR
    nz = fft_filter(rng.standard_normal(n), lo=900, hi=6000)
    env = sum(np.exp(-np.clip(t - d, 0, None) * 380) * (t >= d) for d in (0, 0.011, 0.023))
    env = env * 0.7 + np.exp(-t * 15) * 0.55 * (t >= 0.023)
    return nz * env / np.abs(nz * env).max()
CLAP = clap_sample()

def hat_sample(length=0.07, dec=95):
    n = int(length * SR); t = np.arange(n) / SR
    nz = fft_filter(rng.standard_normal(n), lo=7000)
    s = nz * np.exp(-t * dec)
    return s / np.abs(s).max()
HAT = hat_sample()

def boom(dur=3.2):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 34 + 52 * np.exp(-t * 2.5)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6) * (1 - np.exp(-t * 300))
    nz = fft_filter(rng.standard_normal(n), hi=2500) * np.exp(-t * 7) * 0.5
    return np.tanh(1.5 * (s + nz))

def shimmer(dur=4.0, notes=(86, 93, 90, 98)):
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros((2, n))
    for j, m in enumerate(notes):
        f = mf(m) * (1 + 0.002 * np.sin(2 * np.pi * (4.5 + j) * t))
        v = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (0.9 + 0.2 * j)) * (1 - np.exp(-t * 40))
        p = (-0.6, 0.6, -0.3, 0.3)[j]
        out[0] += v * np.sqrt((1 - p) / 2); out[1] += v * np.sqrt((1 + p) / 2)
    return out * 0.25

def riser(L):
    n = int(L * SR); t = np.arange(n) / SR; x = t / L
    out = np.zeros((2, n))
    for c in range(2):
        nz = fft_filter(rng.standard_normal(n), lo=600, hi=9000)
        out[c] = nz / np.abs(nz).max() * x ** 2.6 * 0.8
    f = 140 * 12 ** x
    sw = np.sin(2 * np.pi * np.cumsum(f) / SR) * x ** 3 * 0.35
    out += sw
    out[:, -int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
    return out

def whoosh(L1=0.45, L2=0.55):
    n1, n2 = int(L1 * SR), int(L2 * SR); n = n1 + n2
    t = np.arange(n) / SR
    env = np.concatenate([(np.arange(n1) / n1) ** 2.2, np.exp(-np.arange(n2) / SR * 7)])
    nz = fft_filter(rng.standard_normal(n), lo=300, hi=4500)
    s = nz / np.abs(nz).max() * env
    pan = np.linspace(-0.8, 0.8, n)
    return np.vstack([s * np.sqrt((1 - pan) / 2), s * np.sqrt((1 + pan) / 2)]) * 1.4

# ---------- партитура ----------
pad, arp, mel, bass, drums, fx, bells = (bus() for _ in range(7))

# Пэды: объединяем одинаковые соседние аккорды
segs = []
for i, c in enumerate(SEQ):
    if segs and segs[-1][2] == c and i < 2: segs[-1][1] += BAR
    else: segs.append([i * BAR, BAR, c])
def pad_level(t):
    return np.interp(t, [0, 4, 5, 10, 10.01, 52.5, 53, 60, 60.01, 65, 65.01, 72.5, 75],
                        [1.5, 2.2, 1.9, 1.8, 0.7, 0.7, 1.0, 1.0, 0.65, 0.65, 0.85, 1.0, 1.0])
def bright_at(t):
    return np.interp(t, [0, 10, 10.01, 40, 52.5, 60, 65, 72.5, 75], [0.15, 0.35, 0.55, 0.7, 0.4, 0.75, 0.9, 0.7, 0.4])
for t0, L, c in segs:
    rel = 1.3
    att = 1.6 if t0 < 5 else 0.35
    dur = L + rel
    if t0 >= 72.5: dur = DUR - t0
    tt = t0 + np.arange(int(dur * SR)) / SR
    for m in CH[c]:
        add(pad, pad_note(mf(m), dur, att, rel if t0 < 72.5 else 2.2, bright_at(tt)) * pad_level(t0 + 0.1), t0, 1 / 5)
    # верхний слой — октава выше, мягко
    for m in CH[c][2:]:
        add(pad, pad_note(mf(m + 12), dur, att * 1.5, rel, bright_at(tt) * 0.5) * pad_level(t0 + 0.1), t0, 0.06)

# Арпеджио
ACC = [1, .55, .8, .55, .9, .55, .8, .6]
for bi, c in enumerate(SEQ):
    t0 = bi * BAR
    if t0 < 5 or (52.5 <= t0 < 60) or t0 >= 72.5: continue
    step = BEAT if t0 < 10 else BEAT / 2
    k = 0
    while k * step < BAR - 1e-6:
        tn = t0 + k * step
        m = ARP[c][(k * (2 if t0 < 10 else 1)) % 8]
        g = (0.55 if t0 < 10 else 0.75) * ACC[k % 8 if t0 >= 10 else (2 * k) % 8]
        add(arp, pluck(mf(m), 1.4, 0.85), tn, g, pan=(-0.3 if k % 2 else 0.3))
        k += 1
# пинг-понг задержка на арпеджио (пунктирная восьмая)
D = idx(BEAT * 0.75)
dl = np.zeros_like(arp)
src = arp.copy()
for r in range(1, 4):
    g = 0.38 ** r
    ch = r % 2
    dl[ch, D * r:] += g * (src[0, :-D * r] + src[1, :-D * r]) * 0.5
dl[0] = fft_filter(dl[0], lo=300, hi=5000); dl[1] = fft_filter(dl[1], lo=300, hi=5000)
arp += dl

# Мелодия (брейкдаун и финал)
MEL = [(52.5, 78, 1.25), (53.75, 76, .625), (54.375, 74, .625), (55.0, 74, 1.875), (56.875, 71, .625),
       (57.5, 73, 1.25), (58.75, 76, 1.25),
       (65.0, 78, 1.25), (66.25, 81, 1.25), (67.5, 78, .625), (68.125, 76, .625), (68.75, 74, 1.25),
       (70.0, 74, 1.25), (71.25, 71, .625), (71.875, 73, .625)]
for t0, m, d in MEL:
    s = pluck(mf(m), max(2.2, d + 1.2), 0.7, decay=2.4)
    add(mel, s, t0, 0.9, pan=0.1)
    add(mel, pluck(mf(m - 12), max(2.2, d + 1.2), 0.5, decay=2.4), t0, 0.35, pan=-0.15)
# аккорды фортепиано в брейкдауне
for bi in (21, 22, 23):
    for j, m in enumerate(CH[SEQ[bi]][1:]):
        add(mel, pluck(mf(m + 12), 2.6, 0.5, decay=2.8), bi * BAR + j * 0.02, 0.22)

# Колокольчики финала
for j, m in enumerate((86, 81, 90, 93)):
    add(bells, pluck(mf(m), 4.0, 0.4, decay=4.0), 72.8 + j * 0.09, 0.35, pan=(-0.4, 0.4, -0.2, 0.2)[j])

# Бас
def bass_note(f, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    env = np.minimum(1, t / 0.02) * np.clip((dur - t) / 0.12, 0, 1)
    return np.tanh(1.2 * s) * env
for bi, c in enumerate(SEQ):
    t0 = bi * BAR
    if 10 <= t0 < 52.5 or 65 <= t0 < 72.5:
        add(bass, bass_note(mf(ROOT[c] + 12), BAR), t0, 0.55)
    elif 52.5 <= t0 < 60:
        add(bass, bass_note(mf(ROOT[c] + 12), BAR), t0, 0.3)

# Ударные
kicks = [x for x in np.arange(15, 52.5 - 1e-6, BEAT)] + [x for x in np.arange(60, 72.5 - 1e-6, BEAT)]
for tk in kicks:
    add(drums, KICK, tk, 0.95 if tk < 60 or tk >= 65 else 1.05)
for t0 in np.arange(22.5, 52.5 - 1e-6, BEAT):
    add(drums, HAT, t0 + BEAT / 2, 0.16, pan=0.25)
for t0 in np.arange(40, 52.5 - 1e-6, BEAT):
    add(drums, HAT, t0 + BEAT / 4, 0.06, pan=-0.3); add(drums, HAT, t0 + 3 * BEAT / 4, 0.07, pan=-0.3)
for t0 in np.arange(65, 72.5 - 1e-6, BEAT):
    add(drums, HAT, t0 + BEAT / 2, 0.18, pan=0.25)
    add(drums, HAT, t0 + BEAT / 4, 0.06, pan=-0.3)
for b0 in list(np.arange(40, 52.5 - 1e-6, BAR)) + list(np.arange(65, 72.5 - 1e-6, BAR)):
    add(drums, CLAP, b0 + BEAT, 0.42); add(drums, CLAP, b0 + 3 * BEAT, 0.42)
# Монтаж: удары на склейках + дробь
for j, th in enumerate((60, 61.25, 62.5, 63.75)):
    add(drums, CLAP, th, 0.6)
    add(fx, boom(1.6), th, 0.35)
    c = "D" if th < 62.5 else "A"
    for m in CH[c][1:]:
        add(arp, pluck(mf(m + 12), 1.2, 1.0), th, 0.22)
roll = [64.0, 64.156, 64.3125, 64.469, 64.5625, 64.625, 64.703, 64.781, 64.844, 64.906, 64.953]
for j, tr in enumerate(roll):
    add(drums, CLAP, tr, 0.18 + 0.5 * j / len(roll))

# Эффекты: райзеры, удары, свуши
add(fx, riser(2.5), 7.5, 0.45)
add(fx, riser(2.5), 57.5, 0.45)
add(fx, riser(1.25), 63.75, 0.35)
for ti, g in ((10.0, 1.0), (65.0, 1.15)):
    add(fx, boom(), ti, g)
    add(bells, shimmer(), ti, 1.0)
add(fx, boom(2.0), 60.0, 0.5)
for tc, g in ((14.75, .35), (22.45, .22), (25.0, .16), (30.0, .16), (35.0, .22), (40.0, .2), (47.55, .18), (52.6, .25), (72.85, .25)):
    add(fx, whoosh(), tc - 0.45, g)

# ---------- сайдчейн ----------
sc = np.ones(N)
tt = np.arange(int(0.45 * SR)) / SR
shape = 1 - 0.5 * np.exp(-tt * 9) * np.minimum(1, tt / 0.004 + 0.6)
for tk in kicks:
    i0 = idx(tk); i1 = min(N, i0 + len(shape))
    sc[i0:i1] = np.minimum(sc[i0:i1], shape[:i1 - i0])
pad *= sc; bass *= sc; arp *= (0.5 + 0.5 * sc)

# ---------- реверберация ----------
def make_ir(rt=2.6, L=3.2):
    n = int(L * SR); t = np.arange(n) / SR
    ir = np.zeros((2, n))
    pre = int(0.025 * SR)
    for c in range(2):
        nz = rng.standard_normal(n) * np.exp(-t * 6.9 / rt)
        nz = fft_filter(nz, lo=150, hi=6500)
        ir[c, pre:] = nz[:n - pre]
        ir[c] /= np.sqrt((ir[c] ** 2).sum())
    return ir
IR = make_ir()
send = pad * 0.45 + arp * 0.55 + mel * 0.7 + bells * 0.9 + drums * 0.08 + fx * 0.35
M = 1 << int(np.ceil(np.log2(N + IR.shape[1])))
wet = np.zeros((2, N))
for c in range(2):
    wet[c] = np.fft.irfft(np.fft.rfft(send[c], M) * np.fft.rfft(IR[c], M), M)[:N]

mix = pad * 0.55 + arp * 0.42 + mel * 0.5 + bells * 0.55 + bass * 0.42 + drums * 0.55 + fx * 0.6 + wet * 0.45

# ---------- мастер ----------
mix -= mix.mean(axis=1, keepdims=True)
peak = np.abs(mix).max()
mix = mix / peak
mix = np.tanh(1.8 * mix) / np.tanh(1.8)
fade_in = np.minimum(1, np.arange(N) / (0.05 * SR))
tN = np.arange(N) / SR
fade_out = np.clip((DUR - tN) / 1.8, 0, 1) ** 1.5
mix *= fade_in * fade_out * 0.93

for a, b in ((0, 5), (5, 10), (10, 15), (15, 22.5), (22.5, 40), (40, 52.5), (52.5, 60), (60, 65), (65, 72.5), (72.5, 75)):
    seg = mix[:, idx(a):idx(b)]
    print(f"{a:5.1f}-{b:5.1f}s  rms {20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9):6.1f} dBFS  peak {20 * np.log10(np.abs(seg).max() + 1e-9):5.1f}")

out = sys.argv[1]
pcm = (np.clip(mix.T, -1, 1) * 32767).astype("<i2")
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", out)

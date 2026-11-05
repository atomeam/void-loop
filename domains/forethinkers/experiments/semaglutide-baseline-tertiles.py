"""Exploratory: does a high baseline epigenetic age acceleration pick the people whose clocks slowed most on semaglutide?

Input: Source Data of Corley et al., Nature Communications 2026 (s41467-026-72861-3),
file 41467_2026_72861_MOESM4_ESM.xls (pass path as argv[1]).

Arms: Randomization 2 = semaglutide (n=45), 1 = placebo (n=39), inferred from arm sizes
in the paper and the arm means.

Baseline sheet (SupplementaryFigure1) has no IDs, so rows are linked to IDs by chronological
age: Fig.3 Age is the week-32 age, so a baseline row matches when Fig.3 Age minus baseline Age
is 0.55-0.67 years (32 weeks = 0.61 y) and the match is unique.

2026-11-05 Q6 tighten (same file + Fig.3 covariates HsCRP, sCD163, BMI, sex):
- placebo-only regression-to-the-mean check
- inflammation/BMI/sex-adjusted interaction
- 2000-draw bootstrap 95% CI
- leave-one-out interaction range
- hashed half-split
Writes semaglutide-baseline-tertiles.csv and semaglutide-baseline-tertiles-q6.csv.
"""
import sys
import numpy as np
import pandas as pd

src = sys.argv[1] if len(sys.argv) > 1 else '41467_2026_72861_MOESM4_ESM.xls'
f3 = pd.read_excel(src, sheet_name='Fig.3')
s1 = pd.read_excel(src, sheet_name='SupplementaryFigure1')
s2 = pd.read_excel(src, sheet_name='SupplementaryFigure2')
used, link = set(), {}
for i, a in enumerate(f3.Age):
    c = [j for j, b in enumerate(s1.Age) if 0.55 <= a - b <= 0.67 and j not in used]
    if len(c) == 1:
        used.add(c[0])
        link[i] = c[0]
print(f'linked {len(link)} of {len(f3)} participants by age')
rows = []
for i, j in link.items():
    r = {
        'id': f3['Sample.Number'][i],
        'sema': int(s2.Randomization[i] == 2),
        'age0': float(s1.Age[j]),
        'hscrp': float(f3.HsCRP[i]),
        'cd163': float(f3.cd163[i]),
        'bmi': float(f3.BMI[i]),
        'female': int(f3.Female[i]),
    }
    for k in ['PCGrimAge', 'PCPhenoAge', 'OMICmAge', 'SystemsAge']:
        if k in s1.columns and k in s2.columns:
            r[k + '_0'] = float(s1[k][j])
            r[k + '_d'] = float(s2[k][i])
    rows.append(r)
d = pd.DataFrame(rows)
print('arms in linked set:', d.sema.value_counts().to_dict())

rng = np.random.default_rng(20261105)


def ols(X, y):
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    res = y - X @ beta
    df = max(len(y) - X.shape[1], 1)
    s2e = float(res @ res / df)
    try:
        se = np.sqrt(np.diag(s2e * np.linalg.inv(X.T @ X)))
    except np.linalg.LinAlgError:
        se = np.full(X.shape[1], np.nan)
    return beta, se


def interaction(df, clock, covars=None):
    acc = df[clock + '_acc'].values
    sema = df.sema.values
    y = df[clock + '_d'].values
    cols = [np.ones(len(df)), sema, acc, sema * acc]
    names = ['intercept', 'sema', 'acc', 'sema_x_acc']
    if covars:
        for c in covars:
            cols.append(df[c].values)
            names.append(c)
    X = np.column_stack(cols)
    beta, se = ols(X, y)
    return dict(zip(names, beta)), dict(zip(names, se))


out, summary = [], []
for k in ['PCGrimAge', 'PCPhenoAge', 'OMICmAge', 'SystemsAge']:
    if k + '_0' not in d.columns:
        continue
    b = np.polyfit(d.age0, d[k + '_0'], 1)
    d[k + '_acc'] = d[k + '_0'] - np.polyval(b, d.age0)
    d['t'] = pd.qcut(d[k + '_acc'], 3, labels=['low', 'mid', 'high'])
    for t in ['low', 'mid', 'high']:
        g = d[d.t == t]
        m1 = g[g.sema == 1][k + '_d'].mean()
        m0 = g[g.sema == 0][k + '_d'].mean()
        out.append(dict(
            clock=k, tertile=t,
            n_sema=int((g.sema == 1).sum()), n_placebo=int((g.sema == 0).sum()),
            sema_change=round(m1, 2), placebo_change=round(m0, 2),
            difference=round(m1 - m0, 2),
        ))
    beta, se = interaction(d, k)
    tstat = beta['sema_x_acc'] / se['sema_x_acc']
    print(f'{k}: interaction (extra slowing per year of baseline acceleration on semaglutide) = '
          f'{beta["sema_x_acc"]:.3f} y/y per y, SE {se["sema_x_acc"]:.3f}, t = {tstat:.2f}')

    p = d[d.sema == 0]
    bp, sep = ols(np.column_stack([np.ones(len(p)), p[k + '_acc'].values]), p[k + '_d'].values)
    print(f'  placebo-only acc slope = {bp[1]:.3f} (SE {sep[1]:.3f}, t = {bp[1]/sep[1]:.2f})')

    dd = d.copy()
    for c in ['hscrp', 'cd163', 'bmi']:
        dd[c] = (dd[c] - dd[c].mean()) / dd[c].std(ddof=0)
    ba, sa = interaction(dd, k, covars=['hscrp', 'cd163', 'bmi', 'female'])
    print(f'  adj HsCRP+sCD163+BMI+sex interaction = {ba["sema_x_acc"]:.3f} '
          f'(SE {sa["sema_x_acc"]:.3f}, t = {ba["sema_x_acc"]/sa["sema_x_acc"]:.2f})')

    boots = []
    n = len(d)
    for _ in range(2000):
        idx = rng.integers(0, n, n)
        try:
            bb, _ = interaction(d.iloc[idx], k)
            boots.append(bb['sema_x_acc'])
        except Exception:
            pass
    boots = np.array(boots)
    lo, hi = np.quantile(boots, [0.025, 0.975])
    print(f'  bootstrap 95% CI: [{lo:.3f}, {hi:.3f}]')

    loos = []
    for i in range(n):
        bi, _ = interaction(d.drop(d.index[i]), k)
        loos.append(bi['sema_x_acc'])
    loos = np.array(loos)
    same = bool(np.all(np.sign(loos) == np.sign(beta['sema_x_acc'])))
    print(f'  LOO range [{loos.min():.3f}, {loos.max():.3f}]; all same sign as full? {same}')

    d['_half'] = (pd.util.hash_array(d['id'].astype(str).values) % 2).astype(int)
    for h in [0, 1]:
        dh = d[d['_half'] == h]
        if len(dh) < 20:
            continue
        bh, sh = interaction(dh, k)
        print(f'  split half={h} n={len(dh)} interaction={bh["sema_x_acc"]:.3f} '
              f'(t={bh["sema_x_acc"]/sh["sema_x_acc"]:.2f})')

    summary.append(dict(
        clock=k, n_linked=len(d),
        interaction=round(beta['sema_x_acc'], 4), se=round(se['sema_x_acc'], 4), t=round(tstat, 2),
        boot_lo=round(float(lo), 4), boot_hi=round(float(hi), 4),
        placebo_acc_slope=round(float(bp[1]), 4), placebo_acc_t=round(float(bp[1] / sep[1]), 2),
        adj_interaction=round(ba['sema_x_acc'], 4),
        adj_t=round(ba['sema_x_acc'] / sa['sema_x_acc'], 2),
        loo_min=round(float(loos.min()), 4), loo_max=round(float(loos.max()), 4),
        loo_all_same_sign=same,
    ))

t = pd.DataFrame(out)
print(t.to_string(index=False))
t.to_csv('semaglutide-baseline-tertiles.csv', index=False)
pd.DataFrame(summary).to_csv('semaglutide-baseline-tertiles-q6.csv', index=False)
print('wrote semaglutide-baseline-tertiles.csv and semaglutide-baseline-tertiles-q6.csv')

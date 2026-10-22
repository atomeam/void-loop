"""Exploratory: does a high baseline epigenetic age acceleration pick the people whose clocks slowed most on semaglutide?
Input: Source Data of Corley et al., Nature Communications 2026 (s41467-026-72861-3), file 41467_2026_72861_MOESM4_ESM.xls.
Arms: Randomization 2 = semaglutide (n=45), 1 = placebo (n=39), inferred from arm sizes in the paper and the arm means.
Baseline sheet (SupplementaryFigure1) has no IDs, so rows are linked to IDs by chronological age: Fig.3 Age is the week-32 age,
so a baseline row matches when Fig.3 Age minus baseline Age is 0.55-0.67 years (32 weeks = 0.61 y) and the match is unique."""
import sys, numpy as np, pandas as pd
src = sys.argv[1] if len(sys.argv) > 1 else '41467_2026_72861_MOESM4_ESM.xls'
f3 = pd.read_excel(src, sheet_name='Fig.3'); s1 = pd.read_excel(src, sheet_name='SupplementaryFigure1')
s2 = pd.read_excel(src, sheet_name='SupplementaryFigure2')
used, link = set(), {}
for i, a in enumerate(f3.Age):
    c = [j for j, b in enumerate(s1.Age) if 0.55 <= a - b <= 0.67 and j not in used]
    if len(c) == 1: used.add(c[0]); link[i] = c[0]
print(f'linked {len(link)} of {len(f3)} participants by age')
rows = []
for i, j in link.items():
    r = {'id': f3['Sample.Number'][i], 'sema': int(s2.Randomization[i] == 2), 'age0': s1.Age[j]}
    for k in ['PCGrimAge', 'PCPhenoAge', 'OMICmAge']:
        r[k + '_0'] = s1[k][j]; r[k + '_d'] = s2[k][i]
    rows.append(r)
d = pd.DataFrame(rows)
print('arms in linked set:', d.sema.value_counts().to_dict())
out = []
for k in ['PCGrimAge', 'PCPhenoAge', 'OMICmAge']:
    # baseline acceleration = residual of baseline clock on age (whole linked cohort, arm-blind)
    b = np.polyfit(d.age0, d[k + '_0'], 1); d[k + '_acc'] = d[k + '_0'] - np.polyval(b, d.age0)
    d['t'] = pd.qcut(d[k + '_acc'], 3, labels=['low', 'mid', 'high'])
    for t in ['low', 'mid', 'high']:
        g = d[d.t == t]
        m1 = g[g.sema == 1][k + '_d'].mean(); m0 = g[g.sema == 0][k + '_d'].mean()
        out.append(dict(clock=k, tertile=t, n_sema=int((g.sema == 1).sum()), n_placebo=int((g.sema == 0).sum()),
                        sema_change=round(m1, 2), placebo_change=round(m0, 2), difference=round(m1 - m0, 2)))
    # interaction: change ~ sema + acc + sema*acc (OLS)
    X = np.column_stack([np.ones(len(d)), d.sema, d[k + '_acc'], d.sema * d[k + '_acc']]); y = d[k + '_d'].values
    beta, *_ = np.linalg.lstsq(X, y, rcond=None); res = y - X @ beta
    s2e = res @ res / (len(y) - 4); se = np.sqrt(np.diag(s2e * np.linalg.inv(X.T @ X)))
    print(f'{k}: interaction (extra slowing per year of baseline acceleration on semaglutide) = {beta[3]:.3f} y/y per y, SE {se[3]:.3f}, t = {beta[3]/se[3]:.2f}')
t = pd.DataFrame(out); print(t.to_string(index=False)); t.to_csv('semaglutide-baseline-tertiles.csv', index=False)

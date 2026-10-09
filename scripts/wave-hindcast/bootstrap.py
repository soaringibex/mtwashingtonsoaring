# Day-block bootstrap of the correlation difference between two hindcast runs.
#   python boot.py A.csv B.csv [train|test|all]
import sys, numpy as np, pandas as pd
a = pd.read_csv(sys.argv[1]); b = pd.read_csv(sys.argv[2]); part = sys.argv[3] if len(sys.argv) > 3 else 'all'
key = ['fid', 't']
m = a[key + ['day', 'z', 'inGrid', 'wobs', 'wmod']].merge(b[key + ['wmod']], on=key, suffixes=('_a', '_b'))
m = m[(m.inGrid == 1) & (m.z > 2000)]
if part == 'train': m = m[m.day < '2021']
if part == 'test': m = m[m.day >= '2021']
days = m.day.unique(); groups = {d: g for d, g in m.groupby('day')}
rng = np.random.default_rng(1)
def r(x, y): return np.corrcoef(x, y)[0, 1]
base = r(m.wobs, m.wmod_b) - r(m.wobs, m.wmod_a)
diffs = []
for _ in range(2000):
    s = pd.concat([groups[d] for d in rng.choice(days, len(days))])
    diffs.append(r(s.wobs, s.wmod_b) - r(s.wobs, s.wmod_a))
lo, hi = np.percentile(diffs, [2.5, 97.5])
print(f"{part}: r(B)-r(A) = {base:+.3f}  95% CI [{lo:+.3f}, {hi:+.3f}]  P(B>A)={np.mean(np.array(diffs) > 0):.2f}  days={len(days)} n={len(m)}")

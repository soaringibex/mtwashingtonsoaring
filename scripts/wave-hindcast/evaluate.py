import sys, pandas as pd, numpy as np
for part in ('train', 'test'):
    for p in sys.argv[1:]:
        d = pd.read_csv(p); d = d[(d.inGrid == 1) & (d.z > 2000)]
        d = d[d.day < '2021'] if part == 'train' else d[d.day >= '2021']
        top = d[d.wmod >= d.wmod.quantile(.9)]
        r = np.corrcoef(d.wobs, d.wmod)[0, 1]
        print(f"{part:5s} {p:18s} days={d.day.nunique():2d} n={len(d):6d} r={r:+.3f}  top10%: model {top.wmod.mean():.2f} obs {top.wobs.mean():.2f} ratio {top.wobs.mean()/top.wmod.mean():.2f}")

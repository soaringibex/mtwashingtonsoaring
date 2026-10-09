# Track -> samples (run from the repo root after unpacking, see README.md).
# WeGlide flightdata: time/alt (pressure altitude, ~10 s, irregular) and the logger's fix
# positions. Positions carry no times; they are placed evenly over the flight, which holds
# for fixed-interval loggers only — XCSoar/LK8000/SeeYou Navigator log 1 s circling and 5 s
# cruising (off by up to 25 min), so their flights are left out of keep_fids.json.
import json, glob, math, csv, datetime as dt, bisect, os
W = os.environ.get('WAVE_HINDCAST_DIR', '.wave-hindcast')
VARIABLE_INTERVAL = {'XCSOAR', 'XLK', 'Naviter', None}
def interp(xs, ys, x):
    i = bisect.bisect_left(xs, x)
    if i <= 0: return ys[0]
    if i >= len(xs): return ys[-1]
    f = (x - xs[i-1]) / (xs[i] - xs[i-1]) if xs[i] != xs[i-1] else 0
    return ys[i-1] + f * (ys[i] - ys[i-1])
rows = []
keep = []
for p in sorted(glob.glob(f'{W}/tracks/*.json')):
    J = json.load(open(p)); D = J['detail']; F = J['data']; fid = D['id']
    if D.get('logger_manufacturer') not in VARIABLE_INTERVAL: keep.append(fid)
    t, a, c = F['time'], F['alt'], F['geom']
    if len(t) < 20 or len(c) < 20: continue
    N = len(c); T0, T1 = t[0], t[-1]
    gt = [T0 + i * (T1 - T0) / (N - 1) for i in range(N)]
    lon = [q[0] for q in c]; lat = [q[1] for q in c]
    ac = D['aircraft']; A, B, C = ac['encoded_coeffs']; vmin = ac['min_speed_m_s']
    v = 1.15 * vmin; sink = -(A * v * v + B * v + C)
    if not (0.3 < sink < 1.5): sink = 0.75
    ok_start = ok_end = None
    est = D.get('engine_scoring_times') or D.get('scoring_times')
    if ac['kind'] != 'GL' and est:
        ok_start = dt.datetime.fromisoformat(est[0]).timestamp(); ok_end = dt.datetime.fromisoformat(est[1]).timestamp()
    tko = dt.datetime.fromisoformat(D['takeoff_time']).timestamp(); lnd = dt.datetime.fromisoformat(D['landing_time']).timestamp()
    def pos(x): return interp(gt, lat, x), interp(gt, lon, x)
    def hdg(x0, x1):
        la0, lo0 = pos(x0); la1, lo1 = pos(x1)
        return math.degrees(math.atan2((lo1 - lo0) * math.cos(math.radians(la0)), la1 - la0))
    for k in range(len(t)):
        x = t[k]
        if x < tko + 120 or x > lnd - 60: continue
        z1 = interp(t, a, x + 15); z0 = interp(t, a, x - 15); vario = (z1 - z0) / 30
        turn = 0; prev = None
        for s in range(-30, 31, 6):
            h = hdg(x + s - 3, x + s + 3)
            if prev is not None: turn += abs((h - prev + 540) % 360 - 180)
            prev = h
        la, lo = pos(x)
        la0, lo0 = pos(x - 15); la1, lo1 = pos(x + 15)
        gs = math.hypot((lo1 - lo0) * 111320 * math.cos(math.radians(la)), (la1 - la0) * 110900) / 30
        engine_ok = 1 if ok_start is None or (ok_start <= x <= ok_end) else 0
        rows.append(dict(fid=fid, day=D['scoring_date'], t=int(x), lat=round(la, 5), lon=round(lo, 5), pa=a[k],
                         vario=round(vario, 2), turn=round(turn), gs=round(gs, 1), sink=round(sink, 2),
                         kind=ac['kind'], engine_ok=engine_ok))
json.dump(keep, open(f'{W}/keep_fids.json', 'w'))
with open(f'{W}/samples.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
hours = sorted({dt.datetime.fromtimestamp(r['t'] + 1800, dt.UTC).strftime('%Y-%m-%dT%H') for r in rows})
json.dump(hours, open(f'{W}/hours.json', 'w'))
print(len(rows), 'samples;', len(keep), 'fixed-interval flights')

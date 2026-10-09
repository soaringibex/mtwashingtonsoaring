#!/usr/bin/env python3
"""Classify each Gorham camp flight as a wave flight and write the `wave` flags into
src/lib/wave-camp-flights.ts. Reproducible from the committed track archive:

    mkdir -p .wave-hindcast && tar xzf data/wave-hindcast/weglide-tracks.tgz -C .wave-hindcast
    python3 scripts/flights/classify-wave.py            # report only
    python3 scripts/flights/classify-wave.py --write    # also rewrite the flags

A flight is wave when its own engine-free flying (WeGlide's engine_scoring_times —
the free-flight window after release, minus any mid-flight engine run) shows either

  A. a ten-minute climb of at least CLIMB_M, ending at least STRAIGHT_TOP_M high, that
     turns no more than MAX_TURN_DEG_S on average — climbing without circling, above
     the Presidential crest (ridge lift and low thermal streets stay below it), or
  B. a peak of at least HIGH_TOP_M, however it was flown and however slowly it
     climbed. October thermals here do not get near ~9,200 ft and a tow releases far
     below it; pilots do circle in wave, and steady wave climbs can be slow.

Test A needs fix positions with correct times. WeGlide's public track gives positions
without per-fix times, so they are spread evenly over the flight — exact for fixed-
interval loggers, wrong by minutes for loggers that switch between 1 s (circling) and
5 s (cruise): XCSoar, LK8000, SeeYou Navigator, and files with no logger make. Those
flights are judged on test B only (a wave flight that never reaches HIGH_TOP_M on
such a logger is missed). Headings are measured over at least HEADING_BASE_M of
track: a glider hovering into the wind moves a few metres per fix and fix-to-fix
headings there are GPS noise, not turning.

Altitudes are the trace's own (WeGlide `alt`, metres; the field reads ~243 m).
"""
import bisect, datetime as dt, glob, json, math, os, re, sys

CLIMB_M = 500            # gain in the window
WINDOW_S = 600           # ten minutes
STRAIGHT_TOP_M = 2300    # ~7,500 ft: ~400 m above Mt Washington's 1,917 m summit
HIGH_TOP_M = 2800        # ~9,200 ft, the flight's engine-free peak
MAX_TURN_DEG_S = 2.0     # accumulated heading change, averaged over the window
HEADING_BASE_M = 60
VARIABLE_INTERVAL_LOGGERS = {"XCSOAR", "XLK", "Naviter", None}

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TRACKS = os.path.join(os.environ.get("WAVE_HINDCAST_DIR", os.path.join(ROOT, ".wave-hindcast")), "tracks")
DATA_TS = os.path.join(ROOT, "src", "lib", "wave-camp-flights.ts")


def interp(xs, ys, x):
    i = bisect.bisect_left(xs, x)
    if i <= 0:
        return ys[0]
    if i >= len(xs):
        return ys[-1]
    f = (x - xs[i - 1]) / (xs[i] - xs[i - 1]) if xs[i] != xs[i - 1] else 0
    return ys[i - 1] + f * (ys[i] - ys[i - 1])


def ts(iso):
    return dt.datetime.fromisoformat(iso).timestamp()


def free_windows(detail):
    """[(start, end)] engine-free intervals; WeGlide lists them as a flat start/end list."""
    times = detail.get("engine_scoring_times") or detail.get("scoring_times") or []
    return [(ts(times[k]), ts(times[k + 1])) for k in range(0, len(times) - 1, 2)]


def classify(track):
    detail, data = track["detail"], track["data"]
    t, alt, geom = data["time"], data["alt"], data["geom"]
    if len(t) < 10 or len(geom) < 10:
        return {"wave": False, "why": "no trace"}
    timed = detail.get("logger_manufacturer") not in VARIABLE_INTERVAL_LOGGERS
    n = len(geom)
    gt = [t[0] + k * (t[-1] - t[0]) / (n - 1) for k in range(n)]
    xy = [(p[0] * 111320 * math.cos(math.radians(p[1])), p[1] * 110900) for p in geom]
    cum = [0.0] * n
    prev = None
    anchor = 0
    for k in range(1, n):
        cum[k] = cum[k - 1]
        dx, dy = xy[k][0] - xy[anchor][0], xy[k][1] - xy[anchor][1]
        if math.hypot(dx, dy) < HEADING_BASE_M:
            continue
        heading = math.degrees(math.atan2(dx, dy))
        if prev is not None:
            cum[k] += abs((heading - prev + 540) % 360 - 180)
        prev, anchor = heading, k
    windows = free_windows(detail)
    peak = max((v for x, v in zip(t, alt) if any(a <= x <= b for a, b in windows)), default=0)
    best = None
    if peak >= HIGH_TOP_M:
        best = {"test": "B", "peak": round(peak)}
    for a, b in windows:
        x = a
        while x + WINDOW_S <= b:
            gain = interp(t, alt, x + WINDOW_S) - interp(t, alt, x)
            top = interp(t, alt, x + WINDOW_S)
            if gain >= CLIMB_M and top >= STRAIGHT_TOP_M:
                turn = (interp(gt, cum, x + WINDOW_S) - interp(gt, cum, x)) / WINDOW_S
                if timed and turn <= MAX_TURN_DEG_S and (best is None or top > best.get("top", 0)):
                    best = {"test": "A", "top": round(top), "gain": round(gain), "turn": round(turn, 2),
                            "at": dt.datetime.fromtimestamp(x, dt.UTC).strftime("%H:%M"), "peak": round(peak)}
            x += 30
    return {"wave": best is not None, "why": best}


def main():
    files = sorted(glob.glob(os.path.join(TRACKS, "*.json")))
    if not files:
        sys.exit(f"no tracks in {TRACKS} — unpack data/wave-hindcast/weglide-tracks.tgz first")
    flags = {}
    for path in files:
        track = json.load(open(path))
        result = classify(track)
        flags[track["detail"]["id"]] = result
    src = open(DATA_TS).read()
    changed = []

    def repl(m):
        fid = int(m.group(1))
        if fid not in flags:
            return m.group(0)
        new = "true" if flags[fid]["wave"] else "false"
        if m.group(2) != new:
            changed.append((fid, m.group(2), new, flags[fid]["why"]))
        return m.group(0)[: m.start(2) - m.start(0)] + new + m.group(0)[m.end(2) - m.start(0):]

    out = re.sub(r"\{ id: (\d+),[^\n]*?wave: (true|false)", repl, src)
    print(f"{len(flags)} flights, {sum(f['wave'] for f in flags.values())} wave; {len(changed)} flags change")
    for fid, old, new, why in changed:
        print(f"  {fid}: {old} -> {new}  {why or ''}")
    if "--write" in sys.argv:
        open(DATA_TS, "w").write(out)
        print(f"wrote {DATA_TS}")


if __name__ == "__main__":
    main()

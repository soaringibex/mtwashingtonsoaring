# Wave hindcast against glider climbs

Reruns the Wavecast map's 3-D linear solve (`src/lib/wave-solve.ts`) for every hour of the
Gorham October camp flights logged on WeGlide (2016–2025) and compares the modelled
vertical velocity with the air vertical velocity the gliders measured (30-s pressure-
altitude climb rate + the aircraft's min-sink, straight flight only, engine off).
This is the evidence behind `DEFAULT_DAMPING_S` and `WAVE_GAIN` in `src/lib/linear-wave.ts`.

## Data (committed, so nothing has to be downloaded again)

- `data/wave-hindcast/weglide-tracks.tgz` — 229 flights from WeGlide's public API
  (takeoff Gorham, October 2016–2025): the track (`time`/`alt` pressure altitude, fix
  positions) and the flight facts the analysis needs (aircraft + polar, takeoff/landing,
  engine-free scoring window, logger make). Pilot names and user ids are stripped; the
  flight `id` matches `src/lib/wave-camp-flights.ts` and weglide.org/flight/<id>.
- `data/wave-hindcast/hrrr-soundings.tgz` — HRRR f00 pressure-level soundings (AWS
  archive) for all 286 flight hours, at Gorham and at 72 points 48 km from the Glider
  Area every 5° (the site's upwind sounding), winds rotated to true north.

## Run (from the repo root)

```bash
mkdir -p .wave-hindcast && tar xzf data/wave-hindcast/weglide-tracks.tgz -C .wave-hindcast \
  && tar xzf data/wave-hindcast/hrrr-soundings.tgz -C .wave-hindcast
python3 scripts/wave-hindcast/extract.py                      # samples.csv, keep_fids.json, hours.json
node scripts/wave-hindcast/hindcast.mts '{}' .wave-hindcast/runs/site.csv            # the site as built
node scripts/wave-hindcast/hindcast.mts '{"damping":2e-4}' .wave-hindcast/runs/a2.csv # a variant
uv run --with pandas --with numpy python scripts/wave-hindcast/evaluate.py .wave-hindcast/runs/site.csv .wave-hindcast/runs/a2.csv
uv run --with pandas --with numpy python scripts/wave-hindcast/bootstrap.py .wave-hindcast/runs/a2.csv .wave-hindcast/runs/site.csv test
```

`evaluate.py` splits 2016–2020 (training) from 2021–2025 (held out) and prints the
correlation of modelled vs measured w above 2,000 m and the strongest-lift decile
(model vs measured). Terrain tiles download to `.wave-hindcast/tiles` on first run.

## Caveats

- Only fixed-interval loggers are used (172 of 229 flights). XCSoar, LK8000 and SeeYou
  Navigator log 1 s circling / 5 s cruising, and the public track carries no per-fix time.
- Calibrate on the lift side: pilots leave sink quickly, so measured sink is biased.
- Southerly days (wind from 190–220°) show no skill in any variant.
- 2016-10-08 … 2025-10-18 results (as built, 2026-10-08): held-out correlation 0.32
  (was 0.27 before the calibration), strongest-lift decile 2.28 m/s modelled vs 2.11
  measured.

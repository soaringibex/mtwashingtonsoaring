# Regenerates .wave-hindcast/cols (already shipped in data/wave-hindcast/hrrr-soundings.tgz).
# Runs inside the wavecaster WRF image (herbie + cfgrib), work dir mounted at /s:
#   docker run --rm -v "$PWD/.wave-hindcast:/s" -v "$PWD/scripts/wave-hindcast:/x" mtw-wrf:4.6.1 python -u /x/hrrr-soundings.py
# For each hour: HRRR f00 pressure-level HGT/TMP/UGRD/VGRD -> soundings at Gorham and at
# 72 points 48 km from the Glider Area (every 5 deg). Winds rotated grid->earth.
import json, math, os, sys, time, warnings, glob
from concurrent.futures import ProcessPoolExecutor
warnings.filterwarnings('ignore')
import numpy as np, xarray as xr
from herbie import Herbie
GA=(44.290556,-71.227778); GORHAM=(44.3931,-71.1996)
def along(p,az,d):
    a=math.radians(az); return (p[0]+math.cos(a)*d/111, p[1]+math.sin(a)*d/(111*math.cos(math.radians(p[0]))))
PTS={'gorham':GORHAM, **{f'u{b}':along(GA,b,48) for b in range(0,360,5)}}
LEVELS=[1000,975,950,925,900,875,850,825,800,775,750,725,700,675,650,625,600,575,550,525,500,475,450,425,400,375,350,325,300,275,250,225,200,175,150,125,100]
idx=None
def one(h):
    out=f'/s/cols/{h}.json'
    if os.path.exists(out): return h,'cached'
    for tries in range(3):
        try:
            H=Herbie(h.replace('T',' ')+':00',model='hrrr',product='prs',fxx=0,save_dir=f'/tmp/hr{os.getpid()}',verbose=False)
            f=H.download(r':(HGT|TMP|UGRD|VGRD):\d+ mb:')
            ds=xr.open_dataset(f,engine='cfgrib',backend_kwargs={'indexpath':''},filter_by_keys={'typeOfLevel':'isobaricInhPa'})
            lat=ds.latitude.values; lon=ds.longitude.values; lon=np.where(lon>180,lon-360,lon)
            P=[float(x) for x in ds.isobaricInhPa.values]
            U=ds.u.values; V=ds.v.values; T=ds.t.values; G=ds.gh.values
            res={}
            for k,(pla,plo) in PTS.items():
                d=(lat-pla)**2+((lon-plo)*math.cos(math.radians(pla)))**2; j,i=np.unravel_index(np.argmin(d),d.shape)
                ang=math.radians(math.sin(math.radians(38.5))*(lon[j,i]-(-97.5)))
                lev=[]
                for li,p in enumerate(P):
                    if p not in LEVELS: continue
                    ug=float(U[li,j,i]); vg=float(V[li,j,i])
                    u=math.cos(ang)*ug+math.sin(ang)*vg; v=-math.sin(ang)*ug+math.cos(ang)*vg
                    spd=math.hypot(u,v); dr=(math.degrees(math.atan2(-u,-v))+360)%360
                    lev.append(dict(hPa=int(p),zM=round(float(G[li,j,i]),1),tempC=round(float(T[li,j,i])-273.15,2),speedMs=round(spd,2),dirDeg=round(dr,1)))
                res[k]=sorted(lev,key=lambda x:-x['hPa'])
            ds.close(); os.remove(f)
            json.dump(res,open(out,'w')); return h,'ok'
        except Exception as e:
            err=str(e)[:200]; time.sleep(5)
            import shutil; shutil.rmtree(f'/tmp/hr{os.getpid()}',ignore_errors=True)
    return h,'FAIL '+err
hours=json.load(open('/s/hours.json'))
if len(sys.argv)>1: hours=hours[:int(sys.argv[1])]
with ProcessPoolExecutor(6) as ex:
    for h,s in ex.map(one,hours): print(h,s,flush=True)

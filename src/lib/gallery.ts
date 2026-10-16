export type Photo = {
  src: string;
  alt: string;
  aspect: "landscape" | "portrait";
  /** The photographer, shown under the image in the lightbox. */
  credit?: string;
  /**
   * How the tile frames the photo. Defaults to "cover"; the wide strips
   * recovered from the old website's albums need "contain" so the whole
   * picture stays visible.
   */
  fit?: "cover" | "contain";
};

export type Album = {
  id: string;
  title: string;
  blurb: string;
  photos: Photo[];
};

export const albums: Album[] = [
  {
    id: "2026",
    title: "Wave Camp 2026",
    blurb: "The opening days at Gorham — virga, a rainbow, the field, and the snow-dusted range from the air.",
    photos: [
      {
        src: "/images/gallery/2026/the-covered-glider-under-a-lenticular.webp",
        alt: "A glider under wing covers on the Gorham turf, a dog beside it, and a lenticular wave cloud over the fall ridge",
        aspect: "landscape",
        credit: "Nelson Howe",
      },
      {
        src: "/images/gallery/2026/the-asg-29-above-the-fall-valleys.webp",
        alt: "Nelson Howe airborne in the ASG 29, the wing out over the fall valleys below",
        aspect: "portrait",
        credit: "Nelson Howe",
      },
      {
        src: "/images/gallery/2026/cockpit-over-the-summit.webp",
        alt: "The cockpit over Mount Washington — the panel, the phone mount and the Oudie reading 7,559 ft",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2026/clouds-spilling-over-the-ridge.webp",
        alt: "Clouds spilling over the Presidential ridge with the undercast beyond, from the air",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2026/the-summit-from-the-wing.webp",
        alt: "Mount Washington's summit and the Auto Road seen from the wing, a wall of cloud beyond",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2026/the-e-bike-tow.webp",
        alt: "The e-bike and its tow bar moving a glider across the field, pickup and trailer behind",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2026/pilots-on-the-grid.webp",
        alt: "Pilots gathered among trucks, gliders and a golf cart on the grid at Gorham",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2026/the-field-and-valley-from-the-air.webp",
        alt: "The Androscoggin valley towns and the Gorham field from the air, gliders lined on the grass",
        aspect: "landscape",
              credit: "Jared Granzow",
      },
      {
        src: "/images/gallery/2026/the-ridge-north-of-the-summit.webp",
        alt: "The ridge north of the summit with the Auto Road, from the air",
        aspect: "landscape",
              credit: "Jared Granzow",
      },
      {
        src: "/images/gallery/2026/the-cone-from-the-southwest.webp",
        alt: "The snowy summit cone and the Auto Road from the southwest",
        aspect: "landscape",
              credit: "Jared Granzow",
      },
      {
        src: "/images/gallery/2026/summit-cone-and-switchbacks.webp",
        alt: "The snow-covered summit cone and the Auto Road's switchbacks, from the air",
        aspect: "landscape",
              credit: "Jared Granzow",
      },
      {
        src: "/images/gallery/2026/the-range-in-the-distance.webp",
        alt: "The Presidential Range in the distance, blue with haze, seen from the south",
        aspect: "landscape",
              credit: "Jared Granzow",
      },
      {
        src: "/images/gallery/2026/the-range-from-the-southwest.webp",
        alt: "The Presidential Range from the southwest, the river threading the valley below",
        aspect: "landscape",
              credit: "Jared Granzow",
      },
      {
        src: "/images/gallery/2026/the-range-from-above.webp",
        alt: "The Presidential Range from high above, fresh snow along the crest and the valley beyond",
        aspect: "landscape",
              credit: "Jared Granzow",
      },
      {
        src: "/images/gallery/2026/mount-washington-from-the-west.webp",
        alt: "Mount Washington's snow-covered summit cone and the Auto Road, seen from the west",
        aspect: "landscape",
              credit: "Jared Granzow",
      },
      {
        src: "/images/gallery/2026/autumn-forest-below-the-ridge.webp",
        alt: "Fall color across the forest below the ridge, a road winding through the valley",
        aspect: "landscape",
              credit: "Jared Granzow",
      },
      {
        src: "/images/gallery/2026/the-field-at-gorham.webp",
        alt: "Gliders and tow vehicles on the grass at Gorham as the sun breaks through cumulus over the ridge",
        aspect: "landscape",
              credit: "David Baxter",
      },
      {
        src: "/images/gallery/2026/the-crest-in-snow.webp",
        alt: "Looking along the snow-dusted Presidential crest toward the summit towers, the Great Gulf falling away below",
        aspect: "portrait",
              credit: "David Baxter",
      },
      {
        src: "/images/gallery/2026/great-gulf-from-the-air.webp",
        alt: "The summit and the Great Gulf from the air, snow along the crest and autumn color to the horizon",
        aspect: "landscape",
              credit: "David Baxter",
      },
      {
        src: "/images/gallery/2026/summit-cone-from-above.webp",
        alt: "The Mount Washington summit cone from directly overhead, the Auto Road switchbacks traced in fresh snow",
        aspect: "landscape",
              credit: "Thomas Van de Velde",
      },
      {
        src: "/images/gallery/2026/summit-buildings-from-above.webp",
        alt: "The summit buildings, parking rows and cog railway yard under fresh snow, seen from overhead",
        aspect: "landscape",
              credit: "Thomas Van de Velde",
      },
      {
        src: "/images/gallery/2026/alpine-shoulder-and-ravine.webp",
        alt: "Snow on Mount Washington's alpine shoulder above a shadowed ravine, the Auto Road cut into the ridge",
        aspect: "landscape",
              credit: "Thomas Van de Velde",
      },
      {
        src: "/images/gallery/2026/presidential-range-from-the-air.webp",
        alt: "The Presidential Range from the air — new snow along the crest, autumn color in the valleys",
        aspect: "landscape",
              credit: "Thomas Van de Velde",
      },
      {
        src: "/images/gallery/2026/summit-cone-from-the-air.webp",
        alt: "The snow-dusted summit cone of Mount Washington and its towers, with the crags falling away below",
        aspect: "landscape",
              credit: "Thomas Van de Velde",
      },
      {
        src: "/images/gallery/2026/gliders-at-gorham-in-autumn.webp",
        alt: "Gliders parked on the grass at Gorham under the ridgeline in full fall color",
        aspect: "landscape",
              credit: "Thomas Van de Velde",
      },
      {
        src: "/images/gallery/2026/virga-rainbow-over-the-valley.webp",
        alt: "A rainbow beneath snow virga over the river valley, seen from the wing of a glider",
        aspect: "landscape",
              credit: "Tim Chow",
      },
      {
        src: "/images/gallery/2026/the-rigging-day.webp",
        alt: "A rigging morning at Gorham — the crew gathered at a wing, trailers and gliders spread across the grass",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2026/the-morning-grid.webp",
        alt: "The morning grid — the RC ship in the low sun, the field's gliders stretching away behind",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2026/the-ridge-in-new-snow.webp",
        alt: "New snow along the crest above the forest, seen from the cockpit",
        aspect: "portrait",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2026/the-winglet-over-the-range.webp",
        alt: "The winglet over the hazy valley, the snow-dusted range beyond",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2026/the-valley-floor-from-the-air.webp",
        alt: "The valley floor from high above — the land combed into fields and back roads, fall color everywhere",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2026/the-panel-in-the-wave.webp",
        alt: "The panel in the wave — the screen's moving map and climb arrow, the round instruments beside",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2026/the-river-flats-from-altitude.webp",
        alt: "The river looping across the valley floor from altitude, a snow-dusted ridge below in the foreground",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2026/the-sailplane-over-the-valley.webp",
        alt: "A white sailplane below, crossing the fall landscape, seen from above",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2026/the-other-glider-in-the-blue.webp",
        alt: "A distant sailplane against the deep blue of the upper sky",
        aspect: "portrait",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2026/the-range-through-the-canopy.webp",
        alt: "New snow on the Presidential crest, seen through the canopy at altitude",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2026/at-the-alpine-garden.webp",
        alt: "Three of the crew at the Alpine Garden trail sign — Lion Head Trail, Huntington Ravine, Nelson Crag — the range behind",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
        ],
  },
  {
    id: "2025",
    title: "Wave Camp 2025",
    blurb: "Undercast, cloud shadows and cockpit views from the wave — shared by David Sherrill and Thomas Van de Velde.",
    photos: [
      {
        src: "/images/gallery/2025/cloud-shadow-and-lennie.jpg",
        alt: "The glider's shadow cast on the cloud deck below, with a lenticular cloud on the horizon",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2025/undercast-wing.jpg",
        alt: "The glider's wing stretched over a white undercast, with cloud tops to the horizon",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2025/panel-at-16872.jpg",
        alt: "The instrument panel at 16,872 feet, with cloud streets below and the climb still working",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2025/wave-climb-over-clouds.jpg",
        alt: "Evening wave climb at 7,549 feet — 6.6 knots on the vario, the cloud deck below",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2025/sun-through-the-canopy.jpg",
        alt: "Sunlight bursting through the canopy as the glider climbs in the wave",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2025/wing-over-the-cloud-deck.jpg",
        alt: "Looking down the wing over the cloud deck and rotor below",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2025/undercast-to-the-horizon.jpg",
        alt: "A sea of undercast stretching to the horizon, seen from the wing",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2025/auto-road-from-the-air.jpg",
        alt: "The Mount Washington Auto Road switchbacking through the alpine zone, seen from the air",
        aspect: "landscape",
      },
    ],
  },
  {
    id: "2024",
    title: "Wave Camp 2024",
    blurb: "There was wave, but on the edges of the camp.",
    photos: [
      {
        src: "/images/gallery/2024/trailer-row.webp",
        alt: "A row of covered glider trailers on the grass at Gorham in the morning light",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2024/suzanne-flight.jpg",
        alt: "The snow-dusted summit of Mount Washington and its observatory, seen from a glider",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2024/oct-1.jpg",
        alt: "A glider wing over the snow-covered ridge of the Presidential Range",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2024/oct-2.jpg",
        alt: "Gliders lined up on the field at Gorham before a morning launch",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2024/oct-3.jpg",
        alt: "View from the cockpit over snowy ridges and valleys of the White Mountains",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2024/oct-4.jpg",
        alt: "A pilot wearing a parachute talks with a passenger seated in a two-seat glider",
        aspect: "portrait",
      },
      {
        src: "/images/gallery/2024/oct-6.jpg",
        alt: "A passenger being strapped into the front seat of a Duo Discus before a wave flight",
        aspect: "portrait",
      },
      {
        src: "/images/gallery/2024/oct-7.jpg",
        alt: "A white glider on the grass between yellow runway cones, autumn birches behind",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2024/the-field-under-a-lenticular.webp",
        alt: "A glider alone on the grass at Gorham, the ridge in full fall color and a lenticular standing over it",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2024/the-range-from-high-above.webp",
        alt: "The Presidential Range under streaming clouds from high above — snow along the crest, the valley beyond",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2024/the-range-under-its-clouds.webp",
        alt: "The range under its cap clouds from altitude, the canopy frame in the corner",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2024/the-lenticular-below-the-wing.webp",
        alt: "A lone lenticular standing over the valley, seen past the wingtip — the river and farms beneath",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2024/the-wave-cloud-from-the-wing.webp",
        alt: "The wing over an enormous lenticular disk, the cloud filling the sky below",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2024/the-climb-above-the-clouds.webp",
        alt: "A white sailplane climbing above the cloud tops, seen from the glider",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2024/the-rime-on-the-summit.webp",
        alt: "The rime-coated summit cone, the Auto Road's switchbacks traced across the frozen slopes — seen from the wing",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2024/rime-and-spruce-on-the-crest.webp",
        alt: "Rime on the spruce and rock along the crest, the valley blue beyond",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2024/the-photographers-shadow.webp",
        alt: "The photographer's shadow across the dry grass at the grid, gliders lined along the field",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2024/the-crew-at-the-wing.webp",
        alt: "A Duo Discus spread across the grass with a crew member at its wing, the club Pawnee waiting behind",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2024/the-crest-in-first-snow.webp",
        alt: "First snow along the Presidential crest from the air — the alpine slopes white above the forest",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2024/the-pawnee-from-the-air.webp",
        alt: "The club's Pawnee towplane, 9809P, banked over the valley, seen from the glider",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
    ],
  },
  {
    id: "2023",
    title: "Wave Camp 2023",
    blurb: "The days were full of moisture, indeed.",
    photos: [
      {
        src: "/images/gallery/2023/lenticular-town.jpg",
        alt: "A dramatic lenticular cloud over the Gorham valley after rain",
        aspect: "portrait",
      },
      {
        src: "/images/gallery/2023/gliders-field.jpg",
        alt: "Gliders on the grass under a blue sky with cumulus clouds",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2023/sunset-wing.jpg",
        alt: "The sun setting over a cloud deck, seen past the glider's wing",
        aspect: "portrait",
      },
      {
        src: "/images/gallery/2023/cloudscape-wing.jpg",
        alt: "The glider wing above a field of clouds",
        aspect: "portrait",
      },
      {
        src: "/images/gallery/2023/glider-portrait.jpg",
        alt: "A visitor standing at the wing of a glider on the field",
        aspect: "landscape",
      },
    ],
  },
  {
    id: "2018",
    title: "Wave Camp 2018",
    blurb: "The range in the season's first snow, and the field at Gorham that launched out over it.",
    photos: [
      {
        src: "/images/gallery/2018/the-grid-at-gorham.webp",
        alt: "Gliders waiting on the grass at Gorham in the morning light, the ridge in fall color behind",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2018/the-field-before-launch.webp",
        alt: "The line of gliders on the grass at Gorham, the photographer's shadow across the turf and cumulus over the ridge",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2018/the-summit-under-the-cap-cloud.webp",
        alt: "Mount Washington under its cap cloud, the snowy summit cone below it, seen from the air",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2018/the-wing-over-the-dark-ridge.webp",
        alt: "The wing over a dark wooded ridge, the valley falling away beyond",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2018/the-towplane-away-above.webp",
        alt: "The towplane away above the canopy after release, seen from the cockpit",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2018/the-range-through-the-canopy.webp",
        alt: "The Presidential Range in new snow through the canopy — cloud streaming off the crest",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2018/the-cockpit-in-the-wave.webp",
        alt: "The cockpit in the wave, the panel set against the snowy range ahead",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2018/the-auto-road-in-first-snow.webp",
        alt: "The Auto Road's switchbacks across Mount Washington's first snow, seen from the cockpit below the canopy",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2018/the-valley-and-its-roads.webp",
        alt: "A road and a river threading the valley floor below, autumn woods up both walls",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2018/first-snow-on-the-crest.webp",
        alt: "First snow on the high ridges, a fallstreak cloud hanging above — seen from the wing",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2018/snow-on-the-summit-aprons.webp",
        alt: "Fresh snow on the summit and its open aprons, the spruce belt below — seen from the air",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2018/the-wing-over-the-rime.webp",
        alt: "The wing over the rime-covered peaks, the valleys dark below",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
    ],
  },
  {
    id: "2016",
    title: "Wave Camp 2016",
    blurb: "One long flight in the October wave — an undercast over the summits and sun on the cloud deck.",
    photos: [
      {
        src: "/images/gallery/2016/summit-beneath-the-cloud-deck.webp",
        alt: "Mount Washington's summit ridges under the cloud deck, seen past the wingtip",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2016/the-panel-in-the-wave.webp",
        alt: "The cockpit panel — airspeed, altimeter and vario around the stick — cloud tops beyond the canopy",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2016/a-sea-of-cumulus.webp",
        alt: "A sea of cumulus under the wingtip, the ridge showing through a gap in the deck",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2016/over-the-nose-in-the-wave.webp",
        alt: "Over the nose in the wave — the yaw string ahead on the canopy, cloud filling the valley below",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2016/autumn-ridges-under-cumulus.webp",
        alt: "Autumn ridges under scattered cumulus, the wing crossing the corner of the frame",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2016/the-wing-over-the-fall-color.webp",
        alt: "The wing over the fall color of the ridges, cloud tops to the horizon",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2016/sun-rays-over-the-cloud-deck.webp",
        alt: "Sun rays breaking over the cloud deck, the forested valley below",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
      {
        src: "/images/gallery/2016/sunburst-over-the-canopy.webp",
        alt: "The sun bursting over the canopy — the panel in silhouette, the climb ahead",
        aspect: "landscape",
        credit: "Steve Waitekaitis",
      },
    ],
  },
  {
    id: "2011",
    title: "Wave Camp 2011",
    blurb:
      "The two covers that survive from the 2011 album, recovered from the old website's archive.",
    photos: [
      {
        src: "/images/gallery/2011/the-field-under-a-low-sky.jpg",
        alt: "The Gorham field under a low fall sky, gliders and vehicles along the grass",
        aspect: "landscape",
        fit: "contain",
      },
      {
        src: "/images/gallery/2011/sailplanes-on-the-grass.jpg",
        alt: "Sailplanes parked in a line along the grass under a heavy sky",
        aspect: "landscape",
        fit: "contain",
      },
    ],
  },
  {
    id: "2010",
    title: "Wave Camp 2010",
    blurb:
      "The grid, the summit from the air and slides from the 2010 camp — recovered from the old website's archive.",
    photos: [
      {
        src: "/images/gallery/2010/the-grid-at-gorham.jpg",
        alt: "Gliders lined up on the grass at Gorham, the ridge in fall color behind",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2010/the-glider-above-the-summit.jpg",
        alt: "A glider in a deep blue sky above the snow-dusted summit and its antennas",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2010/the-glider-in-the-blue.jpg",
        alt: "A glider in the wave above the summit cone and observatory, seen from below",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2010/the-wing-over-the-valley.jpg",
        alt: "The wing over a hazy blue valley, the ridges fading to the horizon",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2010/a-glider-in-the-sunburst.jpg",
        alt: "A glider silhouetted in a sunburst above fall color and cloud",
        aspect: "landscape",
      },
    ],
  },
  {
    id: "2009",
    title: "Wave Camp 2009",
    blurb:
      "The snowy summit from the air and the tow ahead — pictures from the 2009 camp, recovered from the old website's archive.",
    photos: [
      {
        src: "/images/gallery/2009/sun-over-the-cloud-sea.jpg",
        alt: "The sun breaking over a sea of cloud in the wave",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2009/the-ridge-through-the-canopy.jpg",
        alt: "The snowy ridge through the canopy, cloud streaming beyond",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2009/the-summit-from-the-air.jpg",
        alt: "The snow-covered observatory and towers on the summit, seen from the air above the Auto Road",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2009/the-towplane-through-the-canopy.jpg",
        alt: "The towplane ahead in the climb, the tow rope visible through the canopy",
        aspect: "landscape",
      },
    ],
  },
  {
    id: "2008",
    title: "Wave Camp 2008",
    blurb:
      "A yellow sailplane over the slope, and the covers that survive from the 2008 album.",
    photos: [
      {
        src: "/images/gallery/2008/the-wing-over-the-ridge.jpg",
        alt: "The wingtip over the dark wooded ridge, the range hazy beyond",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2008/the-yellow-sailplane-over-the-slope.jpg",
        alt: "A yellow sailplane banked over the wooded slope in fall color",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2008/the-glider-over-the-haze.jpg",
        alt: "A glider against the blue haze of the ridges",
        aspect: "landscape",
      },
    ],
  },
  {
    id: "before-2008",
    title: "Before 2008",
    blurb:
      "The two covers that survive from the years before 2008 — the rest of the album is still missing.",
    photos: [
      {
        src: "/images/gallery/before-2008/the-glider-over-the-forest.jpg",
        alt: "A distant glider over the dark forest and blue ridges",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/before-2008/the-glider-above-the-undercast.jpg",
        alt: "A glider far below the wing, the cloud deck beyond",
        aspect: "landscape",
      },
    ],
  },
  {
    id: "landmark-party",
    title: "Landmark Party",
    blurb:
      "The recovered cover of the Landmark Party — the gathering that marked Mount Washington's dedication as the 14th National Landmark of Soaring in October 2005.",
    photos: [
      {
        src: "/images/gallery/landmark-party/the-landmark-banquet.jpg",
        alt: "Long tables and a crowd beneath the hotel's timber ceiling at the Landmark Party",
        aspect: "landscape",
      },
    ],
  },
  {
    id: "archive",
    title: "Photo archive",
    blurb: "A selection of older pictures from past camps.",
    photos: [
      {
        src: "/images/gallery/archive/img-0880.jpg",
        alt: "A glider silhouetted against the sun high above a cloud deck",
        aspect: "portrait",
      },
      {
        src: "/images/gallery/archive/img-0879.jpg",
        alt: "Cloud streets seen from the wing of a glider on a wave flight",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/archive/img-0920.jpg",
        alt: "An autumn valley under a wave cloud, photographed from the air",
        aspect: "landscape",
      },
    ],
  },
];

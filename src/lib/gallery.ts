export type Photo = {
  src: string;
  alt: string;
  aspect: "landscape" | "portrait";
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
        src: "/images/gallery/2026/virga-rainbow-over-the-valley.webp",
        alt: "A rainbow beneath snow virga over the river valley, seen from the wing of a glider",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2026/summit-cone-from-above.webp",
        alt: "The Mount Washington summit cone from directly overhead, the Auto Road switchbacks traced in fresh snow",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2026/summit-buildings-from-above.webp",
        alt: "The summit buildings, parking rows and cog railway yard under fresh snow, seen from overhead",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2026/alpine-shoulder-and-ravine.webp",
        alt: "Snow on Mount Washington's alpine shoulder above a shadowed ravine, the Auto Road cut into the ridge",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2026/presidential-range-from-the-air.webp",
        alt: "The Presidential Range from the air — new snow along the crest, autumn color in the valleys",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2026/summit-cone-from-the-air.webp",
        alt: "The snow-dusted summit cone of Mount Washington and its towers, with the crags falling away below",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2026/great-gulf-from-the-air.webp",
        alt: "The summit and the Great Gulf from the air, snow along the crest and autumn color to the horizon",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2026/the-field-at-gorham.webp",
        alt: "Gliders and tow vehicles on the grass at Gorham as the sun breaks through cumulus over the ridge",
        aspect: "landscape",
      },
      {
        src: "/images/gallery/2026/the-crest-in-snow.webp",
        alt: "Looking along the snow-dusted Presidential crest toward the summit towers, the Great Gulf falling away below",
        aspect: "portrait",
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

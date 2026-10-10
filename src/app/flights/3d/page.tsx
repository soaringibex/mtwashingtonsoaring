import type { Metadata } from "next";
import { FlightGlobe3D } from "@/components/flights/FlightGlobe3D";

export const metadata: Metadata = {
  title: "Flights in 3D",
  description:
    "Every wave-camp flight of each October, 2016–2026, drawn as a three-dimensional track over the White Mountains — orbit the year and see where the wave carried them.",
};

export default function Flights3DPage() {
  return (
    <div className="h-[calc(100svh-4rem)] w-full sm:h-[calc(100svh-4.5rem)] xl:h-[calc(100svh-5rem)]">
      <FlightGlobe3D />
    </div>
  );
}

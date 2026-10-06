"use client";

import { useState } from "react";
import { WaveCrossSection } from "@/components/weather/WaveCrossSection";
import { WaveForecast } from "@/components/weather/WaveForecast";
import { WaveMap } from "@/components/weather/WaveMap";

/** The wave forecast, its cross-section and the map, sharing the selected hour. */
export function WavePanel() {
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  return (
    <>
      <WaveForecast selectedTime={selectedTime} onSelectTime={setSelectedTime} />
      <WaveCrossSection selectedTime={selectedTime} onSelectTime={setSelectedTime} />
      <WaveMap selectedTime={selectedTime} onSelectTime={setSelectedTime} />
    </>
  );
}

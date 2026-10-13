"use client";

import { useState } from "react";
import { FieldReports } from "@/components/weather/FieldReports";
import { SatellitePanel } from "@/components/weather/SatellitePanel";
import { WaveCrossSection } from "@/components/weather/WaveCrossSection";
import { WaveForecast } from "@/components/weather/WaveForecast";
import { WaveMap } from "@/components/weather/WaveMap";
import { WindPanel } from "@/components/weather/WindPanel";

/**
 * The Wavecast page in three tabs, so the morning check is one screenful of the day's
 * essentials rather than a scroll past every view. The default is the briefing — the
 * day's wave forecast, the winds (summit hourly and the live column) and the fields'
 * reports; the map tab carries the hour-linked detail views, the satellite tab the
 * imagery. The selected hour lives here, so it survives moving between the forecast
 * and the map.
 */

const TABS = [
  { id: "briefing", label: "Briefing", caption: "forecast · winds · fields" },
  { id: "map", label: "Map", caption: "lift bands & cross-section" },
  { id: "satellite", label: "Satellite", caption: "GOES loop & daily passes" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function WxTabs() {
  const [tab, setTab] = useState<TabId>("briefing");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const activeTab = TABS.find((entry) => entry.id === tab) ?? TABS[0];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Wavecast views"
          className="flex w-fit flex-wrap gap-1 rounded-full bg-slate-100 p-1"
        >
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`wx-tab-${entry.id}`}
              aria-selected={tab === entry.id}
              aria-controls={`wx-panel-${entry.id}`}
              onClick={() => setTab(entry.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                tab === entry.id ? "bg-sky-700 text-white" : "text-slate-600 hover:text-sky-700"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">{activeTab.caption}</p>
      </div>

      {tab === "briefing" ? (
        <div
          role="tabpanel"
          id="wx-panel-briefing"
          aria-labelledby="wx-tab-briefing"
          className="grid gap-6"
        >
          <WaveForecast selectedTime={selectedTime} onSelectTime={setSelectedTime} />
          <WindPanel />
          <FieldReports />
        </div>
      ) : null}

      {tab === "map" ? (
        <div
          role="tabpanel"
          id="wx-panel-map"
          aria-labelledby="wx-tab-map"
          className="grid gap-6"
        >
          <WaveMap selectedTime={selectedTime} onSelectTime={setSelectedTime} />
          <WaveCrossSection selectedTime={selectedTime} onSelectTime={setSelectedTime} />
        </div>
      ) : null}

      {tab === "satellite" ? (
        <div
          role="tabpanel"
          id="wx-panel-satellite"
          aria-labelledby="wx-tab-satellite"
          className="grid gap-6"
        >
          <SatellitePanel />
        </div>
      ) : null}
    </>
  );
}

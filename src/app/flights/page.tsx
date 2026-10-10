import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { FlightArchive } from "@/components/flights/FlightArchive";

export const metadata: Metadata = {
  title: "Flights",
  description:
    "Every WeGlide-logged flight from the October wave camps at Gorham, 2016–2026 — with each flight's peak altitude, its badges and the state record — links straight to WeGlide.",
};

export default function FlightsPage() {
  return (
    <>
      <PageHero
        eyebrow="The camps, logged"
        title="Flights"
        lede="Every flight logged on WeGlide that took off from Gorham in the October camps, 2016 through 2026 — with the peak altitude each one reached, the badges it earned, and a link straight to its trace."
        image="/images/scenic/lenticular-wing.webp"
        imageAlt="A lenticular cloud seen past a glider's wing"
        priority
      />

      <section className="py-16 sm:py-20">
        <Container width="5xl">
          <div className="mt-14">
            <FlightArchive />
          </div>
        </Container>
      </section>
    </>
  );
}

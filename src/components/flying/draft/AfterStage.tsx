import { ButtonLink } from "@/components/ui/ButtonLink";
import { DocCard } from "@/components/ui/DocCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { oxygen } from "@/lib/flying";
import { PageCard, Placeholder } from "./DraftShared";

export function AfterStage() {
  return (
    <div className="space-y-16 sm:space-y-20">
      <section>
        <SectionHeading title="Watch for DCS" lede="Symptoms can appear hours after landing." />
        <div className="mt-8 max-w-xl">
          <DocCard doc={oxygen[2]} />
        </div>
      </section>

      <section>
        <SectionHeading title="Log your flight" />
        <div className="mt-6 max-w-3xl">
          <Placeholder topic="logging your flight (upload the IGC)" />
        </div>
        <div className="mt-6">
          <ButtonLink href="/flights" variant="secondary">
            See the flight archive
          </ButtonLink>
        </div>
      </section>

      <section>
        <SectionHeading title="Badge and record claims" />
        <div className="mt-6 max-w-3xl">
          <Placeholder topic="badge and record claims (the process and who serves as official observer at camp)" />
        </div>
      </section>

      <section>
        <SectionHeading title="Share it" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <PageCard
            href="/gallery"
            title="Photos"
            description="Wave camp photo albums — seasons from 2008 to 2026 and the archive."
          />
          <PageCard
            href="/videos"
            title="Videos"
            description="Member videos from the wave camps — climbs in the wave over the Presidential Range, the view from the cockpit, the field at Gorham and a 2026 timelapse of the sky closing over the ridge."
          />
          <PageCard
            href="/stories"
            title="Stories"
            description="First-hand accounts from the wave — bailouts, first visits, recollections from the early camps, and the camp logbooks."
          />
        </div>
      </section>

      <section>
        <SectionHeading title="Feedback" />
        <div className="mt-6 max-w-3xl">
          <Placeholder topic="how to send feedback to the organizers" />
        </div>
      </section>
    </div>
  );
}

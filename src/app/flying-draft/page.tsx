import type { Metadata } from "next";
import { FlyingDraftView } from "@/components/flying/FlyingDraftView";
import {
  formatWaveCampDates,
  isWaveCampStage,
  newYorkDate,
  nextCampAfter,
  nextWaveCamp,
  stageForDate,
  type WaveCampStage,
} from "@/lib/wave-camp-stages";

/**
 * A review draft of the pilot information page, reorganized around the four
 * stages of a wave camp. It is deliberately unlisted: no navigation, footer,
 * sitemap or search-index entry, and the page carries a noindex directive.
 */
export const metadata: Metadata = {
  title: "Flying here",
  description:
    "Draft for review: the pilot information page reorganized around the four stages of a wave camp.",
  robots: { index: false, follow: false },
};

export default async function FlyingDraftPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawStage = typeof params.stage === "string" ? params.stage : null;
  const stageOverride: WaveCampStage | null =
    rawStage && isWaveCampStage(rawStage) ? rawStage : null;

  const today = newYorkDate();
  const initialStage = stageOverride ?? stageForDate(today);
  const upcomingCamp = nextWaveCamp(today);
  const nextCamp = nextCampAfter(today);

  return (
    <FlyingDraftView
      initialStage={initialStage}
      stageOverride={stageOverride}
      campDatesLabel={formatWaveCampDates(upcomingCamp)}
      nextCampDatesLabel={formatWaveCampDates(nextCamp)}
    />
  );
}

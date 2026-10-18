"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import {
  isWaveCampStage,
  newYorkDate,
  stageForDate,
  stageLabels,
  stageOrder,
  type WaveCampStage,
} from "@/lib/wave-camp-stages";
import { AfterStage } from "./draft/AfterStage";
import { BeforeStage } from "./draft/BeforeStage";
import { BetweenStage } from "./draft/BetweenStage";
import { DuringStage } from "./draft/DuringStage";

export function FlyingDraftView({
  initialStage,
  stageOverride,
  campDatesLabel,
  nextCampDatesLabel,
}: {
  initialStage: WaveCampStage;
  stageOverride: WaveCampStage | null;
  campDatesLabel: string;
  nextCampDatesLabel: string;
}) {
  const [stage, setStage] = useState<WaveCampStage>(initialStage);
  const stageBarRef = useRef<HTMLDivElement | null>(null);
  const stageContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scrollToStage = () => {
      const content = stageContentRef.current;
      if (!content) return;
      const headerHeight = window.matchMedia("(min-width: 1280px)").matches
        ? 80
        : window.matchMedia("(min-width: 640px)").matches
          ? 72
          : 64;
      const barHeight = stageBarRef.current?.offsetHeight ?? 0;
      const top =
        content.getBoundingClientRect().top + window.scrollY - headerHeight - barHeight;
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth";
      window.scrollTo({ top: Math.max(0, top), behavior });
    };

    const sync = (scroll: boolean) => {
      const hash = window.location.hash.replace(/^#/, "");
      if (isWaveCampStage(hash)) {
        setStage(hash);
        if (scroll) requestAnimationFrame(scrollToStage);
        return;
      }
      if (stageOverride) {
        setStage(stageOverride);
        return;
      }
      setStage(stageForDate(newYorkDate()));
      if (scroll) requestAnimationFrame(scrollToStage);
    };

    const initialHash = window.location.hash.replace(/^#/, "");
    sync(isWaveCampStage(initialHash));

    const onHashChange = () => sync(true);
    const onPopState = () => sync(true);
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("popstate", onPopState);
    };
  }, [stageOverride]);

  /**
   * All four stages stay in the document. `hidden="until-found"` keeps the
   * inactive ones out of the way while leaving their text available to the
   * browser's find-in-page, which fires `beforematch` when it lands in one.
   */
  useEffect(() => {
    const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-stage-panel]"));
    for (const panel of panels) {
      if (panel.dataset.stagePanel === stage) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "until-found");
      }
    }

    const handleBeforeMatch = (event: Event) => {
      const panel = event.currentTarget as HTMLElement;
      const value = panel.dataset.stagePanel;
      if (value && isWaveCampStage(value)) setStage(value);
    };
    for (const panel of panels) panel.addEventListener("beforematch", handleBeforeMatch);
    return () => {
      for (const panel of panels) panel.removeEventListener("beforematch", handleBeforeMatch);
    };
  }, [stage]);

  return (
    <>
      <PageHero
        eyebrow="Draft for review"
        title="Flying here"
        lede="Everything needed before and during the wave camp — required reading, airspace and paperwork, the airport, and the files for your moving map."
        image="/images/scenic/lenticular-wing.webp"
        imageAlt="A lenticular cloud seen past the wing of a glider"
        priority
      />

      <section className="border-b border-slate-100 bg-slate-50/70 py-10 sm:py-12">
        <Container>
          <div className="max-w-3xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-8">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
              Safety
            </p>
            <p className="mt-3 text-[1.0625rem] leading-8 text-slate-700">
              Some aspects of safety in wave and mountain flying are presented here, but this is
              far from a complete discussion, and some of this material is not aimed at beginners.
              Pilots should strive to develop the judgment that will keep them safe, understanding
              that mountains such as these can present conditions in which even excellent aircraft
              and skilled pilots cannot safely fly.
            </p>
          </div>
        </Container>
      </section>

      <div
        ref={stageBarRef}
        className="sticky top-16 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md sm:top-18 xl:top-20"
      >
        <Container className="py-2.5">
          <nav
            aria-label="Camp stages"
            className="grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:gap-1"
          >
            {stageOrder.map((id) => {
              const active = stage === id;
              return (
                <a
                  key={id}
                  href={`#${id}`}
                  aria-current={active ? "true" : undefined}
                  className={`flex items-center justify-center rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-sky-100 text-sky-700 ring-1 ring-sky-200"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {stageLabels[id]}
                </a>
              );
            })}
          </nav>
        </Container>
      </div>

      <section className="py-16 sm:py-20">
        <Container>
          <div ref={stageContentRef}>
            <StagePanel stage="before" active={stage === "before"}>
              <BeforeStage campDatesLabel={campDatesLabel} />
            </StagePanel>
            <StagePanel stage="during" active={stage === "during"}>
              <DuringStage />
            </StagePanel>
            <StagePanel stage="after" active={stage === "after"}>
              <AfterStage />
            </StagePanel>
            <StagePanel stage="between" active={stage === "between"}>
              <BetweenStage campDatesLabel={nextCampDatesLabel} />
            </StagePanel>
          </div>
        </Container>
      </section>
    </>
  );
}

function StagePanel({
  stage,
  active,
  children,
}: {
  stage: WaveCampStage;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <section data-stage-panel={stage} hidden={!active}>
      <h2 className="sr-only">{stageLabels[stage]}</h2>
      {children}
    </section>
  );
}

import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { press } from "@/lib/press";

export const metadata: Metadata = {
  title: "Press",
  description:
    "Articles published about the Mount Washington wave camps — from Soaring Magazine, Windswept and the Berlin Reporter.",
};

export default function PressPage() {
  return (
    <>
      <PageHero
        eyebrow="In print"
        title="Press"
        lede="Pieces that have been published about the camps, gathered here for reference."
        image="/images/scenic/towplane-tow.webp"
        imageAlt="A tow plane pulling a glider over autumn mountains"
        priority
      />

      <section className="py-16 sm:py-20">
        <Container className="max-w-4xl">
          <p className="rounded-3xl bg-slate-50 p-6 text-sm leading-7 text-slate-600 ring-1 ring-slate-900/5">
            All articles that appear here are republished with permission from the original
            publisher. All rights other than appearing on this website are reserved by the
            original publisher. If you wish to contact us about information you would like to
            publish, please reach out through the{" "}
            <a href="/contact" className="font-medium text-sky-700 underline underline-offset-4">
              contact page
            </a>
            .
          </p>

          <div className="mt-10 space-y-4">
            {press.map((item) => (
              <article
                key={`${item.date}-${item.title}`}
                className="flex flex-col gap-3 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <div className="min-w-0">
                  <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                    {item.source} · {item.date}
                  </p>
                  <h2 className="mt-2 font-display text-lg font-semibold text-slate-900">
                    {item.title}
                  </h2>
                  {item.description ? (
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                  ) : null}
                </div>

                {item.unavailable ? (
                  <span className="shrink-0 self-start rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:self-center">
                    Not archived
                  </span>
                ) : (
                  <a
                    href={item.href}
                    className="shrink-0 self-start rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500 sm:self-center"
                    {...(item.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  >
                    {item.external ? "Read it" : "Download PDF"}
                  </a>
                )}
              </article>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}

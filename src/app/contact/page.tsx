import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the Mount Washington Soaring Association — join the email list, find the field at Gorham (2G8), or reach the webmaster.",
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Get in touch"
        title="Contact"
        lede="The association has no officers and no dues. The best way to get involved is to join the email list and come to the October encampment at Gorham."
      />

      <section className="py-16 sm:py-20">
        <Container className="max-w-5xl">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-900/5">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Join the mailing list
              </h2>
              <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">
                Camp information — including the signup sheet — is distributed by email during
                the weeks leading up to each encampment. Send a note and you are on the list.
              </p>
              <div className="mt-5">
                <ButtonLink href={`mailto:${site.email}`}>{site.email}</ButtonLink>
              </div>
            </div>

            <div className="flex flex-col rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-900/5">
              <h2 className="font-display text-lg font-semibold text-slate-900">Where we fly</h2>
              <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">
                {site.location.airport}
                <br />
                {site.location.town}
                <br />
                From Columbus Day weekend through the following weekend each October.
              </p>
              <div className="mt-5">
                <ButtonLink
                  href="https://maps.google.com/?q=Gorham+Municipal+Airport,+Gorham,+NH"
                  variant="secondary"
                >
                  Open in Maps
                </ButtonLink>
              </div>
            </div>

            <div className="flex flex-col rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-900/5">
              <h2 className="font-display text-lg font-semibold text-slate-900">Webmaster</h2>
              <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">
                Corrections, documents, and photos from past camps are always welcome — several
                pictures from the old website are still missing.
              </p>
              <div className="mt-5">
                <ButtonLink href={`mailto:${site.email}?subject=Website`} variant="secondary">
                  Write to us
                </ButtonLink>
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-3xl bg-gradient-to-br from-sky-600 to-sky-900 p-8 text-white sm:p-10">
            <h2 className="font-display text-2xl font-bold tracking-tight text-balance">
              New to the wave?
            </h2>
            <p className="mt-4 max-w-3xl text-[1.0625rem] leading-8 text-sky-100">
              Flying the Mount Washington wave is not a first cross-country — the rotor, the
              terrain and the altitude all demand experience and preparation. Start with the
              required reading, fly with a club that attends, and come to a daily briefing before
              you launch.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/flying" variant="light">
                Required reading
              </ButtonLink>
              <ButtonLink href="/links" variant="light">
                Founding clubs
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

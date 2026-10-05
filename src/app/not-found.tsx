import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";

export default function NotFound() {
  return (
    <section className="flex min-h-[70svh] items-center py-24 sm:py-32">
      <Container width="3xl" className="text-center">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">
          404
        </p>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          This one&apos;s in the rotor.
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">
          The page you were looking for has either drifted off course or never launched. Head
          back to base and catch the next tow.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">Back to base</ButtonLink>
          <ButtonLink href="/flying" variant="secondary">
            Wave camp reading
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}

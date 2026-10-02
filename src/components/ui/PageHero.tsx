import Image from "next/image";
import { Container } from "./Container";

export function PageHero({
  eyebrow,
  title,
  lede,
  image,
  imageAlt = "",
  priority = false,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  image?: string;
  imageAlt?: string;
  priority?: boolean;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-slate-900">
      {image ? (
        <>
          <Image
            src={image}
            alt={imageAlt}
            fill
            priority={priority}
            sizes="100vw"
            className="object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/55 to-slate-950/40" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-sky-950 via-slate-900 to-slate-800" />
      )}
      <Container className="relative py-20 sm:py-24 lg:py-28">
        {eyebrow ? (
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold tracking-tight text-white text-balance sm:text-5xl">
          {title}
        </h1>
        {lede ? (
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">{lede}</p>
        ) : null}
      </Container>
    </section>
  );
}

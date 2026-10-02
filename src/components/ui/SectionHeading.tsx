export function Eyebrow({ children }: { children: string }) {
  return (
    <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "left",
  className = "",
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  align?: "left" | "center";
  className?: string;
}) {
  const alignment = align === "center" ? "items-center text-center" : "items-start";
  return (
    <div className={`flex max-w-3xl flex-col ${alignment} ${className}`}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 text-balance sm:text-4xl">
        {title}
      </h2>
      {lede ? <p className="mt-4 text-lg leading-8 text-slate-600">{lede}</p> : null}
    </div>
  );
}

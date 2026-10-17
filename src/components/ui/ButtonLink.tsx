import Link from "next/link";
import type { ReactNode } from "react";

const variants = {
  primary: "bg-sky-600 text-white shadow-sm hover:bg-sky-500",
  secondary: "bg-white text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50",
  light: "bg-white/15 text-white ring-1 ring-white/40 backdrop-blur-sm hover:bg-white/25",
  dark: "bg-slate-900 text-white hover:bg-slate-700",
} as const;

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
  track,
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof variants;
  className?: string;
  /** Optional analytics event; see src/lib/analytics.ts. */
  track?: {
    event: string;
    file?: string;
    document?: string;
  };
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${variants[variant]} ${className}`;

  if (href.startsWith("http") || href.startsWith("mailto:")) {
    return (
      <a
        href={href}
        className={classes}
        data-umami-event={track?.event}
        data-umami-event-file={track?.file}
        data-umami-event-document={track?.document}
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={classes}
      data-umami-event={track?.event}
      data-umami-event-file={track?.file}
      data-umami-event-document={track?.document}
    >
      {children}
    </Link>
  );
}

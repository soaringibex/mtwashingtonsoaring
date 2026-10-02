import type { ReactNode } from "react";

export function Prose({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`space-y-6 text-[1.0625rem] leading-8 text-slate-700 [&_a]:font-medium [&_a]:text-sky-700 [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-sky-600 [&_blockquote]:border-l-2 [&_blockquote]:border-sky-300 [&_blockquote]:pl-6 [&_blockquote]:text-slate-600 [&_blockquote]:italic [&_h2]:mt-14 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-slate-900 [&_h2]:first:mt-0 [&_h3]:mt-10 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900 [&_strong]:font-semibold [&_strong]:text-slate-900 ${className}`}
    >
      {children}
    </div>
  );
}

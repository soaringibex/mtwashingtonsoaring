"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { site } from "@/lib/site";
import { Container } from "@/components/ui/Container";

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-600 to-sky-800 shadow-sm">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <path d="M12 3.5 18.5 9 12 10.5 5.5 9z" fill="#ffffff" />
          <path
            d="M4 17c2.1-3.2 4.2-3.2 6.3 0s4.2 3.2 6.3 0"
            fill="none"
            stroke="#7dd3fc"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-display text-[15px] font-bold tracking-tight text-slate-900">
          Mt Washington
        </span>
        <span className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-slate-500">
          Soaring Association
        </span>
      </span>
    </span>
  );
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-900/5 bg-white/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label={site.name}>
          <Logo />
        </Link>

        <nav className="hidden items-center lg:flex" aria-label="Main">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-sky-50 text-sky-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <a
            href={`mailto:${site.email}`}
            className="ml-2 hidden items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 xl:inline-flex"
          >
            Join the list
          </a>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="grid size-10 place-items-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 lg:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </Container>

      {open ? (
        <div className="border-t border-slate-100 bg-white lg:hidden">
          <Container className="py-4">
            <nav className="grid gap-0.5" aria-label="Mobile">
              {site.nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-sky-50 text-sky-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <a
                href={`mailto:${site.email}`}
                onClick={() => setOpen(false)}
                className="mt-3 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Join the mailing list
              </a>
            </nav>
          </Container>
        </div>
      ) : null}
    </header>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { site } from "@/lib/site";
import { Container } from "@/components/ui/Container";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-900/5 bg-white/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4 sm:h-18 xl:h-20">
        <Link href="/" aria-label={site.name} className="flex shrink-0 items-center">
          <Image
            src="/images/brand/logo.svg"
            alt={site.name}
            width={2127}
            height={405}
            priority
            unoptimized
            className="h-11 w-auto sm:h-12 xl:h-16"
          />
        </Link>

        <nav className="hidden items-center lg:flex" aria-label="Main">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-sky-50 text-sky-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {item.label}
              {item.beta ? (
                <span className="pointer-events-none absolute right-3 top-[calc(100%-10px)] rounded-full bg-slate-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  beta
                </span>
              ) : null}
            </Link>
          ))}
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
                  {item.beta ? (
                    <span className="ml-1.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      beta
                    </span>
                  ) : null}
                </Link>
              ))}
            </nav>
          </Container>
        </div>
      ) : null}
    </header>
  );
}

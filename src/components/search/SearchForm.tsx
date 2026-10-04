"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { kindLabels, kindOrder, searchSite, type SearchResult } from "@/lib/search";

const suggestions = ["wave camp", "letter of authorization", "oxygen", "lenticular", "Lennie", "altitude record"];

function ResultRow({ item }: { item: SearchResult }) {
  const isExternal = /^https?:\/\//.test(item.href);
  const isFile = item.href.startsWith("/files/");

  const body = (
    <>
      <span className="min-w-0">
        <span className="block font-display text-[15px] font-semibold text-slate-900">
          {item.title}
        </span>
        {item.section ? (
          <span className="mt-0.5 block text-xs font-medium uppercase tracking-wide text-sky-700">
            {item.section}
          </span>
        ) : null}
        {item.text ? (
          <span className="mt-2 line-clamp-2 block text-sm leading-6 text-slate-600">
            {item.text}
          </span>
        ) : null}
      </span>
      {isExternal ? (
        <span aria-hidden="true" className="shrink-0 text-slate-400">
          ↗
        </span>
      ) : null}
    </>
  );

  const className =
    "flex items-start justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5 transition hover:ring-sky-300";

  return (
    <li>
      {isExternal ? (
        <a href={item.href} target="_blank" rel="noreferrer" className={className}>
          {body}
        </a>
      ) : isFile ? (
        <a href={item.href} className={className}>
          {body}
        </a>
      ) : (
        <Link href={item.href} className={className}>
          {body}
        </Link>
      )}
    </li>
  );
}

const subscribeToUrl = () => () => {};

const getQueryFromUrl = () =>
  typeof window === "undefined"
    ? ""
    : (new URLSearchParams(window.location.search).get("q") ?? "");

const getServerQuery = () => "";

export function SearchForm() {
  const initialQuery = useSyncExternalStore(subscribeToUrl, getQueryFromUrl, getServerQuery);
  const [editedQuery, setEditedQuery] = useState<string | null>(null);
  const query = editedQuery ?? initialQuery;

  const setQuery = (value: string) => setEditedQuery(value);

  // Keep the address bar in sync with the query — but only once the user has
  // actually edited it, so a shared ?q= link is never wiped on arrival.
  useEffect(() => {
    if (editedQuery === null) return;
    const next = editedQuery.trim();
    window.history.replaceState(
      null,
      "",
      next ? `/search?q=${encodeURIComponent(next)}` : "/search",
    );
  }, [editedQuery]);

  const results = useMemo(() => (query.trim() ? searchSite(query) : []), [query]);

  const groups = useMemo(
    () =>
      kindOrder
        .map((kind) => {
          const items = results.filter((result) => result.kind === kind);
          return { kind, total: items.length, items: items.slice(0, 8) };
        })
        .filter((group) => group.items.length > 0),
    [results],
  );

  const searching = query.trim().length > 0;

  return (
    <div>
      <form role="search" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="site-search" className="sr-only">
          Search the site
        </label>
        <div className="relative">
          <input
            id="site-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the site…"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>
      </form>

      <p role="status" className="mt-4 text-sm text-slate-500">
        {searching
          ? `${results.length} ${results.length === 1 ? "result" : "results"} for “${query.trim()}”`
          : "Search every page, document, photo album, press clipping and the full accomplishment record book."}
      </p>

      {!searching || results.length === 0 ? (
        <div className="mt-8">
          {searching && results.length === 0 ? (
            <p className="rounded-2xl bg-amber-50 p-5 text-sm leading-7 text-amber-900 ring-1 ring-amber-200/60">
              Nothing matched “{query.trim()}”. Try a shorter word — a pilot&apos;s last name, a
              document like “LOA”, or a topic like “oxygen”.
            </p>
          ) : null}
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            Try
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setQuery(suggestion)}
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-900/5 transition-colors hover:bg-sky-50 hover:text-sky-700"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-10 space-y-12">
          {groups.map((group) => (
            <section key={group.kind} aria-label={kindLabels[group.kind]}>
              <h2 className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
                {kindLabels[group.kind]}
              </h2>
              <ul className="mt-4 grid gap-3">
                {group.items.map((item) => (
                  <ResultRow key={`${item.kind}-${item.title}-${item.href}`} item={item} />
                ))}
              </ul>
              {group.total > group.items.length ? (
                <p className="mt-3 pl-1 text-sm text-slate-400">
                  {group.total - group.items.length} more in {kindLabels[group.kind].toLowerCase()} —
                  keep typing to narrow it down.
                </p>
              ) : null}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

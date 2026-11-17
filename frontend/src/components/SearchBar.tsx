"use client";

import { useEffect, useRef, useState } from "react";
import { searchLocations, type SearchResultItem } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

interface Props {
  onSelectLocation: (lat: number, lng: number) => void;
}

export default function SearchBar({ onSelectLocation }: Props) {
  const { t, isTh } = useLanguage();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      searchLocations(normalizedQuery)
        .then((res) => {
          if (cancelled) return;
          setResults(res.results || []);
          setOpen(true);
          setSelectedIndex(-1);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
          setOpen(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item: SearchResultItem) => {
    setQuery("");
    setOpen(false);
    onSelectLocation(item.lat, item.lng);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter" && selectedIndex >= 0 && selectedIndex < results.length) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "station":
        return "bg-sky-100 text-sky-800 border-sky-200";
      case "district":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "neighborhood":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "landmark":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-zinc-100 text-zinc-700 border-zinc-200";
    }
  };

  const getBadgeLabel = (type: string, badgeTh: string) => {
    if (isTh) return badgeTh;
    switch (type) {
      case "station":
        return "Station";
      case "district":
        return "District";
      case "neighborhood":
        return "Area";
      case "landmark":
        return "Landmark";
      default:
        return badgeTh;
    }
  };

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <div className="relative flex items-center">
        <svg
          className="absolute left-3.5 h-4 w-4 text-[#809185]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const nextQuery = e.target.value;
            setQuery(nextQuery);
            setSelectedIndex(-1);
            if (!nextQuery.trim()) {
              setResults([]);
              setOpen(false);
              setLoading(false);
            }
          }}
          onFocus={() => query.trim() && setOpen(true)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls="location-search-results"
          aria-autocomplete="list"
          placeholder={t("search.placeholder")}
          className="w-full rounded-full border border-white/70 bg-white/95 py-2.5 pl-10 pr-8 text-[13px] text-[#263d2f] shadow-sm backdrop-blur placeholder:text-[#89988c] focus:border-[#b7d0ba] focus:outline-none focus:ring-2 focus:ring-[#b7d0ba]/40"
        />
        {query && (
          <button
            type="button"
            aria-label={isTh ? "ล้างคำค้นหา" : "Clear search"}
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
            }}
            className="absolute right-3 text-zinc-400 hover:text-zinc-600 cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div
          id="location-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-[#dce6db] bg-white/95 p-2 shadow-[0_16px_42px_rgba(26,52,35,0.16)] backdrop-blur-xl"
        >
          {loading && (
            <div className="px-3 py-2 text-center text-xs text-zinc-400">
              {isTh ? "กำลังค้นหาข้อมูล..." : "Searching locations..."}
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-center text-xs text-zinc-400">{t("search.empty")}</div>
          )}
          {!loading &&
            results.map((item, idx) => {
              const primary = isTh ? item.title_th : (item.title_en || item.title_th);
              const secondary = isTh ? item.title_en : item.title_th;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedIndex === idx}
                  key={`${item.type}-${item.lat}-${item.lng}-${idx}`}
                  onClick={() => handleSelect(item)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors ${
                    selectedIndex === idx ? "bg-[#edf4ec] text-[#315d43]" : "hover:bg-[#f5f8f3]"
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-zinc-800">{primary}</span>
                      <span className="text-[11px] text-zinc-400">{secondary}</span>
                    </div>
                    <div className="truncate text-[10px] text-zinc-500">{item.subtitle}</div>
                  </div>
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${getBadgeColor(
                      item.type
                    )}`}
                  >
                    {getBadgeLabel(item.type, item.badge)}
                  </span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

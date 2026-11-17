"use client";

import {
  type Recommendation,
} from "@/lib/api";
import { useLanguage, formatCurrency, formatDist, formatPricePerSqWah, getDimLabel } from "@/lib/i18n";
import { SparklesIcon, TrophyIcon } from "@/components/icons";

interface Props {
  results: Recommendation[];
  selectedHexId: string | null;
  onSelect: (r: Recommendation) => void;
  onCompute?: () => void;
}

function rankColor(score: number): string {
  if (score >= 75) return "text-[#2d6948] bg-[#e7f2e9] border-[#c8dfce]";
  if (score >= 55) return "text-[#426b52] bg-[#edf5eb] border-[#d7e5d8]";
  if (score >= 40) return "text-[#806536] bg-[#fbf5e7] border-[#e9dcb9]";
  return "text-[#65776b] bg-[#f4f7f2] border-[#dce6da]";
}

export default function ResultsList({ results, selectedHexId, onSelect, onCompute }: Props) {
  const { t, lang, isTh } = useLanguage();

  if (results.length === 0) {
    return (
      <div className="rounded-[22px] border border-[#dfe7dc] bg-white p-7 text-center shadow-[0_5px_20px_rgba(39,62,43,0.035)]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f6eed9] text-[#8b6f37]">
          <TrophyIcon className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-[#263d2f]">
          {isTh ? "ยังไม่มีข้อมูลจัดอันดับทำเล" : "No ranked locations"}
        </h3>
        <p className="mt-2 text-[13px] leading-6 text-[#6b7b6e]">
          {isTh
            ? "คลิกปุ่มด้านล่างเพื่อคำนวณและค้นหาทำเลศักยภาพสูงสุดในกรุงเทพฯ ทันที"
            : "Click below to compute top potential locations across Bangkok now."}
        </p>
        {onCompute && (
          <button
            type="button"
            onClick={onCompute}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#294637] px-5 py-3 text-xs font-semibold text-white transition-colors hover:bg-[#365d48]"
          >
            <SparklesIcon className="w-4 h-4" />
            <span>{isTh ? "⚡ คำนวณอันดับทำเลยอดนิยม" : "⚡ Compute Top Locations"}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#304837]">
            <TrophyIcon className="h-4 w-4 text-[#9b7d42]" />
            <span>{t("results.title")}</span>
          </h2>
          <span className="rounded-full bg-[#e8f2e9] px-2.5 py-1 text-[11px] font-semibold text-[#456d51]">
            {results.length} {isTh ? "ทำเล" : "locations"}
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-5 text-[#6b7b6e]">
          {isTh
            ? "จัดอันดับตามเกณฑ์ที่คุณกำหนด พร้อมการวิเคราะห์ราคาและคุณภาพ"
            : "Ranked by your chosen criteria, with quality and price context"}
        </p>
      </div>

      <div className="space-y-2.5">
        {results.map((r, i) => {
          const active = r.hex_id === selectedHexId;
          const ctx = r.context;
          const price = r.price_valuation;
          const road = price?.road_benchmark;
          const isOfficialArea = price?.market_price_type === "treasury_area_reference";
          const topPos = r.positive_factors.slice(0, 2);

          const primaryTitle = isTh
            ? (ctx?.title_th || `ทำเล ${r.hex_id}`)
            : (ctx?.title_en || `Plot ${r.hex_id}`);
          const subTitle = isTh
            ? `เขต${ctx?.district_th || "กรุงเทพฯ"}`
            : `${ctx?.district_en || "Bangkok"} District`;

          return (
            <button
              key={r.hex_id}
              type="button"
              onClick={() => onSelect(r)}
              aria-pressed={active}
              className={`group w-full rounded-[18px] border p-4 text-left transition-colors ${
                active
                  ? "border-[#8db89a] bg-[#f0f7ee] shadow-[0_5px_20px_rgba(39,62,43,0.06)]"
                  : "border-[#dfe7dc] bg-white hover:border-[#b2cdb7] hover:bg-[#fcfefb]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2d4837] text-[11px] font-semibold text-white">
                      {i + 1}
                    </span>
                    <span className="truncate text-[13px] font-semibold text-[#283e30] group-hover:text-[#315f42]">
                      {primaryTitle}
                    </span>
                  </div>
                  <div className="truncate pl-8 text-xs text-[#7a8a7d]">
                    {subTitle}
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <div className={`flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-xs font-semibold tabular-nums ${rankColor(r.match_score)}`}>
                    <span>{r.match_score.toFixed(0)}</span>
                    <span className="text-[9px] font-normal opacity-70">pts</span>
                  </div>
                </div>
              </div>

              {/* Price & Transit Summary */}
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#e7eee6] pt-3 text-xs">
                <div className="text-zinc-600">
                  <span className="mb-1 block text-[11px] text-[#7f8d80]">
                    {road
                      ? (isTh ? `หน่วยที่ดินบน${road.road_name_th} · เทียบเคียง` : `${road.road_name_en} road units · context`)
                      : isOfficialArea
                      ? (isTh ? "ช่วงราคาประเมินในพื้นที่ · ร้อยละ 10–90" : "Nearby appraisal spread · 10th–90th")
                      : t("results.est_market_price")}
                  </span>
                  <span className="font-semibold text-[#344b38]">
                    {road
                      ? `${formatCurrency(road.low, lang)}–${formatCurrency(road.high, lang)} / ${isTh ? "ตร.ว." : "sq.wah"}`
                      : isOfficialArea && price
                      ? `${formatCurrency(price.market_price_low, lang)}–${formatCurrency(price.market_price_high, lang)} / ${isTh ? "ตร.ว." : "sq.wah"}`
                      : price ? formatPricePerSqWah(price.market_price_sqwah, lang) : "—"}
                  </span>
                  {isOfficialArea && price && (
                    <span className="mt-1 block text-[10px] leading-4 text-[#8a8a7b]">
                      {isTh ? "ค่ากลางระวาง" : "Sheet median"} {formatPricePerSqWah(price.market_price_sqwah, lang)} · {isTh ? "ไม่ใช่ราคาแปลงนี้" : "not this parcel"}
                    </span>
                  )}
                </div>
                <div className="text-zinc-600">
                  <span className="mb-1 block text-[11px] text-[#7f8d80]">{t("detail.nearest_transit")}</span>
                  <span className="block truncate font-medium text-[#426b52]">
                    {ctx?.transit_walk?.station_name ? (
                      <>
                        {ctx.transit_walk.station_name}{" "}
                        <span className="text-zinc-400 font-normal">
                          ({formatDist(ctx.transit_walk.distance_m, lang)})
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              </div>

              {/* Badges / Factors */}
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {price?.is_golden_location && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#e6d3a3] bg-[#fbf2d9] px-2.5 py-1 text-[10px] font-semibold text-[#6d5425]">
                    <SparklesIcon className="w-3 h-3 text-amber-900" />
                    <span>{t("btn.golden_location")}</span>
                  </span>
                )}
                {topPos.map((p) => (
                  <span
                    key={p.dimension}
                    className="rounded-full bg-[#e8f2e9] px-2.5 py-1 text-[10px] font-medium text-[#456d51]"
                  >
                    + {getDimLabel(p.dimension, lang).split(" ")[0]}
                  </span>
                ))}
                <span className="rounded-full bg-[#f1f5ef] px-2.5 py-1 text-[10px] font-mono text-[#728174]">
                  {t("results.quality")} {r.quality.toFixed(0)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

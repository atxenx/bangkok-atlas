"use client";

import { useEffect, useState } from "react";

import {
  DIMENSIONS,
  fetchTreasurySheetPrice,
  type LocationDetail as Detail,
  type TreasuryReference,
} from "@/lib/api";
import {
  useLanguage,
  formatDist,
  formatPricePerSqWah,
  formatCurrency,
  getQualityBadgeInfo,
  getDimLabel,
} from "@/lib/i18n";
import InvestmentMemoCard from "./InvestmentMemoCard";
import StreetLevelCard from "./StreetLevelCard";
import {
  SparklesIcon,
  LandmarkIcon,
  TrainIcon,
  MapPinIcon,
  BarChart3Icon,
  ThumbsUpIcon,
  AlertTriangleIcon,
  TagIcon,
  LayersIcon,
} from "@/components/icons";

interface Props {
  detail: Detail;
  selectedBuilding?: { lat: number; lng: number; name: string | null } | null;
  onClose: () => void;
}

function barColor(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-teal-500";
  if (score >= 35) return "bg-amber-500";
  return "bg-rose-500";
}

export default function LocationDetail({ detail, selectedBuilding, onClose }: Props) {
  const { t, lang, isTh } = useLanguage();
  const d = detail;
  const badge = getQualityBadgeInfo(d.quality, lang);
  const price = d.price_valuation;
  const ctx = d.context;
  const isOfficialReference = price?.market_price_type === "treasury_area_reference";
  const [liveReference, setLiveReference] = useState<TreasuryReference | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (price?.market_price_type !== "treasury_area_reference" || price.reference_resolution_m !== 500) return;
    fetchTreasurySheetPrice(d.center.lat, d.center.lng)
      .then(({ reference }) => {
        if (!cancelled && reference?.source_mode === "official_live_api") setLiveReference(reference);
      })
      .catch(() => {
        // The bundled official CSV remains available when the upstream API fails.
      });
    return () => { cancelled = true; };
  }, [d.center.lat, d.center.lng, price?.market_price_type, price?.reference_resolution_m]);

  const currentReference = isOfficialReference && liveReference?.utm_sheet === price.reference_utm_sheet
    && liveReference?.utm_subsheet === price.reference_utm_subsheet ? liveReference : null;
  const displayPrice = currentReference?.median ?? price?.market_price_sqwah;
  const displayLow = currentReference?.p10 ?? price?.market_price_low;
  const displayHigh = currentReference?.p90 ?? price?.market_price_high;
  const wideSpread = isOfficialReference && displayPrice != null && displayHigh != null && displayHigh >= displayPrice * 3;
  const roadBenchmark = price?.road_benchmark;
  const referenceCount = currentReference?.n ?? price?.reference_record_count;
  const referenceResolution = currentReference?.resolution_m ?? price?.reference_resolution_m;

  const primaryTitle = isTh
    ? (ctx?.title_th || d.hex_id)
    : (ctx?.title_en || d.hex_id);
  const secondaryTitle = isTh ? ctx?.title_en : ctx?.title_th;

  return (
    <div className="space-y-5 text-[#263b2d]">
      {selectedBuilding && (
        <div className="rounded-2xl border border-[#cfe0d3] bg-[#eef5ef] px-4 py-3 text-[13px] leading-5 text-[#315540]">
          <div className="font-semibold">
            {isTh ? "อาคารที่เลือก: " : "Selected building: "}
            {selectedBuilding.name || (isTh ? "ไม่มีชื่อในข้อมูล OSM" : "Unnamed in OSM")}
          </div>
          <div className="mt-1 text-xs text-[#5c7562]">
            {isTh ? "ผลวิเคราะห์เป็นระดับพื้นที่รอบอาคาร ไม่ใช่การประเมินเฉพาะตัวอาคาร" : "Scores describe the surrounding area, not this individual building."}
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[#dde7dc] pb-4">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="rounded-full bg-[#2d4837] px-2.5 py-1 font-mono text-[10px] font-semibold text-white">
              {ctx?.zone || "Bangkok"}
            </span>
            {price?.is_golden_location && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#e6d3a3] bg-[#fbf2d9] px-2.5 py-1 text-[10px] font-semibold text-[#6d5425]">
                <SparklesIcon className="w-3 h-3 text-amber-950" />
                <span>{t("btn.golden_location")}</span>
              </span>
            )}
            <span className="text-xs font-medium text-[#6d7e70]">
              {isTh
                ? `เขต${ctx?.district_th}`
                : `${ctx?.district_en} District`}
            </span>
          </div>
          <h2 className="mt-3 text-lg font-semibold leading-snug tracking-tight text-[#263b2d]">
            {primaryTitle}
          </h2>
          {secondaryTitle && secondaryTitle !== primaryTitle && (
            <p className="mt-1 text-[13px] text-[#839185]">{secondaryTitle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#dce7da] bg-white text-xs text-[#65776a] transition-colors hover:bg-[#eff5ed] hover:text-[#315540]"
          aria-label={isTh ? "ปิดรายละเอียด" : "Close details"}
        >
          ✕
        </button>
      </div>

      {/* Quality Score Hero Card */}
      <div className="rounded-[20px] border border-[#cae0ce] bg-[#f0f7ef] p-4 shadow-[0_5px_20px_rgba(39,62,43,0.035)]">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#315540]">
            {t("detail.quality_title")}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <div className="text-5xl font-semibold tabular-nums tracking-tight text-[#2e7650]">
            {d.quality.toFixed(0)}
          </div>
          <span className="text-xs font-medium text-[#859487]">/ 100 {isTh ? "คะแนน" : "pts"}</span>
        </div>
        <p className="mt-2 text-xs leading-6 text-[#5d7161]">
          {t("detail.quality_desc")}
        </p>
      </div>

      {/* Official map-sheet summary or explicitly marked model fallback. */}
      {price && (
        <div className="rounded-[20px] border border-[#e8ddbf] bg-[#fffcf4] p-4 shadow-[0_5px_20px_rgba(39,62,43,0.035)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TagIcon className="h-4 w-4 text-[#9a7b3e]" />
              <span className="text-[13px] font-semibold text-[#6e572e]">
                {isOfficialReference
                  ? (isTh ? "ข้อมูลราคาประเมินในพื้นที่" : "Nearby official appraisal data")
                  : t("detail.valuation_title")}
              </span>
            </div>
            <span className="rounded-full bg-[#f5e7bc] px-2.5 py-1 text-[10px] font-semibold text-[#6e572e]">
              {price.zone_tier}
            </span>
          </div>

          {isOfficialReference ? (
            <div className="mt-4">
              {roadBenchmark && (
                <div className="mb-4 rounded-xl border border-[#e7d7ad] bg-white/85 p-3">
                  <span className="text-[11px] font-semibold text-[#745a2b]">
                    {isTh
                      ? `ข้อมูลเปรียบเทียบหน่วยที่ดินบน${roadBenchmark.road_name_th}`
                      : `Published ${roadBenchmark.road_name_en} road-unit range`}
                  </span>
                  <div className="mt-1 text-lg font-semibold text-[#67512a]">
                    {formatCurrency(roadBenchmark.low, lang)}–{formatCurrency(roadBenchmark.high, lang)} / {isTh ? "ตร.ว." : "sq.wah"}
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-[#776d59]">
                    {isTh
                      ? "เฉพาะช่วงราคาที่กรมธนารักษ์เผยแพร่สำหรับหน่วยที่ดินตามถนน ไม่ได้ยืนยันว่าแปลงที่เลือกติดถนนหรืออยู่ในช่วงนี้"
                      : "Published for land units on this road. It does not establish that the selected parcel fronts the road or falls in this range."}
                  </p>
                  <a href={roadBenchmark.source_copy_url || roadBenchmark.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-[11px] font-semibold text-[#806433] underline underline-offset-2">
                    {isTh ? "ดูสำเนาตารางราคาหน่วยถนน (PDF) ↗" : "View copy of Treasury road-unit table (PDF) ↗"}
                  </a>
                </div>
              )}
              <div className="flex items-end justify-between gap-3">
                <div>
                  <span className="text-[11px] text-[#7d897d]">
                    {isTh ? "ช่วงราคาประเมินของระเบียนรอบจุดที่เลือก · ร้อยละ 10–90" : "Nearby appraisal records · 10th–90th percentiles"}
                  </span>
                  <div className="mt-1 text-xl font-semibold text-[#2d4031]">
                    {formatCurrency(displayLow, lang)}–{formatCurrency(displayHigh, lang)} <span className="text-xs font-medium">/ {isTh ? "ตร.ว." : "sq.wah"}</span>
                  </div>
                </div>
                <span className="shrink-0 rounded-lg bg-[#f5edda] px-2.5 py-1.5 text-[11px] font-medium text-[#715d3f]">
                  {referenceResolution
                    ? (isTh ? `ระวาง ${referenceResolution.toLocaleString()} ม.` : `${referenceResolution.toLocaleString()} m sheet`)
                    : (isTh ? "ระดับเขต" : "District level")}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-[#6d7467]">
                {isTh ? "ค่ากลางของระวาง" : "Sheet median"}: {formatPricePerSqWah(displayPrice, lang)} · {isTh ? "ไม่ใช่ราคาแปลงที่คลิก" : "not the clicked parcel's price"}
              </p>
              <p className="mt-1 text-[11px] text-[#7c7b6f]">
                {referenceCount?.toLocaleString() ?? "—"} {isTh ? "ระเบียนจากกรมธนารักษ์" : "Treasury appraisal records"}
                {currentReference ? (isTh ? " · ตรวจ API ล่าสุดแล้ว" : " · live API checked") : (isTh ? " · ไฟล์ต้นทางแก้ไข 8 พ.ค. 2569" : " · source file modified 8 May 2026")}
              </p>
              <p className="mt-3 rounded-lg border border-[#ead8ab] bg-[#fff7e5] px-3 py-2 text-[11px] leading-5 text-[#775e2c]">
                {isTh
                  ? `ช่วงนี้คือการกระจายของแปลงอื่นในพื้นที่${wideSpread ? " ซึ่งราคาต่างกันมาก" : ""} โดยตัดข้อมูลสูงสุดและต่ำสุดอย่างละ 10% ออก แปลงติดถนนหลักอาจสูงกว่าช่วงนี้ ไม่ใช่ช่วงราคาของแปลงที่คลิก จึงยังตัดสินงบซื้อไม่ได้`
                  : `This spread covers other nearby parcels${wideSpread ? " with especially varied appraisals" : ""} and excludes the highest and lowest 10%. Main-road parcels may exceed it. It does not price the clicked parcel or establish budget fit.`}
              </p>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 divide-x divide-[#eadfbe]">
              <div>
                <span className="text-[11px] text-[#7d897d]">{t("detail.market_price")}</span>
                <div className="mt-1 text-[15px] font-semibold text-[#2d4031]">{formatPricePerSqWah(price.market_price_sqwah, lang)}</div>
                <span className="text-[10px] text-zinc-400">{isTh ? "ช่วง" : "Range"} {formatCurrency(price.market_price_low, lang)} - {formatCurrency(price.market_price_high, lang)}</span>
              </div>
              <div className="pl-3">
                <span className="text-[10px] text-zinc-500">{t("detail.treasury_price")}</span>
                <div className="mt-1 text-[15px] font-semibold text-[#8a6937]">{formatPricePerSqWah(price.assessed_price_sqwah, lang)}</div>
                <span className="text-[10px] text-amber-700/80">{t("detail.treasury_cycle")}</span>
              </div>
            </div>
          )}

          <div className="mt-4 border-t border-[#eee2c4] pt-3 text-xs leading-5 text-[#6d7467]">
            <p>
              {isOfficialReference
                ? (isTh
                    ? "ช่วงนี้สรุปจากราคาประเมินจริงของแปลงอื่นในระวางใกล้เคียง ไม่ใช่ราคาประเมินของแปลงที่คลิกหรือราคาซื้อขายจริง ตำแหน่งระวางอาจคลาดเคลื่อนจากระบบพิกัด"
                    : "This spread summarizes actual appraisals of other parcels in a nearby map sheet—not the clicked parcel’s official value or a sale price. Sheet positioning may have datum error.")
                : (isTh
                    ? "ค่าบนหน้านี้เป็นค่าประมาณเพื่อคัดกรองระดับย่าน ไม่ใช่ราคาประเมินรายแปลงหรือราคาซื้อขายที่ยืนยันแล้ว"
                    : "These figures are neighborhood screening estimates, not a parcel-specific official appraisal or a verified transaction price.")}
            </p>
            {isOfficialReference && price.reference_source_url && (
              <a href={price.reference_source_url} target="_blank" rel="noreferrer" className="mt-2 mr-3 inline-flex font-semibold text-[#806433] underline underline-offset-2 hover:text-[#5e4b28]">
                {isTh ? "ดูชุดข้อมูลต้นทาง ↗" : "View source dataset ↗"}
              </a>
            )}
            {price.official_lookup_url && (
              <a
                href={price.official_lookup_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex font-semibold text-[#806433] underline underline-offset-2 hover:text-[#5e4b28]"
              >
                {isTh ? "ตรวจราคาประเมินรายแปลงกับกรมธนารักษ์ ↗" : "Check the official parcel appraisal ↗"}
              </a>
            )}
          </div>
        </div>
      )}

      {/* AI Investment Memo */}
      {d.investment_memo && (
        <InvestmentMemoCard memo={d.investment_memo} />
      )}

      {/* Transit & Landmark Highlights */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-[#dce7da] bg-white p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5e7962]">
            <TrainIcon className="h-4 w-4 text-[#5e7962]" />
            <span>{t("detail.nearest_transit")}</span>
          </div>
          <div className="mt-2 truncate text-[13px] font-semibold text-[#2d4031]">
            {ctx?.transit_walk?.station_name || "BTS/MRT Station"}
          </div>
          <div className="mt-1 text-xs text-[#5e7962]">
            {ctx?.transit_walk?.distance_m != null ? (
              ctx.transit_walk.distance_m <= 1500 ? (
                <>
                  <span className="font-semibold">{formatDist(ctx.transit_walk.distance_m, lang)}</span>
                  {ctx.transit_walk.walk_time_min && (
                    <span> · {t("detail.walk_approx")} {ctx.transit_walk.walk_time_min} {t("detail.mins")}</span>
                  )}
                </>
              ) : (
                <>
                  <span className="font-semibold">{formatDist(ctx.transit_walk.distance_m, lang)}</span>
                  <span className="text-zinc-500 font-normal"> · &gt; 1.5 km</span>
                </>
              )
            ) : (
              t("detail.no_station_near")
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#dce7da] bg-white p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5e7962]">
            <MapPinIcon className="h-4 w-4 text-[#5e7962]" />
            <span>{t("detail.nearest_landmark")}</span>
          </div>
          <div className="mt-2 truncate text-[13px] font-semibold text-[#2d4031]" title={isTh ? ctx?.nearest_landmark?.name_th : ctx?.nearest_landmark?.name_en}>
            {(isTh ? ctx?.nearest_landmark?.name_th : ctx?.nearest_landmark?.name_en) || ctx?.nearest_landmark?.name_th || "Landmark"}
          </div>
          <div className="mt-1 text-xs text-[#5e7962]">
            ~{formatDist(ctx?.nearest_landmark?.distance_m, lang)}
          </div>
        </div>
      </div>

      {/* Secondary Notable Nearby Landmarks (Real-world Hubs) */}
      {ctx?.nearby_landmarks && ctx.nearby_landmarks.length > 1 && (
        <div className="rounded-2xl border border-[#dce7da] bg-white px-3 py-3 text-xs">
          <span className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#5e7962]">
            <LandmarkIcon className="h-4 w-4 text-[#5e7962]" />
            <span>{t("detail.other_landmarks")}</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ctx.nearby_landmarks.map((lm, idx) => {
              const lmLabel = isTh ? lm.name_th.split(" (")[0] : (lm.name_en || lm.name_th.split(" (")[0]);
              return (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-full border border-[#e0e9dd] bg-[#f7faf5] px-2.5 py-1 text-[11px] text-[#3e5546]"
                >
                  <MapPinIcon className="h-3 w-3 text-[#6d9475]" />
                  <span className="font-medium">{lmLabel}</span>
                  <span className="font-mono text-[10px] text-[#6e8a72]">({formatDist(lm.distance_m, lang)})</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Street-Level Visual Indices */}
      {d.street_visual && (
        <StreetLevelCard
          data={d.street_visual}
          streetViewLink={d.multimodal_visual?.street_view_link}
          mapillaryLink={d.multimodal_visual?.mapillary_link}
        />
      )}

      {/* 9 Dimensions Breakdown */}
      <div className="rounded-[20px] border border-[#dfe7dc] bg-white p-4 shadow-[0_5px_20px_rgba(39,62,43,0.035)]">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#304837]">
          <BarChart3Icon className="h-4 w-4 text-[#5e7962]" />
          <span>{t("detail.dimensions_title")}</span>
        </h3>
        <div className="mt-4 space-y-3">
          {DIMENSIONS.map((dim) => {
            const score = d.dimensions[dim] ?? 0;
            const contrib = d.contributions[dim] ?? 0;
            const label = getDimLabel(dim, lang);
            return (
              <div key={dim} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-700 truncate">
                    {label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400">+{contrib.toFixed(1)} {t("detail.points")}</span>
                    <span className="w-7 text-right font-mono text-xs font-bold text-zinc-800 tabular-nums">
                      {score.toFixed(0)}
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor(score)}`}
                    style={{ width: `${Math.max(3, score)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Positive & Negative Factors */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
            <ThumbsUpIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t("detail.strengths_title")}</span>
          </h3>
          <ul className="mt-2 space-y-1.5">
            {d.positive_factors.length === 0 && (
              <li className="text-xs text-zinc-400">{t("detail.no_strengths")}</li>
            )}
            {d.positive_factors.map((p) => (
              <li key={p.dimension} className="rounded-lg bg-white/80 p-2 text-xs border border-emerald-100">
                <div className="flex items-baseline justify-between">
                  <span className="font-bold text-emerald-900 capitalize">
                    {getDimLabel(p.dimension, lang)}
                  </span>
                  <span className="font-bold text-emerald-700">{p.score.toFixed(0)}</span>
                </div>
                <span className="text-[10px] text-emerald-600 block mt-0.5">
                  {t("detail.adds_score")} +{p.contribution.toFixed(1)} {t("detail.points")}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
            <AlertTriangleIcon className="w-3.5 h-3.5 text-rose-600" />
            <span>{t("detail.cautions_title")}</span>
          </h3>
          <ul className="mt-2 space-y-1.5">
            {d.negative_factors.length === 0 && (
              <li className="text-xs text-zinc-400">{t("detail.no_cautions")}</li>
            )}
            {d.negative_factors.map((n) => (
              <li key={n.dimension} className="rounded-lg bg-white/80 p-2 text-xs border border-rose-100">
                <div className="flex items-baseline justify-between">
                  <span className="font-bold text-rose-900 capitalize">
                    {getDimLabel(n.dimension, lang)}
                  </span>
                  <span className="font-bold text-rose-700">{n.score.toFixed(0)}</span>
                </div>
                <span className="text-[10px] text-rose-500 block mt-0.5">
                  {t("detail.below_par")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Comparable Neighborhoods */}
      {d.comparables && d.comparables.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
            <LayersIcon className="w-3.5 h-3.5 text-zinc-400" />
            <span>{t("detail.comparables_title")}</span>
          </h3>
          <div className="mt-2 space-y-1 text-xs">
            {d.comparables.map((c) => (
              <div key={c.hex_id} className="flex justify-between rounded-lg bg-zinc-50 px-2.5 py-1.5">
                <span className="font-mono text-zinc-700">{c.hex_id}</span>
                <span className="text-zinc-500 font-medium">
                  {t("detail.similarity")} {c.feature_distance.toFixed(1)} · Quality {c.quality.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

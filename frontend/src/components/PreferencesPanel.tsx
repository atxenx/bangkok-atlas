"use client";

import { useEffect, useState } from "react";
import {
  DIMENSIONS,
  fetchPresets,
  type Dimension,
  type DistrictFeature,
  type Preset,
} from "@/lib/api";
import { useLanguage, formatPricePerSqWah, getDimLabel } from "@/lib/i18n";
import {
  TargetIcon,
  LandmarkIcon,
  SlidersIcon,
  RocketIcon,
  SparklesIcon,
  ScaleIcon,
  TrainIcon,
  TreesIcon,
  BuildingOfficeIcon,
  ShoppingBagIcon,
  CoinsIcon,
} from "@/components/icons";

interface Props {
  weights: Record<Dimension, number>;
  onWeights: (w: Record<Dimension, number>) => void;
  budget: string;
  onBudget: (v: string) => void;
  landSize: string;
  onLandSize: (v: string) => void;
  landUse: string;
  onLandUse: (v: string) => void;
  district?: string;
  onDistrict?: (d: string) => void;
  districtsList?: DistrictFeature[];
  onRecommend: (targetWeights?: Record<Dimension, number>) => void;
  loading: boolean;
}

export default function PreferencesPanel({
  weights,
  onWeights,
  budget,
  onBudget,
  landSize,
  onLandSize,
  landUse,
  onLandUse,
  district = "",
  onDistrict,
  districtsList = [],
  onRecommend,
  loading,
}: Props) {
  const { t, lang, isTh } = useLanguage();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>("balanced");
  const [showSliders, setShowSliders] = useState(true);

  useEffect(() => {
    fetchPresets()
      .then((res) => setPresets(res.presets || []))
      .catch(() => setPresets([]));
  }, []);

  const handleApplyPreset = (p: Preset) => {
    setActivePresetId(p.id);
    const newWeights = { ...p.weights };
    onWeights(newWeights);
    onRecommend(newWeights);
  };

  const handleSliderChange = (d: Dimension, val: number) => {
    setActivePresetId(null);
    onWeights({ ...weights, [d]: val });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-[#253b2e]">
            {t("pref.title")}
          </h2>
          <span className="rounded-full border border-[#d9e7da] bg-[#edf4ec] px-2.5 py-1 text-[11px] font-medium text-[#456d51]">
            {isTh ? "ปรับได้ 9 มิติ" : "9 adjustable measures"}
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-6 text-[#68786c]">
          {t("pref.desc")}
        </p>
      </div>

      {/* Preset Personas */}
      <div>
        <label className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-[#304837]">
          <TargetIcon className="h-4 w-4 text-[#5b8667]" />
          <span>{t("pref.presets")}</span>
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {presets.map((p) => {
            const isActive = activePresetId === p.id;
            const isGolden = p.id === "golden_location";
            const presetName = isTh ? p.name_th : p.name_en;
            const presetDesc = isTh ? p.description_th : p.description_en;

            const renderIcon = () => {
              switch (p.id) {
                case "golden_location":
                  return <SparklesIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
                case "balanced":
                  return <ScaleIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
                case "transit_commuter":
                case "transit_first":
                  return <TrainIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />;
                case "green_family":
                case "green_haven":
                  return <TreesIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
                case "urban_lifestyle":
                  return <ShoppingBagIcon className="w-3.5 h-3.5 text-pink-600 shrink-0" />;
                case "prime_cbd":
                case "commercial_hub":
                  return <BuildingOfficeIcon className="w-3.5 h-3.5 text-purple-600 shrink-0" />;
                case "budget_growth":
                  return <CoinsIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
                default:
                  return <TargetIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />;
              }
            };

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleApplyPreset(p)}
                aria-pressed={isActive}
                className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors ${
                  isActive
                    ? isGolden
                      ? "border-[#d6b870] bg-[#fcf5df] font-semibold text-[#6d5425]"
                      : "border-[#8eb59a] bg-[#e8f2e9] font-semibold text-[#27563d]"
                    : isGolden
                    ? "border-[#e7d9b1] bg-[#fbf7ec] font-semibold text-[#6d5425] hover:bg-[#f7eed8]"
                    : "border-[#dfe7dc] bg-white text-[#4f6354] hover:border-[#a8c1ab] hover:bg-[#f5f8f3]"
                }`}
                title={presetDesc}
              >
                {renderIcon()}
                <span className={`truncate ${isGolden ? "font-bold text-amber-950" : ""}`}>
                  {presetName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders Accordion */}
      <div className="rounded-[20px] border border-[#dfe7dc] bg-white p-4 shadow-[0_5px_20px_rgba(39,62,43,0.035)]">
        <button
          type="button"
          onClick={() => setShowSliders(!showSliders)}
          aria-expanded={showSliders}
          aria-controls="preference-sliders"
          className="flex w-full items-center justify-between text-[13px] font-semibold text-[#304837]"
        >
          <span className="flex items-center gap-1.5">
            <SlidersIcon className="h-4 w-4 text-[#5d8066]" />
            <span>{showSliders ? t("pref.sliders_toggle_hide") : t("pref.sliders_toggle_show")}</span>
          </span>
          <span className="text-[#8ca18d]">{showSliders ? "⌃" : "⌄"}</span>
        </button>

        {showSliders && (
          <div id="preference-sliders" className="mt-4 space-y-3 divide-y divide-[#edf1e9]">
            {DIMENSIONS.map((d) => {
              const label = getDimLabel(d, lang);
              const val = weights[d] ?? 50;
              return (
                <div key={d} className="pt-3 first:pt-0">
                  <div className="mb-2 flex items-center justify-between gap-2 text-[13px]">
                    <span className="font-medium text-[#3e5443]">
                      {label}
                    </span>
                    <span className="min-w-7 text-right font-mono text-xs font-semibold text-[#3d7451]">
                      {val}
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label={label}
                    min={0}
                    max={100}
                    step={1}
                    value={val}
                    onChange={(e) => handleSliderChange(d, Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e2e9e1] accent-[#3d7451]"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Budget is retained for user context, but not used as a purchase-price filter. */}
      <div className="space-y-4 rounded-[20px] border border-[#dfe7dc] bg-white p-4 shadow-[0_5px_20px_rgba(39,62,43,0.035)]">
        <div className="flex items-center justify-between">
          <label htmlFor="budget-input" className="text-[13px] font-semibold text-[#304837]">
            {t("pref.budget")}
          </label>
          <div className="flex gap-1.5 text-[11px]">
            {["5000000", "10000000", "20000000"].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => onBudget(budget === b ? "" : b)}
                aria-pressed={budget === b}
                className={`rounded-full border px-2.5 py-1 font-medium transition-colors ${
                  budget === b
                    ? "border-[#315c43] bg-[#315c43] text-white"
                    : "border-[#dce6dc] bg-[#f7faf6] text-[#607363] hover:bg-[#edf4eb]"
                }`}
              >
                ฿{Number(b) / 1000000}M
              </button>
            ))}
          </div>
        </div>
        <input
          id="budget-input"
          type="number"
          value={budget}
          onChange={(e) => onBudget(e.target.value)}
          placeholder={t("pref.budget_placeholder")}
          className="w-full rounded-xl border border-[#d9e3d8] bg-[#fcfdfb] px-3 py-2.5 text-sm text-[#293d30] placeholder:text-[#91a094] focus:border-[#6d9c78] focus:outline-none focus:ring-2 focus:ring-[#d9e9da]"
        />
        <p className="text-[11px] leading-5 text-[#786744]">
          {isTh
            ? "งบที่กรอกยังไม่ใช้กรองหรือจัดอันดับ: ข้อมูลราคาประเมินระดับระวางไม่ใช่ราคาของแปลงที่เลือก"
            : "Budget is not used to filter or rank: map-sheet appraisals do not price the selected parcel."}
        </p>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label htmlFor="land-size-input" className="mb-2 block text-[13px] font-semibold text-[#304837]">
              {t("pref.land_size")}
            </label>
            <input
              id="land-size-input"
              type="number"
              value={landSize}
              onChange={(e) => onLandSize(e.target.value)}
              placeholder={t("pref.land_size_placeholder")}
              className="w-full rounded-xl border border-[#d9e3d8] bg-[#fcfdfb] px-3 py-2.5 text-sm text-[#293d30] placeholder:text-[#91a094] focus:border-[#6d9c78] focus:outline-none focus:ring-2 focus:ring-[#d9e9da]"
            />
          </div>
          <div>
            <label htmlFor="land-use-select" className="mb-2 block text-[13px] font-semibold text-[#304837]">
              {t("pref.land_use")}
            </label>
            <select
              id="land-use-select"
              value={landUse}
              onChange={(e) => onLandUse(e.target.value)}
              className="w-full rounded-xl border border-[#d9e3d8] bg-[#fcfdfb] px-3 py-2.5 text-sm text-[#293d30] focus:border-[#6d9c78] focus:outline-none focus:ring-2 focus:ring-[#d9e9da]"
            >
              <option value="">{t("pref.land_use_all")}</option>
              <option value="residential">{t("pref.land_use_res")}</option>
              <option value="commercial">{t("pref.land_use_comm")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 50 Administrative Districts Filter */}
      <div className="space-y-3 rounded-[20px] border border-[#dfe7dc] bg-white p-4 shadow-[0_5px_20px_rgba(39,62,43,0.035)]">
        <div className="flex items-center justify-between">
          <label htmlFor="district-select" className="flex items-center gap-2 text-[13px] font-semibold text-[#304837]">
            <LandmarkIcon className="h-4 w-4 text-[#5d8066]" />
            <span>{t("pref.district_filter")}</span>
          </label>
          {district && (
            <button
              type="button"
              onClick={() => onDistrict?.("")}
              className="text-xs font-medium text-[#3d7451] underline underline-offset-2 hover:text-[#24533e]"
            >
              {isTh ? "ล้างตัวกรอง ✕" : "Clear filter ✕"}
            </button>
          )}
        </div>

        <select
          id="district-select"
          value={district}
          onChange={(e) => onDistrict?.(e.target.value)}
          className="w-full rounded-xl border border-[#d9e3d8] bg-[#fcfdfb] px-3 py-2.5 text-sm font-medium text-[#293d30] focus:border-[#6d9c78] focus:outline-none focus:ring-2 focus:ring-[#d9e9da]"
        >
          <option value="">{t("pref.all_districts")}</option>
          {districtsList.map((d) => (
            <option key={d.properties.code} value={d.properties.name_en}>
              {isTh
                ? `เขต${d.properties.name_th} (${d.properties.zone_tier})`
                : `${d.properties.name_en} District (${d.properties.zone_tier})`}
            </option>
          ))}
        </select>

        {(() => {
          const currentDistrict = districtsList.find(
            (d) =>
              d.properties.name_en.toLowerCase() === district.toLowerCase() ||
              d.properties.name_th === district
          );
          if (!currentDistrict) return null;
          return (
            <div className="mt-2 space-y-2 rounded-xl border border-[#dfe9dd] bg-[#f6faf4] p-3 text-xs">
              <div className="flex items-center justify-between font-semibold text-[#304837]">
                <span>
                  {isTh
                    ? `เขต${currentDistrict.properties.name_th} (${currentDistrict.properties.name_en})`
                    : `${currentDistrict.properties.name_en} District`}
                </span>
                <span className="rounded-full bg-[#e6f0e5] px-2 py-0.5 text-[10px] font-semibold text-[#426a4b]">
                  {currentDistrict.properties.zone_tier}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-zinc-400 text-[10px]">
                    {isTh ? "คะแนนคุณภาพเฉลี่ย" : "Avg Quality Score"}
                  </span>
                  <div className="font-semibold text-[#3d7451]">
                    {currentDistrict.properties.quality}/100
                  </div>
                </div>
                <div>
                  <span className="text-zinc-400 text-[10px]">
                    {currentDistrict.properties.price_source === "treasury_district_reference"
                      ? (isTh ? "ค่ากลางราคาประเมินระดับเขต" : "District appraisal median")
                      : (isTh ? "ค่าฐานแบบจำลองระดับเขต" : "District Model Baseline")}
                  </span>
                  <div className="font-semibold text-[#806a3b]">
                    {formatPricePerSqWah(currentDistrict.properties.assessed_price_sqwah, lang)}
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-zinc-500 pt-0.5 flex items-center gap-2">
                <span><TrainIcon className="w-3 h-3 inline text-sky-600 mr-1" />{currentDistrict.properties.transit_stations_count} {isTh ? "สถานี" : "Stations"}</span>
                <span>·</span>
                <span>{currentDistrict.properties.cells_count} {isTh ? "แปลง" : "Cells"}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={() => onRecommend()}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#294637] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(35,68,46,0.13)] transition-colors hover:bg-[#365d48] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {t("pref.btn_recommending")}
          </>
        ) : (
          <>
            <RocketIcon className="w-4 h-4" />
            <span>{t("pref.btn_recommend")}</span>
          </>
        )}
      </button>
    </div>
  );
}

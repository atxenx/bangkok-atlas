"use client";

import type { StreetVisualIndices } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import {
  BuildingOfficeIcon,
  TreesIcon,
  FootprintsIcon,
  CloudSunIcon,
  NavigationIcon,
  LayersIcon,
} from "@/components/icons";

interface Props {
  data: StreetVisualIndices;
  streetViewLink?: string;
  mapillaryLink?: string;
}

interface GaugeProps {
  label: string;
  sublabel: string;
  score: number;
  colorClass: string;
  bgClass: string;
  icon: React.ReactNode;
  lowLabel: string;
  highLabel: string;
}

function Gauge({ label, sublabel, score, colorClass, bgClass, icon, lowLabel, highLabel }: GaugeProps) {
  const pct = Math.max(3, Math.min(100, score));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
            {icon}
            <span>{label}</span>
          </div>
          <div className="text-[10px] text-zinc-400">{sublabel}</div>
        </div>
        <span className={`text-sm font-extrabold tabular-nums ${colorClass}`}>
          {score.toFixed(0)}
        </span>
      </div>

      {/* Track */}
      <div className={`h-2.5 w-full rounded-full ${bgClass} overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ${colorClass.replace("text-", "bg-")}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Range labels */}
      <div className="flex justify-between text-[9px] text-zinc-400">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

const CHARACTER_STYLE: Record<string, { bg: string; text: string }> = {
  urban_dense:       { bg: "bg-rose-100",    text: "text-rose-800" },
  urban_mixed:       { bg: "bg-orange-100",  text: "text-orange-800" },
  mixed_urban:       { bg: "bg-amber-100",   text: "text-amber-800" },
  green_residential: { bg: "bg-emerald-100", text: "text-emerald-800" },
  suburban_open:     { bg: "bg-sky-100",     text: "text-sky-800" },
  low_density:       { bg: "bg-zinc-100",    text: "text-zinc-700" },
};

export default function StreetLevelCard({ data, streetViewLink, mapillaryLink }: Props) {
  const { t, isTh } = useLanguage();
  const charStyle = CHARACTER_STYLE[data.street_character] ?? CHARACTER_STYLE.low_density;

  const characterLabel = isTh
    ? (data.street_character_label_th || data.street_character_label)
    : (data.street_character_label_en || data.street_character_label);

  return (
    <div className="overflow-hidden rounded-[20px] border border-[#dce7dc] bg-white shadow-[0_5px_20px_rgba(39,62,43,0.035)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e5ece3] px-4 pb-3 pt-4">
        <div className="flex items-center gap-1.5">
          <BuildingOfficeIcon className="h-4 w-4 text-[#5f8267]" />
          <span className="text-[13px] font-semibold text-[#315540]">
            {t("street.title")}
          </span>
          <span className="text-[9px] text-zinc-400 font-mono">({t("street.osm_tag")})</span>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${charStyle.bg} ${charStyle.text}`}>
          {characterLabel}
        </span>
      </div>

      {/* Gauges */}
      <div className="px-3.5 py-3 space-y-3.5">
        <Gauge
          icon={<TreesIcon className="w-4 h-4 text-emerald-600" />}
          label={t("street.canopy_label")}
          sublabel={t("street.canopy_sub")}
          score={data.green_canopy_score}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-100"
          lowLabel={t("street.canopy_low")}
          highLabel={t("street.canopy_high")}
        />
        <Gauge
          icon={<FootprintsIcon className="w-4 h-4 text-sky-600" />}
          label={t("street.sidewalk_label")}
          sublabel={t("street.sidewalk_sub")}
          score={data.sidewalk_quality}
          colorClass="text-sky-600"
          bgClass="bg-sky-100"
          lowLabel={t("street.sidewalk_low")}
          highLabel={t("street.sidewalk_high")}
        />
        <Gauge
          icon={<CloudSunIcon className="w-4 h-4 text-violet-600" />}
          label={t("street.sky_label")}
          sublabel={t("street.sky_sub")}
          score={data.sky_openness}
          colorClass="text-violet-600"
          bgClass="bg-violet-100"
          lowLabel={t("street.sky_low")}
          highLabel={t("street.sky_high")}
        />
      </div>

      {/* Street View links */}
      {(streetViewLink || mapillaryLink) && (
        <div className="px-3.5 pb-3 flex gap-2">
          {streetViewLink && (
            <a
              href={streetViewLink}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white/80 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
            >
              <NavigationIcon className="w-3 h-3 text-zinc-500" />
              <span>{t("street.btn_streetview")}</span>
            </a>
          )}
          {mapillaryLink && (
            <a
              href={mapillaryLink}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white/80 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
            >
              <LayersIcon className="w-3 h-3 text-zinc-500" />
              <span>{t("street.btn_mapillary")}</span>
            </a>
          )}
        </div>
      )}

      {/* Methodology note */}
      <div className="px-3.5 pb-2.5 text-[9px] text-zinc-400 leading-snug">
        {t("street.methodology")}
      </div>
    </div>
  );
}

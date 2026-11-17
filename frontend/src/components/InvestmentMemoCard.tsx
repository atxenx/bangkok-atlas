"use client";

import type { InvestmentMemo } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import {
  BotIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  TargetIcon,
  CoinsIcon,
} from "@/components/icons";

interface Props {
  memo: InvestmentMemo;
}

const OUTLOOK_STYLES: Record<
  string,
  { border: string; bg: string; badge: string; badgeText: string; headerText: string }
> = {
  prime: {
    border: "border-[#c8dfce]",
    bg: "bg-[#f1f7ef]",
    badge: "bg-[#dcefe0]",
    badgeText: "text-[#315d43]",
    headerText: "text-[#315540]",
  },
  high: {
    border: "border-[#d2e1d1]",
    bg: "bg-[#f4f8f1]",
    badge: "bg-[#e6f0e2]",
    badgeText: "text-[#426b52]",
    headerText: "text-[#426b52]",
  },
  stable: {
    border: "border-[#dce7dc]",
    bg: "bg-white",
    badge: "bg-[#edf3ed]",
    badgeText: "text-[#526e59]",
    headerText: "text-[#3d5945]",
  },
  cautious: {
    border: "border-[#e8ddbf]",
    bg: "bg-[#fffcf4]",
    badge: "bg-[#f5e7bc]",
    badgeText: "text-[#6e572e]",
    headerText: "text-[#6e572e]",
  },
  limited: {
    border: "border-[#dfe7dc]",
    bg: "bg-[#f6f8f4]",
    badge: "bg-[#e8ece6]",
    badgeText: "text-[#5f6f61]",
    headerText: "text-[#4b5d4e]",
  },
};

export default function InvestmentMemoCard({ memo }: Props) {
  const { t, isTh } = useLanguage();
  const style = OUTLOOK_STYLES[memo.investment_outlook] ?? OUTLOOK_STYLES.stable;

  const outlookLabel = isTh
    ? (memo.outlook_label_th || memo.outlook_label)
    : (memo.outlook_label_en || memo.outlook_label);

  const summary = isTh
    ? (memo.executive_summary_th || memo.executive_summary)
    : (memo.executive_summary_en || memo.executive_summary);

  const strengths = isTh
    ? (memo.strengths_th || memo.strengths)
    : (memo.strengths_en || memo.strengths);

  const considerations = isTh
    ? (memo.considerations_th || memo.considerations)
    : (memo.considerations_en || memo.considerations);

  const useCases = isTh
    ? (memo.use_cases_th || memo.use_cases)
    : (memo.use_cases_en || memo.use_cases);

  return (
    <div
      className={`overflow-hidden rounded-[20px] border ${style.border} ${style.bg} shadow-[0_5px_20px_rgba(39,62,43,0.035)]`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <BotIcon className={`w-4 h-4 ${style.headerText}`} />
          <span className={`text-[13px] font-semibold ${style.headerText}`}>
            {t("memo.title")}
          </span>
          <span className="hidden text-[10px] text-[#829083] sm:inline">({t("memo.local_tag")})</span>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${style.badge} ${style.badgeText}`}
        >
          {outlookLabel}
        </span>
      </div>

      {/* Executive Summary */}
      <div className="border-b border-[#e5ece3] px-4 pb-4">
        <p className="text-[13px] leading-6 text-[#536456]">
          {summary}
        </p>
      </div>

      {/* Strengths */}
      {strengths.length > 0 && (
        <div className="px-3.5 py-2.5 border-b border-zinc-100">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5">
            <CheckCircle2Icon className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t("memo.strengths_title")}</span>
          </div>
          <ul className="space-y-1">
            {strengths.map((s, i) => (
              <li
                key={i}
                className="text-[11px] text-zinc-700 leading-snug flex gap-1.5"
              >
                <span className="text-zinc-300 shrink-0">·</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risk Considerations */}
      {considerations.length > 0 && (
        <div className="px-3.5 py-2.5 border-b border-zinc-100">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">
            <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-600" />
            <span>{t("memo.cautions_title")}</span>
          </div>
          <ul className="space-y-1">
            {considerations.map((c, i) => (
              <li
                key={i}
                className="text-[11px] text-zinc-600 leading-snug flex gap-1.5"
              >
                <span className="text-zinc-300 shrink-0">·</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Use Cases */}
      {useCases.length > 0 && (
        <div className="px-3.5 py-2.5 border-b border-zinc-100">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-violet-700 uppercase tracking-wider mb-1.5">
            <TargetIcon className="w-3.5 h-3.5 text-violet-600" />
            <span>{t("memo.use_cases_title")}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {useCases.map((uc, i) => (
              <span
                key={i}
                className="rounded-md bg-white border border-violet-200 px-2 py-0.5 text-[11px] text-violet-900 font-medium shadow-2xs"
              >
                {uc}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Yield & Cap Rate */}
      <div className="px-3.5 py-2.5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-medium">
            <CoinsIcon className="w-3 h-3 text-zinc-400" />
            <span>{t("memo.gross_yield")}</span>
          </div>
          <div className="text-sm font-extrabold text-zinc-800 tabular-nums">
            {memo.yield_estimate}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-zinc-400 font-medium">{t("memo.cap_rate")}</div>
          <div className="text-xs font-bold text-zinc-700">{memo.cap_rate_tier}</div>
        </div>
      </div>
      <div className="border-t border-zinc-100 px-3.5 py-2 text-[9px] leading-relaxed text-zinc-400">
        {isTh
          ? "ช่วงผลตอบแทนเป็นฉากทัศน์ระดับโซนเพื่อคัดกรองเท่านั้น เนื่องจากระบบยังไม่มีข้อมูลค่าเช่าและธุรกรรมรายทรัพย์"
          : "Yield ranges are zone-level screening scenarios only; no property-level rent or transaction dataset is used."}
      </div>
    </div>
  );
}

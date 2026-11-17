"use client";

import { useLanguage } from "@/lib/i18n";

export default function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <div aria-label="Language" className="inline-flex items-center rounded-full border border-white/30 bg-white/15 p-0.5 text-white/80">
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          lang === "en"
            ? "bg-white text-[#284434] shadow-sm"
            : "text-white/75 hover:text-white"
        }`}
        title="Switch to English (Default)"
      >
        <span className="text-[13px]">🇬🇧</span>
        <span>EN</span>
      </button>
      <button
        type="button"
        onClick={() => setLang("th")}
        aria-pressed={lang === "th"}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          lang === "th"
            ? "bg-white text-[#284434] shadow-sm"
            : "text-white/75 hover:text-white"
        }`}
        title="เปลี่ยนเป็นภาษาไทย (Switch to Thai)"
      >
        <span className="text-[13px]">🇹🇭</span>
        <span>TH</span>
      </button>
    </div>
  );
}

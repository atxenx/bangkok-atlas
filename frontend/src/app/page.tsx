"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import {
  BuildingOfficeIcon,
  TrainIcon,
  TreesIcon,
  CoinsIcon,
  LayersIcon,
} from "@/components/icons";

const content = {
  th: {
    navFeatures: "สิ่งที่ดูได้",
    navSources: "ข้อมูลที่ใช้",
    navHow: "วิธีใช้งาน",
    openMap: "เปิดแผนที่",
    eyebrow: "แผนที่เพื่อเข้าใจย่านในกรุงเทพฯ",
    heroTitle: "เข้าใจย่าน ก่อนตัดสินใจเรื่องทำเล",
    heroBody: "ดูการเดินทาง สิ่งอำนวยความสะดวก สภาพแวดล้อม และค่ากลางราคาประเมินจากข้อมูลจริงของแต่ละพื้นที่ในที่เดียว",
    seeHow: "ดูวิธีอ่านข้อมูล",
    heroNote: "ราคาอ้างอิงจากระเบียนกรมธนารักษ์ในพื้นที่ใกล้เคียง · ไม่ใช่ราคาประเมินรายแปลงหรือราคาซื้อขาย",
    mapCaption: "เริ่มจากย่านที่คุณสนใจ",
    mapHint: "ค้นหาสถานี เขต หรือสถานที่สำคัญ แล้วดูบริบทโดยรอบบนแผนที่",
    mapLink: "สำรวจแผนที่จริง",
    statDistricts: "เขตในกรุงเทพฯ",
    statDimensions: "มิติที่ใช้ดูคุณภาพย่าน",
    statMap: "ดูอาคารบนแผนที่",
    featuresEyebrow: "มองเห็นภาพรวมก่อนลงลึก",
    featuresTitle: "ข้อมูลที่ช่วยให้เลือกทำเลได้ง่ายขึ้น",
    featuresBody: "เราแยกเรื่องสำคัญออกมาให้ดูทีละด้าน และบอกชัดว่าข้อมูลใดเป็นข้อเท็จจริง ข้อมูลใดเป็นค่าประมาณ",
    feature1Title: "การเดินทางในชีวิตจริง",
    feature1Body: "ดูสถานีรถไฟฟ้าและการเข้าถึงพื้นที่ พร้อมบริบทของถนนและทางเดินใกล้เคียง",
    feature2Title: "ลักษณะของย่าน",
    feature2Body: "เปรียบเทียบร้านค้า พื้นที่สีเขียว ความหนาแน่น และความสงบในบริเวณที่สนใจ",
    feature3Title: "มุมมองด้านราคา",
    feature3Body: "ดูค่ากลางและการกระจายของราคาประเมินจริงในระวาง 500 เมตร พร้อมจำนวนระเบียนและข้อจำกัด",
    sourcesEyebrow: "อ่านที่มาของข้อมูลได้",
    sourcesTitle: "ตัวเลขทุกชุดมีบริบท",
    sourcesBody: "แผนที่ใช้ข้อมูลอาคารและสถานที่จาก OpenStreetMap ร่วมกับโครงข่ายคมนาคม ส่วนราคาใช้ระเบียนราคาประเมินที่ดินเปิดเผยของกรมธนารักษ์และสรุปตามระวางแผนที่",
    sourcesNote: "คะแนนเป็นการประเมินระดับพื้นที่ ไม่ใช่การรับรองคุณภาพอาคารหรือราคาของแปลงที่ดินใดโดยเฉพาะ",
    dimensionsTitle: "ดูย่านผ่าน 9 มุมมอง",
    dimensions: [
      "การเดินทาง", "สิ่งอำนวยความสะดวก", "การเดินเท้า",
      "พื้นที่สีเขียว", "โครงข่ายถนน", "กิจกรรมเชิงพาณิชย์",
      "ที่อยู่อาศัย", "ความสงบ", "สิ่งแวดล้อม",
    ],
    howEyebrow: "เริ่มต้นได้ในไม่กี่คลิก",
    howTitle: "เลือกพื้นที่ แล้วค่อยดูรายละเอียด",
    howSteps: [
      { title: "ค้นหาย่าน", body: "พิมพ์ชื่อสถานี เขต หรือสถานที่ที่คุ้นเคย" },
      { title: "ดูบนแผนที่", body: "สลับมุมมองและคลิกพื้นที่หรืออาคารที่สนใจ" },
      { title: "อ่านผลอย่างเข้าใจ", body: "ดูคะแนน ปัจจัยที่เกี่ยวข้อง และข้อจำกัดของราคา" },
    ],
    ctaTitle: "เริ่มจากทำเลที่คุณอยากรู้จัก",
    ctaBody: "เปิดแผนที่แล้วสำรวจกรุงเทพฯ ในจังหวะของคุณ",
    footer: "แผนที่วิเคราะห์บริบททำเลในกรุงเทพฯ",
    footerSource: "ข้อมูลสาธารณะ · ผลวิเคราะห์ระดับพื้นที่",
  },
  en: {
    navFeatures: "Explore",
    navSources: "Our data",
    navHow: "How it works",
    openMap: "Open the map",
    eyebrow: "A clearer view of Bangkok's neighborhoods",
    heroTitle: "Know the neighborhood before you choose the location",
    heroBody: "See transit, everyday amenities, surroundings, and nearby official appraisal summaries in one place.",
    seeHow: "How to read the data",
    heroNote: "Treasury appraisal records from nearby sheets · Not a parcel appraisal or sale price",
    mapCaption: "Start with a place you know",
    mapHint: "Search for a station, district, or landmark, then explore the surrounding area.",
    mapLink: "Explore the live map",
    statDistricts: "Bangkok districts",
    statDimensions: "neighborhood measures",
    statMap: "building map view",
    featuresEyebrow: "The big picture, without the noise",
    featuresTitle: "The essentials for understanding a location",
    featuresBody: "Look at one question at a time, with a clear distinction between observed data and estimates.",
    feature1Title: "Getting around",
    feature1Body: "Explore nearby rail stations, local access, and the street and walking network.",
    feature2Title: "The feel of the area",
    feature2Body: "Compare daily services, green space, density, and quieter surroundings.",
    feature3Title: "A careful price view",
    feature3Body: "See the median and spread of real appraisal records in a nearby 500 m sheet, with sample size and caveats.",
    sourcesEyebrow: "Sources you can understand",
    sourcesTitle: "Every number has context",
    sourcesBody: "The map combines OpenStreetMap buildings and places with transit networks. Prices summarize public Treasury Department appraisal records by map sheet.",
    sourcesNote: "Scores describe an area. They are not a certification of a building or a valuation of a specific plot.",
    dimensionsTitle: "Nine ways to look at a neighborhood",
    dimensions: [
      "Transit", "Daily amenities", "Walkability",
      "Green space", "Road network", "Commercial activity",
      "Residential balance", "Quietness", "Environment",
    ],
    howEyebrow: "A simple place to start",
    howTitle: "Choose an area, then look closer",
    howSteps: [
      { title: "Find a place", body: "Search for a station, district, or familiar landmark." },
      { title: "Explore the map", body: "Change the view and select an area or building." },
      { title: "Read the context", body: "See the score, contributing factors, and price caveats." },
    ],
    ctaTitle: "Start with a place you're curious about",
    ctaBody: "Open the map and explore Bangkok at your own pace.",
    footer: "A neighborhood context map for Bangkok",
    footerSource: "Public data · Area-level analysis",
  },
} as const;

export default function LandingPage() {
  const { lang, setLang } = useLanguage();
  const c = content[lang];

  return (
    <div className="min-h-screen bg-[#f6f6f2] text-[#1e2b29] selection:bg-[#c7ddd2] selection:text-[#1e2b29]">
      <header className="sticky top-3 z-50 px-3 sm:top-5 sm:px-6">
        <nav aria-label="Main navigation" className="landing-glass-nav mx-auto flex max-w-6xl items-center gap-3 rounded-full px-3 py-2 sm:px-4">
          <Link href="/" className="relative z-10 flex min-w-0 items-center gap-2.5 rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/45 bg-white/10 text-[17px] font-semibold">B</span>
            <span className="whitespace-nowrap text-sm font-semibold tracking-tight sm:text-base">Bangkok <span className="font-normal text-white/75">Atlas</span></span>
          </Link>

          <div className="relative z-10 ml-7 hidden items-center gap-7 text-[13px] text-white/75 lg:flex">
            <a className="transition hover:text-white" href="#features">{c.navFeatures}</a>
            <a className="transition hover:text-white" href="#sources">{c.navSources}</a>
            <a className="transition hover:text-white" href="#how">{c.navHow}</a>
          </div>

          <div className="relative z-10 ml-auto flex items-center gap-2">
            <div aria-label="Language" className="flex items-center rounded-full border border-white/30 bg-white/15 p-0.5 text-[11px] font-semibold text-white/80 sm:text-xs">
              <button type="button" onClick={() => setLang("th")} aria-pressed={lang === "th"} className={`rounded-full px-2.5 py-1.5 transition ${lang === "th" ? "bg-white text-[#24342f] shadow-sm" : "hover:text-white"}`}>TH</button>
              <button type="button" onClick={() => setLang("en")} aria-pressed={lang === "en"} className={`rounded-full px-2.5 py-1.5 transition ${lang === "en" ? "bg-white text-[#24342f] shadow-sm" : "hover:text-white"}`}>EN</button>
            </div>
            <Link href="/explore" className="whitespace-nowrap rounded-full bg-white px-3.5 py-2 text-[11px] font-semibold text-[#1b2926] shadow-sm transition hover:bg-[#e7f0eb] sm:px-5 sm:text-xs">{c.openMap} <span aria-hidden="true">↗</span></Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-20 sm:px-8 md:pt-24 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:pb-28 lg:pt-32">
          <div>
            <p className="mb-7 text-xs font-semibold uppercase tracking-[0.18em] text-[#5c756a]">{c.eyebrow}</p>
            <h1 className="max-w-2xl text-[clamp(2.65rem,5.3vw,5.4rem)] font-semibold leading-[1.08] tracking-[-0.055em] text-[#1b2926]">{c.heroTitle}</h1>
            <p className="mt-7 max-w-xl text-[15px] leading-8 text-[#5b6864] sm:text-[17px]">{c.heroBody}</p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/explore" className="inline-flex items-center gap-3 rounded-full bg-[#263c35] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(28,58,47,0.12)] transition hover:bg-[#365b4b]">{c.openMap}<span aria-hidden="true">↗</span></Link>
              <a href="#how" className="rounded-full px-2 py-3 text-sm font-medium text-[#435b51] underline decoration-[#a7b9ae] underline-offset-4 transition hover:text-[#1b2926]">{c.seeHow}</a>
            </div>
            <p className="mt-8 max-w-xl border-l-2 border-[#b8c9bc] pl-4 text-xs leading-6 text-[#7a8982]">{c.heroNote}</p>
          </div>

          <div className="relative min-h-[390px] overflow-hidden rounded-[30px] border border-[#dce5dc] bg-[#e7ede5] shadow-[0_24px_70px_rgba(34,58,45,0.09)] sm:min-h-[480px]" aria-label="Decorative map preview">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.28)_1px,transparent_1px)] bg-[size:35px_35px]" />
            <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 600 510" preserveAspectRatio="xMidYMid slice">
              <path d="M-30 150 C120 125 135 230 280 210 S510 90 640 110" fill="none" stroke="#c8dbe0" strokeWidth="46" strokeLinecap="round" />
              <path d="M-30 150 C120 125 135 230 280 210 S510 90 640 110" fill="none" stroke="#dce9e8" strokeWidth="22" strokeLinecap="round" />
              <path d="M70 -20 L115 530 M255 -30 L305 530 M430 -30 L460 530 M-20 350 L640 300 M-20 420 L640 380 M-20 72 L640 180" fill="none" stroke="#fffdf7" strokeWidth="13" strokeLinecap="round" />
              <path d="M65 -20 L111 530 M249 -30 L298 530 M424 -30 L455 530 M-20 345 L640 295 M-20 415 L640 375 M-20 67 L640 175" fill="none" stroke="#d9dfd4" strokeWidth="2" strokeLinecap="round" />
              <path d="M342 267 C390 236 450 261 467 303 C440 340 379 343 345 316 Z" fill="#b6d1b7" opacity=".85" />
              <path d="M73 270 C112 252 145 260 158 292 C140 322 95 322 75 303 Z" fill="#bbd5bc" opacity=".85" />
              <path d="M110 370 C207 341 294 367 394 324" fill="none" stroke="#608778" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 13" />
              <circle cx="111" cy="369" r="8" fill="#426b5a" stroke="#f6f7f2" strokeWidth="5" />
              <circle cx="295" cy="351" r="8" fill="#426b5a" stroke="#f6f7f2" strokeWidth="5" />
              <circle cx="394" cy="324" r="8" fill="#426b5a" stroke="#f6f7f2" strokeWidth="5" />
            </svg>
            <div className="absolute left-5 top-5 rounded-full border border-white/80 bg-white/70 px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-[#466254] backdrop-blur-lg">BANGKOK · 50 DISTRICTS</div>
            <div className="absolute bottom-5 left-5 right-5 rounded-[22px] border border-white/75 bg-white/85 p-5 shadow-[0_14px_38px_rgba(43,67,53,0.1)] backdrop-blur-xl sm:bottom-7 sm:left-7 sm:right-7 sm:p-6">
              <p className="text-base font-semibold tracking-tight text-[#1c3028] sm:text-lg">{c.mapCaption}</p>
              <p className="mt-1.5 max-w-sm text-xs leading-6 text-[#66776e] sm:text-sm">{c.mapHint}</p>
              <Link href="/explore" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#315f47] hover:text-[#1e4634]">{c.mapLink}<span aria-hidden="true">↗</span></Link>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-6xl grid-cols-3 border-y border-[#dfe5db] px-5 py-7 sm:px-8">
          <div><div className="text-2xl font-semibold tracking-tight text-[#263a32] sm:text-3xl">50</div><p className="mt-1 text-[11px] leading-5 text-[#78867e] sm:text-xs">{c.statDistricts}</p></div>
          <div className="border-l border-[#dfe5db] pl-5 sm:pl-10"><div className="text-2xl font-semibold tracking-tight text-[#263a32] sm:text-3xl">9</div><p className="mt-1 text-[11px] leading-5 text-[#78867e] sm:text-xs">{c.statDimensions}</p></div>
          <div className="border-l border-[#dfe5db] pl-5 sm:pl-10"><div className="text-2xl font-semibold tracking-tight text-[#263a32] sm:text-3xl">3D</div><p className="mt-1 text-[11px] leading-5 text-[#78867e] sm:text-xs">{c.statMap}</p></div>
        </div>

        <section id="features" className="scroll-mt-32 mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#668273]">{c.featuresEyebrow}</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.04em] text-[#1f3029] sm:text-4xl">{c.featuresTitle}</h2>
            <p className="mt-5 text-sm leading-7 text-[#6a7770] sm:text-base">{c.featuresBody}</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { icon: <TrainIcon className="h-5 w-5" />, title: c.feature1Title, body: c.feature1Body },
              { icon: <TreesIcon className="h-5 w-5" />, title: c.feature2Title, body: c.feature2Body },
              { icon: <CoinsIcon className="h-5 w-5" />, title: c.feature3Title, body: c.feature3Body },
            ].map((item, index) => (
              <article key={index} className="rounded-[24px] border border-[#e1e6dd] bg-white/75 p-7 shadow-[0_8px_28px_rgba(37,61,43,0.035)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf2ec] text-[#496f5b]">{item.icon}</div>
                <h3 className="mt-8 text-lg font-semibold tracking-tight text-[#22342a]">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#718078]">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="sources" className="scroll-mt-32 border-y border-[#e1e8dd] bg-[#edf1e9]">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24 lg:py-24">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#668273]">{c.sourcesEyebrow}</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.04em] text-[#22342a] sm:text-4xl">{c.sourcesTitle}</h2>
            </div>
            <div>
              <p className="text-base leading-8 text-[#4f6256]">{c.sourcesBody}</p>
              <div className="mt-7 rounded-2xl border border-[#cedbce] bg-white/50 px-5 py-4 text-sm leading-7 text-[#5b7060]">{c.sourcesNote}</div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-28">
          <div className="flex items-center gap-3 text-[#4d735d]"><LayersIcon className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.18em]">9 dimensions</span></div>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#22342a] sm:text-4xl">{c.dimensionsTitle}</h2>
          <div className="mt-10 grid gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
            {c.dimensions.map((name, index) => (
              <div key={name} className="flex items-center gap-5 border-b border-[#dfe5db] py-4">
                <span className="w-5 text-xs tabular-nums text-[#9bac9e]">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-sm font-medium text-[#354b3e]">{name}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="scroll-mt-32 border-t border-[#e0e7dc] bg-white/50">
          <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-28">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#668273]">{c.howEyebrow}</p>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.04em] text-[#22342a] sm:text-4xl">{c.howTitle}</h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {c.howSteps.map((step, index) => (
                <div key={step.title} className="border-t border-[#bdcdc0] pt-5">
                  <span className="text-xs font-semibold tabular-nums text-[#78917b]">0{index + 1}</span>
                  <h3 className="mt-5 text-lg font-semibold text-[#26392c]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[#6e7c72]">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-7 rounded-[30px] bg-[#23372f] px-8 py-12 text-white sm:px-12 lg:flex-row lg:items-end lg:justify-between lg:py-16">
            <div>
              <BuildingOfficeIcon className="h-6 w-6 text-[#b8d2c0]" />
              <h2 className="mt-7 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">{c.ctaTitle}</h2>
              <p className="mt-4 text-sm leading-7 text-white/65">{c.ctaBody}</p>
            </div>
            <Link href="/explore" className="shrink-0 rounded-full bg-[#f4f7f1] px-6 py-3.5 text-sm font-semibold text-[#23372f] transition hover:bg-white">{c.openMap} <span aria-hidden="true">↗</span></Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dfe5db] px-5 py-8 text-xs text-[#7a897e] sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-2 sm:flex-row"><span className="font-medium text-[#3d5646]">Bangkok Atlas · {c.footer}</span><span>{c.footerSource}</span></div>
      </footer>
    </div>
  );
}

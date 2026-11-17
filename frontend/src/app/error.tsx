"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-100 p-6 text-zinc-900">
      <section className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-lg">
        <p className="text-xs font-bold uppercase tracking-wider text-red-600">
          Bangkok Atlas
        </p>
        <h1 className="mt-2 text-xl font-extrabold">ระบบขัดข้องชั่วคราว</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองโหลดส่วนนี้ใหม่ หากยังไม่สำเร็จให้ตรวจว่า backend ทำงานที่พอร์ต 8000
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
        >
          ลองใหม่
        </button>
      </section>
    </main>
  );
}

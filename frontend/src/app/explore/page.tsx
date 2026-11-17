"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import MapView from "@/components/MapView";
import PreferencesPanel from "@/components/PreferencesPanel";
import ResultsList from "@/components/ResultsList";
import LocationDetail from "@/components/LocationDetail";
import SearchBar from "@/components/SearchBar";
import LanguageToggle from "@/components/LanguageToggle";
import { useLanguage } from "@/lib/i18n";
import {
  SparklesIcon,
  SlidersIcon,
  TrophyIcon,
  BarChart3Icon,
} from "@/components/icons";
import {
  DEFAULT_WEIGHTS,
  fallbackRecommendFromGrid,
  fetchDistricts,
  fetchGrid,
  fetchHealth,
  fetchLocation,
  fetchNeighborhoods,
  fetchStations,
  recommend,
  type Dimension,
  type DistrictsResponse,
  type GridResponse,
  type LocationDetail as Detail,
  type Neighborhood,
  type RailRoute,
  type Recommendation,
  type Station,
  type StationLine,
} from "@/lib/api";

function optionalPositiveNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function ringContains(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export default function ExplorePage() {
  const { t, isTh } = useLanguage();
  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [districtsData, setDistrictsData] = useState<DistrictsResponse | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [stations, setStations] = useState<Station[]>([]);
  const [stationLines, setStationLines] = useState<StationLine[]>([]);
  const [routes, setRoutes] = useState<RailRoute[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [gridError, setGridError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [serviceStatus, setServiceStatus] = useState<"checking" | "online" | "offline">("checking");
  const [weights, setWeights] = useState<Record<Dimension, number>>(DEFAULT_WEIGHTS);
  const [budget, setBudget] = useState("");
  const [landSize, setLandSize] = useState("");
  const [landUse, setLandUse] = useState("");
  const [recommending, setRecommending] = useState(false);
  const [results, setResults] = useState<Recommendation[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selectedHexId, setSelectedHexId] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<{ lat: number; lng: number; name: string | null } | null>(null);
  const detailRequestRef = useRef(0);
  const [highlight, setHighlight] = useState<{ lng: number; lat: number } | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"preferences" | "results" | "detail">("preferences");

  useEffect(() => {
    let cancelled = false;
    void fetchHealth()
      .then(() => {
        if (!cancelled) setServiceStatus("online");
      })
      .catch(() => {
        if (!cancelled) setServiceStatus("offline");
      });

    void Promise.allSettled([
      fetchGrid(),
      fetchDistricts(),
      fetchStations(),
      fetchNeighborhoods(),
    ]).then(([gridResult, districtResult, stationResult, neighborhoodResult]) => {
      if (cancelled) return;
      let loadedGrid: GridResponse | null = null;
      if (gridResult.status === "fulfilled") {
        loadedGrid = gridResult.value;
        setGrid(loadedGrid);
        setGridError(null);
      } else {
        setGridError(String(gridResult.reason));
      }
      setDistrictsData(
        districtResult.status === "fulfilled" ? districtResult.value : null
      );
      if (stationResult.status === "fulfilled") {
        setStations(stationResult.value.stations);
        setStationLines(stationResult.value.lines);
        setRoutes(stationResult.value.routes ?? []);
      }
      setNeighborhoods(
        neighborhoodResult.status === "fulfilled"
          ? neighborhoodResult.value.neighborhoods ?? []
          : []
      );
      setInitialLoading(false);

      // Auto-load top recommendations on page mount
      void recommend(DEFAULT_WEIGHTS, { k: 12 })
        .then((resp) => {
          if (!cancelled && resp.results && resp.results.length > 0) {
            setResults(resp.results);
          }
        })
        .catch(() => {
          if (!cancelled && loadedGrid) {
            const fallback = fallbackRecommendFromGrid(loadedGrid, DEFAULT_WEIGHTS, { k: 12 });
            setResults(fallback.results);
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectDistrict = useCallback((distName: string) => {
    setSelectedDistrict(distName);
    if (distName && districtsData?.features) {
      const found = districtsData.features.find(
        (d) =>
          d.properties.name_en.toLowerCase() === distName.toLowerCase() ||
          d.properties.name_th === distName
      );
      if (found) {
        setHighlight({ lat: found.properties.center_lat, lng: found.properties.center_lng });
      }
    }
  }, [districtsData]);

  const handleRecommendWithWeights = useCallback(
    async (targetWeights: Record<Dimension, number>, switchTab = true) => {
      const parsedBudget = optionalPositiveNumber(budget);
      const parsedLandSize = optionalPositiveNumber(landSize);
      setRecommending(true);
      setDetailError(null);
      try {
        const resp = await recommend(targetWeights, {
          budget: parsedBudget,
          landSize: parsedLandSize,
          landUse: landUse === "" ? null : landUse,
          district: selectedDistrict || null,
          k: 12,
        });
        if (resp.results && resp.results.length > 0) {
          setResults(resp.results);
          if (switchTab) setActiveTab("results");
          const first = resp.results[0];
          setSelectedHexId(first.hex_id);
          setHighlight({ lng: first.center.lng, lat: first.center.lat });
        } else if (grid && grid.features?.length) {
          // Fallback to client-side grid ranking
          const fallback = fallbackRecommendFromGrid(grid, targetWeights, {
            budget: parsedBudget,
            landSize: parsedLandSize,
            district: selectedDistrict || null,
            k: 12,
          });
          if (fallback.results.length > 0) {
            setResults(fallback.results);
            if (switchTab) setActiveTab("results");
            const first = fallback.results[0];
            setSelectedHexId(first.hex_id);
            setHighlight({ lng: first.center.lng, lat: first.center.lat });
          } else {
            setResults([]);
            setSelectedHexId(null);
            setDetail(null);
            setDetailError(
              isTh
                ? "ไม่พบพื้นที่ที่ตรงกับตัวกรอง ลองล้างเขตที่เลือกหรือปรับเกณฑ์ทำเล"
                : "No locations match these filters. Clear the district or adjust location criteria."
            );
          }
        } else {
          setResults([]);
          setSelectedHexId(null);
          setDetail(null);
          setDetailError(
            isTh
              ? "ไม่พบพื้นที่ที่ตรงกับตัวกรอง ลองเลือกเขตอื่นหรือปรับเกณฑ์ทำเล"
              : "No locations match these filters. Try another district or adjust location criteria."
          );
        }
      } catch (e) {
        // Backend offline / network failure: Fall back to client-side grid ranking
        if (grid && grid.features?.length) {
          const fallback = fallbackRecommendFromGrid(grid, targetWeights, {
            budget: parsedBudget,
            landSize: parsedLandSize,
            district: selectedDistrict || null,
            k: 12,
          });
          setResults(fallback.results);
          if (switchTab) setActiveTab("results");
          if (fallback.results.length > 0) {
            const first = fallback.results[0];
            setSelectedHexId(first.hex_id);
            setHighlight({ lng: first.center.lng, lat: first.center.lat });
          }
        } else {
          setResults([]);
          setDetailError(String(e));
        }
      } finally {
        setRecommending(false);
      }
    },
    [budget, isTh, landSize, landUse, selectedDistrict, grid]
  );

  const handleRecommend = useCallback(
    async (customWeights?: Record<Dimension, number>) => {
      await handleRecommendWithWeights(customWeights ?? weights, true);
    },
    [handleRecommendWithWeights, weights]
  );

  const [goldenOnly, setGoldenOnly] = useState(false);

  const handleGoldenLocations = useCallback(() => {
    setGoldenOnly((prev) => {
      const next = !prev;
      if (next) {
        // Zoom and center to Central Bangkok Golden Corridor (Siam-Sukhumvit-Silom)
        setHighlight({ lat: 13.737, lng: 100.550 });
      }
      return next;
    });
  }, []);

  const selectRecommendation = useCallback(
    async (r: Recommendation) => {
      const requestId = ++detailRequestRef.current;
      setSelectedBuilding(null);
      setHighlight({ lng: r.center.lng, lat: r.center.lat });
      setSelectedHexId(r.hex_id);
      setActiveTab("detail");
      setDetailLoading(true);
      setDetail(null);
      setDetailError(null);
      try {
        const d = await fetchLocation(
          r.hex_id,
          optionalPositiveNumber(landSize),
          optionalPositiveNumber(budget)
        );
        if (requestId === detailRequestRef.current) setDetail(d);
      } catch (e) {
        if (requestId === detailRequestRef.current) {
          setDetail(null);
          setDetailError(String(e));
        }
      } finally {
        if (requestId === detailRequestRef.current) setDetailLoading(false);
      }
    },
    [landSize, budget]
  );

  const selectCell = useCallback(
    async (hexId: string) => {
      const requestId = ++detailRequestRef.current;
      setSelectedHexId(hexId);
      setActiveTab("detail");
      setDetailLoading(true);
      setDetail(null);
      setDetailError(null);
      try {
        const d = await fetchLocation(
          hexId,
          optionalPositiveNumber(landSize),
          optionalPositiveNumber(budget)
        );
        if (requestId === detailRequestRef.current) setDetail(d);
      } catch (e) {
        if (requestId === detailRequestRef.current) {
          setDetail(null);
          setDetailError(String(e));
        }
      } finally {
        if (requestId === detailRequestRef.current) setDetailLoading(false);
      }
    },
    [landSize, budget]
  );

  const handleSearchSelect = useCallback(
    (lat: number, lng: number) => {
      setHighlight({ lat, lng });

      // Prefer the containing cell; fall back to the closest polygon centroid.
      if (grid?.features) {
        let bestHex = "";
        let minDist = Infinity;
        for (const f of grid.features) {
          const ring = f.geometry.coordinates[0];
          if (ring.length < 3) continue;
          if (ringContains(lat, lng, ring)) {
            bestHex = f.properties.hex_id;
            break;
          }
          const vertices = ring.slice(0, -1);
          if (vertices.length === 0) continue;
          const providedLat = f.properties.center_lat;
          const providedLng = f.properties.center_lng;
          const [sumLng, sumLat] = vertices.reduce(
            ([x, y], [vertexLng, vertexLat]) => [x + vertexLng, y + vertexLat],
            [0, 0]
          );
          const cLng = typeof providedLng === "number" ? providedLng : sumLng / vertices.length;
          const cLat = typeof providedLat === "number" ? providedLat : sumLat / vertices.length;
          const dist = (cLat - lat) ** 2 + (cLng - lng) ** 2;
          if (dist < minDist) {
            minDist = dist;
            bestHex = f.properties.hex_id;
          }
        }
        if (bestHex) void selectCell(bestHex);
      }
    },
    [grid, selectCell]
  );

  return (
    <div className="explore-shell flex h-dvh min-h-[560px] flex-col bg-[#f6f6f2] text-[#21312a] antialiased font-sans">
      {/* Top bar */}
      <header className="relative z-30 shrink-0 border-b border-[#e2e8df] bg-[#f6f6f2] px-3 pb-2.5 pt-3 sm:px-5">
        <div className="landing-glass-nav mx-auto flex max-w-[1680px] flex-wrap items-center gap-3 rounded-[26px] px-3 py-2.5 sm:px-4 lg:rounded-full">
          <div className="relative z-10 flex min-w-0 items-center gap-3">
            <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" title={isTh ? "กลับหน้าแรก" : "Return home"}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/45 bg-white/10 text-[17px] font-semibold">B</span>
              <span className="whitespace-nowrap text-sm font-semibold tracking-tight">Bangkok <span className="font-normal text-white/75">Atlas</span></span>
            </Link>
            <span className="hidden h-6 w-px bg-white/20 sm:block" />
            <Link href="/" className="hidden rounded-full px-2 py-2 text-xs font-medium text-white/75 transition hover:bg-white/10 hover:text-white sm:inline-flex">← {isTh ? "หน้าแรก" : "Home"}</Link>
          </div>

          <div className="relative z-10 order-3 flex w-full min-w-0 items-center gap-2 lg:order-none lg:ml-6 lg:flex-1">
            <SearchBar onSelectLocation={handleSearchSelect} />
            <button
              type="button"
              onClick={handleGoldenLocations}
              aria-pressed={goldenOnly}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                goldenOnly
                  ? "border-[#e7c979] bg-[#f4dfaa] text-[#4a391a]"
                  : "border-white/25 bg-white/10 text-white hover:bg-white/20"
              }`}
              title={goldenOnly ? t("btn.golden_tooltip_on") : t("btn.golden_tooltip_off")}
            >
              <SparklesIcon className="h-4 w-4" />
              <span>{t("btn.golden_location")}</span>
              {goldenOnly && <span className="hidden text-[11px] font-normal opacity-80 xl:inline">{t("btn.golden_on")}</span>}
            </button>
          </div>

          <div className="relative z-10 ml-auto flex items-center">
            <LanguageToggle />
          </div>
        </div>
        <div className="mx-auto mt-2 flex max-w-[1680px] items-center justify-end gap-3 px-2 text-[11px] text-[#74847a] sm:justify-between sm:px-4">
          <span className="hidden truncate sm:inline">{isTh ? "สำรวจย่านและข้อมูลทำเลกรุงเทพฯ" : "Explore Bangkok neighborhoods and locations"}</span>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${
              serviceStatus === "online"
                ? "border-[#c7ddd0] bg-[#e7f2e9] text-[#315b43]"
                : serviceStatus === "offline"
                  ? "border-[#efd8d0] bg-[#fbefeb] text-[#8b4c3d]"
                  : "border-[#dce3d9] bg-white text-[#66746a]"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${serviceStatus === "online" ? "bg-[#4f8b65]" : serviceStatus === "offline" ? "bg-[#b77867]" : "bg-[#8e9b8e]"}`} />
              {serviceStatus === "online"
                ? t("status.live")
                : serviceStatus === "offline"
                  ? (isTh ? "API ไม่พร้อมใช้งาน" : "API unavailable")
                  : (isTh ? "กำลังตรวจระบบ" : "Checking API")}
            </span>
            <span className="hidden items-center rounded-full border border-[#eadfbe] bg-[#fbf6e7] px-2.5 py-1 font-medium text-[#7a6330] md:inline-flex">{t("status.appraisal")}</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Map View */}
        <main className="relative h-[46dvh] min-h-[310px] shrink-0 flex-1 lg:h-auto lg:min-h-0">
          <MapView
            grid={grid}
            districts={districtsData}
            selectedDistrict={selectedDistrict}
            stations={stations}
            stationLines={stationLines}
            routes={routes}
            neighborhoods={neighborhoods}
            selectedHexId={selectedHexId}
            highlight={highlight}
            onSelect={selectCell}
            onBuildingSelect={setSelectedBuilding}
            goldenOnly={goldenOnly}
            onToggleGoldenOnly={setGoldenOnly}
          />
          {gridError && (
            <div role="status" className="absolute inset-x-4 bottom-16 z-10 mx-auto w-fit max-w-[min(90%,480px)] rounded-xl border border-[#efd8d0] bg-[#fff9f5]/95 px-4 py-2.5 text-xs leading-5 text-[#8b4c3d] shadow-md backdrop-blur sm:bottom-auto sm:top-16">
              {isTh ? "ข้อมูลพื้นที่ยังไม่พร้อมใช้งาน" : "Area data is unavailable"}: {gridError}
            </div>
          )}
          {initialLoading && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-[#f6f6f2]/55 backdrop-blur-[1px]">
              <div className="rounded-2xl border border-[#dce4da] bg-white px-5 py-3 text-sm font-medium text-[#314b3b] shadow-lg">
                {isTh ? "กำลังโหลดข้อมูลกรุงเทพฯ…" : "Loading Bangkok data…"}
              </div>
            </div>
          )}
        </main>

        {/* Sidebar Panel */}
        <aside className="relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-y-auto border-t border-[#dce5d9] bg-[#f6f6f2] shadow-[0_-12px_35px_rgba(27,47,35,0.07)] lg:w-[430px] lg:flex-none lg:border-l lg:border-t-0 lg:shadow-[-10px_0_30px_rgba(27,47,35,0.06)] xl:w-[450px]">
          {/* Navigation Tabs */}
          <div className="sticky top-0 z-10 border-b border-[#e0e7db] bg-[#f6f6f2]/95 px-4 pb-3 pt-4 backdrop-blur-xl">
            <div className="flex gap-1 rounded-2xl border border-[#e2e8df] bg-white/80 p-1 shadow-[0_3px_12px_rgba(30,56,36,0.04)]">
            <button
              type="button"
              onClick={() => setActiveTab("preferences")}
              aria-pressed={activeTab === "preferences"}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-1.5 py-2.5 text-[11px] font-semibold transition-colors ${
                activeTab === "preferences"
                  ? "bg-[#e5eee6] text-[#24533e]"
                  : "text-[#758379] hover:bg-[#f0f4ed] hover:text-[#314e3b]"
              }`}
            >
              <SlidersIcon className="h-4 w-4 shrink-0" />
              <span className="text-center leading-4">{t("tab.preferences")}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("results")}
              aria-pressed={activeTab === "results"}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-1.5 py-2.5 text-[11px] font-semibold transition-colors ${
                activeTab === "results"
                  ? "bg-[#e5eee6] text-[#24533e]"
                  : "text-[#758379] hover:bg-[#f0f4ed] hover:text-[#314e3b]"
              }`}
            >
              <TrophyIcon className="h-4 w-4 shrink-0" />
              <span className="text-center leading-4">{t("tab.results")} ({results.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("detail")}
              disabled={!detail && !detailLoading}
              aria-pressed={activeTab === "detail"}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-1.5 py-2.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                activeTab === "detail"
                  ? "bg-[#e5eee6] text-[#24533e]"
                  : "text-[#758379] hover:bg-[#f0f4ed] hover:text-[#314e3b]"
              }`}
            >
              <BarChart3Icon className="h-4 w-4 shrink-0" />
              <span className="text-center leading-4">{t("tab.detail")}</span>
            </button>
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            {detailError && (
              <div role="alert" className="rounded-2xl border border-[#efd8d0] bg-[#fff8f4] p-4 text-sm leading-6 text-[#8b4c3d]">
                {detailError}
              </div>
            )}

            {activeTab === "preferences" && (
              <PreferencesPanel
                weights={weights}
                onWeights={setWeights}
                budget={budget}
                onBudget={setBudget}
                landSize={landSize}
                onLandSize={setLandSize}
                landUse={landUse}
                onLandUse={setLandUse}
                district={selectedDistrict}
                onDistrict={handleSelectDistrict}
                districtsList={districtsData?.features || []}
                onRecommend={handleRecommend}
                loading={recommending}
              />
            )}

            {activeTab === "results" && (
              <ResultsList
                results={results}
                selectedHexId={selectedHexId}
                onSelect={selectRecommendation}
                onCompute={() => handleRecommendWithWeights(weights, true)}
              />
            )}

            {activeTab === "detail" && detail && (
              <LocationDetail
                detail={detail}
                selectedBuilding={selectedBuilding}
                onClose={() => {
                  setDetail(null);
                  setActiveTab(results.length > 0 ? "results" : "preferences");
                }}
              />
            )}
            {activeTab === "detail" && detailLoading && (
              <div className="rounded-2xl border border-[#dce5d9] bg-white p-6 text-center text-sm font-medium text-[#53665a] shadow-sm">
                {isTh ? "กำลังวิเคราะห์พื้นที่…" : "Analyzing location…"}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

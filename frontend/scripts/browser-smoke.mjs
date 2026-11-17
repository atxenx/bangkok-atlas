import { writeFile } from "node:fs/promises";

const devtoolsOrigin = process.env.CDP_ORIGIN ?? "http://127.0.0.1:9223";
const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3001";
const screenshotPath = process.env.SCREENSHOT_PATH ?? "/tmp/bangkok-ai-3d.png";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const targets = await fetch(`${devtoolsOrigin}/json`).then((response) => response.json());
const target = targets.find((item) => item.type === "page");
if (!target) throw new Error("No Chrome page target found");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const browserErrors = [];
const browserWarnings = [];

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    browserErrors.push(message.params.exceptionDetails.text);
  }
  if (message.method === "Runtime.consoleAPICalled") {
    const text = message.params.args
      .map((arg) => arg.value ?? arg.description ?? "")
      .filter(Boolean)
      .join(" ");
    if (message.params.type === "error") browserErrors.push(text);
    if (message.params.type === "warning") browserWarnings.push(text);
  }
  if (message.method === "Log.entryAdded") {
    const entry = message.params.entry;
    if (entry.level === "error") browserErrors.push(entry.text);
    if (entry.level === "warning") browserWarnings.push(entry.text);
  }
});

function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text);
  }
  return result.result.value;
}

async function waitFor(expression, timeoutMs = 40_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(expression)) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function waitUntil(expression, timeoutMs = 40_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(expression)) return true;
    await delay(250);
  }
  return false;
}

await Promise.all([
  send("Page.enable"),
  send("Runtime.enable"),
  send("Log.enable"),
  send("Network.enable"),
]);
await send("Log.clear");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });

await send("Page.navigate", { url: `${appOrigin}/explore` });
await waitFor("Boolean(window.__bkkMap)");
await delay(1_500);

const initial = await evaluate(`(() => {
  const styleSelect = [...document.querySelectorAll("select")]
    .find((select) => [...select.options].some((option) => option.value === "3d"));
  const map = window.__bkkMap;
  return {
    title: document.title,
    contentLength: document.body.innerText.trim().length,
    errorOverlay: Boolean(document.querySelector("[data-nextjs-dialog], .vite-error-overlay")),
    style: styleSelect?.value,
    pitch: map?.getPitch(),
    bearing: map?.getBearing(),
    gridCanvas: Boolean(document.querySelector("canvas.pointer-events-none")),
  };
})()`);

await evaluate(`(() => {
  const select = [...document.querySelectorAll("select")]
    .find((item) => [...item.options].some((option) => option.value === "3d"));
  select.value = "3d";
  select.dispatchEvent(new Event("change", { bubbles: true }));
})()`);
await waitFor('Boolean(window.__bkkMap && window.__bkkMap.getLayer("bkk-3d-buildings"))');
const buildingSourceLoaded = await waitUntil('window.__bkkMap.isSourceLoaded("openmaptiles")');
if (buildingSourceLoaded) await waitUntil("window.__bkkMap.loaded()");
await delay(750);

const threeD = await evaluate(`(() => {
  const map = window.__bkkMap;
  return {
    pitch: map?.getPitch(),
    bearing: map?.getBearing(),
    layerReady: Boolean(map?.getLayer("bkk-3d-buildings")),
    sourceReady: Boolean(map?.getSource("openmaptiles")),
    sourceLoaded: map?.isSourceLoaded("openmaptiles"),
    sourceFeatureCount: map?.queryRenderedFeatures(undefined, { layers: ["bkk-3d-buildings"] }).length ?? 0,
    center: map?.getCenter().toArray(),
    zoom: map?.getZoom(),
    statusText: [...document.querySelectorAll("div.text-sky-700")]
      .map((item) => item.textContent || "")
      .find((text) => text.includes("explicit-height buildings"))
      ?.slice(0, 200) || "",
  };
})()`);

const image = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: false,
});
await writeFile(screenshotPath, Buffer.from(image.data, "base64"));

await evaluate(`(() => {
  const select = [...document.querySelectorAll("select")]
    .find((item) => [...item.options].some((option) => option.value === "osm"));
  select.value = "osm";
  select.dispatchEvent(new Event("change", { bubbles: true }));
})()`);
await delay(2_000);
const twoD = await evaluate(`(() => ({
  pitch: window.__bkkMap?.getPitch(),
  bearing: window.__bkkMap?.getBearing(),
  style: [...document.querySelectorAll("select")]
    .find((select) => [...select.options].some((option) => option.value === "3d"))?.value,
}))()`);

await evaluate(`(() => {
  const input = document.querySelector('input[role="combobox"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(input, "Siam");
  input.dispatchEvent(new Event("input", { bubbles: true }));
})()`);
await delay(1_500);
const searchCount = await evaluate(`document.querySelectorAll('[role="option"]').length`);
await evaluate(`document.querySelector('[role="option"]')?.click()`);
await delay(5_000);
const detailReady = await evaluate(
  'document.body.innerText.includes("Land Value Screening Estimate") || document.body.innerText.includes("ค่าประมาณเพื่อคัดกรองมูลค่าที่ดิน")'
);

await evaluate(`(() => {
  [...document.querySelectorAll("button")]
    .find((button) => ["Preferences", "ตั้งค่าค้นหา"].includes(button.textContent.trim()))
    ?.click();
})()`);
await delay(500);
await evaluate(`(() => {
  [...document.querySelectorAll("button")]
    .find((button) => button.textContent.includes("Find Matching Locations") || button.textContent.includes("ค้นหาทำเลที่เหมาะสมที่สุด"))
    ?.click();
})()`);
await delay(8_000);
const recommendationReady = await evaluate(
  'document.body.innerText.includes("12 locations") || document.body.innerText.includes("12 ทำเล")'
);

const result = {
  initial,
  threeD,
  twoD,
  searchCount,
  detailReady,
  recommendationReady,
  browserErrors: browserErrors.slice(0, 20),
  browserWarnings: browserWarnings.slice(0, 10),
  screenshotPath,
};

console.log(JSON.stringify(result, null, 2));

const passed =
  initial.contentLength > 500 &&
  !initial.errorOverlay &&
  initial.style === "carto-light" &&
  Math.abs(initial.pitch) < 0.01 &&
  threeD.layerReady &&
  threeD.sourceReady &&
  threeD.sourceLoaded &&
  threeD.sourceFeatureCount > 0 &&
  threeD.pitch > 40 &&
  Math.abs(twoD.pitch) < 0.01 &&
  Math.abs(twoD.bearing) < 0.01 &&
  searchCount > 0 &&
  detailReady &&
  recommendationReady &&
  browserErrors.length === 0;

socket.close();
await delay(100);
process.exit(passed ? 0 : 1);

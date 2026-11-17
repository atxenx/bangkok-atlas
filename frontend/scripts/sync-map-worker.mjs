import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "node_modules/maplibre-gl/dist");
const destination = resolve(root, "public/vendor/maplibre");
await mkdir(destination, { recursive: true });
// v6's module worker imports sibling chunks; ship the matching module set.
for (const name of await readdir(source)) {
  if (name.endsWith(".mjs")) await copyFile(resolve(source, name), resolve(destination, name));
}

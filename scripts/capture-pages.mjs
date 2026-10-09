// Full-page screenshots of a running site via the Chrome DevTools Protocol.
// Usage: BASE_URL=http://localhost:3001 node scripts/capture-pages.mjs
// Output: .screenshots/full/*.png

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const OUT = process.env.OUT_DIR ?? ".screenshots/full";
const PORT = 9333;

const DEFAULT_TARGETS = [
  { name: "home", path: "/", width: 1440, height: 900 },
  { name: "history", path: "/history", width: 1440, height: 900 },
  { name: "reading", path: "/important-reading", width: 1440, height: 900 },
  { name: "documents", path: "/documents", width: 1440, height: 900 },
  { name: "accomplishments", path: "/accomplishments", width: 1440, height: 900 },
  { name: "home-mobile", path: "/", width: 390, height: 844 },
  { name: "gallery-mobile", path: "/gallery", width: 390, height: 844 },
];

const targets = process.env.CAPTURE_TARGETS
  ? JSON.parse(process.env.CAPTURE_TARGETS)
  : DEFAULT_TARGETS;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let seq = 0;
function send(ws, method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      ws.removeEventListener("message", onMessage);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    };
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

async function waitForChrome() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (response.ok) return response.json();
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  throw new Error("Chrome did not expose the debugging port");
}

async function main() {
  await mkdir(OUT, { recursive: true });
  // CHROME_PROFILE keeps a persistent browser profile between runs, so QA captures
  // reuse the localStorage terrain caches instead of re-spending the API budget.
  const userDataDir = process.env.CHROME_PROFILE ?? (await mkdtemp(path.join(tmpdir(), "chrome-cdp-")));
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      // Software WebGL, so pages that draw with it (the flights 3D view) capture too.
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--window-size=1440,900",
    ],
    { stdio: "ignore" },
  );

  try {
    const version = await waitForChrome();
    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.addEventListener("open", resolve));

    for (const target of targets) {
      const { targetId } = await send(ws, "Target.createTarget", { url: "about:blank" });
      const { sessionId } = await send(ws, "Target.attachToTarget", {
        targetId,
        flatten: true,
      });
      if (!sessionId) throw new Error(`Could not attach to target ${targetId}`);

      await send(ws, "Page.enable", {}, sessionId);
      await send(
        ws,
        "Emulation.setDeviceMetricsOverride",
        { width: target.width, height: target.height, deviceScaleFactor: 1, mobile: false },
        sessionId,
      );
      await send(
        ws,
        "Emulation.setEmulatedMedia",
        { features: [{ name: "prefers-reduced-motion", value: "reduce" }] },
        sessionId,
      );
      await send(ws, "Page.navigate", { url: `${BASE}${target.path}` }, sessionId);

      for (let attempt = 0; attempt < 80; attempt += 1) {
        const { result } = await send(
          ws,
          "Runtime.evaluate",
          { expression: "document.readyState", returnByValue: true },
          sessionId,
        );
        if (result.value === "complete") break;
        await sleep(250);
      }

      // Pages that fetch their data after load need a moment before the screenshot —
      // opt in per target when the data arrives over a few seconds.
      if (target.settleMs) await sleep(target.settleMs);

      // Scroll through the page so lazy-loaded images actually load, then wait for them to
      // finish: scrolling to a selector before images settle lands the crop in the wrong
      // place when late arrivals shift the layout.
      await send(
        ws,
        "Runtime.evaluate",
        {
          expression: `(async () => {
            const step = window.innerHeight;
            for (let y = 0; y <= document.body.scrollHeight; y += step) {
              window.scrollTo({ top: y, behavior: "instant" });
              await new Promise((resolve) => setTimeout(resolve, 150));
            }
            await Promise.race([
              Promise.all([...document.images].map((img) =>
                img.complete
                  ? null
                  : new Promise((resolve) => {
                      img.addEventListener("load", resolve, { once: true });
                      img.addEventListener("error", resolve, { once: true });
                    }),
              )),
              new Promise((resolve) => setTimeout(resolve, 5000)),
            ]);
          })()`,
          awaitPromise: true,
        },
        sessionId,
      );

      const fullPage = !target.scrollTo && target.scrollY === undefined;
      if (target.scrollTo || target.scrollY !== undefined) {
        const expression =
          target.scrollTo !== undefined
            ? `(async () => {
              const el = document.querySelector(${JSON.stringify(target.scrollTo)});
              if (el) el.scrollIntoView({ block: "start", behavior: "instant" });
              await new Promise((resolve) => setTimeout(resolve, 800));
            })()`
            : `(async () => {
              window.scrollTo({ top: ${Number(target.scrollY)}, behavior: "instant" });
              await new Promise((resolve) => setTimeout(resolve, 800));
            })()`;
        await send(
          ws,
          "Runtime.evaluate",
          { expression, awaitPromise: true },
          sessionId,
        );
      } else {
        await send(
          ws,
          "Runtime.evaluate",
          {
            expression: `(async () => {
              window.scrollTo({ top: 0, behavior: "instant" });
              await new Promise((resolve) => setTimeout(resolve, 300));
              // Render the sticky header at its document position for the full-page capture.
              const header = document.querySelector("header");
              header?.style.setProperty("position", "static", "important");
              await new Promise((resolve) => setTimeout(resolve, 200));
            })()`,
            awaitPromise: true,
          },
          sessionId,
        );
      }

      if (target.zoom) {
        const { x, y, deltaY, steps = 8 } = target.zoom;
        for (let i = 0; i < steps; i += 1) {
          await send(
            ws,
            "Input.dispatchMouseEvent",
            { type: "mouseWheel", x, y, deltaX: 0, deltaY, pointerType: "mouse" },
            sessionId,
          );
          await send(
            ws,
            "Runtime.evaluate",
            { expression: `new Promise((r) => setTimeout(r, 90))`, awaitPromise: true },
            sessionId,
          );
        }
        await send(
          ws,
          "Runtime.evaluate",
          { expression: `new Promise((r) => setTimeout(r, 700))`, awaitPromise: true },
          sessionId,
        );
      }
      if (target.click) {
        const { x, y } = target.click;
        await send(
          ws,
          "Input.dispatchMouseEvent",
          { type: "mousePressed", x, y, button: "left", clickCount: 1, pointerType: "mouse" },
          sessionId,
        );
        await send(
          ws,
          "Input.dispatchMouseEvent",
          { type: "mouseReleased", x, y, button: "left", clickCount: 1, pointerType: "mouse" },
          sessionId,
        );
        await send(
          ws,
          "Runtime.evaluate",
          { expression: `new Promise((r) => setTimeout(r, 900))`, awaitPromise: true },
          sessionId,
        );
      }
      const shot = await send(
        ws,
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: fullPage },
        sessionId,
      );
      const file = path.join(OUT, `${target.name}.png`);
      await writeFile(file, Buffer.from(shot.data, "base64"));
      console.log(`captured ${target.name} (${target.width}x${target.height})`);
      await send(ws, "Target.closeTarget", { targetId });
    }

    ws.close();
  } finally {
    chrome.kill("SIGKILL");
  }

  console.log("done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

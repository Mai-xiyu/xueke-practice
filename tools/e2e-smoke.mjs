import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = 4173;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteCli = path.join(root, "node_modules", "vite", "bin", "vite.js");
const server = spawn(process.execPath, [viteCli, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: root,
  stdio: "pipe"
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch {
      await wait(500);
    }
  }
  throw new Error("preview server did not start");
}

try {
  await waitForServer();
  const chromePath = process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined;
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await context.addInitScript(() => localStorage.clear());
  const page = await context.newPage();
  const base = `http://127.0.0.1:${port}`;
  await page.goto(`${base}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".subject-card");
  const home = await page.evaluate(() => ({
    subjects: document.querySelectorAll(".subject-card").length,
    colleges: document.querySelectorAll(".college-section").length
  }));
  if (home.subjects !== 10 || home.colleges !== 3) throw new Error(`home check failed ${JSON.stringify(home)}`);

  await page.goto(`${base}/data_visualization_practice.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".question-card");
  await page.locator(".option").first().click();
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    buttons.find((button) => button.textContent?.includes("提交"))?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForSelector(".analysis");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    buttons.find((button) => button.textContent?.includes("完整答题卡"))?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForSelector(".card-drawer");
  const practice = await page.evaluate(() => ({
    stats: document.querySelectorAll(".stat-card").length,
    nearbyButtons: document.querySelectorAll(".answer-card > .answer-card__section .answer-card__btn").length,
    drawerButtons: document.querySelectorAll(".card-drawer .answer-card__btn").length,
    hasAnalysis: Boolean(document.querySelector(".analysis")),
    hasDrawer: Boolean(document.querySelector(".card-drawer")),
    title: document.querySelector(".subject-head h1")?.textContent
  }));
  if (
    practice.stats !== 5 ||
    !practice.hasAnalysis ||
    !practice.hasDrawer ||
    practice.nearbyButtons <= 0 ||
    practice.nearbyButtons >= practice.drawerButtons ||
    !practice.title?.includes("数据可视化")
  ) {
    throw new Error(`practice check failed ${JSON.stringify(practice)}`);
  }

  await page.evaluate(() => {
    document.querySelector(".card-drawer__head button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForSelector(".card-drawer", { state: "detached" });
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll(".layout-controls button"));
    buttons.find((button) => button.textContent?.includes("浮动布局"))?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForSelector(".floating-panel");
  const floating = await page.evaluate(() => ({
    panels: document.querySelectorAll(".floating-panel").length,
    hasQuestion: Array.from(document.querySelectorAll(".floating-panel__bar strong")).some((item) => item.textContent === "题目"),
    hasTaskbar: Boolean(document.querySelector(".floating-taskbar"))
  }));
  if (floating.panels < 10 || !floating.hasQuestion || floating.hasTaskbar) {
    throw new Error(`floating initial check failed ${JSON.stringify(floating)}`);
  }

  await page.evaluate(() => {
    document.querySelector(".floating-panel__minimize")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForSelector(".floating-taskbar");
  await page.evaluate(() => {
    document.querySelector(".floating-taskbar button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForFunction(() => !document.querySelector(".floating-taskbar"));
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll(".layout-controls button"));
    buttons.find((button) => button.textContent?.includes("整理窗口"))?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  const arranged = await page.evaluate(() => {
    const rects = Array.from(document.querySelectorAll(".floating-panel")).map((item) => {
      const rect = item.getBoundingClientRect();
      return { id: item.getAttribute("data-panel-id"), left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    });
    const overlaps = rects.some((a, index) => rects.slice(index + 1).some((b) => (
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    )));
    const taskbar = document.querySelector(".floating-taskbar")?.getBoundingClientRect();
    return {
      panelCount: rects.length,
      hasQuestion: rects.some((rect) => rect.id === "question"),
      hasTaskbar: Boolean(taskbar),
      taskbarBottomGap: taskbar ? window.innerHeight - taskbar.bottom : null,
      overlaps,
      outOfBounds: rects.some((rect) => rect.left < 0 || rect.top < 0 || rect.right > window.innerWidth || rect.bottom > window.innerHeight)
    };
  });
  if (arranged.panelCount !== 1 || !arranged.hasQuestion || !arranged.hasTaskbar || (arranged.taskbarBottomGap ?? 999) > 28 || arranged.overlaps || arranged.outOfBounds) {
    throw new Error(`floating arrange check failed ${JSON.stringify(arranged)}`);
  }

  const questionPanel = page.locator('[data-panel-id="question"]');
  const beforeMove = await questionPanel.boundingBox();
  if (!beforeMove) throw new Error("question floating panel not found");
  await page.mouse.move(beforeMove.x + 80, beforeMove.y + 18);
  await page.mouse.down();
  await page.mouse.move(beforeMove.x + 130, beforeMove.y + 64);
  await page.mouse.up();
  const afterMove = await questionPanel.boundingBox();
  if (!afterMove || (Math.abs(afterMove.x - beforeMove.x) < 10 && Math.abs(afterMove.y - beforeMove.y) < 10)) {
    throw new Error(`floating drag check failed ${JSON.stringify({ beforeMove, afterMove })}`);
  }

  await page.mouse.move(afterMove.x + afterMove.width - 2, afterMove.y + afterMove.height - 24);
  await page.mouse.down();
  await page.mouse.move(afterMove.x + afterMove.width + 58, afterMove.y + afterMove.height + 34);
  await page.mouse.up();
  const afterResize = await questionPanel.boundingBox();
  if (!afterResize || (afterResize.width <= afterMove.width + 20 && afterResize.height <= afterMove.height + 10)) {
    throw new Error(`floating resize check failed ${JSON.stringify({ afterMove, afterResize })}`);
  }
  await browser.close();
  console.log(JSON.stringify({ ok: true, home, practice, floating, arranged }, null, 2));
} finally {
  server.kill();
}

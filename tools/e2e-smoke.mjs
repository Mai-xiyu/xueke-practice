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
  if (home.subjects !== 9 || home.colleges !== 3) throw new Error(`home check failed ${JSON.stringify(home)}`);

  await page.goto(`${base}/data_visualization_practice.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".question-card");
  await page.locator(".option").first().click();
  await page.getByText("提交/查看解析").click();
  await page.waitForSelector(".analysis");
  const practice = await page.evaluate(() => ({
    stats: document.querySelectorAll(".stat-card").length,
    answerButtons: document.querySelectorAll(".answer-card__btn").length,
    hasAnalysis: Boolean(document.querySelector(".analysis")),
    title: document.querySelector(".subject-head h1")?.textContent
  }));
  if (practice.stats !== 5 || !practice.hasAnalysis || !practice.answerButtons || !practice.title?.includes("数据可视化")) {
    throw new Error(`practice check failed ${JSON.stringify(practice)}`);
  }

  await browser.close();
  console.log(JSON.stringify({ ok: true, home, practice }, null, 2));
} finally {
  server.kill();
}

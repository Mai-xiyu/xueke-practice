const http = require("http");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.SESSION_DATA_DIR || path.join(__dirname, "data");
const MAX_BODY = 2 * 1024 * 1024;
const CLIENT_ID_COOKIE = "study_hub_client_id";
const DEV_AUTH_COOKIE = "study_dev_session";
const DEV_DASHBOARD_PASSWORD = process.env.DEV_DASHBOARD_PASSWORD || process.env.DASHBOARD_PASSWORD || "123456";
const DEV_SESSION_TTL_MS = Number(process.env.DEV_SESSION_TTL_SECONDS || 12 * 60 * 60) * 1000;
const ONLINE_WINDOW_MS = Number(process.env.DASHBOARD_ONLINE_WINDOW_SECONDS || 300) * 1000;
const MAX_IP_HISTORY = 20;
const devSessions = new Map();

function json(res, status, body, headers = {}) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": data.length,
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(data);
}

function text(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function html(res, status, body) {
  const data = Buffer.from(body);
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": data.length,
    "Cache-Control": "no-store"
  });
  res.end(data);
}

function dockerNatIp(ip) {
  return /^172\.(1[6-9]|2\d|3[01])\.0\.1$/.test(ip);
}

function requestIpInfo(req) {
  const real = req.headers["x-real-ip"];
  const forwarded = req.headers["x-forwarded-for"];
  const realIp = String(Array.isArray(real) ? real[0] : real || "").trim();
  const forwardedChain = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const socketIp = String(req.socket.remoteAddress || "").trim().replace(/^::ffff:/, "");
  const raw = realIp
    || forwardedChain[0]
    || socketIp
    || req.socket.remoteAddress
    || "unknown";
  const ip = String(raw).trim().replace(/^::ffff:/, "");
  const throughDockerNat = dockerNatIp(ip);
  return {
    ip,
    realIp,
    forwardedFor: forwardedChain,
    socketIp,
    throughDockerNat,
    displayIp: throughDockerNat ? "Docker NAT（真实 IP 不可见）" : ip,
    note: throughDockerNat ? "Docker Desktop 已隐藏真实客户端 IP，请以设备 ID / Cookie 识别用户。" : ""
  };
}

function clientIp(req) {
  return requestIpInfo(req).ip;
}

function safeName(ip) {
  return ip.replace(/[^0-9A-Za-z_.-]/g, "_") || "unknown";
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const safeDecode = (value) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  return Object.fromEntries(String(header).split(";").map((part) => {
    const [name, ...rest] = part.trim().split("=");
    if (!name) return ["", ""];
    return [safeDecode(name), safeDecode(rest.join("=") || "")];
  }).filter(([name]) => name));
}

function clientIdentity(req, url, ip) {
  const header = req.headers["x-study-client"];
  const cookies = parseCookies(req);
  const raw = Array.isArray(header) ? header[0] : header || url.searchParams.get("client") || cookies[CLIENT_ID_COOKIE] || "";
  const value = safeName(String(raw).trim()).slice(0, 120);
  if (value && value !== "unknown") {
    return { id: value, type: "client" };
  }
  return { id: safeName(ip), type: "ip" };
}

function safeApp(app) {
  const value = String(app || "default").trim();
  return value.replace(/[^0-9A-Za-z_.-]/g, "_").slice(0, 120) || "default";
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY) {
      const err = new Error("request body too large");
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error("invalid json body");
    err.status = 400;
    throw err;
  }
}

async function readSession(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return { createdAt: new Date().toISOString(), apps: {} };
    throw err;
  }
}

async function writeSession(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

function userAgent(req) {
  const value = req.headers["user-agent"];
  return String(Array.isArray(value) ? value[0] : value || "").slice(0, 300);
}

function pushUniqueIp(history, ip, now) {
  const next = Array.isArray(history) ? history.filter((item) => item && item.ip !== ip) : [];
  next.unshift({ ip, lastSeenAt: now });
  return next.slice(0, MAX_IP_HISTORY);
}

function touchSession(session, req, app, ip, identity, network) {
  const now = new Date().toISOString();
  session.createdAt ||= now;
  session.firstSeenAt ||= session.createdAt;
  session.lastSeenAt = now;
  session.currentIp = ip;
  session.ip = ip;
  session.network = network;
  session.identity = identity;
  session.userAgent = userAgent(req);
  session.lastApp = app;
  session.ipHistory = pushUniqueIp(session.ipHistory, ip, now);
  return now;
}

function appSummaries(apps) {
  return Object.values(apps || {}).map((item) => {
    const localStorage = item.localStorage && typeof item.localStorage === "object" ? item.localStorage : {};
    const keys = Object.keys(localStorage);
    return {
      app: item.app,
      updatedAt: item.updatedAt,
      title: item.meta?.title || "",
      path: item.meta?.path || "",
      savedAt: item.meta?.savedAt || "",
      localStorageKeys: keys.length,
      progressKeys: keys.filter((key) => key.startsWith("studyhub:v2:")).length,
      storageBytes: Buffer.byteLength(JSON.stringify(localStorage), "utf8")
    };
  }).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function latestAppPath(apps) {
  return appSummaries(apps)[0]?.path || "";
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function createDevSession() {
  const token = crypto.randomBytes(32).toString("hex");
  devSessions.set(token, Date.now() + DEV_SESSION_TTL_MS);
  return token;
}

function pruneDevSessions() {
  const now = Date.now();
  for (const [token, expiresAt] of devSessions.entries()) {
    if (expiresAt <= now) devSessions.delete(token);
  }
}

function devCookie(token) {
  return `${DEV_AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${Math.floor(DEV_SESSION_TTL_MS / 1000)}; HttpOnly; SameSite=Lax`;
}

function isDevAuthorized(req) {
  pruneDevSessions();
  const cookies = parseCookies(req);
  const token = cookies[DEV_AUTH_COOKIE];
  return Boolean(token && devSessions.has(token));
}

async function listSessions() {
  let files = [];
  try {
    files = await fs.readdir(DATA_DIR);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  const sessions = [];
  for (const name of files.filter((file) => file.endsWith(".json"))) {
    const file = path.join(DATA_DIR, name);
    try {
      const session = await readSession(file);
      const apps = appSummaries(session.apps);
      const fallbackIp = session.currentIp || session.ip || "unknown";
      const fallbackDockerNat = dockerNatIp(fallbackIp);
      const network = session.network && typeof session.network === "object"
        ? session.network
        : {
            ip: fallbackIp,
            displayIp: fallbackDockerNat ? "Docker NAT（真实 IP 不可见）" : fallbackIp,
            throughDockerNat: fallbackDockerNat,
            note: fallbackDockerNat ? "Docker Desktop 已隐藏真实客户端 IP，请以设备 ID / Cookie 识别用户。" : ""
          };
      sessions.push({
        id: path.basename(name, ".json"),
        identity: session.identity || { id: path.basename(name, ".json"), type: "file" },
        currentIp: session.currentIp || session.ip || "unknown",
        displayIp: network.displayIp || session.currentIp || session.ip || "unknown",
        network,
        ipHistory: Array.isArray(session.ipHistory) ? session.ipHistory : [],
        firstSeenAt: session.firstSeenAt || session.createdAt || null,
        lastSeenAt: session.lastSeenAt || session.updatedAt || null,
        updatedAt: session.updatedAt || null,
        userAgent: session.userAgent || "",
        lastPath: latestAppPath(session.apps),
        apps,
        appCount: apps.length,
        storageBytes: apps.reduce((sum, app) => sum + app.storageBytes, 0)
      });
    } catch {
      // Ignore malformed session snapshots instead of breaking the dashboard.
    }
  }
  return sessions.sort((a, b) => String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || "")));
}

async function dashboardPayload() {
  const now = Date.now();
  const sessions = await listSessions();
  const online = sessions.filter((session) => session.lastSeenAt && now - new Date(session.lastSeenAt).getTime() <= ONLINE_WINDOW_MS);
  const ipMap = new Map();
  for (const session of sessions) {
    const ip = session.displayIp || session.currentIp || "unknown";
    const entry = ipMap.get(ip) || { ip, sessions: 0, online: 0, lastSeenAt: null, throughDockerNat: Boolean(session.network?.throughDockerNat), note: session.network?.note || "" };
    entry.sessions += 1;
    if (online.some((item) => item.id === session.id)) entry.online += 1;
    if (!entry.lastSeenAt || String(session.lastSeenAt || "") > entry.lastSeenAt) entry.lastSeenAt = session.lastSeenAt;
    entry.throughDockerNat ||= Boolean(session.network?.throughDockerNat);
    entry.note ||= session.network?.note || "";
    ipMap.set(ip, entry);
  }
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    onlineWindowSeconds: Math.round(ONLINE_WINDOW_MS / 1000),
    totals: {
      sessions: sessions.length,
      online: online.length,
      uniqueIps: ipMap.size,
      appSnapshots: sessions.reduce((sum, session) => sum + session.appCount, 0),
      storageBytes: sessions.reduce((sum, session) => sum + session.storageBytes, 0)
    },
    onlineClients: online,
    activeIps: Array.from(ipMap.values()).sort((a, b) => String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || ""))),
    devices: sessions
  };
}

async function handleDevLogin(req, res) {
  if (req.method !== "POST") return text(res, 405, "method not allowed\n");
  const body = await readBody(req);
  if (!safeEqual(body.password || "", DEV_DASHBOARD_PASSWORD)) {
    return json(res, 401, { ok: false, error: "password rejected" });
  }
  return json(res, 200, { ok: true }, { "Set-Cookie": devCookie(createDevSession()) });
}

async function handleDevLogout(req, res) {
  if (req.method !== "POST") return text(res, 405, "method not allowed\n");
  const cookies = parseCookies(req);
  if (cookies[DEV_AUTH_COOKIE]) devSessions.delete(cookies[DEV_AUTH_COOKIE]);
  return json(res, 200, { ok: true }, { "Set-Cookie": `${DEV_AUTH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax` });
}

async function handleDevDashboard(req, res) {
  if (req.method !== "GET") return text(res, 405, "method not allowed\n");
  if (!isDevAuthorized(req)) {
    return json(res, 401, { ok: false, error: "developer login required" });
  }
  return json(res, 200, await dashboardPayload());
}

function devDashboardHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>开发者仪表盘</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f3f6fb;
      --panel: #fff;
      --border: #d9e2f0;
      --muted: #6b7890;
      --text: #0f172a;
      --blue: #2563eb;
      --blue-dark: #1d4ed8;
      --danger: #b91c1c;
      font-family: "Inter", "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); }
    header { background: #fff; border-bottom: 1px solid var(--border); }
    .wrap { width: min(1180px, calc(100% - 40px)); margin: 0 auto; }
    .top { min-height: 58px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 20px; }
    main { padding: 24px 0 70px; }
    .muted, small { color: var(--muted); }
    .login, .panel, .stat { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 22px rgba(15, 23, 42, .05); }
    .login { max-width: 420px; margin: 80px auto; padding: 24px; display: grid; gap: 14px; }
    label { display: grid; gap: 8px; color: var(--muted); font-size: 14px; }
    input { height: 42px; padding: 0 12px; border: 1px solid var(--border); border-radius: 6px; font: inherit; }
    button { height: 42px; padding: 0 16px; border: 0; border-radius: 6px; background: var(--blue); color: #fff; font-weight: 700; cursor: pointer; }
    button:hover { background: var(--blue-dark); }
    button.secondary { background: #eef4ff; color: var(--blue); }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .error { color: var(--danger); min-height: 20px; }
    .hidden { display: none !important; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
    .stat { min-height: 92px; padding: 16px; display: grid; align-content: center; gap: 6px; }
    .stat b { font-size: 26px; }
    .grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); gap: 14px; margin-bottom: 14px; }
    .panel { padding: 18px; }
    .panel-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; min-width: 720px; border-collapse: collapse; }
    th, td { padding: 11px 10px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
    th { color: var(--muted); font-size: 13px; }
    code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; }
    .ip-list, .devices { display: grid; gap: 10px; }
    .ip-item, .device { background: #f8fbff; border: 1px solid var(--border); border-radius: 7px; padding: 12px; }
    .device { display: grid; gap: 10px; }
    .device-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .device-grid div { min-width: 0; }
    .break { overflow-wrap: anywhere; }
    details { border-top: 1px solid var(--border); padding-top: 8px; }
    summary { cursor: pointer; font-weight: 700; }
    ul { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 8px; }
    li { background: #fff; border-radius: 6px; padding: 8px; display: grid; gap: 3px; }
    @media (max-width: 900px) { .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } .grid { grid-template-columns: 1fr; } }
    @media (max-width: 620px) { .wrap { width: min(100% - 20px, 100%); } .stats, .device-grid { grid-template-columns: 1fr; } .top { align-items: flex-start; flex-direction: column; padding: 12px 0; } }
  </style>
</head>
<body>
  <header>
    <div class="wrap top">
      <div>
        <h1>开发者仪表盘</h1>
        <p class="muted">后端会话、在线设备、访问来源和进度快照汇总。Docker Desktop 部署下源 IP 可能显示为 Docker NAT，请以设备 ID / Cookie 为准。</p>
      </div>
      <div class="actions" id="toolbar">
        <button class="secondary" type="button" id="refresh">刷新</button>
        <button class="secondary" type="button" id="logout">退出</button>
      </div>
    </div>
  </header>
  <main class="wrap">
    <form class="login hidden" id="login-form">
      <h2>登录</h2>
      <p class="muted">请输入后端配置的开发者密码。</p>
      <label>密码<input id="password" type="password" autocomplete="current-password" required /></label>
      <button type="submit">进入仪表盘</button>
      <p class="error" id="login-error"></p>
    </form>
    <section id="dashboard" class="hidden">
      <p class="muted" id="generated"></p>
      <div class="stats" id="stats"></div>
      <div class="grid">
        <article class="panel">
          <div class="panel-head"><h2>当前在线</h2><span class="muted" id="online-note"></span></div>
          <div class="table-wrap"><table><thead><tr><th>客户端</th><th>来源</th><th>最近路径</th><th>最后活跃</th></tr></thead><tbody id="online"></tbody></table></div>
        </article>
        <article class="panel">
          <div class="panel-head"><h2>来源汇总</h2><span class="muted" id="ip-count"></span></div>
          <div class="ip-list" id="ips"></div>
        </article>
      </div>
      <article class="panel">
        <div class="panel-head"><h2>历史 Session 设备</h2><span class="muted" id="device-count"></span></div>
        <div class="devices" id="devices"></div>
      </article>
    </section>
    <p class="error" id="page-error"></p>
  </main>
  <script>
    const loginForm = document.getElementById("login-form");
    const password = document.getElementById("password");
    const loginError = document.getElementById("login-error");
    const pageError = document.getElementById("page-error");
    const dashboard = document.getElementById("dashboard");
    const toolbar = document.getElementById("toolbar");

    function esc(value) {
      return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
    }
    function formatTime(value) {
      if (!value) return "-";
      return new Date(value).toLocaleString("zh-CN", { hour12: false });
    }
    function formatBytes(value) {
      if (value < 1024) return value + " B";
      if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB";
      return (value / 1024 / 1024).toFixed(1) + " MB";
    }
    async function api(path, options = {}) {
      const response = await fetch("/api/" + path, { credentials: "same-origin", ...options });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(body.error || "request failed " + response.status);
        error.status = response.status;
        throw error;
      }
      return body;
    }
    function showLogin(message = "") {
      toolbar.classList.add("hidden");
      dashboard.classList.add("hidden");
      loginForm.classList.remove("hidden");
      loginError.textContent = message;
      password.focus();
    }
    function showDashboard() {
      toolbar.classList.remove("hidden");
      loginForm.classList.add("hidden");
      dashboard.classList.remove("hidden");
    }
    function stat(label, value, note) {
      return "<div class=\\"stat\\"><span class=\\"muted\\">" + esc(label) + "</span><b>" + esc(value) + "</b><small>" + esc(note) + "</small></div>";
    }
    function render(data) {
      showDashboard();
      document.getElementById("generated").textContent = "生成时间：" + formatTime(data.generatedAt);
      document.getElementById("stats").innerHTML = [
        stat("在线设备", data.totals.online, data.onlineWindowSeconds + " 秒窗口"),
        stat("历史设备", data.totals.sessions, "有 session 文件"),
        stat("访问来源", data.totals.uniqueIps, "Docker NAT 下真实 IP 可能不可见"),
        stat("应用快照", data.totals.appSnapshots, formatBytes(data.totals.storageBytes))
      ].join("");
      document.getElementById("online-note").textContent = data.onlineClients.length + " 台";
      document.getElementById("online").innerHTML = data.onlineClients.length
        ? data.onlineClients.map((item) => "<tr><td><code>" + esc(item.id) + "</code><small class=\\"muted\\">" + esc(item.identity.type) + "</small></td><td>" + esc(item.displayIp || item.currentIp) + "<small>" + esc(item.network?.note || "") + "</small></td><td class=\\"break\\">" + esc(item.lastPath || "-") + "</td><td>" + esc(formatTime(item.lastSeenAt)) + "</td></tr>").join("")
        : "<tr><td colspan=\\"4\\">当前没有最近活跃的客户端。</td></tr>";
      document.getElementById("ip-count").textContent = data.activeIps.length + " 个";
      document.getElementById("ips").innerHTML = data.activeIps.map((item) => "<div class=\\"ip-item\\"><b>" + esc(item.ip) + "</b><p class=\\"muted\\">" + esc(item.online) + " 在线 / " + esc(item.sessions) + " 历史</p><small>" + esc(item.note || formatTime(item.lastSeenAt)) + "</small></div>").join("") || "<p class=\\"muted\\">暂无来源数据。</p>";
      document.getElementById("device-count").textContent = Math.min(data.devices.length, 50) + " / " + data.devices.length;
      document.getElementById("devices").innerHTML = data.devices.slice(0, 50).map((device) => {
        const apps = device.apps.length ? "<ul>" + device.apps.map((app) => "<li><code>" + esc(app.app) + "</code><span class=\\"break\\">" + esc(app.title || app.path || "-") + "</span><small>" + esc(app.progressKeys) + " 个进度 key / " + esc(app.localStorageKeys) + " 个 localStorage key / " + esc(formatTime(app.updatedAt)) + "</small></li>").join("") + "</ul>" : "<p class=\\"muted\\">暂无应用快照。</p>";
        return "<section class=\\"device\\"><h3 class=\\"break\\">" + esc(device.id) + "</h3><p class=\\"muted\\">" + esc(device.displayIp || device.currentIp) + " · " + esc(device.appCount) + " 个应用快照 · " + esc(formatBytes(device.storageBytes)) + "</p><div class=\\"device-grid\\"><div><small>首次</small><p>" + esc(formatTime(device.firstSeenAt)) + "</p></div><div><small>最近</small><p>" + esc(formatTime(device.lastSeenAt)) + "</p></div><div><small>路径</small><p class=\\"break\\">" + esc(device.lastPath || "-") + "</p></div><div><small>历史来源</small><p class=\\"break\\">" + esc(device.ipHistory.map((item) => item.ip).slice(0, 4).join(" / ") || "-") + "</p></div></div><details><summary>应用快照</summary>" + apps + "</details><small class=\\"break\\">" + esc(device.network?.note || device.userAgent || "unknown user-agent") + "</small></section>";
      }).join("") || "<p class=\\"muted\\">暂无历史设备。</p>";
    }
    async function load() {
      pageError.textContent = "";
      try {
        render(await api("dev-dashboard"));
      } catch (error) {
        if (error.status === 401) showLogin();
        else pageError.textContent = error.message || String(error);
      }
    }
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      loginError.textContent = "";
      try {
        await api("dev-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: password.value })
        });
        password.value = "";
        await load();
      } catch {
        showLogin("密码错误。");
      }
    });
    document.getElementById("refresh").addEventListener("click", load);
    document.getElementById("logout").addEventListener("click", async () => {
      await api("dev-logout", { method: "POST" }).catch(() => {});
      showLogin();
    });
    load();
    setInterval(load, 30000);
  </script>
</body>
</html>`;
}

async function handleSession(req, res, url) {
  const network = requestIpInfo(req);
  const ip = network.ip;
  const app = safeApp(url.searchParams.get("app"));
  const identity = clientIdentity(req, url, ip);
  const file = path.join(DATA_DIR, `${identity.id}.json`);
  const session = await readSession(file);
  const seenAt = touchSession(session, req, app, ip, identity, network);

  if (req.method === "GET") {
    await writeSession(file, session);
    return json(res, 200, {
      ip,
      network,
      identity,
      app: session.apps[app] || null,
      apps: Object.keys(session.apps || {}),
      updatedAt: session.updatedAt || null
    });
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    session.updatedAt = seenAt;
    session.apps ||= {};
    session.apps[app] = {
      updatedAt: session.updatedAt,
      app,
      localStorage: body.localStorage && typeof body.localStorage === "object" ? body.localStorage : {},
      meta: body.meta && typeof body.meta === "object" ? body.meta : {}
    };
    await writeSession(file, session);
    return json(res, 200, { ok: true, ip, network, identity, app, file: path.basename(file), updatedAt: session.updatedAt });
  }

  return text(res, 405, "method not allowed\n");
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const pathname = url.pathname.startsWith("/api/") ? url.pathname.slice(4) : url.pathname;
    if (pathname === "/health") return text(res, 200, "ok\n");
    if (pathname === "/dev.html") return html(res, 200, devDashboardHtml());
    if (pathname === "/dev-login") return await handleDevLogin(req, res);
    if (pathname === "/dev-logout") return await handleDevLogout(req, res);
    if (pathname === "/dev-dashboard" || pathname === "/dashboard") return await handleDevDashboard(req, res);
    if (pathname === "/session") return await handleSession(req, res, url);
    return text(res, 404, "not found\n");
  } catch (err) {
    const status = err.status || 500;
    return json(res, status, { ok: false, error: err.message || "server error" });
  }
});

server.listen(PORT, "0.0.0.0", async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  console.log(`session api listening on ${PORT}, data=${DATA_DIR}`);
});

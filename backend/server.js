const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.SESSION_DATA_DIR || path.join(__dirname, "data");
const MAX_BODY = 2 * 1024 * 1024;

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": data.length,
    "Cache-Control": "no-store"
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

function clientIp(req) {
  const real = req.headers["x-real-ip"];
  const forwarded = req.headers["x-forwarded-for"];
  const raw = (Array.isArray(real) ? real[0] : real)
    || (Array.isArray(forwarded) ? forwarded[0] : forwarded || "").split(",")[0]
    || req.socket.remoteAddress
    || "unknown";
  return String(raw).trim().replace(/^::ffff:/, "");
}

function safeName(ip) {
  return ip.replace(/[^0-9A-Za-z_.-]/g, "_") || "unknown";
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

async function handleSession(req, res, url) {
  const ip = clientIp(req);
  const app = safeApp(url.searchParams.get("app"));
  const file = path.join(DATA_DIR, `${safeName(ip)}.json`);
  const session = await readSession(file);

  if (req.method === "GET") {
    return json(res, 200, {
      ip,
      app: session.apps[app] || null,
      apps: Object.keys(session.apps || {}),
      updatedAt: session.updatedAt || null
    });
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    session.updatedAt = new Date().toISOString();
    session.ip = ip;
    session.apps ||= {};
    session.apps[app] = {
      updatedAt: session.updatedAt,
      app,
      localStorage: body.localStorage && typeof body.localStorage === "object" ? body.localStorage : {},
      meta: body.meta && typeof body.meta === "object" ? body.meta : {}
    };
    await writeSession(file, session);
    return json(res, 200, { ok: true, ip, app, file: path.basename(file), updatedAt: session.updatedAt });
  }

  return text(res, 405, "method not allowed\n");
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/health") return text(res, 200, "ok\n");
    if (url.pathname === "/session") return await handleSession(req, res, url);
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

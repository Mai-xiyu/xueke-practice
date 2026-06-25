(function () {
  const navLinks = [
    ["index.html", "总览"],
    ["network_practice.html", "路由交换"],
    ["network_info_security_practice.html", "网络安全"],
    ["network_data_collection_practice.html", "数据采集"],
    ["data_structure_practice.html", "数据结构"]
  ];

  function pageName() {
    const name = location.pathname.split("/").pop() || "index.html";
    return decodeURIComponent(name);
  }

  function ensureNav() {
    if (document.querySelector(".study-hub-nav")) return;
    const current = pageName();
    const nav = document.createElement("nav");
    nav.className = "study-hub-nav";
    nav.innerHTML = [
      '<div class="study-hub-nav-inner">',
      '<div class="study-hub-brand">学科练习系统</div>',
      '<div class="study-hub-links">',
      navLinks.map(([href, label]) => {
        const active = current === href ? " active" : "";
        return `<a class="${active}" href="${href}">${label}</a>`;
      }).join(""),
      '<span class="study-hub-sync" id="studyHubSync">本地</span>',
      '</div>',
      '</div>'
    ].join("");
    document.body.insertBefore(nav, document.body.firstChild);
  }

  function storageSnapshot() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      out[key] = localStorage.getItem(key);
    }
    return out;
  }

  function setStatus(text) {
    const el = document.getElementById("studyHubSync");
    if (el) el.textContent = text;
  }

  function apiAvailable() {
    return location.protocol === "http:" || location.protocol === "https:";
  }

  const clientKey = "study_hub_client_id";

  function ensureClientId() {
    let id = localStorage.getItem(clientKey);
    if (!id) {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        id = window.crypto.randomUUID();
      } else {
        id = `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }
      localStorage.setItem(clientKey, id);
    }
    return id;
  }

  const app = pageName();
  const clientId = ensureClientId();
  let timer = null;
  let disabled = !apiAvailable();

  function sessionUrl() {
    return `/api/session?app=${encodeURIComponent(app)}&client=${encodeURIComponent(clientId)}`;
  }

  async function loadRemote() {
    if (disabled) return;
    try {
      const res = await fetch(sessionUrl(), {
        credentials: "same-origin",
        headers: { "X-Study-Client": clientId }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const remote = data && data.app && data.app.localStorage ? data.app.localStorage : {};
      let changed = false;
      Object.keys(remote).forEach((key) => {
        if (localStorage.getItem(key) === null && typeof remote[key] === "string") {
          localStorage.setItem(key, remote[key]);
          changed = true;
        }
      });
      setStatus("进度已同步");
      if (changed) setTimeout(() => location.reload(), 80);
    } catch (_) {
      disabled = true;
      setStatus("本地");
    }
  }

  async function saveRemote() {
    if (disabled) return;
    try {
      const payload = {
        app,
        localStorage: storageSnapshot(),
        meta: {
          title: document.title,
          path: location.pathname,
          clientId,
          userAgent: navigator.userAgent,
          savedAt: new Date().toISOString()
        }
      };
      const res = await fetch(sessionUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Study-Client": clientId },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus("进度已保存");
    } catch (_) {
      disabled = true;
      setStatus("本地");
    }
  }

  function scheduleSave() {
    if (disabled) return;
    clearTimeout(timer);
    timer = setTimeout(saveRemote, 700);
  }

  function patchLocalStorage() {
    const rawSet = localStorage.setItem.bind(localStorage);
    const rawRemove = localStorage.removeItem.bind(localStorage);
    const rawClear = localStorage.clear.bind(localStorage);
    localStorage.setItem = function (key, value) {
      rawSet(key, value);
      scheduleSave();
    };
    localStorage.removeItem = function (key) {
      rawRemove(key);
      scheduleSave();
    };
    localStorage.clear = function () {
      rawClear();
      scheduleSave();
    };
  }

  window.addEventListener("storage", scheduleSave);
  window.addEventListener("beforeunload", () => {
    if (!disabled && navigator.sendBeacon) {
      const payload = JSON.stringify({
        app,
        localStorage: storageSnapshot(),
        meta: { title: document.title, clientId, savedAt: new Date().toISOString() }
      });
      navigator.sendBeacon(sessionUrl(), new Blob([payload], { type: "application/json" }));
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    ensureNav();
    patchLocalStorage();
    loadRemote().then(() => setTimeout(saveRemote, 1200));
  });
})();

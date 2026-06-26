(function () {
  const navLinks = [
    ["index.html", "总览"],
    ["network_practice.html", "路由交换"],
    ["network_info_security_practice.html", "网络安全"],
    ["network_data_collection_practice.html", "数据采集"],
    ["data_structure_practice.html", "数据结构"],
    ["linux_practice.html", "Linux课程"],
    ["modern_history_practice.html", "中国近代史"]
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

  function installPracticeShell() {
    if (pageName() === "index.html") return;
    const main = document.querySelector("main, .app, .wrap");
    if (!main) return;

    document.body.classList.add("practice-page");

    let nav = null;
    let grid = null;
    let lastTotal = 0;
    let updateTimer = null;

    function isVisible(el) {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    }

    function normalizePracticeFields() {
      document.querySelectorAll(".panel > .grid > .side").forEach((side) => {
        if (side.dataset.practiceFields === "wrapped") return;
        Array.from(side.children).forEach((child) => {
          const next = child.nextElementSibling;
          if (
            child.tagName === "LABEL" &&
            next &&
            /^(SELECT|INPUT|TEXTAREA)$/.test(next.tagName)
          ) {
            const field = document.createElement("div");
            field.className = "practice-field";
            side.insertBefore(field, child);
            field.append(child, next);
          }
        });
        side.dataset.practiceFields = "wrapped";
      });
    }

    function scopedText(selector, limit) {
      const el = document.querySelector(selector);
      return el ? (el.innerText || "").slice(0, limit || 2000) : "";
    }

    function parseProgress() {
      const chunks = [
        scopedText("#questionPanel", 1000),
        scopedText("#learn:not(.hidden)", 1400),
        scopedText("#exam:not(.hidden)", 1400),
        scopedText("#study:not(.hidden)", 1000),
        scopedText("#panel", 1000),
        scopedText("#learnInfo", 400),
        scopedText("main", 1800),
        scopedText(".app", 2200),
        scopedText(".wrap", 2200)
      ];
      for (const text of chunks) {
        const match = text.match(/(?:当前\s*)?(\d+)\s*\/\s*(\d+)/);
        if (match) {
          return {
            current: Number(match[1]),
            total: Number(match[2])
          };
        }
      }
      return { current: null, total: null };
    }

    function cardList() {
      return Array.from(document.querySelectorAll(".q-card")).filter(isVisible);
    }

    function currentFromCards() {
      const cards = cardList();
      if (cards.length < 2) return null;
      let bestIndex = 0;
      let bestDistance = Infinity;
      cards.forEach((card, index) => {
        const top = card.getBoundingClientRect().top;
        const distance = Math.abs(top - 92);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      return bestIndex + 1;
    }

    function detectTotal() {
      const candidates = [];
      const progress = parseProgress();
      if (progress.total) return progress.total;

      const totalCount = Number((document.getElementById("totalCount") || {}).innerText || 0);
      if (totalCount > 1) candidates.push(totalCount);

      const cards = cardList().length;
      if (cards > 1) candidates.push(cards);

      const text = [
        scopedText("header", 1500),
        scopedText("#learn:not(.hidden)", 1800),
        scopedText("#exam:not(.hidden)", 1800),
        scopedText("#learnInfo", 400),
        scopedText("#totalPill", 300),
        scopedText("#stats", 1000),
        scopedText("main", 2600),
        scopedText(".app", 3200),
        scopedText(".wrap", 3200)
      ].join("\n");

      const patterns = [
        /总题(?:库)?\s*(\d+)\s*题/g,
        /共\s*(\d+)\s*(?:题|道)/g,
        /(\d+)\s*题/g
      ];
      patterns.forEach((pattern) => {
        for (const match of text.matchAll(pattern)) {
          const value = Number(match[1]);
          if (value > 1 && value <= 1000) candidates.push(value);
        }
      });

      return candidates.length ? Math.max(...candidates) : 0;
    }

    function findStepButton(direction) {
      const labels = direction > 0 ? ["下一题", "下一道", "下一个"] : ["上一题", "上一道", "上一个"];
      return Array.from(document.querySelectorAll("button")).find((button) => {
        if (!isVisible(button) || button.disabled) return false;
        const text = (button.textContent || "").trim();
        return labels.some((label) => text.includes(label));
      });
    }

    function jumpByStepButtons(targetIndex) {
      const progress = parseProgress();
      const current = progress.current || currentFromCards() || 1;
      const delta = targetIndex - current;
      const direction = delta > 0 ? 1 : -1;
      for (let i = 0; i < Math.abs(delta); i += 1) {
        const button = findStepButton(direction);
        if (!button) break;
        button.click();
      }
    }

    function jumpToQuestion(index) {
      const cards = cardList();
      if (cards.length > 1 && cards[index - 1]) {
        cards[index - 1].scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(updateActive, 180);
        return;
      }
      jumpByStepButtons(index);
      scheduleUpdate();
    }

    function currentIndex() {
      const progress = parseProgress();
      return progress.current || currentFromCards() || 1;
    }

    function updateActive() {
      if (!grid) return;
      const active = currentIndex();
      grid.querySelectorAll(".practice-nav-btn").forEach((button) => {
        button.classList.toggle("active", Number(button.dataset.index) === active);
      });
    }

    function renderNav(total) {
      if (!total || total < 2) return;
      if (!nav) {
        nav = document.createElement("aside");
        nav.className = "practice-question-nav";
        nav.setAttribute("aria-label", "题号导航");
        document.body.appendChild(nav);
      }

      nav.innerHTML = "";
      const title = document.createElement("h2");
      title.textContent = "一、答题卡";
      const meta = document.createElement("div");
      meta.className = "practice-nav-meta";
      meta.textContent = `共 ${total} 题`;
      grid = document.createElement("div");
      grid.className = "practice-nav-grid";

      for (let i = 1; i <= total; i += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "practice-nav-btn";
        button.dataset.index = String(i);
        button.textContent = String(i);
        button.addEventListener("click", () => jumpToQuestion(i));
        grid.appendChild(button);
      }

      nav.append(title, meta, grid);
      lastTotal = total;
      updateActive();
    }

    function scheduleUpdate() {
      clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        normalizePracticeFields();
        const total = detectTotal();
        if (total && total !== lastTotal) {
          renderNav(total);
        } else {
          updateActive();
        }
      }, 80);
    }

    normalizePracticeFields();
    renderNav(detectTotal());
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    new MutationObserver(scheduleUpdate).observe(main, {
      childList: true,
      subtree: true,
      characterData: true
    });
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
    installPracticeShell();
    loadRemote().then(() => setTimeout(saveRemote, 1200));
  });
})();

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

    let nav = document.getElementById("practiceAnswerCard");
    let lastSignature = "";
    let updateTimer = null;
    const groups = [
      ["choice", "选择题"],
      ["fill", "填空题"],
      ["judge", "判断题"],
      ["short", "简答题"],
      ["code", "代码题"],
      ["comprehensive", "综合应用题"],
      ["other", "其他"]
    ];

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

    function ensureNav() {
      if (!nav) {
        nav = document.createElement("aside");
        nav.id = "practiceAnswerCard";
        nav.className = "practice-question-nav";
        nav.setAttribute("aria-label", "答题卡");
        document.body.appendChild(nav);
      }
      return nav;
    }

    function hideNav() {
      if (nav) {
        nav.hidden = true;
        nav.innerHTML = "";
      }
      document.body.classList.remove("has-practice-nav");
      lastSignature = "";
    }

    function normalizeType(type) {
      const value = String(type || "").toLowerCase();
      if (["single", "multiple", "choice", "select", "radio", "checkbox"].includes(value)) return "choice";
      if (["tf", "true_false", "judge", "judgement", "boolean"].includes(value)) return "judge";
      if (["fill", "blank", "completion"].includes(value)) return "fill";
      if (["short", "subjective", "essay"].includes(value)) return "short";
      if (["comprehensive", "application", "case"].includes(value)) return "comprehensive";
      if (["code", "program", "programming"].includes(value)) return "code";
      return "other";
    }

    function readPracticeModel() {
      if (typeof window.studyHubPracticeNav !== "function") return null;
      let raw = null;
      try {
        raw = window.studyHubPracticeNav();
      } catch (_) {
        return null;
      }
      if (!raw || (raw.mode && !["study", "learn"].includes(raw.mode))) return null;
      if (!Array.isArray(raw.items) || raw.items.length < 2) return null;
      const items = raw.items.map((item, index) => ({
        id: String(item.id || item.key || item.label || index + 1),
        index: Number(item.index || index + 1),
        label: String(item.label || index + 1),
        type: normalizeType(item.type || item.kind),
        done: Boolean(item.done),
        wrong: Boolean(item.wrong),
        marked: Boolean(item.marked)
      }));
      return {
        title: raw.title || "答题卡",
        current: Number(raw.current || raw.currentIndex || currentFromCards() || 1),
        items,
        jump: typeof raw.jump === "function" ? raw.jump : null
      };
    }

    function signatureOf(model) {
      return [
        model.current,
        model.items.length,
        model.items.map((item) => `${item.id}:${item.index}:${item.type}:${item.done ? 1 : 0}:${item.wrong ? 1 : 0}:${item.marked ? 1 : 0}`).join("|")
      ].join(";");
    }

    function jumpToQuestion(model, item) {
      if (model.jump) {
        model.jump(item.index, item);
        scheduleUpdate();
        setTimeout(scheduleUpdate, 220);
        return;
      }
      const cards = cardList();
      if (cards.length > 1 && cards[item.index - 1]) {
        cards[item.index - 1].scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(scheduleUpdate, 180);
      }
    }

    function renderNav(model) {
      if (!model) {
        hideNav();
        return;
      }
      const nextSignature = signatureOf(model);
      if (nextSignature === lastSignature) return;
      const box = ensureNav();
      box.hidden = false;
      document.body.classList.add("has-practice-nav");
      box.innerHTML = "";

      const title = document.createElement("h2");
      title.textContent = model.title;
      const meta = document.createElement("div");
      meta.className = "practice-nav-meta";
      meta.textContent = `当前 ${model.current} / ${model.items.length}`;
      box.append(title, meta);

      groups.forEach(([key, label]) => {
        const sectionItems = model.items.filter((item) => item.type === key);
        if (!sectionItems.length) return;

        const section = document.createElement("section");
        section.className = "practice-nav-section";
        const heading = document.createElement("div");
        heading.className = "practice-nav-section-title";
        heading.textContent = label;
        const grid = document.createElement("div");
        grid.className = "practice-nav-grid";

        sectionItems.forEach((item) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "practice-nav-btn";
          button.dataset.index = String(item.index);
          button.textContent = item.label;
          button.classList.toggle("active", item.index === model.current);
          button.classList.toggle("done", item.done);
          button.classList.toggle("wrongMini", item.wrong);
          button.classList.toggle("marked", item.marked);
          button.addEventListener("click", () => jumpToQuestion(model, item));
          grid.appendChild(button);
        });

        section.append(heading, grid);
        box.appendChild(section);
      });
      lastSignature = nextSignature;
    }

    function scheduleUpdate() {
      clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        normalizePracticeFields();
        renderNav(readPracticeModel());
      }, 80);
    }

    normalizePracticeFields();
    renderNav(readPracticeModel());
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    new MutationObserver(scheduleUpdate).observe(main, {
      attributes: true,
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

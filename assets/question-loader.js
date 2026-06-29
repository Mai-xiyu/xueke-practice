(function () {
  async function loadQuestionData(url, label) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("题库 JSON 顶层必须是数组");
      return data;
    } catch (error) {
      const message = `${label || "题库"}加载失败：${error.message}`;
      const target = document.querySelector("main, .app, .wrap, body");
      const box = document.createElement("div");
      box.className = "card";
      box.style.cssText = "margin:16px;padding:16px;border:1px solid #fecaca;background:#fff1f2;color:#991b1b;border-radius:8px;line-height:1.7";
      box.textContent = `${message}。请确认通过 HTTP 服务访问页面，且 ${url} 存在。`;
      target.prepend(box);
      throw error;
    }
  }

  window.studyHubLoadQuestions = loadQuestionData;
})();

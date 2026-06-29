import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / ".artifacts" / "higher_math_down_source"
ASSET_DIR = ROOT / "assets" / "higher_math_down"
PAGE = ROOT / "higher_math_down_practice.html"
OCR_CACHE = ROOT / ".artifacts" / "higher_math_down_ocr.json"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8", newline="\n")


def find_source_dir() -> Path:
    candidates = [p for p in SOURCE_ROOT.rglob("*") if p.is_dir() and list(p.glob("*.jpg"))]
    if not candidates:
        raise SystemExit(f"未找到已解压的高数下资料图片目录：{SOURCE_ROOT}")
    return sorted(candidates, key=lambda p: len(str(p)))[0]


def clean_ocr_lines(lines):
    banned = [
        "答题卡",
        "教师已设置",
        "上一题",
        "下一题",
        "交卷",
        "已经是最后一题",
        "请输入答案",
        "李昕萌",
        "麦尔丹",
        "202413",
        "高等数学",
    ]
    out = []
    for raw in lines:
        line = re.sub(r"\s+", " ", str(raw)).strip()
        if not line:
            continue
        if any(key in line for key in banned):
            continue
        if re.fullmatch(r"[\d:/'\".\- ]{3,}", line):
            continue
        if len(line) <= 1 and line.upper() not in {"A", "B", "C", "D"}:
            continue
        out.append(line)
    return out


def load_or_create_ocr(images, use_ocr: bool):
    if OCR_CACHE.exists():
        return json.loads(read_text(OCR_CACHE))
    if not use_ocr:
        return {}

    try:
        from rapidocr_onnxruntime import RapidOCR
    except Exception:
        return {}

    OCR_CACHE.parent.mkdir(parents=True, exist_ok=True)
    ocr = RapidOCR()
    cache = {}
    for index, image in enumerate(images, 1):
        try:
            result, _ = ocr(str(image))
            lines = [item[1] for item in result] if result else []
            cache[image.name] = clean_ocr_lines(lines)
            print(f"OCR {index}/{len(images)} {image.name}: {len(cache[image.name])} lines")
        except Exception as exc:
            cache[image.name] = []
            print(f"OCR failed {image.name}: {exc}")
    write_text(OCR_CACHE, json.dumps(cache, ensure_ascii=False, indent=2))
    return cache


def copy_images(images):
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    copied = []
    for index, image in enumerate(images, 1):
        name = f"math_down_{index:03d}{image.suffix.lower()}"
        target = ASSET_DIR / name
        shutil.copy2(image, target)
        copied.append((image, f"assets/higher_math_down/{name}"))
    return copied


def image_sort_key(path: Path):
    name = path.name
    if name.startswith("微信图片_2026062813"):
        return (0, name)
    paper_order = {
        "微信图片_20260629224235.jpg": 1,
        "微信图片_2026-06-29_224242_065.jpg": 2,
        "微信图片_2026-06-29_224247_308.jpg": 3,
    }
    return (1, paper_order.get(name, 99), name)


def image_kind(name: str, index: int):
    if name.startswith("微信图片_2026062813"):
        return "学习通截图题", "single", "选择题截图"
    if name in {"微信图片_20260629224235.jpg", "微信图片_2026-06-29_224242_065.jpg", "微信图片_2026-06-29_224247_308.jpg"}:
        return "2023-2024 A卷纸质卷", "comprehensive", "纸质卷图片"
    return "高数下截图资料", "short", "截图资料"


def build_questions(copied, ocr_cache):
    questions = []
    screenshot_no = 0
    paper_no = 0
    for index, (image, asset_path) in enumerate(copied, 1):
        chapter, qtype, source = image_kind(image.name, index)
        lines = ocr_cache.get(image.name, [])
        search_text = "\n".join(lines[:24]) if lines else ""
        if chapter == "学习通截图题":
            screenshot_no += 1
            question_line = next((line for line in lines if re.match(r"^\d+[.．、]", line)), "")
            suffix = f"：{question_line}" if question_line else "：见图作答，答案以截图中高亮选项为准。"
            stem = f"学习通截图题 {screenshot_no}{suffix}"
        elif chapter == "2023-2024 A卷纸质卷":
            paper_no += 1
            stem = f"2023-2024 学年第 2 学期高等数学A期末考试试卷图片第 {paper_no} 页。"
        else:
            stem = f"高数下截图资料 {index}：见原图。"
        search_text = "\n".join([stem, search_text]).strip()
        questions.append({
            "id": f"hm-down-img-{index:03d}",
            "source": source,
            "chapter": chapter,
            "type": qtype,
            "stem": stem,
            "image": asset_path,
            "answer": "见原图高亮或纸质资料。数学公式以图片为准。",
            "analysis": "该题来自用户提供的《高数下册期末资料.zip》。为避免数学公式、上下标和积分符号被 OCR 误改，题面以图片为准；OCR 摘要仅用于检索。",
            "searchText": search_text,
            "originalName": image.name,
        })

    material_cards = [
        {
            "id": "hm-down-doc-a",
            "source": "Word复习资料",
            "chapter": "Word复习资料",
            "type": "short",
            "stem": "复习1(5).docx：高数下册期末测试卷A卷，包含选择题、填空题、计算题和应用题。",
            "answer": "按原 Word 资料复习；公式未强行转文本。",
            "analysis": "Word 内大量公式是对象/图片形式，抽纯文本会丢失关键公式。页面将其作为复习资料索引保留，正式练习以截图题和纸质卷图片为准。",
            "searchText": "复习1 A卷 选择题 填空题 计算题 应用题 高等数学下册 期末",
        },
        {
            "id": "hm-down-doc-b",
            "source": "Word复习资料",
            "chapter": "Word复习资料",
            "type": "short",
            "stem": "复习2(5).docx：期末测试卷B卷，包含选择题、填空题、计算题和应用题。",
            "answer": "按原 Word 资料复习；公式未强行转文本。",
            "analysis": "该文件适合用作模拟卷结构参考。公式题建议打开原 Word 或结合截图复习，避免公式识别误差。",
            "searchText": "复习2 B卷 选择题 填空题 计算题 应用题 高等数学下册 期末",
        },
        {
            "id": "hm-down-doc-review",
            "source": "Word复习资料",
            "chapter": "Word复习资料",
            "type": "short",
            "stem": "高数下册  复习.docx：复习提纲，包含选择题与计算题方向。",
            "answer": "按原 Word 资料复习；公式未强行转文本。",
            "analysis": "该资料用于复习范围提示。系统保留为资料卡，可配合图片题面进行自测。",
            "searchText": "复习提纲 选择题 计算题 向量 多元函数 重积分 曲线积分 曲面积分 级数 微分方程",
        },
    ]
    return questions + material_cards


def html_template(questions):
    questions_json = json.dumps(questions, ensure_ascii=False, indent=2)
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>高等数学(下)练习系统</title>
  <link rel="stylesheet" href="assets/common.css">
  <script src="assets/session-sync.js" defer></script>
  <style>
    body{{margin:0;background:#f3f5f9;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC","Microsoft YaHei",Arial,sans-serif}}
    .app{{max-width:1180px;margin:0 auto;padding:24px}}
    .card,.toolbar{{background:#fff;border:1px solid #d9e2ef;border-radius:8px;padding:18px;margin-bottom:14px}}
    .toolbar{{display:grid;gap:12px}}
    .row{{display:flex;gap:10px;flex-wrap:wrap;align-items:center}}
    .tabs{{display:flex;gap:8px;flex-wrap:wrap}}
    .tabs button{{min-width:92px}}
    button,select,input,textarea{{border:1px solid #cbd5e1;border-radius:8px;padding:9px 12px;background:#fff;color:#0f172a;font:inherit}}
    button.primary,.tabs button.active{{background:#2563eb;border-color:#2563eb;color:#fff}}
    button.ghost{{background:#fff;color:#0f172a;border-color:#cbd5e1}}
    button.warn{{background:#b45309;border-color:#b45309;color:#fff}}
    input{{min-width:220px;flex:1}}
    textarea{{width:100%;min-height:118px;line-height:1.65;resize:vertical}}
    .muted{{color:#64748b}}
    .meta-line{{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;color:#64748b}}
    .pill{{display:inline-flex;align-items:center;min-height:26px;padding:4px 8px;border:1px solid #d9e2ef;border-radius:8px;background:#f8fafc;color:#475569;font-size:13px}}
    .stem{{font-size:18px;line-height:1.75;font-weight:700;margin:8px 0 14px;color:#0f172a}}
    .question-image-wrap{{margin:14px 0;border:1px solid #d9e2ef;border-radius:8px;background:#fff;overflow:hidden}}
    .question-image{{display:block;width:100%;height:auto;max-height:78vh;object-fit:contain;background:#fff}}
    .answer-box{{margin-top:14px;padding:14px 16px;border:1px solid #d9e2ef;border-left:4px solid #2563eb;border-radius:8px;background:#fbfdff;line-height:1.75}}
    .answer-box b{{display:block;margin-bottom:6px}}
    .library-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}}
    .library-item{{display:grid;gap:10px;padding:14px;border:1px solid #d9e2ef;border-radius:8px;background:#fff}}
    .thumb{{width:100%;height:150px;object-fit:cover;object-position:top;border:1px solid #e5e7eb;border-radius:8px;background:#fff}}
    .empty{{padding:28px;text-align:center;color:#64748b}}
    .hidden{{display:none!important}}
    @media (max-width:680px){{.app{{padding:14px}} input,select,button{{width:100%}} .question-image{{max-height:none}}}}
  </style>
</head>
<body data-practice-shell="higher-math-down">
<aside id="practiceAnswerCard" class="practice-question-nav" aria-label="答题卡" hidden></aside>
<main class="app">
  <header class="card">
    <h1>高等数学(下)练习系统</h1>
    <p class="muted">高数下册期末资料、学习通截图题、2023-2024 A卷纸质卷图片和 Word 复习资料。公式题以原图为准，避免 OCR 误改数学符号。</p>
  </header>

  <section class="toolbar">
    <div class="tabs" aria-label="练习模式">
      <button type="button" data-mode="study" class="active">学习模式</button>
      <button type="button" data-mode="wrong">错题本</button>
      <button type="button" data-mode="library">题库浏览</button>
      <button type="button" data-mode="materials">复习资料</button>
    </div>
    <div class="row">
      <select id="chapterFilter" aria-label="章节筛选"></select>
      <select id="typeFilter" aria-label="题型筛选"></select>
      <input id="searchBox" placeholder="搜索题干 / OCR 摘要 / 来源">
      <button id="randomBtn" type="button" class="primary">随机一题</button>
      <button id="resetBtn" type="button" class="ghost">重置本题</button>
    </div>
  </section>

  <section id="questionPanel"></section>
</main>

<script>
const STORAGE_KEY = "higher_math_down_practice_state_v1";
const QUESTIONS = {questions_json};

const TYPE_LABELS = {{
  single: "选择题截图",
  multiple: "选择题截图",
  fill: "填空题",
  judge: "判断题",
  short: "资料卡片",
  essay: "论述题",
  comprehensive: "试卷图片"
}};

let mode = "study";
let currentIndex = 0;
let currentList = [];

const state = loadState();
const els = {{}};

function loadState() {{
  try {{
    return Object.assign({{ done: {{}}, wrong: {{}}, notes: {{}} }}, JSON.parse(localStorage.getItem(STORAGE_KEY) || "{{}}"));
  }} catch (_) {{
    return {{ done: {{}}, wrong: {{}}, notes: {{}} }};
  }}
}}

function saveState() {{
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (typeof window.studyHubRefreshStats === "function") window.studyHubRefreshStats();
}}

function escapeHtml(value) {{
  return String(value ?? "").replace(/[&<>"']/g, ch => ({{"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}}[ch]));
}}

function typeGroup(type) {{
  if (["single", "multiple", "choice"].includes(type)) return "choice";
  if (type === "comprehensive") return "comprehensive";
  if (type === "fill") return "fill";
  if (type === "judge") return "judge";
  return "short";
}}

function typeLabel(type) {{
  return TYPE_LABELS[type] || "资料";
}}

function unique(values) {{
  return Array.from(new Set(values.filter(Boolean)));
}}

function initFilters() {{
  els.chapter.innerHTML = `<option value="all">全部分类</option>${{unique(QUESTIONS.map(q => q.chapter)).map(x => `<option value="${{escapeHtml(x)}}">${{escapeHtml(x)}}</option>`).join("")}}`;
  els.type.innerHTML = `<option value="all">全部题型</option>${{unique(QUESTIONS.map(q => typeGroup(q.type))).map(x => `<option value="${{escapeHtml(x)}}">${{escapeHtml(groupTitle(x))}}</option>`).join("")}}`;
}}

function groupTitle(group) {{
  return {{
    choice: "选择题",
    fill: "填空题",
    judge: "判断题",
    short: "资料/简答",
    essay: "论述题",
    comprehensive: "综合/试卷"
  }}[group] || "其他";
}}

function filteredQuestions() {{
  const chapter = els.chapter?.value || "all";
  const type = els.type?.value || "all";
  const keyword = (els.search?.value || "").trim().toLowerCase();
  let list = QUESTIONS.slice();
  if (mode === "wrong") list = list.filter(q => state.wrong[q.id]);
  if (mode === "materials") list = list.filter(q => q.chapter === "Word复习资料");
  if (chapter !== "all") list = list.filter(q => q.chapter === chapter);
  if (type !== "all") list = list.filter(q => typeGroup(q.type) === type);
  if (keyword) {{
    list = list.filter(q => [q.stem, q.answer, q.analysis, q.source, q.chapter, q.searchText, q.originalName].join("\\n").toLowerCase().includes(keyword));
  }}
  return list;
}}

function setMode(nextMode) {{
  mode = nextMode;
  currentIndex = 0;
  document.querySelectorAll(".tabs button").forEach(btn => btn.classList.toggle("active", btn.dataset.mode === mode));
  render();
}}

function goToQuestionById(id) {{
  mode = "study";
  document.querySelectorAll(".tabs button").forEach(btn => btn.classList.toggle("active", btn.dataset.mode === mode));
  currentList = filteredQuestions();
  const idx = currentList.findIndex(q => q.id === id);
  currentIndex = Math.max(0, idx);
  render();
  window.scrollTo({{ top: 0, behavior: "smooth" }});
}}

function markDone(q) {{
  state.done[q.id] = true;
  saveState();
  render();
}}

function toggleWrong(q) {{
  if (state.wrong[q.id]) delete state.wrong[q.id];
  else state.wrong[q.id] = true;
  saveState();
  render();
}}

function resetQuestion(q) {{
  delete state.done[q.id];
  delete state.wrong[q.id];
  delete state.notes[q.id];
  saveState();
  render();
}}

function updateNote(q, value) {{
  state.notes[q.id] = value;
  saveState();
}}

function renderQuestion(q) {{
  const done = !!state.done[q.id];
  const wrong = !!state.wrong[q.id];
  const note = state.notes[q.id] || "";
  const imageHtml = q.image ? `
    <div class="question-image-wrap">
      <img class="question-image" src="${{escapeHtml(q.image)}}" alt="${{escapeHtml(q.stem)}}">
    </div>
    <a class="pill" href="${{escapeHtml(q.image)}}" target="_blank" rel="noopener">打开原图</a>` : "";
  const answerHtml = done ? `
    <div class="answer-box">
      <b>参考答案：</b>
      <div>${{escapeHtml(q.answer)}}</div>
      <b style="margin-top:10px">解析：</b>
      <div>${{escapeHtml(q.analysis)}}</div>
    </div>` : "";
  return `
    <article class="card q-card" data-qid="${{escapeHtml(q.id)}}">
      <div class="meta-line">
        <span class="pill">学习模式 · ${{currentIndex + 1}}/${{currentList.length}}</span>
        <span class="pill">${{escapeHtml(q.chapter)}}</span>
        <span class="pill">${{escapeHtml(typeLabel(q.type))}}</span>
        <span class="pill">${{escapeHtml(q.source)}}</span>
        ${{wrong ? '<span class="pill" style="border-color:#fca5a5;color:#b91c1c;background:#fff1f2">已加入错题本</span>' : ""}}
      </div>
      <div class="stem">${{escapeHtml(q.stem)}}</div>
      ${{imageHtml}}
      <label class="muted" for="noteBox">自测记录</label>
      <textarea id="noteBox" placeholder="这里写自己的解题过程或答案。">${{escapeHtml(note)}}</textarea>
      <div class="row" style="margin-top:12px">
        <button type="button" class="primary" data-action="done">提交/查看解析</button>
        <button type="button" class="${{wrong ? "warn" : "ghost"}}" data-action="wrong">${{wrong ? "移出错题本" : "加入错题本"}}</button>
        <button type="button" class="ghost" data-action="prev">上一题</button>
        <button type="button" class="primary" data-action="next">下一题</button>
      </div>
      ${{answerHtml}}
    </article>`;
}}

function renderLibrary(list) {{
  if (!list.length) return `<div class="card empty">没有匹配的题目。</div>`;
  return `<div class="library-grid">${{list.map((q, idx) => `
    <article class="library-item">
      ${{q.image ? `<img class="thumb" src="${{escapeHtml(q.image)}}" alt="${{escapeHtml(q.stem)}}">` : ""}}
      <div class="meta-line"><span class="pill">${{escapeHtml(q.chapter)}}</span><span class="pill">${{escapeHtml(typeLabel(q.type))}}</span></div>
      <b>${{escapeHtml(q.stem)}}</b>
      <div class="muted">${{escapeHtml(q.originalName || q.source)}}</div>
      <button type="button" class="primary" data-open-id="${{escapeHtml(q.id)}}">开始练</button>
    </article>`).join("")}}</div>`;
}}

function render() {{
  currentList = filteredQuestions();
  if (currentIndex < 0) currentIndex = 0;
  if (currentIndex >= currentList.length) currentIndex = Math.max(0, currentList.length - 1);
  if (mode === "library" || mode === "materials") {{
    els.panel.innerHTML = renderLibrary(currentList);
    bindLibrary();
    return;
  }}
  if (!currentList.length) {{
    els.panel.innerHTML = `<div class="card empty">${{mode === "wrong" ? "错题本为空。" : "没有匹配的题目。"}}</div>`;
    return;
  }}
  els.panel.innerHTML = renderQuestion(currentList[currentIndex]);
  bindQuestion();
}}

function bindQuestion() {{
  const q = currentList[currentIndex];
  const note = document.getElementById("noteBox");
  if (note) note.addEventListener("input", event => updateNote(q, event.target.value));
  els.panel.querySelectorAll("[data-action]").forEach(btn => {{
    btn.addEventListener("click", () => {{
      const action = btn.dataset.action;
      if (action === "done") markDone(q);
      if (action === "wrong") toggleWrong(q);
      if (action === "prev") {{ currentIndex = Math.max(0, currentIndex - 1); render(); }}
      if (action === "next") {{ currentIndex = Math.min(currentList.length - 1, currentIndex + 1); render(); }}
    }});
  }});
}}

function bindLibrary() {{
  els.panel.querySelectorAll("[data-open-id]").forEach(btn => {{
    btn.addEventListener("click", () => goToQuestionById(btn.dataset.openId));
  }});
}}

function randomQuestion() {{
  const list = filteredQuestions();
  if (!list.length) return;
  currentIndex = Math.floor(Math.random() * list.length);
  mode = "study";
  document.querySelectorAll(".tabs button").forEach(btn => btn.classList.toggle("active", btn.dataset.mode === mode));
  render();
}}

window.studyHubPracticeStats = function () {{
  const total = QUESTIONS.length;
  const done = Object.keys(state.done).filter(id => QUESTIONS.some(q => q.id === id)).length;
  const wrong = Object.keys(state.wrong).filter(id => QUESTIONS.some(q => q.id === id)).length;
  return {{
    total,
    done,
    wrong,
    accuracy: done ? Math.max(0, (done - wrong) / done) : 0,
    extraLabel: "图片/资料",
    extraValue: `${{QUESTIONS.filter(q => q.image).length}}/${{QUESTIONS.filter(q => !q.image).length}}`
  }};
}};

window.studyHubPracticeNav = function () {{
  if (!["study", "wrong"].includes(mode) || currentList.length < 2) return null;
  return {{
    title: "答题卡",
    current: currentIndex + 1,
    mode: "study",
    items: currentList.map((q, idx) => ({{
      id: q.id,
      index: idx + 1,
      label: String(idx + 1),
      type: typeGroup(q.type),
      done: !!state.done[q.id],
      wrong: !!state.wrong[q.id]
    }})),
    jump(index) {{
      currentIndex = index - 1;
      render();
      window.scrollTo({{ top: 0, behavior: "smooth" }});
    }}
  }};
}};

document.addEventListener("DOMContentLoaded", () => {{
  els.chapter = document.getElementById("chapterFilter");
  els.type = document.getElementById("typeFilter");
  els.search = document.getElementById("searchBox");
  els.panel = document.getElementById("questionPanel");
  initFilters();
  document.querySelectorAll(".tabs button").forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
  els.chapter.addEventListener("change", () => {{ currentIndex = 0; render(); }});
  els.type.addEventListener("change", () => {{ currentIndex = 0; render(); }});
  els.search.addEventListener("input", () => {{ currentIndex = 0; render(); }});
  document.getElementById("randomBtn").addEventListener("click", randomQuestion);
  document.getElementById("resetBtn").addEventListener("click", () => {{
    if (currentList[currentIndex]) resetQuestion(currentList[currentIndex]);
  }});
  render();
}});
</script>
</body>
</html>
"""


def update_subjects():
    path = ROOT / "subjects.json"
    data = json.loads(read_text(path))
    subjects = [s for s in data["subjects"] if s.get("id") != "higher-math-down"]
    subjects.append({
        "id": "higher-math-down",
        "title": "高等数学(下)",
        "mark": "HM",
        "href": "higher_math_down_practice.html",
        "accent": "math",
        "description": "高数下册期末资料、学习通截图题、纸质卷图片和 Word 复习资料。",
        "order": 80,
    })
    data["subjects"] = sorted(subjects, key=lambda s: int(s.get("order", 999)))
    write_text(path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def update_index():
    path = ROOT / "index.html"
    text = read_text(path)
    if 'id: "higher-math-down"' not in text:
        insert = """      },
      {
        id: "higher-math-down",
        title: "高等数学(下)",
        mark: "HM",
        href: "higher_math_down_practice.html",
        accent: "math",
        description: "高数下册期末资料、学习通截图题、纸质卷图片和 Word 复习资料。"
"""
        text = text.replace("""      {
        id: "community",
        title: "中华民族共同体",
        mark: "CM",
        href: "community_practice.html",
        accent: "history",
        description: "超星《中华民族共同体概论》两套模拟测试去重题库，含单选、多选、判断和论述题。"
      }
""", """      {
        id: "community",
        title: "中华民族共同体",
        mark: "CM",
        href: "community_practice.html",
        accent: "history",
        description: "超星《中华民族共同体概论》两套模拟测试去重题库，含单选、多选、判断和论述题。"
""" + insert + "      }\n")
    write_text(path, text)


def update_session_sync():
    path = ROOT / "assets" / "session-sync.js"
    text = read_text(path)
    if "higher_math_down_practice.html" not in text:
        text = text.replace(
            '    ["community_practice.html", "\\u4e2d\\u534e\\u6c11\\u65cf\\u5171\\u540c\\u4f53"]',
            '    ["community_practice.html", "\\u4e2d\\u534e\\u6c11\\u65cf\\u5171\\u540c\\u4f53"],\n'
            '    ["higher_math_down_practice.html", "高等数学(下)"]',
        )
    write_text(path, text)


def update_common_css():
    path = ROOT / "assets" / "common.css"
    text = read_text(path)
    if ".subject-math" not in text:
        text = text.replace(".subject-history { --subject-accent: #b91c1c; }", ".subject-history { --subject-accent: #b91c1c; }\n.subject-math { --subject-accent: #0369a1; }")
    write_text(path, text)


def main():
    use_ocr = "--ocr" in sys.argv
    source_dir = find_source_dir()
    images = sorted(source_dir.glob("*.jpg"), key=image_sort_key)
    if not images:
      raise SystemExit(f"未找到 jpg 图片：{source_dir}")
    ocr_cache = load_or_create_ocr(images, use_ocr=use_ocr)
    copied = copy_images(images)
    questions = build_questions(copied, ocr_cache)
    write_text(PAGE, html_template(questions))
    update_subjects()
    update_index()
    update_session_sync()
    update_common_css()
    print(f"created {PAGE.name}: {len(questions)} items, {len(copied)} images")


if __name__ == "__main__":
    main()

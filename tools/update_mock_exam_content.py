from __future__ import annotations

import html
import json
import random
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / ".artifacts"


def norm_stem(text: str) -> str:
    text = html.unescape(str(text or ""))
    text = re.sub(r"\s+", "", text)
    text = text.replace("（", "(").replace("）", ")")
    return re.sub(r"[，。、“”‘’\"'`·:：；;,.!?？（）()《》<>【】\[\]]", "", text).lower()


def read_questions(path: Path) -> tuple[str, list[dict], str]:
    text = path.read_text(encoding="utf-8")
    marker = "const QUESTIONS = "
    start = text.index(marker)
    array_start = text.index("[", start)
    array_end = text.index("];", array_start)
    questions = json.loads(text[array_start : array_end + 1])
    return text[:start], questions, text[array_end + 2 :]


def write_questions(path: Path, prefix: str, questions: list[dict], tail: str) -> None:
    body = json.dumps(questions, ensure_ascii=False, indent=2)
    path.write_text(prefix + "const QUESTIONS = " + body + ";\n" + tail, encoding="utf-8")


def replace_toolbar(prefix: str, subject: str, description: str) -> str:
    prefix = re.sub(
        r"<p class=\"muted\">.*?</p>",
        f"<p class=\"muted\">{description}</p>",
        prefix,
        count=1,
        flags=re.S,
    )
    if 'id="examBtn"' not in prefix:
        prefix = prefix.replace(
            '<button id="resetBtn">重置本题</button>',
            '<button id="resetBtn">重置本题</button>\n      '
            '<button id="examBtn" class="primary">模拟考试</button>\n      '
            '<button id="exitExamBtn" class="hidden">退出模拟</button>\n      '
            '<span id="examInfo" class="muted"></span>',
        )
    prefix = prefix.replace(
        ".muted{color:#64748b}.hidden{display:none}.analysis",
        ".muted{color:#64748b}.hidden{display:none}.answer-code{white-space:pre-wrap;background:#0f172a;color:#e5e7eb;border-radius:8px;padding:12px;line-height:1.55;overflow:auto}.analysis",
    )
    if subject == "linux":
        prefix = prefix.replace(
            "超星 Linux 课程作业题库，共 300 道单选题。未显示标准答案的题目已标记为待补答案。",
            description,
        )
    return prefix


def parse_docx_mock() -> list[dict]:
    data_path = ARTIFACTS / "modern_history_mock_docx.json"
    if not data_path.exists():
        return []
    paragraphs = json.loads(data_path.read_text(encoding="utf-8")).get("paragraphs", [])
    current_type = None
    questions: list[dict] = []
    current: dict | None = None

    def flush() -> None:
        nonlocal current
        if current:
            if current["type"] == "judge" and not current.get("options"):
                current["options"] = {"A": "对", "B": "错"}
            questions.append(current)
            current = None

    for raw in paragraphs:
        line = re.sub(r"\s+", " ", str(raw).strip())
        if not line:
            continue
        if line.startswith("一、"):
            flush()
            current_type = "single"
            continue
        if line.startswith("二、"):
            flush()
            current_type = "multiple"
            continue
        if line.startswith("三、"):
            flush()
            current_type = "judge"
            continue

        match_q = re.match(r"^(\d+)\.\s*(.+)", line)
        if match_q and current_type:
            flush()
            order = int(match_q.group(1))
            current = {
                "id": f"mh-mock-docx-{order:03d}",
                "source": "中国近代史模拟试卷.docx",
                "chapter": "模拟试卷",
                "type": current_type,
                "stem": match_q.group(2).strip(),
                "options": {},
                "correct": [],
                "analysis": "来源：中国近代史模拟试卷.docx；标准答案待人工补充。",
                "examTags": ["modern-history-mock"],
                "mockOrder": order,
            }
            continue

        if current:
            inline_judge = re.match(r"^A\.\s*对\s+B\.\s*错$", line)
            if inline_judge:
                current["options"] = {"A": "对", "B": "错"}
                continue
            match_opt = re.match(r"^([A-D])\.\s*(.+)", line)
            if match_opt:
                current["options"][match_opt.group(1)] = match_opt.group(2).strip()
            else:
                current["stem"] += line
    flush()
    return questions


def parse_book118_description() -> list[dict]:
    path = ARTIFACTS / "book118_description.txt"
    if not path.exists():
        return []
    text = html.unescape(path.read_text(encoding="utf-8"))
    if "单项选择题" not in text:
        return []
    text = text.split("一、单项选择题", 1)[1]
    parts = re.split(r"\s(?=\d+、)", text)
    items: list[dict] = []
    for part in parts:
        match = re.match(r"(\d+)、(.+)", part.strip(), re.S)
        if not match:
            continue
        order = int(match.group(1))
        body = re.sub(r"\s+", " ", match.group(2)).strip()
        opt_a = body.find(" A.")
        if opt_a < 0:
            opt_a = body.find("A.")
        if opt_a < 0:
            continue
        stem = body[:opt_a].strip()
        opt_text = body[opt_a:].strip()
        opts = {}
        matches = list(re.finditer(r"([A-D])\.", opt_text))
        if len(matches) < 4:
            continue
        for i, m in enumerate(matches):
            start = m.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(opt_text)
            opts[m.group(1)] = opt_text[start:end].strip()
        if len(opts) == 4:
            items.append(
                {
                    "id": f"mh-book118-{order:03d}",
                    "source": "Book118公开摘要",
                    "chapter": "Book118模拟卷",
                    "type": "single",
                    "stem": stem,
                    "options": opts,
                    "correct": [],
                    "analysis": "来源：https://max.book118.com/html/2024/0104/8072025041006023.shtm 公开 HTML 摘要；标准答案待人工补充。",
                    "examTags": ["modern-history-book118"],
                }
            )
    return items


def merge_modern_history() -> dict:
    path = ROOT / "modern_history_practice.html"
    prefix, questions, tail = read_questions(path)
    seen = {norm_stem(q.get("stem") or q.get("title")): q for q in questions}
    added = 0
    duplicates = 0
    for q in parse_docx_mock():
        key = norm_stem(q["stem"])
        if key in seen:
            target = seen[key]
            tags = set(target.get("examTags") or [])
            tags.update(q.get("examTags") or [])
            target["examTags"] = sorted(tags)
            target.setdefault("mockOrder", q.get("mockOrder"))
            duplicates += 1
        else:
            questions.append(q)
            seen[key] = q
            added += 1
    book_added = 0
    book_duplicates = 0
    for q in parse_book118_description():
        key = norm_stem(q["stem"])
        if key in seen:
            target = seen[key]
            tags = set(target.get("examTags") or [])
            tags.update(q.get("examTags") or [])
            target["examTags"] = sorted(tags)
            book_duplicates += 1
        else:
            questions.append(q)
            seen[key] = q
            book_added += 1
    prefix = replace_toolbar(
        prefix,
        "modern",
        "截图题库、学习通章节测验与模拟试卷题源；模拟考试按 30 单选、15 多选、10 判断组卷，重复题干只保留一份。",
    )
    write_questions(path, prefix, questions, modern_tail())
    return {
        "modern_total": len(questions),
        "modern_docx_added": added,
        "modern_docx_duplicates": duplicates,
        "modern_book118_added": book_added,
        "modern_book118_duplicates": book_duplicates,
    }


def linux_extra_questions() -> list[dict]:
    judge = [
        ("linux-judge-001", "Linux 中 /etc 目录主要存放系统和服务配置文件。", "A", "/etc 是系统配置文件目录。"),
        ("linux-judge-002", "Linux 中 /proc 目录主要存放普通用户长期保存的文档。", "B", "/proc 是内核和进程信息的虚拟文件系统。"),
        ("linux-judge-003", "CentOS 7 可使用 systemctl reboot 重启系统。", "A", "systemctl reboot 可触发重启。"),
        ("linux-judge-004", "poweroff 命令用于注销当前用户但不关闭系统。", "B", "poweroff 用于关闭系统电源。"),
        ("linux-judge-005", "vi 普通模式下 dd 可以删除当前行。", "A", "dd 删除当前行。"),
        ("linux-judge-006", "vi 普通模式下 x 可以删除当前光标所在字符。", "A", "x 删除当前字符。"),
        ("linux-judge-007", "cd 命令用于切换当前工作目录。", "A", "cd 用于改变 shell 当前目录。"),
        ("linux-judge-008", "pwd 命令用于显示当前工作目录。", "A", "pwd 输出当前工作目录。"),
        ("linux-judge-009", "chmod 755 file 表示所有用户都拥有写权限。", "B", "755 中其他用户只有读和执行权限。"),
        ("linux-judge-010", "grep 常用于按模式检索文本内容。", "A", "grep 是常用文本检索命令。"),
        ("linux-judge-011", "Shell 脚本第一行 #!/usr/bin/env bash 通常用于指定解释器。", "A", "shebang 指定脚本解释器。"),
        ("linux-judge-012", "在 shell 脚本中 $# 表示脚本文件名。", "B", "$# 表示位置参数个数，$0 通常表示脚本名。"),
    ]
    fill = [
        ("linux-fill-001", "显示当前工作目录的命令是____。", ["pwd"], "pwd 输出当前目录。"),
        ("linux-fill-002", "切换当前目录的命令是____。", ["cd"], "cd 用于切换目录。"),
        ("linux-fill-003", "修改文件权限常用命令是____。", ["chmod"], "chmod 修改权限位。"),
        ("linux-fill-004", "Linux 超级用户用户名通常是____。", ["root"], "root 是超级用户。"),
        ("linux-fill-005", "Shell 脚本中表示位置参数个数的变量是____。", ["$#"], "$# 表示参数个数。"),
        ("linux-fill-006", "查看文本前 10 行常用____命令。", ["head"], "head 默认显示前 10 行。"),
        ("linux-fill-007", "按模式搜索文本常用____命令。", ["grep"], "grep 用于文本匹配检索。"),
        ("linux-fill-008", "创建目录常用____命令。", ["mkdir"], "mkdir 创建目录。"),
    ]
    extras: list[dict] = []
    for qid, stem, correct, analysis in judge:
        extras.append(
            {
                "id": qid,
                "source": "Linux模拟考试补充",
                "chapter": "Linux基础判断",
                "type": "judge",
                "stem": stem,
                "options": {"A": "对", "B": "错"},
                "correct": [correct],
                "analysis": analysis,
            }
        )
    for qid, stem, answers, analysis in fill:
        extras.append(
            {
                "id": qid,
                "source": "Linux模拟考试补充",
                "chapter": "Linux基础填空",
                "type": "fill",
                "stem": stem,
                "options": {},
                "answers": answers,
                "analysis": analysis,
            }
        )

    triangles = [
        ("linux-triangle-001", "Shell脚本：读取行数 n，输出左对齐递增实心直角三角形。", """#!/usr/bin/env bash
read -rp "请输入行数：" n
for ((i = 1; i <= n; i++)); do
    for ((j = 1; j <= i; j++)); do
        printf "*"
    done
    printf "\\n"
done"""),
        ("linux-triangle-002", "Shell脚本：读取行数 n，输出左对齐递增空心直角三角形。", """#!/usr/bin/env bash
read -rp "请输入行数：" n
for ((i = 1; i <= n; i++)); do
    for ((j = 1; j <= i; j++)); do
        if ((j == 1 || j == i || i == n)); then printf "*"; else printf " "; fi
    done
    printf "\\n"
done"""),
        ("linux-triangle-003", "Shell脚本：读取行数 n，输出右对齐递减实心直角三角形。", """#!/usr/bin/env bash
read -rp "请输入行数：" n
for ((i = n; i >= 1; i--)); do
    for ((s = 0; s < n - i; s++)); do printf " "; done
    for ((j = 1; j <= i; j++)); do printf "*"; done
    printf "\\n"
done"""),
        ("linux-triangle-004", "Shell脚本：读取行数 n，输出右对齐递减空心直角三角形。", """#!/usr/bin/env bash
read -rp "请输入行数：" n
for ((i = n; i >= 1; i--)); do
    for ((s = 0; s < n - i; s++)); do printf " "; done
    for ((j = 1; j <= i; j++)); do
        if ((j == 1 || j == i || i == n)); then printf "*"; else printf " "; fi
    done
    printf "\\n"
done"""),
        ("linux-triangle-005", "Shell脚本：读取行数 n，输出左对齐递减实心直角三角形。", """#!/usr/bin/env bash
read -rp "请输入行数：" n
for ((i = n; i >= 1; i--)); do
    for ((j = 1; j <= i; j++)); do printf "*"; done
    printf "\\n"
done"""),
        ("linux-triangle-006", "Shell脚本：读取行数 n，输出左对齐递减空心直角三角形。", """#!/usr/bin/env bash
read -rp "请输入行数：" n
for ((i = n; i >= 1; i--)); do
    for ((j = 1; j <= i; j++)); do
        if ((j == 1 || j == i || i == n)); then printf "*"; else printf " "; fi
    done
    printf "\\n"
done"""),
        ("linux-triangle-007", "Shell脚本：读取行数 n，输出右对齐递增实心直角三角形。", """#!/usr/bin/env bash
read -rp "请输入行数：" n
for ((i = 1; i <= n; i++)); do
    for ((s = 0; s < n - i; s++)); do printf " "; done
    for ((j = 1; j <= i; j++)); do printf "*"; done
    printf "\\n"
done"""),
        ("linux-triangle-008", "Shell脚本：读取行数 n，输出右对齐递增空心直角三角形。", """#!/usr/bin/env bash
read -rp "请输入行数：" n
for ((i = 1; i <= n; i++)); do
    for ((s = 0; s < n - i; s++)); do printf " "; done
    for ((j = 1; j <= i; j++)); do
        if ((j == 1 || j == i || i == n)); then printf "*"; else printf " "; fi
    done
    printf "\\n"
done"""),
    ]
    for qid, stem, answer in triangles:
        extras.append(
            {
                "id": qid,
                "source": "Linux模拟考试补充",
                "chapter": "Shell脚本三角形",
                "type": "short",
                "stem": stem,
                "options": {},
                "answer": answer,
                "analysis": "模拟考试简答题从 8 种三角形脚本中随机抽 1 题。",
                "examPool": "linux-triangle",
            }
        )

    extras.append(
        {
            "id": "linux-short-001",
            "source": "Linux模拟考试补充",
            "chapter": "权限管理",
            "type": "short",
            "stem": "简述 Linux 文件权限 r、w、x 的含义，并说明 chmod 755 file 的权限效果。",
            "options": {},
            "answer": "r 表示读，w 表示写，x 表示执行。chmod 755 file 表示属主拥有读写执行权限，所属组和其他用户拥有读、执行权限。",
            "analysis": "考查权限位与 chmod 八进制表示。",
        }
    )

    comprehensive = [
        ("linux-comp-001", "Linux网络实战（一）- DNS配置", "说明 BIND/named 服务安装、主配置文件与区域文件配置、正反向解析记录编写、服务启动以及 nslookup/dig 验证过程。"),
        ("linux-comp-002", "Linux网络实战（二）- Samba服务器搭建", "说明 Samba 安装、共享目录创建、smb.conf 配置、用户映射/密码设置、服务启动、防火墙放行和客户端访问验证。"),
        ("linux-comp-003", "Linux网络实战（三）- WWW服务器搭建", "说明 Apache/Nginx 安装、站点根目录与首页配置、虚拟主机/端口配置、服务启动、防火墙放行和浏览器/curl 验证。"),
        ("linux-comp-004", "Linux网络实战（四）- FTP服务器搭建", "说明 vsftpd 安装、匿名或本地用户访问配置、上传目录权限、服务启动、防火墙/SELinux 注意点和 ftp/lftp 验证。"),
    ]
    for qid, title, answer in comprehensive:
        extras.append(
            {
                "id": qid,
                "source": "Educoder实训截图/链接",
                "chapter": "Linux网络实战",
                "type": "comprehensive",
                "stem": f"{title}：按实训要求给出关键配置步骤、主要配置文件、启动命令和验证方法。",
                "options": {},
                "answer": answer,
                "analysis": "来源：https://www.educoder.net/classrooms/J3A4RP9P/shixun_homework/1238445?tabs=0；浏览器控制通道不可用时按用户截图中的实训标题整理。",
            }
        )
    return extras


def merge_linux() -> dict:
    path = ROOT / "linux_practice.html"
    prefix, questions, _tail = read_questions(path)
    before = len(questions)
    questions = [q for q in questions if q.get("source") != "????"]
    removed_bad = before - len(questions)
    seen_ids = {q.get("id") for q in questions}
    seen = {norm_stem(q.get("stem") or q.get("title")) for q in questions}
    added = 0
    for q in linux_extra_questions():
        key = norm_stem(q["stem"])
        if q["id"] in seen_ids or key in seen:
            continue
        questions.append(q)
        seen_ids.add(q["id"])
        seen.add(key)
        added += 1
    prefix = replace_toolbar(
        prefix,
        "linux",
        "超星 Linux 作业题库 + 模拟考试补充题；模拟考试按 25 单选、5 填空、10 判断、2 简答、2 综合应用组卷。",
    )
    write_questions(path, prefix, questions, linux_tail())
    return {"linux_total": len(questions), "linux_removed_bad": removed_bad, "linux_added": added}


def common_tail(type_name: dict, storage_key: str, subject: str) -> str:
    type_json = json.dumps(type_name, ensure_ascii=False)
    build = "buildLinuxExam" if subject == "linux" else "buildModernExam"
    return f"""

const TYPE_NAME = {type_json};
let state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{{"answers":{{}},"wrong":{{}}}}');
let current = 0;
let examMode = false;
let examQuestions = [];

function save(){{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }}
function esc(s){{ return String(s ?? "").replace(/[&<>"']/g, c => ({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}}[c])); }}
function stemOf(q){{ return q.stem || q.title || ""; }}
function chapters(){{ return [...new Set(QUESTIONS.map(q => q.chapter || "未分章"))]; }}
function optionEntries(q){{
  if (Array.isArray(q.options)) return q.options.map(o => [o.label, o.text]);
  return Object.entries(q.options || {{}});
}}
function filtered(){{
  const ch = chapterFilter.value;
  const ty = typeFilter.value;
  const kw = searchBox.value.trim().toLowerCase();
  return QUESTIONS.filter(q => (!ch || q.chapter === ch) && (!ty || q.type === ty) && (!kw || JSON.stringify(q).toLowerCase().includes(kw)));
}}
function activeList(){{ return examMode ? examQuestions : filtered(); }}
function answerText(q){{
  if (q.type === "fill") return (q.answers || (Array.isArray(q.answer) ? q.answer : [q.answer]).filter(Boolean)).join(" / ");
  if (q.type === "short" || q.type === "code" || q.type === "comprehensive") return q.answer || "";
  const opts = q.options || {{}};
  return (q.correct || []).map(k => opts[k] ? `${{k}}. ${{opts[k]}}` : k).join(" / ");
}}
function hasKnownAnswer(q){{ return Boolean(answerText(q)); }}
function shuffleCopy(arr){{
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {{
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }}
  return copy;
}}
function pick(pool, count){{ return shuffleCopy(pool).slice(0, count); }}
function buildModernExam(){{
  const tagged = QUESTIONS.filter(q => (q.examTags || []).includes("modern-history-mock"));
  if (tagged.length >= 50) return tagged.slice().sort((a,b) => (a.mockOrder || 9999) - (b.mockOrder || 9999));
  return [
    ...pick(QUESTIONS.filter(q => q.type === "single"), 30),
    ...pick(QUESTIONS.filter(q => q.type === "multiple"), 15),
    ...pick(QUESTIONS.filter(q => q.type === "judge"), 10)
  ];
}}
function buildLinuxExam(){{
  const singles = QUESTIONS.filter(q => q.type === "single");
  const fills = QUESTIONS.filter(q => q.type === "fill");
  const judges = QUESTIONS.filter(q => q.type === "judge");
  const triangles = QUESTIONS.filter(q => q.examPool === "linux-triangle");
  const shortOther = QUESTIONS.filter(q => q.type === "short" && q.examPool !== "linux-triangle");
  const comprehensive = QUESTIONS.filter(q => q.type === "comprehensive");
  return [
    ...pick(singles, 25),
    ...pick(fills, 5),
    ...pick(judges, 10),
    ...pick(triangles, 1),
    ...pick(shortOther, 1),
    ...pick(comprehensive, 2)
  ];
}}
function startExam(){{
  examQuestions = {build}();
  examMode = true;
  current = 0;
  chapterFilter.disabled = true;
  typeFilter.disabled = true;
  searchBox.disabled = true;
  examBtn.classList.add("hidden");
  exitExamBtn.classList.remove("hidden");
  examInfo.textContent = `模拟考试：${{examQuestions.length}} 题`;
  render();
}}
function exitExam(){{
  examMode = false;
  examQuestions = [];
  current = 0;
  chapterFilter.disabled = false;
  typeFilter.disabled = false;
  searchBox.disabled = false;
  examBtn.classList.remove("hidden");
  exitExamBtn.classList.add("hidden");
  examInfo.textContent = "";
  render();
}}
function render(){{
  const list = activeList();
  if (!list.length) {{
    questionPanel.innerHTML = '<div class="card">没有匹配题目。</div>';
    return;
  }}
  current = Math.max(0, Math.min(current, list.length - 1));
  const q = list[current];
  const saved = state.answers[q.id];
  let body = "";
  if (q.type === "single" || q.type === "judge") {{
    body = optionEntries(q).map(([k,v]) => `<button class="option" data-answer="${{esc(k)}}"><b>${{esc(k)}}.</b> ${{esc(v)}}</button>`).join("");
  }} else if (q.type === "multiple") {{
    const savedSet = new Set(Array.isArray(saved) ? saved : []);
    body = optionEntries(q).map(([k,v]) => `<label class="option" data-option="${{esc(k)}}"><input type="checkbox" value="${{esc(k)}}" ${{savedSet.has(k) ? "checked" : ""}}> <b>${{esc(k)}}.</b> ${{esc(v)}}</label>`).join("");
  }} else {{
    body = `<textarea id="textAnswer" style="width:100%;min-height:150px">${{esc(saved || "")}}</textarea>`;
  }}
  questionPanel.innerHTML = `<article class="card">
    <p class="muted">${{examMode ? "模拟考试" : "学习模式"}} · ${{current + 1}}/${{list.length}} · ${{esc(q.source)}} · ${{esc(q.chapter)}} · ${{esc(TYPE_NAME[q.type] || q.type)}}</p>
    <h2>${{esc(stemOf(q))}}</h2>
    ${{body}}
    <div class="row"><button class="primary" id="showBtn">提交/查看解析</button><button id="prevBtn">上一题</button><button id="nextBtn">下一题</button></div>
    <div id="analysis" class="analysis hidden"></div>
  </article>`;
  if (q.type === "single" || q.type === "judge") {{
    questionPanel.querySelectorAll("[data-answer]").forEach(btn => btn.onclick = () => choose(q, btn.dataset.answer));
  }}
  showBtn.onclick = () => submit(q);
  prevBtn.onclick = () => {{ current -= 1; render(); }};
  nextBtn.onclick = () => {{ current += 1; render(); }};
}}
function choose(q, value){{
  state.answers[q.id] = value;
  const correct = q.correct || [];
  if (correct.length) {{
    const ok = correct.includes(value);
    if (ok) delete state.wrong[q.id]; else state.wrong[q.id] = value;
  }} else {{
    delete state.wrong[q.id];
  }}
  save();
  show(q);
}}
function submit(q){{
  if (q.type === "multiple") {{
    const selected = [...document.querySelectorAll('input[type="checkbox"]:checked')].map(x => x.value).sort();
    state.answers[q.id] = selected;
    const correct = [...(q.correct || [])].sort();
    if (correct.length) {{
      const ok = selected.length === correct.length && selected.every((x, i) => x === correct[i]);
      if (ok) delete state.wrong[q.id]; else state.wrong[q.id] = selected;
    }}
    save();
    show(q);
    return;
  }}
  const text = document.getElementById("textAnswer");
  if (text) {{ state.answers[q.id] = text.value; save(); }}
  show(q);
}}
function show(q){{
  const box = document.getElementById("analysis");
  const known = hasKnownAnswer(q);
  box.classList.remove("hidden");
  box.innerHTML = `<b>参考答案：</b><pre class="answer-code">${{known ? esc(answerText(q)) : "待补充"}}</pre><p>${{esc(q.analysis || "")}}</p>`;
  document.querySelectorAll(".option").forEach(el => {{
    if (!known) return;
    const value = el.dataset.answer || el.dataset.option;
    if ((q.correct || []).includes(value)) el.classList.add("correct");
    else el.classList.add("wrong");
  }});
}}
function init(){{
  chapterFilter.innerHTML = '<option value="">全部章节</option>' + chapters().map(x => `<option>${{esc(x)}}</option>`).join("");
  typeFilter.innerHTML = '<option value="">全部题型</option>' + Object.entries(TYPE_NAME).map(([k,v]) => `<option value="${{k}}">${{v}}</option>`).join("");
  [chapterFilter,typeFilter,searchBox].forEach(el => el.addEventListener("input", () => {{ current = 0; render(); }}));
  shuffleBtn.onclick = () => {{ const list = activeList(); current = Math.floor(Math.random() * list.length); render(); }};
  resetBtn.onclick = () => {{ const q = activeList()[current]; if (q) delete state.answers[q.id]; save(); render(); }};
  examBtn.onclick = startExam;
  exitExamBtn.onclick = exitExam;
  render();
}}
function practiceQuestionType(q){{
  if(q.type === "single" || q.type === "multiple") return "choice";
  if(q.type === "judge") return "judge";
  if(q.type === "short") return "short";
  if(q.type === "fill") return "fill";
  if(q.type === "code") return "code";
  if(q.type === "comprehensive") return "comprehensive";
  return "other";
}}
window.studyHubPracticeNav=()=>{{
  const list=activeList();
  if(!list.length)return null;
  return {{mode:'study',title:examMode?'模拟答题卡':'答题卡',current:current+1,items:list.map((q,i)=>({{id:q.id,index:i+1,label:String(i+1),type:practiceQuestionType(q),done:state.answers[q.id]!==undefined,wrong:Boolean(state.wrong[q.id])}})),jump(index){{current=Math.max(0,Math.min(index-1,list.length-1));render();window.scrollTo(0,0);}}}};
}};
init();
</script>
</body>
</html>
"""


def modern_tail() -> str:
    return common_tail(
        {
            "single": "单选题",
            "multiple": "多选题",
            "fill": "填空题",
            "judge": "判断题",
            "short": "简答题",
            "code": "代码题",
            "comprehensive": "综合应用题",
        },
        "modern_history_practice_state_v3",
        "modern",
    )


def linux_tail() -> str:
    return common_tail(
        {
            "single": "单选题",
            "multiple": "多选题",
            "fill": "填空题",
            "judge": "判断题",
            "short": "简答题",
            "code": "代码题",
            "comprehensive": "综合应用题",
        },
        "linux_practice_state_v2",
        "linux",
    )


def update_session_sync() -> None:
    path = ROOT / "assets" / "session-sync.js"
    text = path.read_text(encoding="utf-8")
    if '["comprehensive", "application", "case"]' not in text:
        text = text.replace(
            'if (["short", "subjective", "essay"].includes(value)) return "short";',
            'if (["short", "subjective", "essay"].includes(value)) return "short";\n'
            '      if (["comprehensive", "application", "case"].includes(value)) return "comprehensive";',
        )
    if '["comprehensive", "综合应用题"]' not in text:
        text = text.replace('["code", "代码题"],\n      ["other", "其他"]', '["code", "代码题"],\n      ["comprehensive", "综合应用题"],\n      ["other", "其他"]')
    text = text.replace(
        '["choice", "选择题"],\n      ["judge", "判断题"],\n      ["fill", "填空题"],',
        '["choice", "选择题"],\n      ["fill", "填空题"],\n      ["judge", "判断题"],',
    )
    path.write_text(text, encoding="utf-8")


def update_subjects() -> None:
    path = ROOT / "subjects.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    for item in data.get("subjects", []):
        if item.get("id") == "linux-course":
            item["description"] = "超星 Linux 课程题库与模拟考试，覆盖命令、权限、Shell、服务配置和网络实战。"
        if item.get("id") == "modern-history":
            item["description"] = "中国近现代史纲要题库、章节测验和模拟试卷，支持单选、多选、判断组卷。"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    result = {}
    result.update(merge_modern_history())
    result.update(merge_linux())
    update_session_sync()
    update_subjects()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    random.seed()
    main()

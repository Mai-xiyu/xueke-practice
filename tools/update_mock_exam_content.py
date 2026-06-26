from __future__ import annotations

import html
import json
import random
import re
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / ".artifacts"


def norm_stem(text: str) -> str:
    text = html.unescape(str(text or ""))
    text = re.sub(r"\s+", "", text)
    text = text.replace("（", "(").replace("）", ")")
    return re.sub(r"[，。、“”‘’\"'`·:：；;,.!?？（）()《》<>【】\[\]]", "", text).lower()


def split_options(text: str) -> dict[str, str]:
    text = re.sub(r"\s+", " ", str(text or "").strip())
    text = text.replace("．", ".")
    matches = list(re.finditer(r"([A-D])(?:[.、])?", text))
    if not matches:
        return {}
    options: dict[str, str] = {}
    for index, match in enumerate(matches):
        key = match.group(1)
        if key in options:
            continue
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        value = text[start:end].strip()
        if value:
            options[key] = value
    return options


def normalize_options(question: dict) -> None:
    options = question.get("options") or {}
    if not isinstance(options, dict) or not options:
        return
    joined = " ".join(f"{key}.{value}" for key, value in sorted(options.items()))
    parsed = split_options(joined)
    if len(parsed) > len(options):
        question["options"] = parsed


def read_docx_paragraphs(path: Path) -> list[str]:
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    with ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    paragraphs: list[str] = []
    for paragraph in root.findall(".//w:p", namespace):
        text = "".join(node.text or "" for node in paragraph.findall(".//w:t", namespace))
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            paragraphs.append(text)
    return paragraphs


def load_2023_b_paragraphs() -> list[str]:
    artifact = ARTIFACTS / "modern_history_2023_b_docx.json"
    if artifact.exists():
        return json.loads(artifact.read_text(encoding="utf-8")).get("paragraphs", [])
    downloads = Path.home() / "Downloads"
    matches = sorted(downloads.glob("2023 b*.docx"))
    if not matches:
        return []
    return read_docx_paragraphs(matches[0])


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


def parse_2023_b_docx() -> list[dict]:
    paragraphs = load_2023_b_paragraphs()
    if not paragraphs:
        return []

    try:
        answer_start = paragraphs.index("参考答案")
    except ValueError:
        answer_start = len(paragraphs)

    answer_map: dict[int, dict] = {}
    current_answer_no: int | None = None
    current_answer_type: str | None = None
    current_section = None

    def flush_answer() -> None:
        nonlocal current_answer_no, current_answer_type
        current_answer_no = None
        current_answer_type = None

    for raw in paragraphs[answer_start + 1 :]:
        line = re.sub(r"\s+", " ", raw.strip())
        if not line or line == "复制":
            continue
        if line.startswith("一、"):
            flush_answer()
            current_section = "single"
            continue
        if line.startswith("二、"):
            flush_answer()
            current_section = "multiple"
            continue
        if line.startswith("三、"):
            flush_answer()
            current_section = "judge"
            continue
        if line.startswith("四、"):
            flush_answer()
            current_section = "short"
            continue
        if line.startswith("五、"):
            flush_answer()
            current_section = "comprehensive"
            continue
        if line.startswith("六、"):
            flush_answer()
            current_section = "short"
            continue

        objective = re.match(r"^(\d+)[、.]\s*([A-D√×]+)$", line)
        if objective and current_section in {"single", "multiple", "judge"}:
            no = int(objective.group(1))
            value = objective.group(2)
            if current_section == "judge":
                correct = ["A"] if value == "√" else ["B"]
            else:
                correct = list(value)
            answer_map[no] = {"correct": correct}
            continue

        answer_match = re.match(r"^(\d+)[、.]\s*(?:答|【参考答案】)[:：]?\s*(.*)$", line)
        if answer_match:
            no = int(answer_match.group(1))
            answer_map[no] = {"answer": answer_match.group(2).strip()}
            current_answer_no = no
            current_answer_type = "text"
            continue
        if current_answer_no and current_answer_type == "text":
            answer_map[current_answer_no]["answer"] += "\n" + line

    current_type = None
    questions: list[dict] = []
    current: dict | None = None

    def flush() -> None:
        nonlocal current
        if not current:
            return
        no = current["originNo"]
        answer = answer_map.get(no, {})
        if current["type"] in {"single", "multiple", "judge"}:
            current["correct"] = answer.get("correct", [])
        else:
            current["answer"] = answer.get("answer", "")
        if current["type"] == "judge":
            current["options"] = {"A": "对", "B": "错"}
        normalize_options(current)
        questions.append(current)
        current = None

    for raw in paragraphs[:answer_start]:
        line = re.sub(r"\s+", " ", raw.strip())
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
        if line.startswith("四、"):
            flush()
            current_type = "short"
            continue
        if line.startswith("五、"):
            flush()
            current_type = "comprehensive"
            continue
        if line.startswith("六、"):
            flush()
            current_type = "short"
            continue

        match_q = re.match(r"^(\d+)[、.]\s*(.+)", line)
        if match_q and current_type:
            flush()
            order = int(match_q.group(1))
            chapter = {
                "single": "2023 B卷单选题",
                "multiple": "2023 B卷多选题",
                "judge": "2023 B卷判断题",
                "short": "2023 B卷主观题",
                "comprehensive": "2023 B卷材料分析题",
            }[current_type]
            current = {
                "id": f"mh-2023b-{order:03d}",
                "source": "2023 b卷.docx",
                "chapter": chapter,
                "type": current_type,
                "stem": match_q.group(2).strip(),
                "options": {},
                "correct": [],
                "analysis": "来源：2023年新疆师范大学公共课《中国近代史纲要》期末试卷B。",
                "examTags": ["modern-history-2023-b"],
                "mockOrder": order,
                "originNo": order,
            }
            continue

        if current:
            opts = split_options(line)
            if opts and current["type"] in {"single", "multiple"}:
                current["options"].update(opts)
            else:
                current["stem"] += "\n" + line
    flush()
    return questions


def parse_user_screenshots() -> list[dict]:
    path = ARTIFACTS / "modern_history_user_screenshots" / "parsed_questions.json"
    if not path.exists():
        return []
    questions = json.loads(path.read_text(encoding="utf-8"))
    manual_answers = {
        "mh-user-shot-023": ["A", "B", "C"],
        "mh-user-shot-036": ["D"],
        "mh-user-shot-039": ["C"],
        "mh-user-shot-042": ["D"],
        "mh-user-shot-043": ["D"],
        "mh-user-shot-046": ["C"],
        "mh-user-shot-047": ["D"],
        "mh-user-shot-048": ["D"],
        "mh-user-shot-051": ["C"],
        "mh-user-shot-057": ["D"],
    }
    for question in questions:
        question["examTags"] = sorted(set(question.get("examTags") or []) | {"modern-history-screenshot-detail"})
        if question.get("id") in manual_answers and not question.get("correct"):
            question["correct"] = manual_answers[question["id"]]
            question["analysis"] += " OCR 漏识的答案已按题目上下文补齐。"
        normalize_options(question)
    return questions


def merge_modern_history() -> dict:
    path = ROOT / "modern_history_practice.html"
    prefix, questions, tail = read_questions(path)
    before = len(questions)
    questions = [
        q
        for q in questions
        if not str(q.get("id", "")).startswith(("mh-book118-", "mh-mock-docx-", "mh-2023b-", "mh-user-shot-"))
        and q.get("source") not in {"Book118公开摘要", "中国近代史模拟试卷.docx", "2023 b卷.docx", "学习通截图详解"}
        and "modern-history-book118" not in (q.get("examTags") or [])
    ]
    seen = {norm_stem(q.get("stem") or q.get("title")): q for q in questions}
    removed_managed = before - len(questions)

    def merge_batch(batch: list[dict]) -> tuple[int, int]:
        added = 0
        duplicates = 0
        for q in batch:
            key = norm_stem(q.get("stem") or q.get("title"))
            if not key:
                continue
            normalize_options(q)
            if key in seen:
                target = seen[key]
                tags = set(target.get("examTags") or [])
                tags.update(q.get("examTags") or [])
                target["examTags"] = sorted(tags)
                if not target.get("correct") and q.get("correct"):
                    target["correct"] = q["correct"]
                if not target.get("answer") and q.get("answer"):
                    target["answer"] = q["answer"]
                if q.get("mockOrder") and not target.get("mockOrder"):
                    target["mockOrder"] = q["mockOrder"]
                duplicates += 1
            else:
                questions.append(q)
                seen[key] = q
                added += 1
        return added, duplicates

    docx_added, docx_duplicates = merge_batch(parse_docx_mock())
    b_added, b_duplicates = merge_batch(parse_2023_b_docx())
    shot_added, shot_duplicates = merge_batch(parse_user_screenshots())
    prefix = replace_toolbar(
        prefix,
        "modern",
        "截图题库、学习通章节测验、2023 B 卷与模拟试卷题源；模拟考试按 30 单选、15 多选、10 判断组卷，重复题干只保留一份。",
    )
    write_questions(path, prefix, questions, modern_tail())
    return {
        "modern_total": len(questions),
        "modern_managed_removed": removed_managed,
        "modern_docx_added": docx_added,
        "modern_docx_duplicates": docx_duplicates,
        "modern_2023b_added": b_added,
        "modern_2023b_duplicates": b_duplicates,
        "modern_screenshot_added": shot_added,
        "modern_screenshot_duplicates": shot_duplicates,
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
        ("linux-fill-004", "查看当前登录用户名常用____命令。", ["whoami"], "whoami 输出当前有效用户名。"),
        ("linux-fill-005", "列出目录内容常用____命令。", ["ls"], "ls 用于列出目录内容。"),
        ("linux-fill-006", "查看文本前 10 行常用____命令。", ["head"], "head 默认显示前 10 行。"),
        ("linux-fill-007", "按模式搜索文本常用____命令。", ["grep"], "grep 用于文本匹配检索。"),
        ("linux-fill-008", "创建目录常用____命令。", ["mkdir"], "mkdir 创建目录。"),
        ("linux-fill-009", "打包或解包归档文件常用____命令。", ["tar"], "tar 常用于归档、压缩包处理。"),
        ("linux-fill-010", "管理 systemd 服务常用____命令。", ["systemctl"], "systemctl 用于启动、停止、查看 systemd 服务。"),
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
        (
            "linux-comp-001",
            "Linux网络实战（一）- DNS配置",
            "初始化：apt-get update；apt-get install host。\n配置目标：在 BIND 中添加 test.com 区域，并把 test.com 解析到 10.40.211.244。\n关键步骤：在 named/bind 主配置中声明 zone \"test.com\"；创建正向区域文件，补齐 SOA、NS 和 A 记录；重启 bind9/named 服务；用 host/nslookup/dig 验证 test.com 是否返回 10.40.211.244。",
        ),
        (
            "linux-comp-002",
            "Linux网络实战（二）- WWW服务器搭建",
            "初始化：mkdir /var/www/html/test；cp /var/www/html/index.html /var/www/html/test。\n配置目标：把默认访问端口 80 改为 8011；新增监听端口 8012，并把站点根目录设为 /var/www/html/test。\n关键步骤：修改 Apache2 ports.conf 和站点配置中的 Listen/VirtualHost；确保 8012 对应 DocumentRoot /var/www/html/test；重启 apache2；用浏览器或 curl 访问 8011、8012 验证。",
        ),
        (
            "linux-comp-003",
            "Linux网络实战（三）- Samba服务器搭建",
            "初始化：mkdir /testDir；chmod 777 /testDir；useradd testUser；smbpasswd -a testUser；touch testFile。\n配置目标：新增共享 TestShare，目录为 /testDir，可浏览、可写，create mask=0644，directory mask=0755。\n关键步骤：在 smb.conf 中添加 [TestShare] 段；重启 smbd/nmbd；用 smbclient 以 testUser 连接本机 TestShare；在远程共享中新建 Dir；把 /root/testFile 上传到 Dir 并重命名为 upLoadFile。",
        ),
        (
            "linux-comp-004",
            "Linux网络实战（四）- FTP服务器搭建",
            "初始化：useradd -m newUser；passwd newUser 并设置 123456；touch testFile；将 vsftpd 配置项 pam_service_name 改为 ftp。\n配置目标：使用 newUser 连接本地 FTP 服务，并上传 /root/testFile 到远程当前目录，重命名为 upLoadFile。\n关键步骤：在 vsftpd.conf 中启用本地用户登录和写权限；重启 vsftpd；ftp localhost 后用 newUser 登录；执行 put /root/testFile upLoadFile；ls 验证远程文件存在。",
        ),
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
                "analysis": "来源：Educoder Linux组网技术实训页面；已按 Chrome 登录态抓取到的最后一关“编程要求/测试说明”整理。",
            }
        )
    return extras


def merge_linux() -> dict:
    path = ROOT / "linux_practice.html"
    prefix, questions, _tail = read_questions(path)
    before = len(questions)
    managed_prefixes = ("linux-judge-", "linux-fill-", "linux-triangle-", "linux-short-", "linux-comp-")
    questions = [
        q
        for q in questions
        if q.get("source") != "????"
        and q.get("source") not in {"Linux模拟考试补充", "Educoder实训截图/链接"}
        and not str(q.get("id", "")).startswith(managed_prefixes)
    ]
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
  const tagged = QUESTIONS.filter(q => (q.examTags || []).some(tag => String(tag).startsWith("modern-history-")) && hasKnownAnswer(q));
  const pool = tagged.length >= 55 ? tagged : QUESTIONS.filter(q => hasKnownAnswer(q));
  const byType = type => pool.filter(q => q.type === type);
  return [
    ...pick(byType("single"), 30),
    ...pick(byType("multiple"), 15),
    ...pick(byType("judge"), 10)
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

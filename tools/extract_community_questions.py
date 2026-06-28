import json
import re
from pathlib import Path

from bs4 import BeautifulSoup


RAW_DIR = Path("tmp_community_raw")
OUT = Path("tmp_community_questions.json")


def clean(text):
    text = re.sub(r"\u00a0+", " ", text or "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def compact(text):
    return re.sub(r"[\s，。？！、；：:,.!?“”\"'（）()\[\]【】《》<>—_-]+", "", text or "").lower()


def topic_from_stem(stem):
    rules = [
        ("铸牢中华民族共同体意识", "中华民族共同体意识"),
        ("中华民族共同体", "中华民族共同体"),
        ("民族区域自治", "民族区域自治"),
        ("大一统", "大一统传统"),
        ("元朝", "辽宋夏金元"),
        ("辽", "辽宋夏金元"),
        ("宋", "辽宋夏金元"),
        ("夏", "辽宋夏金元"),
        ("金", "辽宋夏金元"),
        ("明朝", "明清边疆治理"),
        ("清朝", "明清边疆治理"),
        ("新疆", "边疆治理"),
        ("西藏", "边疆治理"),
        ("西域", "边疆治理"),
        ("秦", "古代统一国家"),
        ("汉", "古代统一国家"),
        ("隋", "隋唐统一"),
        ("唐", "隋唐统一"),
        ("鸦片战争", "近代民族觉醒"),
        ("甲午", "近代民族觉醒"),
        ("辛亥", "近代民族觉醒"),
        ("中国共产党", "中国共产党民族工作"),
        ("新中国", "中国共产党民族工作"),
        ("中国式现代化", "中国式现代化"),
        ("人类命运共同体", "人类命运共同体"),
    ]
    for key, value in rules:
        if key in stem:
            return value
    return "综合"


def type_name(raw):
    if "多选" in raw:
        return "multiple"
    if "判断" in raw:
        return "judge"
    if "论述" in raw:
        return "essay"
    return "single"


def normalize_answer(qtype, raw):
    raw = clean(raw).replace(" ", "")
    if qtype == "judge":
        if raw == "对":
            return "A"
        if raw == "错":
            return "B"
    return "".join(sorted(re.findall(r"[A-Z]", raw.upper()))) or raw


def parse_options(block):
    options = {}
    for li in block.select("ul.qtDetail li"):
        text = clean(li.get_text(" ", strip=True))
        m = re.match(r"^([A-Z])\.\s*(.*)$", text)
        if m:
            options[m.group(1)] = clean(m.group(2))
    return options


def parse_paper(path, paper_no):
    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
    title = clean(soup.get_text("\n", strip=True).splitlines()[2])
    questions = []
    for block in soup.select("div.questionLi"):
        h = block.select_one("h3.mark_name")
        if not h:
            continue
        no_text = clean(next((str(x) for x in h.contents if isinstance(x, str) and x.strip()), ""))
        m_no = re.match(r"(\d+)", no_text)
        no = int(m_no.group(1)) if m_no else len(questions) + 1
        raw_type = clean(h.select_one(".colorShallow").get_text(" ", strip=True) if h.select_one(".colorShallow") else "")
        qtype = type_name(raw_type)
        qt = h.select_one(".qtContent")
        stem_text = clean(qt.get_text("\n", strip=True) if qt else "")
        options = parse_options(block)
        right = clean(block.select_one(".rightAnswerContent").get_text("\n", strip=True) if block.select_one(".rightAnswerContent") else "")
        analysis = clean(block.select_one(".qtAnalysis").get_text("\n", strip=True) if block.select_one(".qtAnalysis") else "")
        answer = normalize_answer(qtype, right)
        if qtype == "essay":
            parts = [line.strip() for line in stem_text.splitlines() if line.strip()]
            if not right and len(parts) > 1:
                stem_text = parts[0]
                answer = clean("\n".join(parts[1:]))
            elif right:
                answer = right
            options = {}
        if qtype == "judge" and not options:
            options = {"A": "对", "B": "错"}
        explain = analysis or ("参考答案见题目来源。 " + answer if qtype == "essay" else f"正确答案：{answer}")
        questions.append(
            {
                "id": f"CMT{paper_no}-Q{no:03d}",
                "source": f"中华民族共同体模拟测试{paper_no}",
                "chapter": topic_from_stem(stem_text),
                "type": qtype,
                "title": stem_text,
                "options": options,
                "answer": answer,
                "explanations": [{"label": "参考解析", "text": explain}],
                "tags": [f"模拟测试{paper_no}", qtype, topic_from_stem(stem_text)],
                "difficulty": "基础",
            }
        )
    return title, questions


def main():
    all_questions = []
    titles = []
    for idx, path in enumerate([RAW_DIR / "paper1.html", RAW_DIR / "paper2.html"], start=1):
        title, qs = parse_paper(path, idx)
        titles.append(title)
        all_questions.extend(qs)
    seen = {}
    deduped = []
    duplicates = []
    for q in all_questions:
        key = (q["type"], compact(q["title"]))
        if key in seen:
            duplicates.append((seen[key], q["id"], q["title"][:80]))
            continue
        seen[key] = q["id"]
        q["id"] = f"CMT-Q{len(deduped)+1:03d}"
        deduped.append(q)
    OUT.write_text(json.dumps(deduped, ensure_ascii=False, indent=2), encoding="utf-8")
    stats = {
        "titles": titles,
        "raw": len(all_questions),
        "deduped": len(deduped),
        "duplicates": len(duplicates),
        "by_type": {},
    }
    for q in deduped:
        stats["by_type"][q["type"]] = stats["by_type"].get(q["type"], 0) + 1
    print(json.dumps(stats, ensure_ascii=False, indent=2))
    for old, new, stem in duplicates[:20]:
        print("DUP", old, new, stem)


if __name__ == "__main__":
    main()

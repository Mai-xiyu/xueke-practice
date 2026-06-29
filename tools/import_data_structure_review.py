from __future__ import annotations

import hashlib
import argparse
import json
import re
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "data_structure_practice.html"
DEFAULT_SOURCE_DIR = Path.home() / "Downloads" / "新建文件夹"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

HASH_CLEAN_QA = "b1c0300d28b86046"
HASH_NOTES = "6b80c60d925e4522"
HASH_OUTLINE = "ab8fba7ff5f4f112"
HASH_FINAL_POINTS = "d01a3389ff03526c"


def sha16(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def docx_paragraphs(path: Path) -> list[str]:
    with ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    paragraphs: list[str] = []
    for paragraph in root.findall(".//w:p", NS):
        text = "".join(node.text or "" for node in paragraph.findall(".//w:t", NS))
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            paragraphs.append(text)
    return paragraphs


def find_doc(source_dir: Path, hash_prefix: str) -> Path:
    for path in sorted(source_dir.glob("*.docx")):
        if sha16(path) == hash_prefix:
            return path
    raise FileNotFoundError(f"missing docx with hash {hash_prefix} in {source_dir}")


def extract_array(text: str, marker: str) -> tuple[int, int, list]:
    start = text.index(marker) + len(marker)
    depth = 0
    in_string = False
    escaped = False
    end = None
    for index, char in enumerate(text[start:], start):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                end = index + 1
                break
    if end is None:
        raise ValueError(f"could not find end for {marker}")
    return start, end, json.loads(text[start:end])


def compact(text: str) -> str:
    return re.sub(r"[\s，。；;、,.!?！？（）()\[\]【】《》“”\"'：:]+", "", text or "").lower()


def chapter_for(text: str) -> str:
    rules = [
        ("循环队列", "第三章 栈和队列"),
        ("队列", "第三章 栈和队列"),
        ("进栈", "第三章 栈和队列"),
        ("出栈", "第三章 栈和队列"),
        ("栈", "第三章 栈和队列"),
        ("串", "第四章 串、数组与广义表"),
        ("数组", "第四章 串、数组与广义表"),
        ("矩阵", "第四章 串、数组与广义表"),
        ("广义表", "第四章 串、数组与广义表"),
        ("树", "第五章 树和二叉树"),
        ("二叉", "第五章 树和二叉树"),
        ("哈夫曼", "第五章 树和二叉树"),
        ("图", "第六章 图"),
        ("最小生成树", "第六章 图"),
        ("Prim", "第六章 图"),
        ("Kruskal", "第六章 图"),
        ("查找", "第七章 查找"),
        ("哈希", "第七章 查找"),
        ("排序", "第八章 排序"),
        ("堆", "第八章 排序"),
        ("线性表", "第二章 线性表"),
        ("链表", "第二章 线性表"),
        ("顺序表", "第二章 线性表"),
        ("算法", "第一章 绪论"),
        ("数据结构", "第一章 绪论"),
    ]
    for key, chapter in rules:
        if key in text:
            return chapter
    return "数据结构复习资料"


def parse_options(text: str) -> list[dict[str, str]]:
    normalized = re.sub(r"\s+", " ", text).strip()
    matches = list(re.finditer(r"([A-D])\s*[．.、]", normalized))
    options: list[dict[str, str]] = []
    for index, match in enumerate(matches):
        label = match.group(1)
        begin = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(normalized)
        value = normalized[begin:end].strip()
        if value:
            options.append({"label": label, "text": value})
    return options


def parse_clean_questions(paragraphs: list[str]) -> list[dict]:
    text = "\n".join(paragraphs)
    text = text.split("1．简述", 1)[0]
    blocks = re.split(r"(?=（\d+）)", text)
    out: list[dict] = []
    for block in blocks:
        block = block.strip()
        if not re.match(r"^（\d+）", block):
            continue
        answer_match = re.search(r"答案：\s*([A-D](?:[、,，]\s*[A-D])*)", block)
        if not answer_match:
            continue
        answer = re.sub(r"[^A-D]", "", answer_match.group(1))
        if len(answer) != 1:
            continue
        before_answer = block[: answer_match.start()].strip()
        explain_match = re.search(r"解释：(.+)", block[answer_match.end() :], flags=re.S)
        explanation = re.sub(r"\s+", " ", explain_match.group(1)).strip() if explain_match else f"正确答案：{answer}"
        first_option = re.search(r"\bA\s*[．.、]", before_answer)
        if not first_option:
            continue
        title = re.sub(r"^（\d+）", "", before_answer[: first_option.start()]).strip()
        options = parse_options(before_answer[first_option.start() :])
        labels = {item["label"] for item in options}
        if len(options) < 4 or answer not in labels:
            continue
        out.append(
            {
                "id": "",
                "source": "数据结构复习资料",
                "chapter": chapter_for(title),
                "type": "single",
                "title": title,
                "options": options,
                "answer": answer,
                "explanations": [{"label": "资料解析", "text": explanation}],
                "tags": ["数据结构复习资料", "single", chapter_for(title)],
                "difficulty": "复习",
            }
        )
    return out


def parse_short_questions(paragraphs: list[str]) -> list[dict]:
    start = next(i for i, p in enumerate(paragraphs) if p.startswith("1．简述"))
    end = next(i for i, p in enumerate(paragraphs) if p == "算法填空")
    region = paragraphs[start:end]
    chunks: list[tuple[str, list[str]]] = []
    current_title = ""
    current_answer: list[str] = []
    in_answer = False
    for item in region:
        if re.match(r"^\d+．", item):
            if current_title:
                chunks.append((current_title, current_answer))
            current_title = item
            current_answer = []
            in_answer = False
        elif item == "答案：":
            in_answer = True
        elif in_answer and current_title:
            current_answer.append(item)
    if current_title:
        chunks.append((current_title, current_answer))

    out = []
    for title, answer_lines in chunks:
        answer = "\n".join(answer_lines).strip()
        if not answer:
            continue
        out.append(
            {
                "id": "",
                "source": "数据结构复习资料",
                "chapter": chapter_for(title),
                "type": "short",
                "title": title,
                "answer": answer,
                "explanations": [{"label": "复习资料", "text": "来自数据结构复习资料，可按参考答案自行核对。"}],
                "tags": ["数据结构复习资料", "short", chapter_for(title)],
                "difficulty": "复习",
            }
        )
    return out


def parse_algorithm_question(paragraphs: list[str]) -> dict:
    start = next(i for i, p in enumerate(paragraphs) if p == "算法填空")
    end = next(i for i, p in enumerate(paragraphs) if p == "应用题")
    lines = paragraphs[start + 1 : end]
    title = lines[0]
    answer = "\n".join(lines[1:]).strip()
    return {
        "id": "",
        "source": "数据结构复习资料",
        "chapter": "第二章 线性表",
        "type": "short",
        "title": title,
        "answer": answer,
        "explanations": [{"label": "算法思路", "text": "先定位区间前驱与区间后继，再断链并释放区间结点。"}],
        "tags": ["数据结构复习资料", "short", "第二章 线性表"],
        "difficulty": "复习",
    }


def group_by_chapter(paragraphs: list[str]) -> list[tuple[str, str]]:
    groups: list[tuple[str, list[str]]] = []
    current_title = ""
    current_body: list[str] = []
    for item in paragraphs:
        if re.fullmatch(r"第[一二三四五六七八]章", item):
            if current_title and current_body:
                groups.append((current_title, current_body))
            current_title = item
            current_body = []
        elif current_title:
            current_body.append(item)
    if current_title and current_body:
        groups.append((current_title, current_body))
    return [(title, "；".join(body)) for title, body in groups]


def final_review_cards(paragraphs: list[str]) -> list[tuple[str, str]]:
    groups: list[tuple[str, list[str]]] = []
    current_title = ""
    current_body: list[str] = []
    heading = re.compile(r"^[一二三四五六七八]、")
    for item in paragraphs[1:]:
        if heading.match(item):
            if current_title and current_body:
                groups.append((current_title, current_body))
            current_title = item
            current_body = []
        elif current_title:
            current_body.append(item)
    if current_title and current_body:
        groups.append((current_title, current_body))
    return [(title, "；".join(body)) for title, body in groups]


def build_review_cards(notes: list[str], outline: list[str], final_points: list[str]) -> list[dict[str, str]]:
    cards: list[dict[str, str]] = []
    if len(notes) > 1:
        cards.append({"title": "复习资料：考试题型提示", "body": notes[1]})
    for title, body in group_by_chapter(outline):
        cards.append({"title": f"总复习提纲：{title}", "body": body})
    for title, body in final_review_cards(final_points):
        cards.append({"title": f"期末复习要点：{title}", "body": body})
    return cards


def assign_ids(new_questions: list[dict], existing: list[dict]) -> list[dict]:
    seen = {compact(q.get("title", "")) for q in existing}
    result = []
    counter = 1
    for question in new_questions:
        key = compact(question.get("title", ""))
        if not key or key in seen:
            continue
        seen.add(key)
        question["id"] = f"DS-REVIEW-{counter:03d}"
        counter += 1
        result.append(question)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Import data-structure review docs into data_structure_practice.html.")
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR, help="Folder containing the review .docx files.")
    args = parser.parse_args()
    source_dir = args.source_dir.expanduser().resolve()

    text = HTML.read_text(encoding="utf-8")
    q_start, q_end, questions = extract_array(text, "const QUESTIONS = ")
    c_start, c_end, cards = extract_array(text, "const CARDS = ")

    qa_paragraphs = docx_paragraphs(find_doc(source_dir, HASH_CLEAN_QA))
    notes = docx_paragraphs(find_doc(source_dir, HASH_NOTES))
    outline = docx_paragraphs(find_doc(source_dir, HASH_OUTLINE))
    final_points = docx_paragraphs(find_doc(source_dir, HASH_FINAL_POINTS))

    candidates = []
    candidates.extend(parse_clean_questions(qa_paragraphs))
    candidates.extend(parse_short_questions(qa_paragraphs))
    candidates.append(parse_algorithm_question(qa_paragraphs))
    additions = assign_ids(candidates, questions)
    questions.extend(additions)

    existing_card_titles = {card.get("title") for card in cards}
    card_additions = [card for card in build_review_cards(notes, outline, final_points) if card["title"] not in existing_card_titles]
    cards.extend(card_additions)

    next_text = (
        text[:q_start]
        + json.dumps(questions, ensure_ascii=False, separators=(",", ":"))
        + text[q_end:c_start]
        + json.dumps(cards, ensure_ascii=False, separators=(",", ":"))
        + text[c_end:]
    )
    next_text = next_text.replace(
        '<button data-mode="cards">速记卡片</button>',
        '<button data-mode="cards">复习资料</button>',
    )
    next_text = next_text.replace(
        "function renderCards(){ panel.innerHTML='<div class=\"grid\">'+CARDS.map(c=>`<div class=\"card\"><h3>${c.title}</h3><p>${c.body}</p></div>`).join('')+'</div>'; }",
        "function renderCards(){ panel.innerHTML=`<div class=\"card\"><h2>复习资料</h2><p class=\"small\">共 ${CARDS.length} 张卡片，包含速记知识点和本次导入的复习提纲。</p></div><div class=\"grid\">`+CARDS.map(c=>`<div class=\"card\"><h3>${c.title}</h3><p>${c.body}</p></div>`).join('')+'</div>'; }",
    )
    HTML.write_text(next_text, encoding="utf-8")
    print(
        json.dumps(
            {
                "questions_added": len(additions),
                "cards_added": len(card_additions),
                "questions_total": len(questions),
                "cards_total": len(cards),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

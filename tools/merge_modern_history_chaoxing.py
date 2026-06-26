from __future__ import annotations

import base64
import html
import json
import re
import tempfile
from pathlib import Path

import numpy as np
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
STRUCTURED_DIR = ROOT / ".artifacts" / "modern_history_chaoxing" / "structured"
DECODED_PATH = ROOT / ".artifacts" / "modern_history_chaoxing" / "decoded_questions.json"
HTML_PATH = ROOT / "modern_history_practice.html"
NOTO_FONT = Path(r"C:\Windows\Fonts\NotoSansSC-VF.ttf")

SOURCE_CHAOXING = "\u5b66\u4e60\u901a\u7ae0\u8282\u6d4b\u9a8c"
CHAPTER_PREFIX = "\u7ae0\u8282\u6d4b\u9a8c \u00b7 "
ANALYSIS_PENDING = (
    "\u6765\u6e90\uff1a\u5b66\u4e60\u901a\u4e2d\u56fd\u8fd1\u73b0\u4ee3\u53f2"
    "\u7eb2\u8981\u7ae0\u8282\u6d4b\u9a8c\uff1b\u539f\u9875\u9762\u672a\u516c\u5f00"
    "\u6807\u51c6\u7b54\u6848\uff0c\u5f85\u4eba\u5de5\u8865\u5145\u3002"
)

CANVAS = 180
OUTSIZE = 48
MAXSIZE = 40


def glyph_arr(ch: str, font: ImageFont.FreeTypeFont) -> np.ndarray | None:
    img = Image.new("L", (CANVAS, CANVAS), 0)
    draw = ImageDraw.Draw(img)
    draw.text((40, 0), ch, font=font, fill=255)
    bbox = img.getbbox()
    if not bbox:
        return None
    crop = img.crop(bbox)
    width, height = crop.size
    scale = min(MAXSIZE / width, MAXSIZE / height)
    new_width = max(1, round(width * scale))
    new_height = max(1, round(height * scale))
    resized = crop.resize((new_width, new_height), Image.Resampling.LANCZOS)
    out = Image.new("L", (OUTSIZE, OUTSIZE), 0)
    out.paste(resized, ((OUTSIZE - new_width) // 2, (OUTSIZE - new_height) // 2))
    return np.frombuffer(out.tobytes(), dtype=np.uint8).astype(np.int16)


def is_gbk_cjk(cp: int) -> bool:
    if not (0x3400 <= cp <= 0x9FFF):
        return False
    try:
        chr(cp).encode("gbk")
        return True
    except UnicodeEncodeError:
        return False


def build_candidates() -> tuple[list[int], np.ndarray]:
    font = ImageFont.truetype(str(NOTO_FONT), 96)
    codepoints: list[int] = []
    signatures: list[np.ndarray] = []
    for lo, hi in ((0x4E00, 0x9FFF), (0x3400, 0x4DBF)):
        for cp in range(lo, hi + 1):
            if not is_gbk_cjk(cp):
                continue
            arr = glyph_arr(chr(cp), font)
            if arr is not None and int(arr.sum()) > 0:
                codepoints.append(cp)
                signatures.append(arr)
    return codepoints, np.stack(signatures).astype(np.int16)


def build_font_map(font_b64: str, candidates: list[int], candidate_matrix: np.ndarray) -> dict[str, str]:
    data = base64.b64decode(font_b64)
    with tempfile.NamedTemporaryFile(delete=False, suffix=".ttf") as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    custom_font = ImageFont.truetype(tmp_path, 96)
    tt_font = TTFont(tmp_path)
    hidden_codepoints = sorted({cp for table in tt_font["cmap"].tables for cp in table.cmap.keys()})

    mapping: dict[str, str] = {}
    for cp in hidden_codepoints:
        hidden_arr = glyph_arr(chr(cp), custom_font)
        if hidden_arr is None:
            continue
        distances = np.abs(candidate_matrix - hidden_arr).sum(axis=1)
        best_index = int(np.argmin(distances))
        mapping[chr(cp)] = chr(candidates[best_index])
    return mapping


VARIANT_TRANS = str.maketrans(
    {
        "\u5727": "\u538b",
    }
)

TEXT_REPLACEMENTS = (
    ("\u60dc\u9274", "\u501f\u9274"),
    ("\u6cbe\u7247\u6218\u4e89", "\u9e26\u7247\u6218\u4e89"),
    ("\u6297\u66f0\u6218\u4e89", "\u6297\u65e5\u6218\u4e89"),
    ("\u4e28\u4e2a", "\u4e00\u4e2a"),
    ("\u3021\u4e2a", "\u4e00\u4e2a"),
    ("\u9886\u5bfc\u91cf", "\u9886\u5bfc\u529b\u91cf"),
)


def clean_text(value: str) -> str:
    text = html.unescape(str(value or ""))
    return re.sub(r"\s+", " ", text).strip()


def decode_text(value: str, mapping: dict[str, str]) -> str:
    text = "".join(mapping.get(ch, ch) for ch in clean_text(value))
    text = text.translate(VARIANT_TRANS)
    for old, new in TEXT_REPLACEMENTS:
        text = text.replace(old, new)
    return text.strip()


def chapter_name(title: str) -> str:
    value = re.sub(r"^\d+(?:\.\d+)*\s*", "", title or "").strip()
    value = re.sub(r"\s+\d+$", "", value).strip()
    return value or "\u7ae0\u8282\u6d4b\u9a8c"


def question_type(label: str, ans_type: str) -> str:
    if "\u591a\u9009" in label or ans_type == "1":
        return "multiple"
    if "\u5224\u65ad" in label or ans_type == "3":
        return "judge"
    return "single"


def decode_structured_questions() -> list[dict]:
    candidates, candidate_matrix = build_candidates()
    font_cache: dict[str, dict[str, str]] = {}
    questions: list[dict] = []

    for path in sorted(STRUCTURED_DIR.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        structured = payload["structured"]
        font_b64 = structured.get("fontBase64", "")
        if font_b64 not in font_cache:
            font_cache[font_b64] = build_font_map(font_b64, candidates, candidate_matrix) if font_b64 else {}
        mapping = font_cache[font_b64]
        chapter = CHAPTER_PREFIX + chapter_name(payload["chapter"]["title"])

        for raw in structured["questions"]:
            q_type = question_type(raw.get("typeLabel", ""), raw.get("ansType", ""))
            options = {}
            for option in raw.get("options", []):
                key = (option.get("key") or "").strip()
                if key:
                    options[key] = decode_text(option.get("text", ""), mapping)

            questions.append(
                {
                    "id": "",
                    "source": SOURCE_CHAOXING,
                    "chapter": chapter,
                    "type": q_type,
                    "stem": decode_text(raw.get("stem", ""), mapping),
                    "options": options,
                    "correct": [],
                    "analysis": ANALYSIS_PENDING,
                    "originId": raw.get("qid", ""),
                }
            )

    seen: set[str] = set()
    unique: list[dict] = []
    for question in questions:
        key = re.sub(r"\W+", "", question["stem"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(question)

    for index, question in enumerate(unique, 1):
        question["id"] = f"mh-chaoxing-{index:03d}"
    return unique


def extract_questions_array(html_text: str) -> tuple[list[dict], int, int]:
    marker = "const QUESTIONS = "
    start = html_text.index(marker) + len(marker)
    array_start = html_text.index("[", start)
    depth = 0
    in_string = False
    escape = False
    for index in range(array_start, len(html_text)):
        ch = html_text[index]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                end = index + 1
                return json.loads(html_text[array_start:end]), array_start, end
    raise ValueError("QUESTIONS array end not found")


def merge_questions(existing: list[dict], crawled: list[dict]) -> list[dict]:
    seen = {re.sub(r"\W+", "", q.get("stem", "")) for q in existing}
    merged = list(existing)
    for question in crawled:
        key = re.sub(r"\W+", "", question["stem"])
        if key in seen:
            continue
        seen.add(key)
        merged.append(question)
    return merged


def update_html(questions: list[dict]) -> None:
    html_text = HTML_PATH.read_text(encoding="utf-8")
    _, start, end = extract_questions_array(html_text)
    replacement = json.dumps(questions, ensure_ascii=False, indent=2)
    html_text = html_text[:start] + replacement + html_text[end:]
    html_text = html_text.replace(
        "\u4e2d\u56fd\u8fd1\u73b0\u4ee3\u53f2\u7eb2\u8981\u622a\u56fe\u9898\u5e93\uff0c\u5305\u542b\u5355\u9009\u3001\u591a\u9009\u3001\u5224\u65ad\u548c\u4e3b\u89c2\u9898\u3002",
        "\u622a\u56fe\u9898\u5e93 + \u5b66\u4e60\u901a\u7ae0\u8282\u6d4b\u9a8c\uff0c\u5305\u542b\u5355\u9009\u3001\u591a\u9009\u3001\u5224\u65ad\u548c\u4e3b\u89c2\u9898\uff1b\u90e8\u5206\u7ae0\u8282\u6d4b\u9a8c\u7b54\u6848\u5f85\u8865\u5145\u3002",
    )
    HTML_PATH.write_text(html_text, encoding="utf-8")


def main() -> None:
    crawled = decode_structured_questions()
    DECODED_PATH.write_text(json.dumps(crawled, ensure_ascii=False, indent=2), encoding="utf-8")

    html_text = HTML_PATH.read_text(encoding="utf-8")
    existing, _, _ = extract_questions_array(html_text)
    merged = merge_questions(existing, crawled)
    update_html(merged)

    print(json.dumps({"existing": len(existing), "crawled": len(crawled), "merged": len(merged)}, ensure_ascii=False))


if __name__ == "__main__":
    main()

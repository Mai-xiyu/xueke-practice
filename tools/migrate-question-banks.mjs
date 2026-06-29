import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDataDir = fs.existsSync(path.join(root, "data")) ? path.join(root, "data") : path.join(root, "public", "data");
const targetDataDir = path.join(root, "public", "data");
const subjectPath = fs.existsSync(path.join(root, "subjects.json"))
  ? path.join(root, "subjects.json")
  : path.join(root, "public", "subjects.json");
const targetSubjectPath = path.join(root, "public", "subjects.json");

const typeAlias = new Map([
  ["single", "single"],
  ["choice", "single"],
  ["select", "single"],
  ["radio", "single"],
  ["multiple", "multiple"],
  ["multi", "multiple"],
  ["checkbox", "multiple"],
  ["tf", "judge"],
  ["true_false", "judge"],
  ["judge", "judge"],
  ["judgement", "judge"],
  ["boolean", "judge"],
  ["fill", "fill"],
  ["blank", "fill"],
  ["completion", "fill"],
  ["short", "short"],
  ["subjective", "short"],
  ["essay", "essay"],
  ["argument", "essay"],
  ["code", "code"],
  ["program", "code"],
  ["comprehensive", "comprehensive"],
  ["application", "comprehensive"],
  ["case", "comprehensive"]
]);

function normalizeType(value, question) {
  const raw = String(value || "").trim().toLowerCase();
  if (typeAlias.has(raw)) return typeAlias.get(raw);
  if (question?.options) return "single";
  if (question?.answers) return "fill";
  return "short";
}

function normalizeOptions(options) {
  if (!options) return undefined;
  if (Array.isArray(options)) {
    const out = {};
    options.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const label = String(item.label || item.key || String.fromCharCode(65 + index)).trim();
      out[label] = String(item.text || item.value || "");
    });
    return Object.keys(out).length ? out : undefined;
  }
  if (typeof options === "object") {
    const out = {};
    Object.entries(options).forEach(([key, value]) => {
      out[String(key).trim()] = String(value ?? "");
    });
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

function answerKeys(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  if (/^[A-Z]+$/i.test(raw) && raw.length > 1) return raw.toUpperCase().split("");
  return [raw.toUpperCase()];
}

function analysisText(question) {
  const parts = [];
  for (const key of ["analysis", "explanation", "explain", "note"]) {
    if (question[key]) parts.push(String(question[key]));
  }
  const explanations = question.explanations;
  if (Array.isArray(explanations)) {
    parts.push(explanations.map((item) => {
      if (item && typeof item === "object") return `${item.label || ""}${item.text ? `：${item.text}` : ""}`;
      return String(item);
    }).join("\n"));
  } else if (explanations && typeof explanations === "object") {
    parts.push(Object.entries(explanations).map(([key, value]) => `${key}：${value}`).join("\n"));
  }
  return [...new Set(parts.map((part) => part.trim()).filter(Boolean))].join("\n");
}

function normalizeQuestion(question, index) {
  const options = normalizeOptions(question.options);
  let type = normalizeType(question.type, question);
  if ((type === "single" || type === "multiple" || type === "judge") && !options && question.image) {
    type = "comprehensive";
  }
  const meta = {};
  for (const [key, value] of Object.entries(question)) {
    if (![
      "id", "source", "chapter", "topic", "type", "stem", "title", "options", "correct", "answers",
      "answer", "analysis", "explanation", "explain", "explanations", "tags", "image", "note"
    ].includes(key)) {
      meta[key] = value;
    }
  }
  if (question.searchText) meta.searchText = question.searchText;
  const out = {
    id: String(question.id || `q-${index + 1}`),
    source: String(question.source || "未标注来源"),
    chapter: String(question.chapter || question.topic || "未分章"),
    type,
    stem: String(question.stem || question.title || ""),
    tags: Array.isArray(question.tags) ? question.tags.map(String) : []
  };
  if (options) out.options = options;
  if (question.image) out.image = question.image;
  const analysis = analysisText(question);
  if (analysis) out.analysis = analysis;
  if (Object.keys(meta).length) out.meta = meta;

  if (type === "single" || type === "multiple" || type === "judge") {
    const correct = answerKeys(question.correct || question.answer);
    out.correct = type === "single" || type === "judge" ? correct.slice(0, 1) : correct;
  } else if (type === "fill") {
    out.answers = Array.isArray(question.answers)
      ? question.answers.map(String)
      : question.answer ? [String(question.answer)] : [];
  } else {
    out.answer = String(question.answer || question.analysis || "见参考解析。");
  }
  return out;
}

function addMockExam(subject) {
  const configs = {
    "network-security": {
      title: "网络安全模拟考试",
      sections: [
        { type: "single", count: 30, score: 1 },
        { type: "judge", count: 10, score: 1 }
      ]
    },
    "linux-course": {
      title: "Linux课程模拟考试",
      sections: [
        { type: "single", count: 25, score: 2 },
        { type: "fill", count: 5, score: 2 },
        { type: "judge", count: 10, score: 1 },
        { type: "short", count: 2, score: 5 },
        { type: "comprehensive", count: 2, score: 10 }
      ]
    },
    "modern-history": {
      title: "中国近代史最新模拟卷",
      sections: [
        { type: "single", count: 30, score: 1 },
        { type: "multiple", count: 15, score: 1 },
        { type: "judge", count: 10, score: 1 },
        { type: "short", count: 2, score: 15 },
        { type: "essay", count: 1, score: 15 }
      ]
    }
  };
  return configs[subject.id] ? { ...subject, mockExam: configs[subject.id] } : subject;
}

fs.mkdirSync(targetDataDir, { recursive: true });
const directory = JSON.parse(fs.readFileSync(subjectPath, "utf8"));
directory.subjects = directory.subjects.map(addMockExam);

for (const subject of directory.subjects) {
  const fileName = path.basename(subject.dataFile);
  const source = path.join(sourceDataDir, fileName);
  const target = path.join(targetDataDir, fileName);
  const questions = JSON.parse(fs.readFileSync(source, "utf8"));
  const normalized = questions.map(normalizeQuestion);
  fs.writeFileSync(target, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  subject.dataFile = `data/${fileName}`;
  console.log(`${subject.id}: ${questions.length} -> ${normalized.length}`);
}

fs.writeFileSync(targetSubjectPath, `${JSON.stringify(directory, null, 2)}\n`, "utf8");
console.log(`subjects: ${directory.subjects.length}`);

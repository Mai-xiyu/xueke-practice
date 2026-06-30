import fs from "node:fs";
import path from "node:path";

export const markdownQuestionTypes = new Set(["single", "multiple", "judge", "fill", "short", "essay", "code", "comprehensive"]);

function fail(file, message) {
  throw new Error(`${file}: ${message}`);
}

function parseScalar(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

function parseList(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  const body = raw.startsWith("[") && raw.endsWith("]") ? raw.slice(1, -1) : raw;
  return body.split(/[,，]/).map((item) => parseScalar(item)).filter(Boolean);
}

function parseMeta(block, file, questionNumber) {
  const meta = {};
  block.split(/\r?\n/).forEach((line, lineIndex) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = /^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(trimmed);
    if (!match) fail(file, `question ${questionNumber} metadata line ${lineIndex + 1} must use "key: value"`);
    meta[match[1]] = parseScalar(match[2]);
  });
  return meta;
}

function normalizeAnswerKeys(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  if (/^[A-Z]+$/i.test(raw) && raw.length > 1) return raw.toUpperCase().split("");
  return raw.split(/[,，、\s]+/).map((item) => item.trim().toUpperCase()).filter(Boolean);
}

function splitFencedBlock(body, name) {
  const pattern = new RegExp("```" + name + "\\s*\\n([\\s\\S]*?)```", "i");
  const match = pattern.exec(body);
  if (!match) return { block: "", body };
  return {
    block: match[1].trim(),
    body: `${body.slice(0, match.index)}${body.slice(match.index + match[0].length)}`.trim()
  };
}

function extractOptions(body) {
  const lines = body.split(/\r?\n/);
  const stem = [];
  const options = {};
  let currentKey = "";
  let seenOption = false;

  for (const line of lines) {
    const match = /^\s*([A-Z])[\.\)、:：]\s*(.+?)\s*$/.exec(line);
    if (match) {
      seenOption = true;
      currentKey = match[1].toUpperCase();
      options[currentKey] = match[2].trim();
      continue;
    }
    if (seenOption && currentKey && line.trim()) {
      options[currentKey] = `${options[currentKey]}\n${line.trim()}`;
      continue;
    }
    if (!seenOption) stem.push(line);
  }

  return {
    stem: stem.join("\n").trim(),
    options: Object.keys(options).length ? options : undefined
  };
}

function requireString(meta, key, file, questionNumber) {
  const value = String(meta[key] ?? "").trim();
  if (!value) fail(file, `question ${questionNumber} missing metadata "${key}"`);
  return value;
}

function buildQuestion(meta, body, file, questionNumber) {
  const answerBlock = splitFencedBlock(body, "answer");
  const analysisBlock = splitFencedBlock(answerBlock.body, "analysis");
  const { stem, options } = extractOptions(analysisBlock.body);
  const type = requireString(meta, "type", file, questionNumber);
  if (!markdownQuestionTypes.has(type)) fail(file, `question ${questionNumber} invalid type "${type}"`);
  if (!stem) fail(file, `question ${questionNumber} missing stem`);

  const question = {
    id: requireString(meta, "id", file, questionNumber),
    source: requireString(meta, "source", file, questionNumber),
    chapter: requireString(meta, "chapter", file, questionNumber),
    type,
    stem,
    tags: parseList(meta.tags),
    analysis: analysisBlock.block || undefined
  };

  if (type === "judge") {
    question.options = options || { A: "对", B: "错" };
    question.correct = normalizeAnswerKeys(meta.correct || meta.answer);
  } else if (type === "single" || type === "multiple") {
    if (!options) fail(file, `question ${questionNumber} ${type} question missing options`);
    question.options = options;
    question.correct = normalizeAnswerKeys(meta.correct || meta.answer);
  } else if (type === "fill") {
    question.answers = parseList(meta.answers || meta.answer);
  } else {
    question.answer = answerBlock.block || String(meta.answer ?? "").trim();
  }

  if (["single", "multiple", "judge"].includes(type) && !question.correct?.length) {
    fail(file, `question ${questionNumber} choice/judge question missing correct answer`);
  }
  if (type === "single" && question.correct.length !== 1) fail(file, `question ${questionNumber} single question must have exactly one correct answer`);
  if (type === "fill" && !question.answers?.length) fail(file, `question ${questionNumber} fill question missing answers`);
  if (["short", "essay", "code", "comprehensive"].includes(type) && !question.answer) {
    fail(file, `question ${questionNumber} subjective question missing answer block or answer metadata`);
  }
  if (meta.image) question.image = String(meta.image).trim();

  return {
    subject: requireString(meta, "subject", file, questionNumber),
    question
  };
}

export function parseMarkdownQuestionBank(content, file = "markdown input") {
  const items = [];
  const pattern = /```question\s*\n([\s\S]*?)```/gi;
  const matches = [...content.matchAll(pattern)];
  if (!matches.length && content.trim()) fail(file, "no ```question fenced block found");

  matches.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : content.length;
    const meta = parseMeta(match[1], file, index + 1);
    items.push(buildQuestion(meta, content.slice(start, end).trim(), file, index + 1));
  });

  return items;
}

export function listMarkdownFiles(targetPath) {
  if (!fs.existsSync(targetPath)) return [];
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return targetPath.toLowerCase().endsWith(".md") ? [targetPath] : [];
  const out = [];
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdownFiles(fullPath));
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) out.push(fullPath);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export function parseMarkdownFiles(files) {
  const grouped = new Map();
  for (const file of files) {
    const parsed = parseMarkdownQuestionBank(fs.readFileSync(file, "utf8"), file);
    for (const item of parsed) {
      const list = grouped.get(item.subject) || [];
      list.push(item.question);
      grouped.set(item.subject, list);
    }
  }
  return grouped;
}

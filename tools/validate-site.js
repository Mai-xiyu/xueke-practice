const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const subjectFile = path.join(root, "subjects.json");
const subjects = JSON.parse(fs.readFileSync(subjectFile, "utf8")).subjects;

if (!Array.isArray(subjects) || subjects.length === 0) {
  throw new Error("subjects.json must contain a non-empty subjects array");
}

const ids = new Set();
const hrefs = new Set();

function extractQuestionArray(source) {
  const match = source.match(/\b(?:const|let|var)\s+(QUESTIONS|QBANK)\s*=\s*\[/);
  if (!match) return null;
  const start = match.index + match[0].lastIndexOf("[");
  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error("question array end not found");
}

for (const subject of subjects) {
  for (const key of ["id", "title", "href"]) {
    if (!subject[key]) throw new Error(`subject missing ${key}: ${JSON.stringify(subject)}`);
  }
  if (ids.has(subject.id)) throw new Error(`duplicate subject id: ${subject.id}`);
  ids.add(subject.id);
  hrefs.add(subject.href);

  const htmlPath = path.join(root, subject.href);
  if (!fs.existsSync(htmlPath)) throw new Error(`subject href does not exist: ${subject.href}`);

  const html = fs.readFileSync(htmlPath, "utf8");
  if (/衍生题|派生|derived/i.test(html)) {
    throw new Error(`derived-question marker found in ${subject.href}`);
  }

  const arrayText = extractQuestionArray(html);
  if (!arrayText) {
    console.warn(`[warn] ${subject.href}: no QUESTIONS/QBANK array detected`);
    continue;
  }
  const questions = JSON.parse(arrayText);
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error(`${subject.href}: question array is empty`);
  }
  console.log(`${subject.href}: ${questions.length} questions`);
}

console.log(`subjects.json: ${subjects.length} subjects`);

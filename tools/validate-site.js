const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const subjectFile = path.join(root, "subjects.json");
const directory = JSON.parse(fs.readFileSync(subjectFile, "utf8"));
const subjects = directory.subjects;
const colleges = directory.colleges;

if (!Array.isArray(subjects) || subjects.length === 0) {
  throw new Error("subjects.json must contain a non-empty subjects array");
}

if (!Array.isArray(colleges) || colleges.length === 0) {
  throw new Error("subjects.json must contain a non-empty colleges array");
}

const ids = new Set();
const hrefs = new Set();
const collegeIds = new Set(colleges.map((college) => college.id));

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

for (const college of colleges) {
  for (const key of ["id", "title"]) {
    if (!college[key]) throw new Error(`college missing ${key}: ${JSON.stringify(college)}`);
  }
}

for (const subject of subjects) {
  for (const key of ["id", "title", "href", "college", "dataFile"]) {
    if (!subject[key]) throw new Error(`subject missing ${key}: ${JSON.stringify(subject)}`);
  }
  if (!collegeIds.has(subject.college)) throw new Error(`subject references unknown college: ${subject.id} -> ${subject.college}`);
  if (ids.has(subject.id)) throw new Error(`duplicate subject id: ${subject.id}`);
  ids.add(subject.id);
  hrefs.add(subject.href);

  const htmlPath = path.join(root, subject.href);
  if (!fs.existsSync(htmlPath)) throw new Error(`subject href does not exist: ${subject.href}`);

  const html = fs.readFileSync(htmlPath, "utf8");
  if (/衍生题|派生|derived/i.test(html)) {
    throw new Error(`derived-question marker found in ${subject.href}`);
  }

  if (!html.includes("studyHubLoadQuestions")) {
    throw new Error(`${subject.href}: missing JSON question loader`);
  }

  const embeddedArray = extractQuestionArray(html);
  if (embeddedArray) {
    const embeddedQuestions = JSON.parse(embeddedArray);
    if (Array.isArray(embeddedQuestions) && embeddedQuestions.length > 0) {
      throw new Error(`${subject.href}: questions must live in ${subject.dataFile}, not in HTML`);
    }
  }

  const dataPath = path.join(root, subject.dataFile);
  if (!fs.existsSync(dataPath)) throw new Error(`subject dataFile does not exist: ${subject.dataFile}`);
  const questions = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error(`${subject.href}: question array is empty`);
  }
  console.log(`${subject.href}: ${questions.length} questions`);
}

console.log(`subjects.json: ${subjects.length} subjects`);

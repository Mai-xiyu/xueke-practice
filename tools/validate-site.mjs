import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const subjectFile = path.join(publicDir, "subjects.json");
const directory = JSON.parse(fs.readFileSync(subjectFile, "utf8"));
const subjects = directory.subjects;
const colleges = directory.colleges;
const validTypes = new Set(["single", "multiple", "judge", "fill", "short", "essay", "code", "comprehensive"]);
const expectedCounts = new Map([
  ["route-switching", 372],
  ["network-security", 215],
  ["data-collection", 95],
  ["data-visualization", 100],
  ["data-structure", 188],
  ["linux-course", 335],
  ["modern-history", 390],
  ["community", 158],
  ["higher-math-down", 32]
]);

function fail(message) {
  throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function assertArray(value, message) {
  if (!Array.isArray(value)) fail(message);
}

function checkQuestion(subject, question, index, seen) {
  for (const key of ["id", "source", "chapter", "type", "stem"]) {
    if (!question[key]) fail(`${subject.id}: question ${index + 1} missing ${key}`);
  }
  if (seen.has(question.id)) fail(`${subject.id}: duplicate question id ${question.id}`);
  seen.add(question.id);
  if (!validTypes.has(question.type)) fail(`${subject.id}: invalid type ${question.id} -> ${question.type}`);
  if (!Array.isArray(question.tags)) fail(`${subject.id}: ${question.id} tags must be array`);
  if (question.options !== undefined && (typeof question.options !== "object" || Array.isArray(question.options))) {
    fail(`${subject.id}: ${question.id} options must be object`);
  }
  if (["single", "multiple", "judge"].includes(question.type)) {
    if (!question.options || !Object.keys(question.options).length) fail(`${subject.id}: ${question.id} choice question missing options`);
    assertArray(question.correct, `${subject.id}: ${question.id} correct must be array`);
  }
  if (question.type === "fill") assertArray(question.answers, `${subject.id}: ${question.id} answers must be array`);
  if (["short", "essay", "code", "comprehensive"].includes(question.type) && typeof question.answer !== "string") {
    fail(`${subject.id}: ${question.id} subjective question missing answer string`);
  }
  if (question.image && !String(question.image).startsWith("data:")) {
    const imagePath = path.join(publicDir, String(question.image));
    if (!fs.existsSync(imagePath)) fail(`${subject.id}: ${question.id} image not found: ${question.image}`);
  }
}

assertArray(subjects, "subjects.json must contain subjects array");
assertArray(colleges, "subjects.json must contain colleges array");

const collegeIds = new Set(colleges.map((college) => college.id));
const subjectIds = new Set();
const hrefs = new Set();

for (const college of colleges) {
  if (!college.id || !college.title) fail(`college missing id/title: ${JSON.stringify(college)}`);
}

for (const subject of subjects) {
  for (const key of ["id", "title", "mark", "href", "college", "dataFile"]) {
    if (!subject[key]) fail(`subject missing ${key}: ${JSON.stringify(subject)}`);
  }
  if (subjectIds.has(subject.id)) fail(`duplicate subject id: ${subject.id}`);
  subjectIds.add(subject.id);
  if (hrefs.has(subject.href)) fail(`duplicate subject href: ${subject.href}`);
  hrefs.add(subject.href);
  if (!collegeIds.has(subject.college)) fail(`subject references unknown college: ${subject.id}`);
  if (!fs.existsSync(path.join(root, subject.href))) fail(`subject href missing: ${subject.href}`);
  if (!subject.dataFile.startsWith("data/")) fail(`${subject.id}: dataFile must stay under data/`);
  const questions = readJson(path.join(publicDir, subject.dataFile));
  assertArray(questions, `${subject.id}: question bank must be array`);
  const expected = expectedCounts.get(subject.id);
  if (expected !== undefined && questions.length !== expected) {
    fail(`${subject.id}: expected ${expected} questions, got ${questions.length}`);
  }
  const seen = new Set();
  questions.forEach((question, index) => checkQuestion(subject, question, index, seen));
  if (subject.mockExam) {
    assertArray(subject.mockExam.sections, `${subject.id}: mockExam.sections must be array`);
    subject.mockExam.sections.forEach((section, index) => {
      if (!validTypes.has(section.type)) fail(`${subject.id}: mock section ${index + 1} invalid type`);
      if (!Number.isInteger(section.count) || section.count < 1) fail(`${subject.id}: mock section ${index + 1} invalid count`);
    });
  }
  console.log(`${subject.href}: ${questions.length} questions`);
}

console.log(`subjects.json: ${subjects.length} subjects`);

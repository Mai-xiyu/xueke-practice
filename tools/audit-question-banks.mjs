// Audits all question banks under public/data for common quality issues.
// Usage:
//   node tools/audit-question-banks.mjs
//   node tools/audit-question-banks.mjs --apply
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const reportsDir = path.join(root, "reports");
const apply = process.argv.includes("--apply");

const directory = JSON.parse(fs.readFileSync(path.join(publicDir, "subjects.json"), "utf8"));
const CHOICE_TYPES = new Set(["single", "multiple", "judge"]);
const SINGLE_BIAS_THRESHOLD = 0.55;

/** @typedef {{ severity: "error" | "warn" | "info", code: string, subjectId: string, questionId: string, message: string, needsReview?: boolean }} Issue */

/** @type {Issue[]} */
const issues = [];
const bankStats = [];

function pushIssue(severity, code, subjectId, questionId, message, needsReview = false) {
  issues.push({ severity, code, subjectId, questionId, message, needsReview });
}

function plainText(value) {
  return String(value ?? "").trim();
}

function hasGarbled(text) {
  return /\uFFFD/.test(text) || /\?{3,}/.test(text) || /\u0000/.test(text);
}

const EXTERNAL_MATERIAL_PATTERN =
  /课程\s*PPT|PPT\s*(说明|给出|示例|备注|流程|中|里)|课件(中|说明|给出|列出|示例)|来自\s*(PPT|课件|材料|截图)|根据\s*(PPT|课件|材料|截图|头歌)|见图作答|纸质资料|课堂资料|原卷逐题|OCR\s*摘录|最后一页/;

function visibleQuestionText(question) {
  const parts = [question.stem, question.analysis, question.answer];
  if (question.options && typeof question.options === "object") {
    parts.push(...Object.values(question.options));
  }
  if (Array.isArray(question.answers)) parts.push(...question.answers);
  return parts.map(plainText).join("\n");
}

function hasExternalMaterialReference(question) {
  return EXTERNAL_MATERIAL_PATTERN.test(visibleQuestionText(question));
}

function analysisClaimedLetters(analysis, optionKeys) {
  const text = plainText(analysis).replace(/\s+/g, "");
  if (!text) return null;
  const patterns = [
    /正确答案(?:是|为|[:：])([A-H]{1,6})(?![A-Za-z0-9])/,
    /答案(?:是|为|[:：])([A-H]{1,6})(?![A-Za-z0-9])/,
    /正确选项(?:是|为|[:：])([A-H]{1,6})(?![A-Za-z0-9])/,
    /故选([A-H]{1,6})(?![A-Za-z0-9])/,
    /应选([A-H]{1,6})(?![A-Za-z0-9])/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const letters = match[1].split("");
    if (letters.every((letter) => optionKeys.includes(letter))) return letters.sort();
  }
  return null;
}

function auditQuestion(subject, question) {
  const subjectId = subject.id;
  const id = question.id || "(no id)";
  const stem = plainText(question.stem);

  if (!stem) pushIssue("error", "empty-stem", subjectId, id, "stem is empty", true);
  const rawText = JSON.stringify(question);
  if (hasGarbled(rawText)) pushIssue("error", "garbled", subjectId, id, "contains garbled placeholder text (??? / U+FFFD / NUL)", true);
  if (hasExternalMaterialReference(question)) {
    pushIssue("error", "external-material-reference", subjectId, id, "visible question text depends on external material instead of being self-contained", true);
  }

  if (CHOICE_TYPES.has(question.type)) {
    const options = question.options || {};
    const optionKeys = Object.keys(options);
    const correct = Array.isArray(question.correct) ? question.correct.map(String) : [];

    if (!correct.length) pushIssue("error", "missing-correct", subjectId, id, "choice question missing correct", true);
    const badKeys = correct.filter((key) => !optionKeys.includes(key));
    if (badKeys.length) pushIssue("error", "correct-not-in-options", subjectId, id, `correct contains keys not in options: ${badKeys.join(",")}`, true);

    const texts = optionKeys.map((key) => plainText(options[key]).replace(/\s+/g, ""));
    const seen = new Map();
    texts.forEach((text, index) => {
      if (!text) {
        pushIssue("warn", "empty-option", subjectId, id, `option ${optionKeys[index]} is empty`, true);
        return;
      }
      if (seen.has(text)) {
        pushIssue("warn", "duplicate-option", subjectId, id, `options ${seen.get(text)} and ${optionKeys[index]} have duplicate text`, true);
      } else {
        seen.set(text, optionKeys[index]);
      }
    });

    if (question.type === "single" && correct.length === 1) {
      const claimed = analysisClaimedLetters(question.analysis, optionKeys);
      if (claimed && claimed.length === 1 && claimed[0] !== correct[0]) {
        pushIssue("warn", "analysis-conflict", subjectId, id, `analysis claims ${claimed[0]}, but correct is ${correct[0]}`, true);
      }
    }
    if (question.type === "multiple" && correct.length > 1) {
      const claimed = analysisClaimedLetters(question.analysis, optionKeys);
      if (claimed && claimed.length > 1 && claimed.join("") !== [...correct].sort().join("")) {
        pushIssue("warn", "analysis-conflict", subjectId, id, `analysis claims ${claimed.join("")}, but correct is ${[...correct].sort().join("")}`, true);
      }
    }
  }

  if (question.type === "fill") {
    const answers = Array.isArray(question.answers) ? question.answers.map(plainText).filter(Boolean) : [];
    if (!answers.length) pushIssue("error", "missing-answers", subjectId, id, "fill question missing answers", true);
  }

  if (!plainText(question.analysis)) {
    pushIssue("info", "empty-analysis", subjectId, id, "analysis is empty");
  }
}

function auditDistribution(subject, questions) {
  const singles = questions.filter((question) => question.type === "single" && Array.isArray(question.correct) && question.correct.length === 1 && Object.keys(question.options || {}).length >= 3);
  if (singles.length < 20) return null;
  const counts = {};
  singles.forEach((question) => {
    const key = String(question.correct[0]);
    counts[key] = (counts[key] || 0) + 1;
  });
  const distribution = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  const [topKey, topCount] = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
  const ratio = topCount / singles.length;
  if (ratio > SINGLE_BIAS_THRESHOLD) {
    pushIssue("warn", "answer-bias", subject.id, "(bank)", `single-choice answer distribution is skewed: ${topKey} is ${(ratio * 100).toFixed(1)}% (${topCount}/${singles.length})`);
  }
  return { total: singles.length, distribution: distribution.map(([key, count]) => `${key}:${count}`).join(" ") };
}

const needsReviewByBank = new Map();

for (const subject of directory.subjects) {
  const file = path.join(publicDir, subject.dataFile);
  const questions = JSON.parse(fs.readFileSync(file, "utf8"));
  const before = issues.length;
  questions.forEach((question) => auditQuestion(subject, question));
  const dist = auditDistribution(subject, questions);
  bankStats.push({
    subjectId: subject.id,
    title: subject.title,
    file: subject.dataFile,
    count: questions.length,
    emptyAnalysis: questions.filter((question) => !plainText(question.analysis)).length,
    singleDistribution: dist ? dist.distribution : "-",
    issueCount: issues.length - before
  });

  if (apply) {
    const flagged = new Map();
    issues
      .filter((issue) => issue.subjectId === subject.id && issue.needsReview && issue.questionId !== "(bank)")
      .forEach((issue) => {
        const list = flagged.get(issue.questionId) || [];
        list.push(`${issue.code}: ${issue.message}`);
        flagged.set(issue.questionId, list);
      });
    if (flagged.size) {
      let changed = false;
      questions.forEach((question) => {
        const reasons = flagged.get(question.id);
        if (!reasons) return;
        question.meta = { ...(question.meta || {}), needsReview: true, reviewReasons: reasons };
        changed = true;
      });
      if (changed) {
        fs.writeFileSync(file, `${JSON.stringify(questions, null, 2)}\n`, "utf8");
        needsReviewByBank.set(subject.id, flagged.size);
      }
    }
  }
}

const severityOrder = { error: 0, warn: 1, info: 2 };
issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.subjectId.localeCompare(b.subjectId) || a.questionId.localeCompare(b.questionId));

const lines = [];
lines.push("# Question Bank Audit Report");
lines.push("");
lines.push("Generated by: npm run audit");
lines.push(`Scope: public/data/*.json (${directory.subjects.length} banks)`);
lines.push("");
lines.push("## Summary");
lines.push("");
lines.push("| Bank | File | Questions | Empty analysis | Single distribution | Issues |");
lines.push("| --- | --- | ---: | ---: | --- | ---: |");
bankStats.forEach((stat) => {
  lines.push(`| ${stat.title} | ${stat.file} | ${stat.count} | ${stat.emptyAnalysis} | ${stat.singleDistribution} | ${stat.issueCount} |`);
});
lines.push("");

const errors = issues.filter((issue) => issue.severity === "error");
const warns = issues.filter((issue) => issue.severity === "warn");
const infos = issues.filter((issue) => issue.severity === "info");

function renderIssues(title, list) {
  lines.push(`## ${title} (${list.length})`);
  lines.push("");
  if (!list.length) {
    lines.push("None.");
    lines.push("");
    return;
  }
  lines.push("| Bank | Question ID | Type | Description |");
  lines.push("| --- | --- | --- | --- |");
  list.forEach((issue) => {
    lines.push(`| ${issue.subjectId} | ${issue.questionId} | ${issue.code} | ${issue.message.replace(/\|/g, "\\|")} |`);
  });
  lines.push("");
}

renderIssues("Errors", errors);
renderIssues("Warnings", warns);

lines.push(`## Empty Analysis (${infos.length})`);
lines.push("");
if (infos.length) {
  const grouped = new Map();
  infos.forEach((issue) => {
    const list = grouped.get(issue.subjectId) || [];
    list.push(issue.questionId);
    grouped.set(issue.subjectId, list);
  });
  grouped.forEach((ids, subjectId) => {
    lines.push(`- **${subjectId}** (${ids.length}): ${ids.join(", ")}`);
  });
} else {
  lines.push("None.");
}
lines.push("");
if (apply && needsReviewByBank.size) {
  lines.push("## Marked meta.needsReview");
  lines.push("");
  needsReviewByBank.forEach((count, subjectId) => lines.push(`- ${subjectId}: ${count}`));
  lines.push("");
}

fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(path.join(reportsDir, "question-audit.md"), `${lines.join("\n")}\n`, "utf8");
console.log(`audit: ${errors.length} errors, ${warns.length} warns, ${infos.length} empty-analysis -> reports/question-audit.md${apply ? " (needsReview applied)" : ""}`);
if (errors.length) process.exitCode = 1;

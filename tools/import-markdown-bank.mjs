import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listMarkdownFiles, parseMarkdownFiles } from "./markdown-bank.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const targetArg = args.find((arg) => !arg.startsWith("--"));
const targetPath = path.resolve(root, targetArg || "contrib/question-banks");
const outIndex = args.indexOf("--out");
const outDir = outIndex >= 0 ? path.resolve(root, args[outIndex + 1] || "") : "";
const checkOnly = args.includes("--check");

const files = listMarkdownFiles(targetPath);
const grouped = parseMarkdownFiles(files);
const total = [...grouped.values()].reduce((sum, items) => sum + items.length, 0);

if (checkOnly) {
  console.log(`markdown question banks: ${files.length} files, ${total} questions`);
  process.exit(0);
}

if (outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [subject, questions] of grouped.entries()) {
    fs.writeFileSync(path.join(outDir, `${subject}.json`), `${JSON.stringify(questions, null, 2)}\n`, "utf8");
  }
  console.log(`wrote ${total} questions into ${outDir}`);
} else {
  const payload = Object.fromEntries([...grouped.entries()].map(([subject, questions]) => [subject, questions]));
  console.log(JSON.stringify(payload, null, 2));
}

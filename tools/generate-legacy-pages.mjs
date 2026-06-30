import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const subjectsFile = path.join(root, "public", "subjects.json");
const indexFile = path.join(distDir, "index.html");

const directory = JSON.parse(fs.readFileSync(subjectsFile, "utf8"));
const indexHtml = fs.readFileSync(indexFile, "utf8");

for (const subject of directory.subjects || []) {
  const target = path.join(distDir, subject.href);
  const title = `${subject.title}练习系统`;
  const html = indexHtml.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
  fs.writeFileSync(target, html, "utf8");
  console.log(`generated dist/${subject.href}`);
}

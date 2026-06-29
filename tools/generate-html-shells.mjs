import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const subjects = JSON.parse(fs.readFileSync(path.join(root, "public", "subjects.json"), "utf8")).subjects;

function html(title, subjectId = "") {
  const data = subjectId ? ` data-subject-id="${subjectId}"` : "";
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"${data}></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

fs.writeFileSync(path.join(root, "index.html"), html("学科练习系统"), "utf8");
for (const subject of subjects) {
  fs.writeFileSync(path.join(root, subject.href), html(`${subject.title}练习系统`, subject.id), "utf8");
  console.log(`generated ${subject.href}`);
}

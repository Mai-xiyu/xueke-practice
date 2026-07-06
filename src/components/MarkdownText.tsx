import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

interface MarkdownTextProps {
  value?: string | null;
  compact?: boolean;
  className?: string;
}

function escapeMarker(marker: string): string {
  return marker.split("").map((char) => `\\${char}`).join("");
}

function preserveLeadingMarkdownLiterals(text: string, compact: boolean): string {
  return text
    .split("\n")
    .map((line) => {
      let next = line.replace(/^(\s*)(>+)(?=\s|$)/, (_, leading: string, signs: string) => `${leading}${escapeMarker(signs)}`);
      if (!compact) return next;
      next = next.replace(/^(\s*)(#{1,6})(?=\s|$)/, (_, leading: string, signs: string) => `${leading}${escapeMarker(signs)}`);
      next = next.replace(/^(\s*)([-+*])(?=\s|$)/, (_, leading: string, sign: string) => `${leading}\\${sign}`);
      next = next.replace(/^(\s*)(\d+[.)])(?=\s|$)/, (_, leading: string, marker: string) => `${leading}${marker.replace(/[.)]/g, "\\$&")}`);
      next = next.replace(/^(\s*)(-{3,}|\*{3,}|_{3,})\s*$/, (_, leading: string, marker: string) => `${leading}${escapeMarker(marker)}`);
      return next;
    })
    .join("\n");
}

export function MarkdownText({ value, compact = false, className = "" }: MarkdownTextProps) {
  const text = preserveLeadingMarkdownLiterals(String(value ?? ""), compact);
  const classes = ["markdown-content", compact ? "markdown-content--compact" : "", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        skipHtml
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

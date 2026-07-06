import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

interface MarkdownTextProps {
  value?: string | null;
  compact?: boolean;
  className?: string;
}

function preserveLeadingGreaterThan(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^(\s*)(>+)(?=\s|$)/, (_, leading: string, signs: string) => {
      return `${leading}${signs.split("").map(() => "\\>").join("")}`;
    }))
    .join("\n");
}

export function MarkdownText({ value, compact = false, className = "" }: MarkdownTextProps) {
  const text = preserveLeadingGreaterThan(String(value ?? ""));
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

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownText } from "./MarkdownText";

describe("MarkdownText", () => {
  it("renders math markdown without executing raw html", () => {
    const { container } = render(<MarkdownText value={"公式：$x^2$ <script>window.bad = true</script>"} />);

    expect(container.querySelector(".katex")).not.toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });
  it("preserves shell redirection operators that start a line", () => {
    const { container } = render(<MarkdownText value={">>\n> file\n2> err"} compact />);

    expect(container.textContent).toContain(">>");
    expect(container.textContent).toContain("> file");
    expect(container.textContent).toContain("2> err");
    expect(container.querySelector("blockquote")).toBeNull();
  });

  it("preserves compact answer markers that look like markdown syntax", () => {
    const { container } = render(<MarkdownText value={"#\n* item\n- item\n+ item\n1. item\n---"} compact />);

    expect(container.textContent).toContain("#");
    expect(container.textContent).toContain("* item");
    expect(container.textContent).toContain("- item");
    expect(container.textContent).toContain("+ item");
    expect(container.textContent).toContain("1. item");
    expect(container.textContent).toContain("---");
    expect(container.querySelector("h1,h2,h3,ul,ol,hr")).toBeNull();
  });

  it("does not escape markdown markers inside fenced code blocks", () => {
    const { container } = render(<MarkdownText value={"```bash\n>> file\n# comment\n* literal\n```"} compact />);

    const code = container.querySelector("pre code");
    expect(code?.textContent).toContain(">> file");
    expect(code?.textContent).toContain("# comment");
    expect(code?.textContent).toContain("* literal");
    expect(code?.textContent).not.toContain("\\>");
  });
});

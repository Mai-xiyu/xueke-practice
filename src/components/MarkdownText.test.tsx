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
});

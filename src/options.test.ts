import { describe, it, expect } from "vitest";
import {
  parseMeta,
  templateImg,
  templateSvg,
  templateText,
  escapeHtml,
} from "./options.ts";

describe("Utility Functions", () => {
  describe("parseMeta", () => {
    it("should parse a simple output type", () => {
      const result = parseMeta("img");
      expect(result.kind).toBe("img");
      expect(result.deps).toEqual([]);
    });

    it("should parse dependencies in brackets", () => {
      const result = parseMeta("text [numpy pandas  scipy]");
      expect(result.kind).toBe("text");
      expect(result.deps).toEqual(["numpy", "pandas", "scipy"]);
    });

    it("should parse caption text correctly", () => {
      const result = parseMeta('img caption="A beautiful plot"');
      expect(result.kind).toBe("img");
      expect(result.caption).toBe("A beautiful plot");
    });

    it("should handle a complex combination", () => {
      const result = parseMeta('svg [matplotlib] caption="Vector Plot"');
      expect(result.kind).toBe("svg");
      expect(result.deps).toEqual(["matplotlib"]);
      expect(result.caption).toBe("Vector Plot");
    });

    it("should fallback to text for invalid kinds", () => {
      const result = parseMeta("unknown [deps]");
      expect(result.kind).toBe("text");
    });
  });

  describe("HTML Templates", () => {
    it("templateImg should render correctly with caption and class", () => {
      const html = templateImg("base64data", "My caption", "my-wrapper");
      expect(html).toContain('class="my-wrapper"');
      expect(html).toContain('src="data:image/png;base64,base64data"');
      expect(html).toContain('alt="My caption"');
      expect(html).toContain("<figure");
    });

    it("templateSvg should wrap raw SVG content", () => {
      const svgRaw = "<svg>...</svg>";
      const html = templateSvg(svgRaw, undefined, "svg-wrap");
      expect(html).toContain('class="svg-wrap"');
      expect(html).toContain(svgRaw);
    });

    it("templateText should escape dangerous characters", () => {
      const dirty = "5 > 2 && 2 < 5 '5'\"";
      const safe = escapeHtml(dirty);
      expect(safe).toContain("5 &gt; 2 &amp;&amp; 2 &lt; 5");
      expect(safe).not.toContain(">");
      expect(safe).not.toContain("<");
      expect(safe).not.toContain("'");
      expect(safe).not.toContain('"');
    });

    it("should handle templates without optional wrapper classes", () => {
      const html = templateText("hello");
      expect(html).toContain("<div>"); // No class attribute added
    });
  });
});

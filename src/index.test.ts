import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { remark } from "remark";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import remarkPyRun, { type RemarkPyRunOptions } from "./index.ts";

// Mock the child_process so we don't actually run Python during tests
vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

describe("remarkPyRun Plugin", () => {
  let tempCacheDir: string;

  // Helper to process markdown through remark and our plugin
  const processMarkdown = (md: string, options?: RemarkPyRunOptions) => {
    return remark().use(remarkPyRun, options).processSync(md).toString();
  };

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Create a unique temporary directory for cache tests
    tempCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "remark-pyrun-test-"));
  });

  afterEach(() => {
    // Clean up the temporary cache directory
    fs.rmSync(tempCacheDir, { recursive: true, force: true });
  });

  it("should ignore standard python blocks", () => {
    const input = "```python\nprint('hello')\n```";
    const output = processMarkdown(input);

    // Should remain untouched
    expect(output).toContain("```python");
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("should execute pyRun blocks and output text by default", () => {
    // Mock the spawnSync response
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 0,
      stdout: "Hello from mock Python!",
      stderr: "",
      pid: 123,
      output: [],
      signal: null,
    });

    const input = "```pyRun\nprint('hello')\n```";
    const output = processMarkdown(input);

    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(output).toContain('<div class="py-run-result">');
    expect(output).toContain("Hello from mock Python!");
  });

  it("should correctly handle 'img' output type and alt text", () => {
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 0,
      stdout:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", // fake base64
      stderr: "",
      pid: 123,
      output: [],
      signal: null,
    });

    const input = '```pyRun img caption="My Plot"\nplot()\n```';
    const output = processMarkdown(input);

    expect(output).toContain("<figure");
    expect(output).toContain('alt="My Plot"');
    expect(output).toContain("<figcaption>My Plot</figcaption>");
    expect(output).toContain("data:image/png;base64,iVBOR");
  });

  it("should correctly handle 'svg' output type", () => {
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 0,
      stdout: "<svg><circle cx='50' cy='50' r='50'/></svg>",
      stderr: "",
      pid: 123,
      output: [],
      signal: null,
    });

    const input = "```pyRun svg\nplot_svg()\n```";
    const output = processMarkdown(input);

    expect(output).toContain("<figure");
    expect(output).toContain("<svg><circle");
  });

  it("should inject base and custom dependencies into the script payload", () => {
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 0,
      stdout: "success",
      stderr: "",
      pid: 123,
      output: [],
      signal: null,
    });

    const input = "```pyRun text [numpy pandas]\nimport numpy\n```";
    processMarkdown(input);

    // Extract what was passed to stdin of spawnSync
    const callArgs = vi.mocked(spawnSync).mock.calls[0];
    const scriptPayload = callArgs[2]?.input as string;

    expect(scriptPayload).toContain("matplotlib"); // base dep
    expect(scriptPayload).toContain("numpy"); // custom dep
    expect(scriptPayload).toContain("pandas"); // custom dep
  });

  it("should handle script execution errors gracefully", () => {
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 1,
      stdout: "",
      stderr: "Traceback: SyntaxError",
      pid: 123,
      output: [],
      signal: null,
      error: new Error("Process failed"),
    });

    // Suppress console.error for this specific test to keep terminal output clean
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const input = "```pyRun\nbad code\n```";
    const output = processMarkdown(input);

    expect(output).toContain("Execution Error:");
    expect(output).toContain("Traceback: SyntaxError");

    consoleSpy.mockRestore();
  });

  it("should cache successful executions", () => {
    // First run - should call spawnSync
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 0,
      stdout: "Cached Output",
      stderr: "",
      pid: 123,
      output: [],
      signal: null,
    });

    const input = "```pyRun\nprint('cache me')\n```";

    // Process once
    processMarkdown(input, { cacheDir: tempCacheDir });
    expect(spawnSync).toHaveBeenCalledTimes(1);

    // Process exactly the same markdown again
    const output2 = processMarkdown(input, { cacheDir: tempCacheDir });

    // spawnSync should NOT have been called a second time
    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(output2).toContain("Cached Output");

    // Verify cache file was actually written to the file system
    const files = fs.readdirSync(tempCacheDir);
    expect(files.length).toBe(1);
    expect(files[0].endsWith(".out")).toBe(true);
  });

  it("should safely escape HTML in text outputs to prevent XSS", () => {
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 0,
      stdout: "<script>alert('hacked')</script> & other things",
      stderr: "",
      pid: 123,
      output: [],
      signal: null,
    });

    const input = "```pyRun\nprint('hack')\n```";
    const output = processMarkdown(input);

    // The raw brackets, quotes and ampersands should be escaped
    expect(output).toContain(
      "&lt;script&gt;alert(&#039;hacked&#039;)&lt;/script&gt; &amp; other things",
    );
    expect(output).not.toContain("<script>");
  });
});

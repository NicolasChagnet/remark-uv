import { visit } from "unist-util-visit";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  appendFileSync,
} from "node:fs";
import { join } from "node:path";
import type { Plugin } from "unified";
import type { Code, HTML, Root, Parent } from "mdast";
import {
  parseMeta,
  templateImg,
  templateSvg,
  templateText,
} from "./options.ts";
import type { OutputType } from "./options.ts";

// --- Configuration Interfaces ---

export interface RemarkPyRunOptions {
  /** Code tag. Default: 'pyRun' */
  codeTag?: string;
  /** Command to invoke uv. Default: 'uv' */
  uvCommand?: string;
  /** Timeout for the python execution in milliseconds. Default: 10000 */
  timeout?: number;
  /** Base dependencies injected via PEP 723. Default: ['matplotlib', 'plotly', 'kaleido'] */
  baseDeps?: string[];
  /** Directory to store execution cache. If undefined, caching is disabled. */
  cacheDir?: string;
  /** Default output type if not specified in metadata. Default: 'text' */
  defaultOutputType?: OutputType;
  /** CSS class applied to the wrapper HTML element. Default: 'py-run-result' */
  wrapperClass?: string;
}

const defaultOptions: Required<RemarkPyRunOptions> = {
  codeTag: "pyRun",
  uvCommand: "uv",
  timeout: 10000,
  baseDeps: ["matplotlib", "plotly", "kaleido"],
  cacheDir: "", // Disabled by default
  defaultOutputType: "text",
  wrapperClass: "py-run-result",
};

// --- Injected Python Helpers ---

const pythonHelpers = `
def mpl_to_base64(fig, *args, **kwargs):
    import io
    import base64
    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight', *args, **kwargs)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')

def plotly_to_base64(fig, *args, **kwargs):
    import base64
    return base64.b64encode(fig.to_image(format="png", *args, **kwargs)).decode('utf-8')

def plotly_to_svg(fig, *args, **kwargs):
    return fig.to_image(format="svg", *args, **kwargs).decode('utf-8')
`;

// --- The Plugin ---

const remarkPyRun: Plugin<[RemarkPyRunOptions?], Root> = (options = {}) => {
  const config = { ...defaultOptions, ...options };

  return (tree: Root) => {
    const nodesToProcess: Array<{ node: Code; index: number; parent: Parent }> =
      [];

    visit(tree, "code", (node: Code, index, parent) => {
      if (node.lang === config.codeTag && parent && index !== undefined) {
        nodesToProcess.push({ node, index, parent });
      }
    });

    // Node processing
    for (const { node, index, parent } of nodesToProcess) {
      const meta = node.meta || config.defaultOutputType;
      const metaOptions = parseMeta(meta);
      let outputType = metaOptions.kind;

      // Parse additional dependencies (e.g., pyRun img [numpy pandas])
      const deps = Array.from(
        new Set([...config.baseDeps, ...(metaOptions.deps || [])]),
      );

      // Construct the PEP 723 compliant script payload
      const scriptPayload = [
        "# /// script",
        `# dependencies = ${JSON.stringify(deps)}`,
        "# ///",
        pythonHelpers,
        node.value,
      ].join("\n");

      // Generate cache hash based on execution parameters and script content
      const hashInput = JSON.stringify({
        scriptPayload,
        command: config.uvCommand,
      });
      const hash = createHash("sha256").update(hashInput).digest("hex");

      let stdout = "";
      let cached = false;

      // If configured, store the output of the script in a cache directory
      // The file is named based on a hash of the script content and execution parameters to ensure uniqueness
      if (config.cacheDir) {
        const cachePath = join(config.cacheDir, `${hash}.out`);
        if (existsSync(cachePath)) {
          stdout = readFileSync(cachePath, "utf-8");
          cached = true;
        }
      }

      // Execute Script (if not cached)
      if (!cached) {
        const result = spawnSync(config.uvCommand, ["run", "-"], {
          input: scriptPayload,
          encoding: "utf-8",
          timeout: config.timeout,
        });

        if (result.error || result.status !== 0) {
          const errMsg =
            result.stderr || result.error?.message || "Unknown Execution Error";
          console.error(`[remark-pyrun] Error executing script:\n${errMsg}`);
          // Fallback to safely displaying the error inline instead of breaking the build
          stdout = `Execution Error:\n${errMsg}`;
          // outputType = "text";
        } else {
          stdout = result.stdout.trim();

          // Save successful runs to cache
          if (config.cacheDir && result.status === 0) {
            if (!existsSync(config.cacheDir)) {
              mkdirSync(config.cacheDir, { recursive: true });
            }
            writeFileSync(
              join(config.cacheDir, `${hash}.out`),
              stdout,
              "utf-8",
            );
          }
        }
      }

      // Generate HTML output
      let htmlValue = "";
      if (outputType === "img") {
        htmlValue = templateImg(
          stdout,
          metaOptions.caption,
          config.wrapperClass,
        );
      } else if (outputType === "svg") {
        htmlValue = templateSvg(
          stdout,
          metaOptions.caption,
          config.wrapperClass,
        );
      } else {
        htmlValue = templateText(stdout, config.wrapperClass);
      }

      const newNode: HTML = {
        type: "html",
        value: htmlValue,
      };

      // Replace the original code node with the generated HTML
      parent.children.splice(index, 1, newNode);
    }
  };
};

export default remarkPyRun;

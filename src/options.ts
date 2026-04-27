const OUTPUT_TYPES = ["text", "img", "svg"] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];

export function parseOutputType(value: string): OutputType {
  const lowerValue = value.toLowerCase();
  if (OUTPUT_TYPES.includes(lowerValue as OutputType)) {
    return lowerValue as OutputType;
  }
  return "text"; // Default fallback
}

export interface MetaOptions {
  kind: OutputType;
  deps: string[];
  caption: string;
}

export function parseMeta(meta: string): MetaOptions {
  const options: MetaOptions = {
    kind: "text",
    deps: [],
    caption: "",
  };

  const regex =
    /^\s*(img|text|svg)(?:\s+\[([^\]]*)\])?(?:\s+caption="([^"]*)")?/;
  const match = meta.trim().match(regex);

  if (match) {
    options.kind = parseOutputType(match[1]);
    options.deps = match[2]?.split(/\s+/).filter(Boolean) ?? [];
    options.caption = match[3] || "";
  }
  return options;
}

export function templateImg(
  imgb64: string,
  caption?: string,
  wrapperClass?: string,
): string {
  const tag = wrapperClass ? `<figure class="${wrapperClass}">` : "<figure>";
  return `
${tag}
  <img src="data:image/png;base64,${imgb64}" caption="${caption || ""}" />
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</figure>`;
}

export function templateSvg(
  svg: string,
  caption?: string,
  wrapperClass?: string,
): string {
  const tag = wrapperClass ? `<figure class="${wrapperClass}">` : "<figure>";
  return `
${tag}
  ${svg}
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</figure>`;
}

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function templateText(text: string, wrapperClass?: string): string {
  const tag = wrapperClass ? `<div class="${wrapperClass}">` : "<div>";
  const safeText = escapeHtml(text);
  return `
${tag}
  <pre class="python-output"><code>${safeText}</code></pre>
</div>`;
}

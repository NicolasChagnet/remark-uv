# remark-uv

**[remark][]** plugin to execute Python code blocks with [uv][] and embed their
output into the document.

## Contents

*   [What is this?](#what-is-this)
*   [When should I use this?](#when-should-i-use-this)
*   [Install](#install)
*   [Use](#use)
*   [API](#api)
*   [Block syntax](#block-syntax)
*   [Astro](#astro)
*   [Security](#security)
*   [License](#license)

## What is this?

This package is a [unified][] ([remark][]) plugin that 
- finds fenced code blocks tagged `pyRun` (or a custom code tag),
- executes them with [`uv run`][uv] in script mode, 
- replaces the block with the resulting output (plain text, a base64-encoded PNG image, or an inline SVG).

Dependencies are declared directly in the block metadata and injected into the
script via a [PEP 723][] inline script header, so no virtual environment setup
is required.

## When should I use this?

Use this plugin when you want to generate figures, tables, or computed output
from Python scripts at build time and have them embedded directly in your
rendered markdown. You must have [`uv`][uv] available in your build environment.

## Install

This package is [ESM only][esm].

```sh
npm install @nchagnet/remark-uv
```

## Use

Given the following file `example.md`:

````md
# My plot

```pyRun img [numpy] caption="Sine wave"
import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 2 * np.pi, 200)
fig, ax = plt.subplots()
ax.plot(x, np.sin(x))
print(mpl_to_base64(fig))
```
````

And a script `example.js`:

```js
import { remark } from 'remark'
import { read } from 'to-vfile'
import remarkPyRun from '@nchagnet/remark-uv'

const file = await remark()
  .use(remarkPyRun)
  .process(await read('example.md'))

console.log(String(file))
```

Running `node example.js` yields HTML with the code block replaced by a
`<figure>` containing the rendered image.

## API

This package exports `remarkPyRun` which accepts the options described below.

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `codeTag` | `string` | `'pyRun'` | Fenced code language tag that triggers execution. |
| `uvCommand` | `string` | `'uv'` | Path or name of the `uv` executable. |
| `timeout` | `number` | `10000` | Maximum execution time per script in milliseconds. |
| `baseDeps` | `string[]` | `['matplotlib', 'plotly', 'kaleido']` | Dependencies always injected via [PEP 723][]. |
| `cacheDir` | `string` | `''` | Directory used to cache script output by content hash. Caching is disabled when empty. |
| `defaultOutputType` | `'text' \| 'img' \| 'svg'` | `'text'` | Output kind used when none is specified in the block metadata. |
| `wrapperClass` | `string` | `'py-run-result'` | CSS class applied to the generated wrapper element. |

## Block syntax

````md
```pyRun <type> [<deps>] [caption="<text>"]
# python code
```
````

*   **`type`** — `text`, `img`, or `svg`. Defaults to `defaultOutputType`.
*   **`deps`** — space-separated list of extra pip packages in square brackets,
    e.g. `[numpy scipy]`. These are merged with `baseDeps`.
*   **`caption`** — optional caption rendered as a `<figcaption>` (image and SVG
    only).

Three Python helper functions are available inside every block without importing:

*   `mpl_to_base64(fig)`: converts a Matplotlib figure to a base64 PNG string.
*   `plotly_to_base64(fig)`: converts a Plotly figure to a base64 PNG string.
*   `plotly_to_svg(fig)`: converts a Plotly figure to an SVG string.

## Astro

Add the plugin to your `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config'
import remarkPyRun from '@nchagnet/remark-uv'

export default defineConfig({
  markdown: {
    remarkPlugins: [
      [remarkPyRun, {
        cacheDir: '.cache/remark-uv',
        defaultOutputType: 'img',
      }],
    ],
  },
})
```

Setting `cacheDir` is recommended in Astro builds to avoid re-running scripts
that have not changed between builds.

## Security

Script execution happens at **build time** on your own machine or CI runner; no
user-supplied content is executed. Text output is HTML-escaped before being
embedded. Image and SVG output is embedded as-is so make sure your Python code
only produces trusted content.

## License

[MIT][] © [Nicolas Chagnet][author]

<!-- Definitions -->

[unified]: https://github.com/unifiedjs/unified

[remark]: https://github.com/remarkjs/remark

[uv]: https://docs.astral.sh/uv/

[esm]: https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c

[pep 723]: https://peps.python.org/pep-0723/

[mit]: license

[author]: https://github.com/NicolasChagnet

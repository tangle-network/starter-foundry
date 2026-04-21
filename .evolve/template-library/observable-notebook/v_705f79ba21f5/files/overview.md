---
title: Overview
---

# Overview

Data is loaded at build time from `src/data/rows.json.ts` and rendered
reactively. The loader runs as a Node.js script; Observable Framework ships
only the serialised output to the browser.

```js
const rows = await FileAttachment("data/rows.json").json();
```

```js
Inputs.table(rows)
```

```js
Plot.plot({
  y: { grid: true, label: "Revenue ($)" },
  marks: [Plot.barY(rows, { x: "month", y: "revenue", fill: "#2563eb" })]
})
```

To use real data, replace the generated array in `src/data/rows.json.ts`
with a database query or API fetch — the `FileAttachment` import above
stays the same.

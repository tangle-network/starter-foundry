---
title: {{headline}}
toc: false
---

# {{headline}}

{{subheadline}}

```js
const series = Array.from({ length: 30 }, (_, i) => ({
  day: i,
  value: Math.sin(i / 3) * 50 + 60 + i
}));
```

```js
Plot.plot({
  marks: [Plot.line(series, { x: 'day', y: 'value' })]
})
```

See [Overview](./overview) for a data-loader example.

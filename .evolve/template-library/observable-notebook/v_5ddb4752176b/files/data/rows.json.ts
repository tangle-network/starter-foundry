const rows = Array.from({ length: 12 }, (_, i) => ({
  month: i + 1,
  revenue: Math.round(10_000 + Math.sin(i / 2) * 3_000 + i * 200),
}));

process.stdout.write(JSON.stringify(rows));

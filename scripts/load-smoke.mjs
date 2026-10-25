#!/usr/bin/env node
const base = (process.env.LOAD_BASE_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
const endpoint = process.env.LOAD_ENDPOINT || "/api/live";
const concurrency = Math.max(1, Number(process.env.LOAD_CONCURRENCY || 25));
const total = Math.max(concurrency, Number(process.env.LOAD_REQUESTS || 500));
const latencies = [];
let completed = 0;
let failures = 0;
let cursor = 0;
const worker = async () => {
  while (true) {
    const id = cursor++;
    if (id >= total) return;
    const started = performance.now();
    try {
      const response = await fetch(`${base}${endpoint}`, { headers: { accept: "application/json" } });
      latencies.push(performance.now() - started);
      if (!response.ok) failures++;
    } catch {
      failures++;
    } finally {
      completed++;
    }
  }
};
await Promise.all(Array.from({ length: concurrency }, worker));
latencies.sort((a, b) => a - b);
const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] ?? 0;
const result = {
  base,
  endpoint,
  total,
  concurrency,
  completed,
  failures,
  errorRate: total ? failures / total : 1,
  p50Ms: Math.round(percentile(0.5)),
  p95Ms: Math.round(percentile(0.95)),
  p99Ms: Math.round(percentile(0.99)),
};
console.log(JSON.stringify(result, null, 2));
if (failures || result.p95Ms > Number(process.env.LOAD_P95_MAX_MS || 1000)) process.exitCode = 1;

import { performance } from "node:perf_hooks";
import Shared from "../utils/shared.js";

const config = Shared.normalizeConfig({
  proxies: Array.from({ length: 20 }, (_, index) => ({
    id: `proxy-${index}`,
    type: "http",
    host: "127.0.0.1",
    port: 8000 + index,
  })),
  containerSettings: Object.fromEntries(
    Array.from({ length: 100 }, (_, index) => [
      `firefox-container-${index}`,
      { proxyId: `proxy-${index % 20}` },
    ]),
  ),
});
const runtime = Shared.compileRuntime(config, []);
const iterations = 500000;

function measure(name, operation) {
  for (let index = 0; index < 10000; index += 1) {
    operation(index);
  }

  const startedAt = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    operation(index);
  }
  const duration = performance.now() - startedAt;
  process.stdout.write(`${name}: ${duration.toFixed(2)} ms (${iterations} iterations)\n`);
}

measure("proxy assignment", (index) => {
  Shared.resolveProxyAssignment(config, `firefox-container-${index % 100}`);
});
measure("compiled proxy lookup", (index) => {
  return runtime.proxyRuntime.planByContainerId[
    `firefox-container-${index % 100}`
  ];
});

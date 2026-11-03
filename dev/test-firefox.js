import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clearTimeout, setTimeout } from "node:timers";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json")));
const archive = path.join(root, "dist", `privacy-containers-${manifest.version}.xpi`);
const stage = await mkdtemp(path.join(os.tmpdir(), "privacy-containers-firefox-"));
const requests = [];
let firefox;
let output = "";
let timeout;
let complete;
const result = new Promise((resolve) => { complete = resolve; });

const origin = http.createServer(async (request, response) => {
  if (request.url === "/result" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    try {
      const report = JSON.parse(body);
      response.end("ok");
      complete(report);
    } catch (error) {
      response.writeHead(400).end(error.message);
    }
    return;
  }
  if (request.url === "/requests") {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(requests));
    return;
  }
  const observation = {
    url: request.url,
    headers: request.headers,
    route: request.headers["x-test-proxy"] || "direct",
  };
  requests.push(observation);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  const escaped = JSON.stringify(observation).replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  response.end(`<!doctype html><title>Integration target</title><pre id="request">${escaped}</pre>`);
});

const proxy = http.createServer((request, response) => {
  let target;
  try {
    target = new URL(request.url);
    assert.equal(target.protocol, "http:");
    assert.equal(target.hostname, "localhost");
    assert.equal(target.port, String(origin.address().port));
  } catch {
    response.writeHead(403).end("Only the local test target is allowed");
    return;
  }
  const upstream = http.request({
    hostname: "127.0.0.1",
    port: origin.address().port,
    path: target.pathname + target.search,
    method: request.method,
    headers: { ...request.headers, "x-test-proxy": "http" },
  }, (reply) => {
    response.writeHead(reply.statusCode, reply.headers);
    reply.pipe(response);
  });
  upstream.on("error", () => response.writeHead(502).end("Test proxy failed"));
  request.pipe(upstream);
});

async function command(binary, args) {
  const child = spawn(binary, args, { cwd: root, stdio: "inherit" });
  const [code] = await once(child, "exit");
  assert.equal(code, 0, `${binary} failed`);
}

try {
  origin.listen(0, "127.0.0.1");
  await once(origin, "listening");
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");
  await command("unzip", ["-q", archive, "-d", stage]);
  await cp(path.join(root, "tests/firefox"), path.join(stage, "tests/firefox"), { recursive: true });
  const testManifest = JSON.parse(await readFile(path.join(stage, "manifest.json")));
  testManifest.background.scripts.push("tests/firefox/start.js");
  await writeFile(path.join(stage, "manifest.json"), JSON.stringify(testManifest));
  await writeFile(path.join(stage, "tests/firefox/settings.json"), JSON.stringify({
    target: `http://localhost:${origin.address().port}`,
    control: `http://127.0.0.1:${origin.address().port}`,
    proxyPort: proxy.address().port,
  }));
  firefox = spawn(process.execPath, [
    path.join(root, "node_modules/web-ext/bin/web-ext.js"), "run",
    "--source-dir", stage,
    "--firefox", process.env.FIREFOX_BINARY || "firefox",
    "--no-input", "--no-reload", "--verbose", "--args=-headless",
    "--pref=privacy.userContext.enabled=true",
    "--pref=network.proxy.allow_hijacking_localhost=true",
  ], { cwd: root, env: { ...process.env, MOZ_WEBRENDER: "0" } });
  for (const stream of [firefox.stdout, firefox.stderr]) {
    stream.on("data", (chunk) => { output += chunk; });
  }
  firefox.on("error", (error) => complete({ error: error.stack }));
  firefox.on("exit", (code, signal) => complete({ error: `Firefox runner exited: ${code ?? signal}` }));
  timeout = setTimeout(() => complete({ error: "Firefox integration tests exceeded 90 seconds" }), 90000);
  const report = await result;
  for (const name of report.passed || []) console.log(`PASS ${name}`);
  assert.ok(!report.error, report.error);
  assert.equal(report.passed?.length, 10, "Not all browser scenarios completed");
  console.log(`Firefox ${report.firefox}: all integration scenarios passed`);
} catch (error) {
  console.error(output);
  console.error(error);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  if (firefox && firefox.exitCode === null && firefox.signalCode === null) {
    const stopped = once(firefox, "exit");
    firefox.kill("SIGTERM");
    const timer = setTimeout(() => firefox.kill("SIGKILL"), 5000);
    await stopped;
    clearTimeout(timer);
  }
  for (const server of [proxy, origin]) {
    server.closeAllConnections();
    await new Promise((resolve) => { server.close(resolve); });
  }
  await rm(stage, { recursive: true, force: true, maxRetries: 3 });
}

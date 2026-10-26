import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import test from "node:test";

// Use the real Worker runtime: a direct Node import cannot load cloudflare: URLs.
test(
  "production Worker renders room creation without starter content or private state",
  { timeout: 30000 },
  async () => {
    const listener = createServer();
    await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
    const port = listener.address().port;
    await new Promise((resolve) => listener.close(resolve));
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(
          new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
        ),
        "dev",
        "--config",
        "dist/server/wrangler.json",
        "--ip",
        "127.0.0.1",
        "--port",
        String(port),
        "--local",
      ],
      {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        detached: process.platform !== "win32",
        env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    try {
      let response;
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        if (child.exitCode !== null)
          throw new Error(`Worker exited: ${output.slice(-4000)}`);
        try {
          response = await fetch(`http://127.0.0.1:${port}/`);
          if (response.status === 200) break;
        } catch {
          /* Worker is starting. */
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      assert.ok(response, `Worker did not start: ${output.slice(-4000)}`);
      assert.equal(response.status, 200, output.slice(-4000));
      assert.match(response.headers.get("content-type") ?? "", /text\/html/);
      const html = await response.text();
      for (const text of [
        "Here to Slay",
        "Create a table",
        "Join friends",
        "Gather your party.",
        "Warriors",
        "Berserkers",
        "Standard",
        "Quick",
      ])
        assert.ok(html.includes(text), `Missing ${text}`);
      assert.doesNotMatch(
        html,
        /Your site is taking shape|Codex is working|codex-preview|tokenHash/,
      );
    } finally {
      try {
        if (process.platform === "win32") child.kill();
        else process.kill(-child.pid, "SIGTERM");
      } catch {
        /* Already stopped. */
      }
    }
  },
);

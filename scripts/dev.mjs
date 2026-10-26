import { spawn } from "node:child_process";

const grouped = process.platform !== "win32";
const children = [
  spawn("cargo", ["run", "--manifest-path", "backend/Cargo.toml"], {
    stdio: "inherit",
    detached: grouped,
  }),
  spawn("npm", ["run", "dev"], { stdio: "inherit", detached: grouped }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      if (grouped && child.pid) process.kill(-child.pid, "SIGTERM");
      else child.kill("SIGTERM");
    } catch {
      // A process may have already exited; still stop its sibling.
    }
  }
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => stop(code ?? 0));
}

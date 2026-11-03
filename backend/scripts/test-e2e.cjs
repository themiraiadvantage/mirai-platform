const { spawnSync } = require("node:child_process");
const result = spawnSync(
  process.execPath,
  ["--test", "test/auth.test.cjs", "test/admin-auth.test.cjs"],
  {
    stdio: "inherit",
    env: { ...process.env, RUN_DATABASE_TESTS: "1" },
  },
);
process.exitCode = result.status ?? 1;

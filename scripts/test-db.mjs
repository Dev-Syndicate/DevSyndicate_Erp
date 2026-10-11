// Runs every supabase/tests/*.sql against the linked project (each file rolls back) and fails if one doesn't pass.
// Needs `supabase login` and `supabase link` done once.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const files = readdirSync("supabase/tests").filter((f) => f.endsWith(".sql")).sort();
let failed = 0;

for (const file of files) {
  const run = spawnSync("pnpm", ["dlx", "supabase", "db", "query", "--linked", "-f", `supabase/tests/${file}`], {
    encoding: "utf8",
    shell: true,
  });
  const out = `${run.stdout}${run.stderr}`;
  const passed = out.match(/"result": "([^"]*passed)"/)?.[1];
  if (passed) {
    console.log(`✓ ${file}: ${passed}`);
  } else {
    failed++;
    console.log(`✗ ${file}\n${out.match(/ERROR:[^"]*/)?.[0] ?? out.slice(-500)}`);
  }
}

console.log(`\n${files.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

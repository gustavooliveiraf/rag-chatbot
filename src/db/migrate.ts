import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

async function main() {
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    console.log(`Applying migration ${file}...`);
    await pool.query(sql);
  }
  console.log(`Applied ${files.length} migration(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exitCode = 1;
});

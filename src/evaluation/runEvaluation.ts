import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchChunks } from "../retrieval/search.js";
import { selectPassages } from "../retrieval/selectPassages.js";
import { generateAnswer } from "../generation/generateAnswer.js";
import type { EvaluationCase } from "../types/index.js";

const fixturesPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "evaluation",
  "fixtures",
  "cases.json",
);

interface CaseResult {
  id: string;
  pass: boolean;
  detail: string;
}

async function runCase(evalCase: EvaluationCase): Promise<CaseResult> {
  const retrieved = await searchChunks(evalCase.question);
  const passages = selectPassages(retrieved);
  const answer = await generateAnswer(evalCase.question, passages);

  if (!evalCase.expect_answered) {
    const pass = answer.grounded === false;
    return {
      id: evalCase.id,
      pass,
      detail: pass ? "correctly declined" : `expected decline, got grounded=${answer.grounded}`,
    };
  }

  console.log(`===> ${evalCase.id}: ${evalCase.question}\n\n`);
  retrieved.forEach(r => console.log(r.similarity, r.content));
  console.log("===>\n\n");

  const sourceTitles = answer.sources.map((s) => s.title);
  const matched = evalCase.expected_source_titles.some((title) => sourceTitles.includes(title));
  const pass = answer.grounded === true && matched;
  return {
    id: evalCase.id,
    pass,
    detail: pass
      ? "grounded with expected source"
      : `expected one of [${evalCase.expected_source_titles.join(", ")}] in sources, got [${sourceTitles.join(", ")}] (grounded=${answer.grounded})`,
  };
}

async function main() {
  const raw = await readFile(fixturesPath, "utf8");
  const cases: EvaluationCase[] = JSON.parse(raw);

  const results: CaseResult[] = [];
  for (const evalCase of cases) {
    try {
      results.push(await runCase(evalCase));
    } catch (err) {
      results.push({
        id: evalCase.id,
        pass: false,
        detail: `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  for (const result of results) {
    console.log(`[${result.pass ? "PASS" : "FAIL"}] ${result.id}: ${result.detail}`);
  }

  const declineCases = cases.filter((c) => !c.expect_answered);
  const answeredCases = cases.filter((c) => c.expect_answered);
  const declineResults = results.filter((r) => declineCases.some((c) => c.id === r.id));
  const answeredResults = results.filter((r) => answeredCases.some((c) => c.id === r.id));

  const declineRate = declineCases.length
    ? declineResults.filter((r) => r.pass).length / declineCases.length
    : null;
  const sourceMatchRate = answeredCases.length
    ? answeredResults.filter((r) => r.pass).length / answeredCases.length
    : null;

  console.log("");
  console.log(
    `Correct decline rate (SC-002, target >=95%): ${declineRate === null ? "n/a" : `${(declineRate * 100).toFixed(1)}%`}`,
  );
  console.log(
    `Source-match rate (SC-003, target >=90%): ${sourceMatchRate === null ? "n/a" : `${(sourceMatchRate * 100).toFixed(1)}%`}`,
  );
}

main().catch((err) => {
  console.error("Evaluation run failed:", err);
  process.exitCode = 1;
});

import fs from "fs";
import path from "path";

const jsonlPath = path.join(
  process.env.USERPROFILE,
  ".cursor/projects/c-Users-Standard-Desktop-Trebon-po-cely-rok/agent-transcripts/55c00a48-eca2-4281-9a61-fbe0549654dc/55c00a48-eca2-4281-9a61-fbe0549654dc.jsonl"
);
const outPath = process.argv[3] || path.join(process.cwd(), "scripts/checkpoint-prolnuti.tsx");
const lineNum = Number(process.argv[2] || 466);

const line = fs.readFileSync(jsonlPath, "utf8").split("\n")[lineNum - 1];
const obj = JSON.parse(line);
for (const part of obj.message?.content ?? []) {
  if (part.type === "tool_use" && part.name === "Write" && part.input?.path?.includes("ZobrazeniProlnuti")) {
    fs.writeFileSync(outPath, part.input.contents);
    console.log("Wrote", outPath, part.input.contents.length, "bytes");
    process.exit(0);
  }
}
console.error("Not found");
process.exit(1);

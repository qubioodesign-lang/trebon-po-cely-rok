import fs from "fs";
import path from "path";

const jsonlPath = path.join(
  process.env.USERPROFILE,
  ".cursor/projects/c-Users-Standard-Desktop-Trebon-po-cely-rok/agent-transcripts/55c00a48-eca2-4281-9a61-fbe0549654dc/55c00a48-eca2-4281-9a61-fbe0549654dc.jsonl"
);
const repoRoot = "C:/Users/Standard/Desktop/Trebon-po-cely-rok";
const target = path.join(repoRoot, "src/components/ZobrazeniProlnuti.tsx");
const stopLine = Number(process.argv[2] || 475);
const startFromWriteLine = Number(process.argv[3] || 466);

const lines = fs.readFileSync(jsonlPath, "utf8").split("\n");
let content = null;
let applied = [];

for (let i = startFromWriteLine - 1; i < stopLine && i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }
  for (const part of obj.message?.content ?? []) {
    if (part.type !== "tool_use") continue;
    const p = part.input?.path?.replace(/\\/g, "/");
    if (!p?.endsWith("ZobrazeniProlnuti.tsx")) continue;

    if (part.name === "Write") {
      content = part.input.contents;
      applied.push({ line: i + 1, op: "Write", bytes: content.length });
    } else if (part.name === "StrReplace" && content !== null) {
      const { old_string, new_string } = part.input;
      if (!content.includes(old_string)) {
        console.error(`MISS at line ${i + 1}:`);
        console.error(old_string.slice(0, 200));
        process.exit(1);
      }
      content = content.replace(old_string, new_string);
      applied.push({ line: i + 1, op: "StrReplace" });
    }
  }
}

if (content === null) {
  console.error("No content");
  process.exit(1);
}

fs.writeFileSync(target, content);
console.log("Restored checkpoint (transcript lines", startFromWriteLine, "→", stopLine + ")");
for (const a of applied) console.log(`  ${a.line} ${a.op}${a.bytes ? " " + a.bytes + "b" : ""}`);

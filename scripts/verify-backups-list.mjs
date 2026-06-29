import { list } from "@vercel/blob";
import fs from "fs";

const env = fs.readFileSync(".env.vercel", "utf8");
const match = env.match(/VERCEL_OIDC_TOKEN="([^"]+)"/);
const token = match?.[1];
if (!token) {
  console.log("NO_OIDC");
  process.exit(1);
}

const storeMatch = env.match(/BLOB_STORE_ID="store_([^"]+)"/);
const storeId = storeMatch?.[1];

const result = await list({
  prefix: "backups/manual/",
  token,
  oidcToken: token,
  ...(storeId ? { storeId } : {}),
});

console.log("BACKUPS_COUNT", result.blobs.length);
for (const blob of result.blobs.slice(0, 10)) {
  console.log("PATH", blob.pathname, "SIZE", blob.size);
}

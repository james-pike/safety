import { writeFileSync, mkdirSync, cpSync } from "node:fs";
import { join } from "node:path";

const outputDir = ".vercel/output";
const funcDir = join(outputDir, "functions/_qwik-city.func");

// Create function directory
mkdirSync(funcDir, { recursive: true });

// Copy server build into function directory
cpSync("server", funcDir, { recursive: true });

// Copy client dist to static
mkdirSync(join(outputDir, "static"), { recursive: true });
cpSync("dist", join(outputDir, "static"), { recursive: true });

// Write output config.json
writeFileSync(
  join(outputDir, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: "filesystem" },
        { src: "/.*", dest: "/_qwik-city" },
      ],
    },
    null,
    2
  )
);

// Write function config
writeFileSync(
  join(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs20.x",
      handler: "entry.vercel-edge.js",
      launcherType: "Nodejs",
    },
    null,
    2
  )
);

console.log("Vercel output config written successfully");

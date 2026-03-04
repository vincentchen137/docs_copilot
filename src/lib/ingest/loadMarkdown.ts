import fs from "fs";
import path from "path";

export type LoadedMarkdown = {
  absolutePath: string;
  relativePath: string;
  content: string;
};

export function loadMarkdownFromDocs(rootDir: string): LoadedMarkdown[] {
  const docsDir = path.join(rootDir, "docs");

  if (!fs.existsSync(docsDir)) {
    return [];
  }

  const results: LoadedMarkdown[] = [];

  function walk(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        const content = fs.readFileSync(full, "utf8");
        const relativePath = path.relative(rootDir, full).replace(/\\/g, "/");
        results.push({
          absolutePath: full,
          relativePath,
          content
        });
      }
    }
  }

  walk(docsDir);

  return results;
}


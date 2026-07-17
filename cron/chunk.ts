const TARGET_TOKENS = 500;
const OVERLAP_CHARS = 200;
const HARD_WRAP_CHARS = 2000;

export interface ChunkDraft {
  chunkIndex: number;
  headingPath: string;
  content: string;
  tokenCount: number;
}

export interface ParsedDocument {
  title: string;
  chunks: ChunkDraft[];
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function stripFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  const lines = raw.split("\n");
  if ((lines[0] ?? "").trim() !== "---") {
    return { frontmatter: {}, body: raw };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if ((lines[i] ?? "").trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { frontmatter: {}, body: raw };
  }
  const frontmatter: Record<string, string> = {};
  for (const line of lines.slice(1, end)) {
    const match = /^(\w+):\s*(.+)$/.exec(line.trim());
    if (match) {
      frontmatter[match[1] as string] = (match[2] as string).replace(/^["']|["']$/g, "");
    }
  }
  return { frontmatter, body: lines.slice(end + 1).join("\n") };
}

function humanizeFilename(path: string): string {
  const base = path.split("/").pop() ?? path;
  const stem = base.replace(/\.mdx?$/i, "");
  return stem.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function deriveTitle(
  frontmatter: Record<string, string>,
  body: string,
  path: string,
): { title: string; body: string } {
  if (frontmatter.title) {
    return { title: frontmatter.title, body };
  }

  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();
    if (line === "") continue;
    const match = /^#\s+(.+)$/.exec(line);
    if (match) {
      const remaining = [...lines.slice(0, i), ...lines.slice(i + 1)].join("\n");
      return { title: (match[1] as string).trim(), body: remaining };
    }
    break;
  }

  return { title: humanizeFilename(path), body };
}

interface Section {
  headingPath: string;
  body: string;
}

function splitSections(body: string, title: string): Section[] {
  const lines = body.split("\n");
  const sections: Section[] = [];
  let headingPath = title;
  let currentH2: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text.length > 0) {
      sections.push({ headingPath, body: text });
    }
    buffer = [];
  };

  for (const line of lines) {
    const h2Match = /^##\s+(.+)$/.exec(line);
    const h3Match = /^###\s+(.+)$/.exec(line);
    if (h2Match) {
      flush();
      currentH2 = (h2Match[1] as string).trim();
      headingPath = currentH2;
      continue;
    }
    if (h3Match) {
      flush();
      const h3 = (h3Match[1] as string).trim();
      headingPath = currentH2 ? `${currentH2} > ${h3}` : h3;
      continue;
    }
    buffer.push(line);
  }
  flush();

  return sections;
}

function hardWrap(text: string): string[] {
  const pieces: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + HARD_WRAP_CHARS, text.length);
    pieces.push(text.slice(start, end));
    start = end;
  }
  return pieces;
}

function windowSection(body: string): string[] {
  if (estimateTokens(body) <= TARGET_TOKENS) {
    return [body];
  }

  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const windows: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim().length > 0) windows.push(current.trim());
  };

  for (const paragraph of paragraphs) {
    const pieces = estimateTokens(paragraph) > TARGET_TOKENS ? hardWrap(paragraph) : [paragraph];
    for (const piece of pieces) {
      const candidate = current ? `${current}\n\n${piece}` : piece;
      if (current && estimateTokens(candidate) > TARGET_TOKENS) {
        pushCurrent();
        const overlap = current.slice(-OVERLAP_CHARS);
        current = overlap ? `${overlap}\n\n${piece}` : piece;
      } else {
        current = candidate;
      }
    }
  }
  pushCurrent();

  return windows.length > 0 ? windows : [body];
}

export function parseMarkdown(raw: string, path: string): ParsedDocument {
  const { frontmatter, body: afterFrontmatter } = stripFrontmatter(raw);
  const { title, body } = deriveTitle(frontmatter, afterFrontmatter, path);
  const sections = splitSections(body, title);

  const chunks: ChunkDraft[] = [];
  let chunkIndex = 0;
  for (const section of sections) {
    for (const windowText of windowSection(section.body)) {
      chunks.push({
        chunkIndex: chunkIndex++,
        headingPath: section.headingPath,
        content: windowText,
        tokenCount: estimateTokens(windowText),
      });
    }
  }

  return { title, chunks };
}

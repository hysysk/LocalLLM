import fs from "node:fs/promises";
import path from "node:path";

const WORKSPACE_DIR = "/home/node/.openclaw/workspace";
const INBOUND_DIR = "/home/node/.openclaw/media/inbound";
const DEFAULT_OUTPUT_DIR = path.join(WORKSPACE_DIR, "transcriptions");

const MODEL = "qwen2.5vl:7b";
const OLLAMA_URL = "http://ollama:11434/api/chat";

const SUPPORTED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

// ------------------------------------------------------------
// Arguments
// ------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(name) {
  const index = args.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }

  return value;
}

function hasArg(name) {
  return args.includes(name);
}

if (hasArg("--help")) {
  console.log(`
Usage:

  node image-to-md.mjs [options]

Options:

  --input <path>
      Image to process.
      If omitted, the most recently uploaded image in
      OpenClaw's media/inbound directory is used.

      Relative paths are resolved from the OpenClaw workspace.

  --output-dir <path>
      Directory where the Markdown file will be saved.
      If omitted, workspace/transcriptions is used.

      Relative paths are resolved from the OpenClaw workspace.

Examples:

  node image-to-md.mjs

  node image-to-md.mjs \\
    --output-dir notes

  node image-to-md.mjs \\
    --input images/document.jpg \\
    --output-dir notes
`);
  process.exit(0);
}

// ------------------------------------------------------------
// Path helpers
// ------------------------------------------------------------

function resolveWorkspacePath(value) {
  if (path.isAbsolute(value)) {
    return path.normalize(value);
  }

  return path.resolve(WORKSPACE_DIR, value);
}

function isSupportedImage(filePath) {
  return SUPPORTED_EXTENSIONS.has(
    path.extname(filePath).toLowerCase()
  );
}

// ------------------------------------------------------------
// Find input image
// ------------------------------------------------------------

async function findLatestInboundImage() {
  const entries = await fs.readdir(INBOUND_DIR, {
    withFileTypes: true,
  });

  const images = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const filePath = path.join(INBOUND_DIR, entry.name);

    if (!isSupportedImage(filePath)) {
      continue;
    }

    const stat = await fs.stat(filePath);

    images.push({
      path: filePath,
      mtimeMs: stat.mtimeMs,
    });
  }

  if (images.length === 0) {
    throw new Error(
      `No supported image found in ${INBOUND_DIR}`
    );
  }

  images.sort((a, b) => b.mtimeMs - a.mtimeMs);

  return images[0].path;
}

async function resolveInputPath() {
  const inputArg = getArg("--input");

  const inputPath = inputArg
    ? resolveWorkspacePath(inputArg)
    : await findLatestInboundImage();

  let stat;

  try {
    stat = await fs.stat(inputPath);
  } catch {
    throw new Error(`Input image not found: ${inputPath}`);
  }

  if (!stat.isFile()) {
    throw new Error(`Input is not a file: ${inputPath}`);
  }

  if (!isSupportedImage(inputPath)) {
    throw new Error(
      `Unsupported image format: ${path.extname(inputPath)}`
    );
  }

  return inputPath;
}

// ------------------------------------------------------------
// Output directory
// ------------------------------------------------------------

function resolveOutputDir() {
  const outputArg = getArg("--output-dir");

  if (!outputArg) {
    return DEFAULT_OUTPUT_DIR;
  }

  return resolveWorkspacePath(outputArg);
}

// ------------------------------------------------------------
// Filename helpers
// ------------------------------------------------------------

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function escapeYamlString(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

async function createUniqueOutputPath(outputDir, slug) {
  let candidate = path.join(outputDir, `${slug}.md`);
  let suffix = 2;

  while (true) {
    try {
      await fs.access(candidate);

      candidate = path.join(
        outputDir,
        `${slug}-${suffix}.md`
      );

      suffix += 1;
    } catch {
      return candidate;
    }
  }
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

const inputPath = await resolveInputPath();
const outputDir = resolveOutputDir();

console.log(`Using image: ${inputPath}`);
console.log(`Output directory: ${outputDir}`);

const imageBytes = await fs.readFile(inputPath);
const imageBase64 = imageBytes.toString("base64");

const prompt = `
You are transcribing a document image into Markdown.

Read the image carefully.

Return Markdown only.

The first line MUST be an H1 heading containing the best concise
document title supported by clearly readable text in the image.

Choose the title using this priority:

1. An explicit document title.
2. A clearly identifiable course, assignment, lecture, section,
   article, chapter, or project title.
3. A short descriptive title constructed only from clearly readable
   text in the document.

Do not invent information.

Do not use generic titles such as "Document", "Page", or "Untitled"
when more meaningful identifying text is available.

After the H1, use this structure:

## Transcription

Transcribe all clearly readable text.

Preserve headings, numbering, paragraph structure, and meaningful
line breaks.

Mark uncertain text as [unclear].

Do not silently correct, reconstruct, or invent unreadable text.

## Visual Description

Describe clearly observable visual features including diagrams,
layout, typography, annotations, spatial relationships, tables,
figures, or other visually significant elements.

Do not speculate about meaning when it cannot be directly observed.

## Identifiable Information

List clearly observable identifying information when present,
such as:

- names
- dates
- institutions
- organizations
- course titles
- publication titles
- project titles
- mathematical terms
- design terms

Do not add items that are not visible in the image.

Return Markdown only.
`;

const response = await fetch(OLLAMA_URL, {
  method: "POST",

  headers: {
    "Content-Type": "application/json",
  },

  body: JSON.stringify({
    model: MODEL,

    messages: [
      {
        role: "user",
        content: prompt,
        images: [imageBase64],
      },
    ],

    stream: false,

    // Free the vision model after processing.
    keep_alive: 0,

    options: {
      // 4096 was insufficient for the tested document image.
      num_ctx: 8192,
      num_predict: 2048,
      temperature: 0,
    },
  }),

  signal: AbortSignal.timeout(300000),
});

if (!response.ok) {
  const body = await response.text();

  throw new Error(
    `Ollama request failed: ${response.status} ${response.statusText}\n${body}`
  );
}

const result = await response.json();
const markdown = result?.message?.content?.trim();

if (!markdown) {
  throw new Error("Qwen returned no Markdown content.");
}

// ------------------------------------------------------------
// Determine title and filename
// ------------------------------------------------------------

const titleMatch = markdown.match(/^#\s+(.+)$/m);

let title = titleMatch?.[1]?.trim();

if (!title) {
  title = path.parse(inputPath).name;
}

let slug = slugify(title);

if (!slug) {
  slug =
    slugify(path.parse(inputPath).name) ||
    "document";
}

// ------------------------------------------------------------
// Save
// ------------------------------------------------------------

await fs.mkdir(outputDir, {
  recursive: true,
});

const outputPath = await createUniqueOutputPath(
  outputDir,
  slug
);

const sourceImage = path.basename(inputPath);

const frontmatter = `---
title: "${escapeYamlString(title)}"
source_image: "${escapeYamlString(sourceImage)}"
vision_model: "${MODEL}"
---

`;

await fs.writeFile(
  outputPath,
  frontmatter + markdown + "\n",
  "utf8"
);

console.log(`Title: ${title}`);
console.log(`Saved: ${outputPath}`);
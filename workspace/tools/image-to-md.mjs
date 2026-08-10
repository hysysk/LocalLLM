import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";

const WORKSPACE_DIR = "/home/user/workspace";
const DEFAULT_INPUT_DIR = path.join(WORKSPACE_DIR, "inbox");
const DEFAULT_OUTPUT_DIR = path.join(WORKSPACE_DIR, "transcriptions");

const OLLAMA_URL =
  process.env.OLLAMA_URL ?? "http://ollama:11434/api/chat";

const DEFAULT_MODEL =
  process.env.IMAGE_MODEL ?? "qwen2.5vl:7b";

const OLLAMA_TIMEOUT_MS =
  Number(process.env.OLLAMA_TIMEOUT_MS ?? 900000);

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

if (args.includes("--help")) {
  console.log(`
Usage:

  node image-to-md.mjs [options]

Options:

  --input <path>
      Image to process.

      If omitted, the most recently modified image in:
      ${DEFAULT_INPUT_DIR}
      is used.

      Relative paths are resolved from:
      ${WORKSPACE_DIR}

  --output-dir <path>
      Directory where the Markdown file will be saved.

      If omitted:
      ${DEFAULT_OUTPUT_DIR}

      Relative paths are resolved from:
      ${WORKSPACE_DIR}

  --model <model>
      Ollama vision model.

      Default:
      ${DEFAULT_MODEL}

Examples:

  node image-to-md.mjs

  node image-to-md.mjs \\
    --output-dir transcriptions

  node image-to-md.mjs \\
    --input inbox/page-01.jpg \\
    --output-dir transcriptions

  node image-to-md.mjs \\
    --input project-a/images/document.png \\
    --output-dir project-a/transcriptions
`);
  process.exit(0);
}

// ------------------------------------------------------------
// Path handling
// ------------------------------------------------------------

function resolveWorkspacePath(value) {
  if (path.isAbsolute(value)) {
    return path.normalize(value);
  }

  return path.resolve(WORKSPACE_DIR, value);
}

function assertInsideWorkspace(targetPath) {
  const relative = path.relative(
    WORKSPACE_DIR,
    path.resolve(targetPath),
  );

  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `Path must stay inside workspace: ${targetPath}`,
    );
  }
}

function isSupportedImage(filePath) {
  return SUPPORTED_EXTENSIONS.has(
    path.extname(filePath).toLowerCase(),
  );
}

// ------------------------------------------------------------
// Input image
// ------------------------------------------------------------

async function findLatestImage(directory) {
  let entries;

  try {
    entries = await fs.readdir(directory, {
      withFileTypes: true,
    });
  } catch {
    throw new Error(
      `Input directory does not exist: ${directory}`,
    );
  }

  const images = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const filePath = path.join(directory, entry.name);

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
      `No supported image found in: ${directory}`,
    );
  }

  images.sort((a, b) => b.mtimeMs - a.mtimeMs);

  return images[0].path;
}

async function resolveInputPath() {
  const inputArg = getArg("--input");

  const inputPath = inputArg
    ? resolveWorkspacePath(inputArg)
    : await findLatestImage(DEFAULT_INPUT_DIR);

  assertInsideWorkspace(inputPath);

  let stat;

  try {
    stat = await fs.stat(inputPath);
  } catch {
    throw new Error(
      `Input image not found: ${inputPath}`,
    );
  }

  if (!stat.isFile()) {
    throw new Error(
      `Input is not a file: ${inputPath}`,
    );
  }

  if (!isSupportedImage(inputPath)) {
    throw new Error(
      `Unsupported image format: ${path.extname(inputPath)}`,
    );
  }

  return inputPath;
}

// ------------------------------------------------------------
// Output
// ------------------------------------------------------------

function resolveOutputDir() {
  const outputArg = getArg("--output-dir");

  const outputDir = outputArg
    ? resolveWorkspacePath(outputArg)
    : DEFAULT_OUTPUT_DIR;

  assertInsideWorkspace(outputDir);

  return outputDir;
}

// ------------------------------------------------------------
// Filename
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
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ");
}

async function createUniqueOutputPath(
  outputDir,
  slug,
) {
  let candidate =
    path.join(outputDir, `${slug}.md`);

  let suffix = 2;

  while (true) {
    try {
      await fs.access(candidate);

      candidate = path.join(
        outputDir,
        `${slug}-${suffix}.md`,
      );

      suffix += 1;
    } catch {
      return candidate;
    }
  }
}

// ------------------------------------------------------------
// Vision prompt
// ------------------------------------------------------------

const prompt = `
You are transcribing a document image into Markdown.

Read the image carefully.

Return Markdown only.

The first line MUST be an H1 heading containing the best concise
document title supported by clearly readable text in the image.

Choose the title using this priority:

1. An explicit document title.
2. A clearly identifiable course, assignment, lecture, section,
   article, chapter, publication, or project title.
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

Describe clearly observable visual features including:

- diagrams
- layout
- typography
- annotations
- spatial relationships
- tables
- figures
- other visually significant elements

Do not speculate about meaning when it cannot be directly observed.

## Identifiable Information

List clearly observable identifying information when present,
including:

- names
- dates
- institutions
- organizations
- course titles
- publication titles
- project titles
- mathematical terms
- design terms

Do not add information that is not visible in the image.

Return Markdown only.
`;

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

const inputPath = await resolveInputPath();
const outputDir = resolveOutputDir();
const model = getArg("--model") ?? DEFAULT_MODEL;

console.log(`Using image: ${inputPath}`);
console.log(`Model: ${model}`);
console.log(`Output directory: ${outputDir}`);

const imageBytes = await fs.readFile(inputPath);
const imageBase64 = imageBytes.toString("base64");

function ollamaChat(payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(OLLAMA_URL);
    const body = JSON.stringify(payload);

    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },

      (response) => {
        let data = "";

        response.setEncoding("utf8");

        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          if (
            response.statusCode < 200 ||
            response.statusCode >= 300
          ) {
            reject(
              new Error(
                `Ollama request failed: ` +
                `${response.statusCode}\n${data}`,
              ),
            );

            return;
          }

          try {
            resolve(JSON.parse(data));
          } catch {
            reject(
              new Error(
                `Could not parse Ollama response:\n${data}`,
              ),
            );
          }
        });
      },
    );

    request.setTimeout(
      OLLAMA_TIMEOUT_MS,
      () => {
        request.destroy(
          new Error(
            `Ollama request timed out after ` +
            `${OLLAMA_TIMEOUT_MS / 1000} seconds`,
          ),
        );
      },
    );

    request.on("error", reject);

    request.write(body);
    request.end();
  });
}

const result = await ollamaChat({
  model,

  messages: [
    {
      role: "user",
      content: prompt,
      images: [imageBase64],
    },
  ],

  stream: false,

  // Unload the vision model after the request.
  keep_alive: 0,

  options: {
    num_ctx: 8192,
    num_predict: 2048,
    temperature: 0,
  },
});

const nsToSeconds = (ns) =>
  typeof ns === "number" ? (ns / 1e9).toFixed(1) : "?";

console.log(
  `Ollama timing: total=${nsToSeconds(result.total_duration)}s ` +
  `load=${nsToSeconds(result.load_duration)}s ` +
  `prompt=${nsToSeconds(result.prompt_eval_duration)}s ` +
  `generation=${nsToSeconds(result.eval_duration)}s`
);

const markdown =
  result?.message?.content?.trim();

if (!markdown) {
  throw new Error(
    "Vision model returned no Markdown content.",
  );
}

// ------------------------------------------------------------
// Determine title
// ------------------------------------------------------------

const titleMatch =
  markdown.match(/^#\s+(.+)$/m);

let title =
  titleMatch?.[1]?.trim();

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

const outputPath =
  await createUniqueOutputPath(
    outputDir,
    slug,
  );

const sourceImage =
  path.relative(WORKSPACE_DIR, inputPath);

const frontmatter = `---
title: "${escapeYamlString(title)}"
source_image: "${escapeYamlString(sourceImage)}"
vision_model: "${escapeYamlString(model)}"
---

`;

await fs.writeFile(
  outputPath,
  frontmatter + markdown + "\n",
  "utf8",
);

console.log(`Title: ${title}`);
console.log(`Saved: ${outputPath}`);
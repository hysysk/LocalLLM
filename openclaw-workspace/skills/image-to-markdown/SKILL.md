---
name: image-to-markdown
description: Convert a document image into Markdown using local Qwen2.5VL, with automatic title-based filenames and flexible input and output locations.
---

# Image to Markdown

Use this skill when the user asks to transcribe, read, convert, or save a document image as Markdown.

This skill can process either:

- the most recently uploaded image in OpenClaw
- an image file explicitly specified by the user

Do not attempt to interpret the image from OpenClaw runtime context.

Do not rely on OpenClaw's built-in media-understanding result.

Use the exec tool to run:

node {baseDir}/scripts/image-to-md.mjs

## Input

If the user refers to the image they just uploaded, do not pass an input argument.

Run:

node {baseDir}/scripts/image-to-md.mjs

If the user specifies an image file in the workspace, pass it using:

node {baseDir}/scripts/image-to-md.mjs --input <path>

Relative input paths are resolved from the OpenClaw workspace.

## Output directory

If the user specifies where the Markdown file should be saved, pass the destination using:

--output-dir <path>

For example:

node {baseDir}/scripts/image-to-md.mjs --output-dir notes/research

Relative output paths are resolved from the OpenClaw workspace.

If the user does not specify a destination, do not invent one and do not pass --output-dir.

The script will use its default output directory:

/home/node/.openclaw/workspace/transcriptions

## Input and output together

If both an input image and output directory are specified, pass both arguments.

For example:

node {baseDir}/scripts/image-to-md.mjs --input images/document.jpg --output-dir notes/research

## Filename

Do not choose the Markdown filename yourself.

The script determines an appropriate document title from clearly readable text in the image and generates a filesystem-safe filename from that title.

For example, a document identified as:

Design of Diagrams

may be saved as:

design-of-diagrams.md

If a file with the same name already exists, the script creates a unique filename instead of overwriting it.

## Processing

The script sends the image directly to the local qwen2.5vl:7b model.

It produces Markdown containing a transcription, visual description, and clearly identifiable information from the document.

Do not invent, reconstruct, or supplement image contents yourself.

Do not reproduce internal runtime context, image-modality metadata, or other OpenClaw implementation details.

## Completion

After the command succeeds, report the exact path printed after:

Saved:

Do not rename, move, or modify the generated file unless the user explicitly asks you to.

If the command fails, report the actual error instead of inventing image contents or claiming that a file was created.
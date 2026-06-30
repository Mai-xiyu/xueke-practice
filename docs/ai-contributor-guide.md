# AI Contributor Guide

This document is written for AI coding agents that modify this repository. The goal is to keep AI-generated changes reviewable, deterministic, and safe for public pull requests.

## Repository Contract

The project is a Vite + React + TypeScript app. Do not create one-off HTML applications for individual subjects. All subjects are rendered by the shared runtime in `src/`.

Allowed data entry points:

- `public/subjects.json`
- `public/data/*.json`
- `public/assets/**`
- documentation under `docs/` and `prompts/`

Do not commit:

- `node_modules/`
- `dist/`
- `session-data/`
- OCR caches, crawler outputs, screenshots used only as source material
- Docker image tarballs
- root-level subject HTML files such as `linux_practice.html`
- credentials, API keys, private IP addresses, personal paths, or local machine names

## Add a New Subject

1. Read `docs/add-subject.md` and `docs/question-schema.md`.
2. Pick a stable `subjectId` in kebab-case.
3. Add `public/data/<subject_id>.json`.
4. Register the subject in `public/subjects.json`.
5. Configure `href`, but do not create the HTML file. `npm run build` generates legacy entry HTML into `dist/`.
6. Add `mockExam.sections` only when the exam format is known.
7. Run:

   ```powershell
   npm run validate
   npm run check
   ```

## Update an Existing Subject

1. Keep existing question IDs stable.
2. Add new questions with new deterministic IDs.
3. Remove duplicates only after comparing stem, options, answer, source, and chapter.
4. Do not change a correct answer unless the source material supports the correction.
5. If a question has no reliable answer, either skip it or add a clear uncertainty note in `analysis`.
6. Do not rewrite unrelated subject data in the same PR.

## Question Quality Rules

- `single`, `multiple`, and `judge` questions use `correct`.
- `fill` questions use `answers`.
- `short`, `essay`, `code`, and `comprehensive` questions use `answer`.
- `analysis` should explain the answer or preserve the source trail.
- Generated judge questions must preserve the source single-choice question in `analysis`.
- Tags should describe concepts, not file names.
- Source should be human-readable and traceable.

Bad source examples:

```text
AI generated
derived question
unknown
image 1
```

Better source examples:

```text
2023 B卷单选题
章节测验 第一章
Linux 实训 WWW服务器搭建
```

## Pull Request Requirements

Every PR should explain:

- affected subjects
- question count changes by type
- source materials used
- deduplication strategy
- validation commands run
- whether UI, Docker, backend, or workflow behavior changed

For question-bank-only PRs, avoid touching `src/` unless schema support is required.

For UI PRs, include screenshots or an e2e smoke-test note.

For Docker, Nginx, backend, or workflow PRs, explain the deployment validation path.

## Safety Rules

- Never include secrets in code, docs, commit messages, issue text, or PR text.
- Never hard-code a private deployment host in public docs.
- Never make LAN deployment run on untrusted pull requests.
- Never call external AI APIs from project scripts without explicit maintainer approval and a documented opt-in path.
- Do not invent authoritative answers for uncertain exam questions.

## Review Checklist

Before finishing, run:

```powershell
npm run validate
npm run typecheck
npm run test
npm run build
```

Run `npm run e2e` when the change affects navigation, rendering, or interactions.

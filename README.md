# CanvasUI Lab

WebGPU infinite-canvas design-system matrix with edge VRT, Figma / pen.dev sync and AI audit.
Built on Void (Cloudflare Workers) + Vite+ + gpucanvas, with a strict 5-layer architecture
protected by Brand "passport" types and a FactoryGate.

## Requirements

- Node.js 24.22+ (Volta: `volta install node@24`)
- Chrome 157+ for the GPU path (WebGPU + HTML-in-Canvas). Other browsers get the DOM fallback.
- Cloudflare account (free tier is enough: D1, R2, Workers AI)

## Setup

```sh
npm install
npx void db push          # local D1 schema
npm run dev               # http://localhost:5173
```

Workers AI (audit) and deployment need a Cloudflare login:

```sh
npx void account login
```

## Usage

- The matrix expands every `src/components/**/*.stories.tsx` (CSF3) into a
  size x variant x state x theme grid on the canvas. Shift-click selects a cell
  (Interact mode); the Inspector approves baselines and pins notes.
- **Run VRT** snapshots every baselined cell from GPU memory, diffs in the browser
  (`diffImages`) and highlights regressions with a red WGSL glow. Approve baselines
  per cell after intentional changes. `/history` lists runs and baselines.
- **Design sync** panel: import `design/*.pen` tokens/themes, fetch Figma frame
  renders, compare design vs implementation pixel diffs.
- **Audit** sends the Agent View JSON tree + diff summary to Workers AI
  (llama-3.3-70b, max 20 cells per run) and pins the returned marks.
- Benchmark: `/?bench=10000` tiles the matrix to 10,000 live cells.

## Integrations

### pen.dev

- `design/*.pen` files are watched; import them from the Design sync panel
  (themes become token values per mode).
- Export design baselines with the pen CLI:

  ```sh
  npm install -g @pen.dev/cli
  pen login
  npm run pen:export
  ```

### Figma

- Frame renders: set `FIGMA_TOKEN` (personal access token, `file_content:read`)
  in `.env`, then use the Design sync panel (file key + node ids).
  Production: `npx void secret put FIGMA_TOKEN=...`.
- Design tokens: the Variables REST API is Enterprise-only, so tokens come from
  the plugin in `figma-plugin/` (Figma > Plugins > Development > Import plugin
  from manifest). It exports all local variables/modes and posts them to
  `/api/tokens/import`. W3C DTCG JSON is accepted on the same endpoint
  (`format: "dtcg"`).

## Architecture

```
src/domain/      pure types + rules; Brand passports (ValidatedSnapshot, ...)
src/service/     validation at boundaries (zod), issues passports
src/repository/  D1 (void/db) + R2 (void/storage); accepts passports only
routes/api/      Resolve layer; calls services from src/factory only
src/factory/     sole composition root; holds the FactoryGate value
```

`tests/passport.ts` proves at type level that unvalidated data and forged gates
are rejected. CI (`.github/workflows/ci.yml`) runs `vp check` (Oxlint + tsgo) and
`vp test` (Vitest) as the deploy gate.

## Commands

| Command                           | Purpose                                  |
| --------------------------------- | ---------------------------------------- |
| `npm run dev`                     | dev server (Vite+ / Void)                |
| `npm run check`                   | format + lint + type check               |
| `npm run test`                    | Vitest unit + type-passport tests        |
| `npm run db:push` / `db:generate` | local schema / migrations                |
| `npm run deploy`                  | build + provision + deploy to Cloudflare |
| `npm run pen:export`              | pen CLI design baselines into R2         |

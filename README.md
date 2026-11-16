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

## Remote MCP server (AI agents)

The backend is a standard remote MCP server on Cloudflare Workers with two transports:

- Streamable HTTP: `POST/GET/DELETE /api/mcp` (session via `Mcp-Session-Id` header)
- Legacy HTTP+SSE: `GET /api/mcp/sse` + `POST /api/mcp/messages?sessionId=…`

In production both require `Authorization: Bearer <MCP_AUTH_TOKEN>` (or `?token=` for SSE clients).
Set the secret with `npx void secret put MCP_AUTH_TOKEN=…`.

Tools: `canvas.cells`, `canvas.describe`, `canvas.snapshot`, `vrt.run`, `vrt.baselines`,
`audit.run`, `marks.list`, `marks.add`, `source.read`, `source.propose`, `source.apply`, `pr.open`.
Canvas tools talk to the open browser tab through a live SSE bridge (`void/live`), so keep the
canvas open while agents inspect or test it.

Cursor / Claude desktop config example (Streamable HTTP):

```json
{
  "mcpServers": {
    "canvasui-lab": {
      "url": "https://<your-worker>.workers.dev/api/mcp",
      "headers": { "Authorization": "Bearer <MCP_AUTH_TOKEN>" }
    }
  }
}
```

### Write-back modes

`WRITEBACK_MODE` selects the source repository adapter:

- `local` (dev): AST patches are applied to local `src/components/**/*.tsx` through a
  token-guarded Vite dev middleware (`CANVASUI_WRITEBACK_TOKEN`).
- `github` (production): patches are committed to `canvasui/*` branches and opened as pull
  requests via the GitHub API (`GITHUB_TOKEN`, `GITHUB_REPO`). Main is never written directly.
- `off`: write-back disabled.

Every patch is AST-validated (babel parser, TS+JSX): allowlisted paths, baseHash optimistic
concurrency, unique anchors, export preservation, and a parse check on the result. Applied
patches are recorded in D1 (`source_patches`).

### In-canvas editing

Double-click a component (or use "Edit source" in the Inspector) to open Monaco on its `.tsx`.
"Apply to source" proposes an AST diff of your edit and writes it back; HMR updates every matrix
cell instantly. The Inspector can also write a single JSX prop back through an AST anchor.

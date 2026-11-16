import type { FactoryGate } from "../domain/brands";
import type { Ports } from "../ports";
import { createComponentRepo } from "../repository/componentRepo";
import { createDocumentRepo } from "../repository/documentRepo";
import { createFigmaRepo } from "../repository/figmaRepo";
import { createGithubSourceRepo } from "../repository/githubRepo";
import { createMarkRepo } from "../repository/markRepo";
import { createMcpRepo } from "../repository/mcpRepo";
import { createSnapshotRepo } from "../repository/snapshotRepo";
import {
  createLocalSourceRepo,
  createOfflineSourceRepo,
  type SourceRepo,
} from "../repository/sourceRepo";
import { createTokenRepo } from "../repository/tokenRepo";
import { createVrtRepo } from "../repository/vrtRepo";
import { createAuditService } from "../service/auditService";
import { createBridgeService } from "../service/bridgeService";
import { createDocumentService } from "../service/documentService";
import { createChatService } from "../service/chatService";
import { createFigImportService } from "../service/figImportService";
import { createHealService } from "../service/healService";
import { createSyncService } from "../service/syncService";
import { createFigmaService } from "../service/figmaService";
import { createMarkService } from "../service/markService";
import { createMatrixService } from "../service/matrixService";
import { createMcpService } from "../service/mcpService";
import { createPenService } from "../service/penService";
import { createPrService } from "../service/prService";
import { createSnapshotService } from "../service/snapshotService";
import { createSourceService } from "../service/sourceService";
import { createTokenService } from "../service/tokenService";
import { createVrtService } from "../service/vrtService";

export interface ServiceOpts {
  writeback: "local" | "github" | "off";
  github?: { token: string; repo: string };
  makeSourceRepo?: (gate: FactoryGate) => SourceRepo;
}

export function createServices(ports: Ports, opts: ServiceOpts) {
  const gate = { [Symbol("CanvasUI.FactoryGate")]: true } as unknown as FactoryGate;

  const snapshotRepo = createSnapshotRepo(gate, ports.db, ports.storage);
  const tokenRepo = createTokenRepo(gate, ports.db);
  const componentRepo = createComponentRepo(gate, ports.db);
  const vrtRepo = createVrtRepo(gate, ports.db);
  const markRepo = createMarkRepo(gate, ports.db);
  const figmaRepo = createFigmaRepo(gate, ports.db);
  const mcpRepo = createMcpRepo(gate, ports.db);
  const documentRepo = createDocumentRepo(gate, ports.db);

  const sourceRepo: SourceRepo =
    opts.makeSourceRepo?.(gate) ??
    (opts.writeback === "local"
      ? createLocalSourceRepo(gate, {
          baseUrl: "http://localhost:5173",
          token: ports.env.get("CANVASUI_WRITEBACK_TOKEN") ?? "",
        })
      : opts.writeback === "github" && opts.github
        ? createGithubSourceRepo(gate, opts.github)
        : createOfflineSourceRepo(gate));

  const snapshotService = createSnapshotService({ snapshots: snapshotRepo });
  const tokenService = createTokenService({ tokens: tokenRepo });
  const matrixService = createMatrixService({ components: componentRepo });
  const markService = createMarkService({ marks: markRepo });
  const sourceService = createSourceService({ source: sourceRepo, patches: mcpRepo });
  const bridgeService = createBridgeService({ mcp: mcpRepo, live: ports.live });
  const prService = opts.github
    ? createPrService({ github: createGithubSourceRepo(gate, opts.github), patches: mcpRepo })
    : null;

  const healService = createHealService({ ai: ports.ai, source: sourceService });

  return {
    documents: createDocumentService({ documents: documentRepo }),
    heal: healService,
    chat: createChatService({ ai: ports.ai }),
    sync: createSyncService({ db: ports.db, live: ports.live }),
    figImport: createFigImportService({
      source: sourceRepo,
      tokens: tokenService,
      storage: ports.storage,
    }),
    snapshots: snapshotService,
    tokens: tokenService,
    matrix: matrixService,
    vrt: createVrtService({ vrt: vrtRepo }),
    marks: markService,
    figma: createFigmaService({ snapshots: snapshotService, figma: figmaRepo, env: ports.env }),
    pen: createPenService({ tokens: tokenService }),
    audit: createAuditService({ marks: markRepo, ai: ports.ai }),
    source: sourceService,
    bridge: bridgeService,
    mcpRepo,
    mcp: createMcpService({
      matrix: matrixService,
      snapshots: snapshotService,
      marks: markService,
      source: sourceService,
      bridge: bridgeService,
      pr: prService,
      heal: healService,
    }),
    pr: prService,
  };
}

export type Services = ReturnType<typeof createServices>;

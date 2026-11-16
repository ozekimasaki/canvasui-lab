import type { FactoryGate } from "../domain/brands";
import { env } from "void/env";
import { createComponentRepo } from "../repository/componentRepo";
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
import { createFigmaService } from "../service/figmaService";
import { createMarkService } from "../service/markService";
import { createMatrixService } from "../service/matrixService";
import { createMcpService } from "../service/mcpService";
import { createPrService } from "../service/prService";
import { createPenService } from "../service/penService";
import { createSnapshotService } from "../service/snapshotService";
import { createSourceService } from "../service/sourceService";
import { createTokenService } from "../service/tokenService";
import { createVrtService } from "../service/vrtService";

const gate = { [Symbol("CanvasUI.FactoryGate")]: true } as unknown as FactoryGate;

const snapshotRepo = createSnapshotRepo(gate);
const tokenRepo = createTokenRepo(gate);
const componentRepo = createComponentRepo(gate);
const vrtRepo = createVrtRepo(gate);
const markRepo = createMarkRepo(gate);
const figmaRepo = createFigmaRepo(gate);
const mcpRepo = createMcpRepo(gate);

const sourceRepo: SourceRepo =
  env.WRITEBACK_MODE === "local"
    ? createLocalSourceRepo(gate, {
        baseUrl: "http://localhost:5173",
        token: env.CANVASUI_WRITEBACK_TOKEN ?? "",
      })
    : env.WRITEBACK_MODE === "github"
      ? createGithubSourceRepo(gate, { token: env.GITHUB_TOKEN ?? "", repo: env.GITHUB_REPO ?? "" })
      : createOfflineSourceRepo(gate);

const snapshotService = createSnapshotService({ snapshots: snapshotRepo });
const tokenService = createTokenService({ tokens: tokenRepo });
const matrixService = createMatrixService({ components: componentRepo });
const markService = createMarkService({ marks: markRepo });
const sourceService = createSourceService({ source: sourceRepo, patches: mcpRepo });
const bridgeService = createBridgeService({ mcp: mcpRepo });
const githubRepo =
  env.GITHUB_TOKEN && env.GITHUB_REPO
    ? createGithubSourceRepo(gate, { token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO })
    : null;
const prService = githubRepo ? createPrService({ github: githubRepo, patches: mcpRepo }) : null;

export const services = {
  snapshots: snapshotService,
  tokens: tokenService,
  matrix: matrixService,
  vrt: createVrtService({ vrt: vrtRepo }),
  marks: markService,
  figma: createFigmaService({ snapshots: snapshotService, figma: figmaRepo }),
  pen: createPenService({ tokens: tokenService }),
  audit: createAuditService({ marks: markRepo }),
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
  }),
  pr: prService,
};

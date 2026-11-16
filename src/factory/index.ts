import type { FactoryGate } from "../domain/brands";
import { createComponentRepo } from "../repository/componentRepo";
import { createFigmaRepo } from "../repository/figmaRepo";
import { createMarkRepo } from "../repository/markRepo";
import { createSnapshotRepo } from "../repository/snapshotRepo";
import { createTokenRepo } from "../repository/tokenRepo";
import { createVrtRepo } from "../repository/vrtRepo";
import { createAuditService } from "../service/auditService";
import { createFigmaService } from "../service/figmaService";
import { createMarkService } from "../service/markService";
import { createMatrixService } from "../service/matrixService";
import { createPenService } from "../service/penService";
import { createSnapshotService } from "../service/snapshotService";
import { createTokenService } from "../service/tokenService";
import { createVrtService } from "../service/vrtService";

const gate = { [Symbol("CanvasUI.FactoryGate")]: true } as unknown as FactoryGate;

const snapshotRepo = createSnapshotRepo(gate);
const tokenRepo = createTokenRepo(gate);
const componentRepo = createComponentRepo(gate);
const vrtRepo = createVrtRepo(gate);
const markRepo = createMarkRepo(gate);
const figmaRepo = createFigmaRepo(gate);

const snapshotService = createSnapshotService({ snapshots: snapshotRepo });
const tokenService = createTokenService({ tokens: tokenRepo });

export const services = {
  snapshots: snapshotService,
  tokens: tokenService,
  matrix: createMatrixService({ components: componentRepo }),
  vrt: createVrtService({ vrt: vrtRepo }),
  marks: createMarkService({ marks: markRepo }),
  figma: createFigmaService({ snapshots: snapshotService, figma: figmaRepo }),
  pen: createPenService({ tokens: tokenService }),
  audit: createAuditService({ marks: markRepo }),
};

import type { FactoryGate, SnapshotData, ValidatedSnapshot } from "../src/domain/brands";
import { createSnapshotRepo } from "../src/repository/snapshotRepo";

declare const gate: FactoryGate;
declare const validated: ValidatedSnapshot;

const repo = createSnapshotRepo(gate);
void repo.save(validated);

const raw: SnapshotData = {
  componentId: "button",
  cellKey: "button:abc",
  kind: "baseline",
  source: "implementation",
  png: new Uint8Array(0),
  width: 1,
  height: 1,
  scale: 1,
  contentHash: "deadbeef",
};

// @ts-expect-error PASSPORT DEFENSE: an unvalidated snapshot must be rejected by the repository
void repo.save(raw);

// @ts-expect-error GATE DEFENSE: a plain symbol cannot forge the FactoryGate
createSnapshotRepo(Symbol("forged"));

// @ts-expect-error GATE DEFENSE: an object cannot forge the FactoryGate
createSnapshotRepo({});

// @ts-expect-error GATE DEFENSE: a string cannot forge the FactoryGate
createSnapshotRepo("gate");

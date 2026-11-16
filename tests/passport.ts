import type { FactoryGate, SnapshotData, ValidatedSnapshot } from "../src/domain/brands";
import type { DbPort, StoragePort } from "../src/ports";
import { createSnapshotRepo } from "../src/repository/snapshotRepo";

declare const gate: FactoryGate;
declare const validated: ValidatedSnapshot;
const dbStub = null as unknown as DbPort;
const storageStub = null as unknown as StoragePort;

const repo = createSnapshotRepo(gate, dbStub, storageStub);
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

// @ts-expect-error PASSPORT: unvalidated snapshot rejected
void repo.save(raw);
// @ts-expect-error GATE: plain symbol cannot forge
createSnapshotRepo(Symbol("x"), dbStub, storageStub);
// @ts-expect-error GATE: object cannot forge
createSnapshotRepo({}, dbStub, storageStub);
// @ts-expect-error GATE: string cannot forge
createSnapshotRepo("gate", dbStub, storageStub);

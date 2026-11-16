import { defineHandler } from "void";
import { services } from "../src/factory/cf";

export const loader = defineHandler(async () => {
  const runs = await services.vrt.listRuns();
  const baselines = await services.snapshots.baselines();
  return { runs, baselines };
});

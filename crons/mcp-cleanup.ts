import { defineScheduled } from "void";
import { services } from "../src/factory/cf";

export const cron = "0 * * * *";

export default defineScheduled(async () => {
  await services.mcpRepo.cleanup(new Date(Date.now() - 60 * 60 * 1000).toISOString());
});

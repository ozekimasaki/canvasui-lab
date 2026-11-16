import { cfPorts } from "../adapters/cf";
import { createServices, type ServiceOpts } from "./index";

const cfWriteback = (cfPorts.env.get("WRITEBACK_MODE") ?? "off") as ServiceOpts["writeback"];
const cfGithub =
  cfPorts.env.get("GITHUB_TOKEN") && cfPorts.env.get("GITHUB_REPO")
    ? {
        token: cfPorts.env.get("GITHUB_TOKEN") as string,
        repo: cfPorts.env.get("GITHUB_REPO") as string,
      }
    : undefined;

export const services = createServices(cfPorts, { writeback: cfWriteback, github: cfGithub });

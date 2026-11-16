import { defineHandler } from "void";
import { services } from "../../../src/factory/cf";
import * as h from "../../../src/resolve/api-mcp-sse";

export const GET = defineHandler(h.GET(services));

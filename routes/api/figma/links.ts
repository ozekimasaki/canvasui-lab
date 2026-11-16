import { defineHandler } from "void";
import { services } from "../../../src/factory/cf";
import * as h from "../../../src/resolve/api-figma-links";

export const GET = defineHandler(h.GET(services));

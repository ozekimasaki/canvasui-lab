import { defineHandler } from "void";
import { services } from "../../../../src/factory/cf";
import * as h from "../../../../src/resolve/api-vrt-runs-[id]";

export const GET = defineHandler(h.GET(services));

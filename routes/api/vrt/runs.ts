import { defineHandler } from "void";
import { services } from "../../../src/factory/cf";
import * as h from "../../../src/resolve/api-vrt-runs";

export const POST = defineHandler(h.POST(services));
export const GET = defineHandler(h.GET(services));

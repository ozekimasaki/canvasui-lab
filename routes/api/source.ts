import { defineHandler } from "void";
import { services } from "../../src/factory/cf";
import * as h from "../../src/resolve/api-source";

export const GET = defineHandler(h.GET(services));
export const POST = defineHandler(h.POST(services));

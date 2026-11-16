import { defineHandler } from "void";
import * as h from "../../src/resolve/api-sync";
import { services } from "../../src/factory/cf";

export const GET = defineHandler(h.GET(services));
export const POST = defineHandler(h.POST(services));

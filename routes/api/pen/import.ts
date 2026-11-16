import { defineHandler } from "void";
import { services } from "../../../src/factory/cf";
import * as h from "../../../src/resolve/api-pen-import";

export const POST = defineHandler(h.POST(services));

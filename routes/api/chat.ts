import { defineHandler } from "void";
import * as h from "../../src/resolve/api-chat";
import { services } from "../../src/factory/cf";

export const POST = defineHandler(h.POST(services));

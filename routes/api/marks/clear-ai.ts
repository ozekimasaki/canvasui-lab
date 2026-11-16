import { defineHandler } from "void";
import { services } from "../../../src/factory/cf";
import * as h from "../../../src/resolve/api-marks-clear-ai";

export const POST = defineHandler(h.POST(services));

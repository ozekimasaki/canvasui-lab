import { defineHandler } from "void";
import { services } from "../../../src/factory/cf";
import * as h from "../../../src/resolve/api-marks-[id]";

export const DELETE = defineHandler(h.DELETE(services));

import { defineHandler } from "void";
import { services } from "../../../src/factory/cf";
import * as h from "../../../src/resolve/api-snapshots-png";

export const GET = defineHandler(h.GET(services));

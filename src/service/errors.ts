import { z } from "zod";

export class ServiceError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
  }
}

export function errorJson(error: unknown): Response {
  let status = 500;
  let message = "Internal error";
  if (error instanceof ServiceError) {
    status = error.status;
    message = error.message;
  } else if (error instanceof z.ZodError) {
    status = 400;
    message = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  } else {
    console.error("[canvasui] unhandled service error:", error);
  }
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

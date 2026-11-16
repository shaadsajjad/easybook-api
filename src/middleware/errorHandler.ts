import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { env } from "../config/env";
import { ApiError, type FieldError } from "../utils/ApiError";
import { isSlotOverlapError, SLOT_TAKEN_MESSAGE } from "../utils/prismaErrors";

interface ErrorBody {
  success: false;
  message: string;
  errors?: FieldError[];
}

// body-parser errors (bad JSON, body too large) carry a `type` string and a `status` number.
function isBodyParserError(error: unknown): error is { type: string; status: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof error.type === "string" &&
    "status" in error &&
    typeof error.status === "number"
  );
}

// Turns any thrown error into { status, body }. Internal details never reach the client.
function toResponse(error: unknown): { status: number; body: ErrorBody } {
  if (error instanceof ApiError) {
    return {
      status: error.statusCode,
      body: { success: false, message: error.message, ...(error.errors && { errors: error.errors }) },
    };
  }

  if (error instanceof ZodError) {
    const errors = error.issues.flatMap((issue): FieldError[] => {
      const prefix = issue.path.map(String).join(".");
      // Unknown fields in a strict object: report each one under its own name.
      if (issue.code === "unrecognized_keys") {
        return issue.keys.map((key) => ({
          field: prefix ? `${prefix}.${key}` : key,
          message: "This field is not allowed",
        }));
      }
      return [{ field: prefix || "body", message: issue.message }];
    });
    return { status: 422, body: { success: false, message: "Validation failed", errors } };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return { status: 409, body: { success: false, message: "This record already exists" } };
    }
    if (error.code === "P2025") {
      return { status: 404, body: { success: false, message: "Resource not found" } };
    }
  }

  // Safety net: the appointments service already converts this, but never let it become a 500.
  if (isSlotOverlapError(error)) {
    return { status: 409, body: { success: false, message: SLOT_TAKEN_MESSAGE } };
  }

  if (isBodyParserError(error)) {
    if (error.type === "entity.parse.failed") {
      return { status: 400, body: { success: false, message: "Malformed JSON in request body" } };
    }
    if (error.type === "entity.too.large") {
      return { status: 413, body: { success: false, message: "Request body is too large" } };
    }
  }

  return { status: 500, body: { success: false, message: "Something went wrong. Please try again." } };
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const { status, body } = toResponse(error);
  // Log unexpected errors on the server only (the client gets a generic message).
  if (status >= 500 && env.NODE_ENV !== "test") {
    console.error(error);
  }
  res.status(status).json(body);
};

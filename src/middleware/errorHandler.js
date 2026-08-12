import { AppError } from "../utils/AppError.js";

export function errorHandler(error, req, res, next) {
  const statusCode =
    error instanceof AppError ? error.statusCode : error.statusCode || 500;

  res.status(statusCode).json({
    message: error.message || "Internal server error",
  });
}

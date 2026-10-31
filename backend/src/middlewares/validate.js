import { AppError } from "../utils/AppError.js";

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!result.success) {
    throw new AppError("Validation failed", 400, result.error.flatten());
  }

  req.validated = result.data;
  next();
};

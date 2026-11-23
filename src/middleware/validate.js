const { ApiError } = require("../utils/ApiError");

const validate = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return next(new ApiError(400, "Validation failed", details));
  }

  if (source === "query") {
    req.validatedQuery = result.data;
  } else {
    req[source] = result.data;
  }

  next();
};

module.exports = validate;

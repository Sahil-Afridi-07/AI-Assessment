class AppError extends Error {
  constructor(status, message, code, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

// Never leaks stack traces or internals: unknown errors become a generic message.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) return res.status(err.status).json({ message: err.message, code: err.code, ...err.extra });
  if (err.name === 'ValidationError') return res.status(400).json({ message: 'Some of the submitted data is invalid.', code: 'VALIDATION' });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id', code: 'BAD_ID' });
  if (err.code === 11000) return res.status(409).json({ message: 'Already exists', code: 'DUPLICATE' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Malformed request body', code: 'BAD_JSON' });
  console.error(err); // server log only
  res.status(500).json({ message: 'Something went wrong on our side. Please try again.', code: 'SERVER' });
}

module.exports = errorHandler;
module.exports.AppError = AppError;

const notFoundHandler = (req, res, next) => {
  const err = new Error("Not found");
  err.status = 404;
  err.errorCode = "NOT_FOUND";
  next(err);
};

module.exports = { notFoundHandler };

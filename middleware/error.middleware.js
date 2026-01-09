// Global error handling middleware

const errorMiddleware = (err, req, res, next) => {
  try {
    let error = { ...err };
    error.message = err.message;
    console.error(err);
  } catch (error) {
    next(error);
  }
};

export default errorMiddleware;

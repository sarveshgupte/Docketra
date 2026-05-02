const mountFallbackRoutes = (app, { notFound, uploadErrorHandler, errorHandler }) => {
  app.get('/', (req, res) => {
    res.json({ status: 'Docketra API running' });
  });

  app.use(notFound);
  app.use(uploadErrorHandler);
  app.use(errorHandler);
};

module.exports = { mountFallbackRoutes };

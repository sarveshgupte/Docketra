const mountHealthRoutes = (app, { healthRoutes, apiHealth, metricsService, allowInternalTokenOrSuperadmin, internalMetricsLimiter, getSecurityMetrics }) => {
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'docketra-api',
      timestamp: new Date().toISOString(),
    });
  });
  app.use('/health', healthRoutes);
  app.get('/api/health', apiHealth);
  app.get('/api/system/health', apiHealth);
  app.get('/metrics', async (req, res) => {
    const configuredMetricsToken = process.env.METRICS_TOKEN;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    let authorized = false;
    if (configuredMetricsToken && typeof token === 'string') {
      if (configuredMetricsToken.length === token.length) {
        let mismatch = 0;
        for (let i = 0; i < configuredMetricsToken.length; i++) {
          mismatch |= configuredMetricsToken.charCodeAt(i) ^ token.charCodeAt(i);
        }
        if (mismatch === 0) authorized = true;
      }
    }

    if (!authorized) return res.status(401).json({ error: 'unauthorized' });
    if ((req.headers.accept || '').includes('application/json')) return res.json(await metricsService.getSnapshot());

    res.type('text/plain; version=0.0.4; charset=utf-8');
    return res.send(await metricsService.renderPrometheusMetrics());
  });
  app.get('/api/metrics/security', allowInternalTokenOrSuperadmin, internalMetricsLimiter, getSecurityMetrics);
};

module.exports = { mountHealthRoutes };

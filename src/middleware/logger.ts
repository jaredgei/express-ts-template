import { NextFunction, Request, Response } from 'express';

export default (req: Request, res: Response, next: NextFunction) => {
  const start = performance.now();

  res.on('finish', () => {
    const elapsed = performance.now() - start;

    const log = {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      elapsedMs: parseFloat(elapsed.toFixed(3)),
    };

    console.log(JSON.stringify(log));
  });

  next();
};

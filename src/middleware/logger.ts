import { NextFunction, Request, Response } from 'express-serve-static-core';

export default (request: Request, response: Response, next: NextFunction) => {
  const start = new Date();
  console.log(`${start.toUTCString()} ${request.ip} ${request.method} ${request.url}`);
  response.on('finish', () => {
    const end = new Date();
    const duration = end.getTime() - start.getTime();
    console.log(`${end.toUTCString()} ${response.statusCode} ${response.statusMessage} elapsed: ${duration}`);
  });
  next();
};

import type { Request, Response, NextFunction } from "express";

export function noStoreApiResponses(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Cache-Control", "private, no-store");
  next();
}

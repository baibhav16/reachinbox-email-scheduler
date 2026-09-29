import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const token = req.cookies?.session;
    if (!token) { res.status(401).json({ error: 'Please sign in with Google.' }); return; }
    const claims = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (typeof claims.userId !== 'string') { res.status(401).json({ error: 'Invalid session.' }); return; }
    const membership = await prisma.userTenant.findFirst({ where: { userId: claims.userId }, include: { user: true, tenant: true } });
    if (!membership) { res.status(401).json({ error: 'Workspace membership not found.' }); return; }
    res.locals.user = membership.user; res.locals.tenant = membership.tenant; res.locals.userId = membership.userId; res.locals.tenantId = membership.tenantId;
    next();
  } catch { res.status(401).json({ error: 'Your session expired. Please sign in again.' }); }
};

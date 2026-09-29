import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { encryptSecret } from '../utils/crypto.js';
export const senderRoutes = Router();
senderRoutes.get('/', async (_req, res, next) => {
  try { res.json({ senders: await prisma.sender.findMany({ where: { tenantId: res.locals.tenantId }, select: { id: true, tenantId: true, name: true, email: true, smtpHost: true, smtpPort: true, hourlyLimit: true, isActive: true, createdAt: true }, orderBy: { createdAt: 'asc' } }) }); }
  catch (error) { next(error); }
});
senderRoutes.post('/', async (req, res, next) => {
  try {
    const body = z.object({ name: z.string().min(1), email: z.string().email(), smtpHost: z.string().min(1), smtpPort: z.coerce.number().int().min(1).max(65535).default(587), smtpUser: z.string().min(1), smtpPassword: z.string().min(1), hourlyLimit: z.coerce.number().int().positive().optional() }).parse(req.body);
    const sender = await prisma.sender.create({ data: { ...body, smtpPassword: encryptSecret(body.smtpPassword), tenantId: res.locals.tenantId }, select: { id: true, name: true, email: true, smtpHost: true, smtpPort: true, hourlyLimit: true, isActive: true } });
    res.status(201).json({ sender });
  } catch (error) { next(error); }
});
senderRoutes.patch('/:id', async (req, res, next) => {
  try {
    const body = z.object({ isActive: z.boolean().optional(), hourlyLimit: z.coerce.number().int().positive().nullable().optional() }).parse(req.body);
    const update = await prisma.sender.updateMany({ where: { id: req.params.id, tenantId: res.locals.tenantId }, data: body });
    if (!update.count) { res.status(404).json({ error: 'Sender not found.' }); return; }
    res.json({ ok: true });
  } catch (error) { next(error); }
});

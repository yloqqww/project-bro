import { prisma } from '@clinic/db';
import crypto from 'crypto';

export interface CreateAdminNotificationParams {
  type?: 'info' | 'success' | 'warning' | 'error';
  category?: string;
  title: string;
  message: string;
  staffName?: string;
  staffEmail?: string;
  staffRole?: string;
  staffSpecialty?: string;
  staffRoom?: string;
  metadata?: Record<string, any>;
}

export interface AdminNotificationItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: string;
  title: string;
  message: string;
  staffName: string | null;
  staffEmail: string | null;
  staffRole: string | null;
  staffSpecialty: string | null;
  staffRoom: string | null;
  metadata: any;
  isRead: boolean;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
}

export async function createAdminNotification(params: CreateAdminNotificationParams) {
  try {
    const id = `notif_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const type = params.type || 'info';
    const category = params.category || 'STAFF_LOGIN';
    const title = params.title;
    const message = params.message;
    const staffName = params.staffName || null;
    const staffEmail = params.staffEmail || null;
    const staffRole = params.staffRole || null;
    const staffSpecialty = params.staffSpecialty || null;
    const staffRoom = params.staffRoom || null;
    const metadataStr = JSON.stringify(params.metadata || {});
    const settingRows = await prisma.$queryRawUnsafe<Array<{ notificationRetentionDays: number }>>(`SELECT "notificationRetentionDays" FROM "clinic_settings" WHERE "id" = 'default' LIMIT 1`).catch(() => []);
    const retentionDays = Math.max(7, settingRows[0]?.notificationRetentionDays || 90);
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

    if (false && (prisma as any).adminNotification?.create) {
      return await (prisma as any).adminNotification.create({
        data: {
          id,
          type,
          category,
          title,
          message,
          staffName,
          staffEmail,
          staffRole,
          staffSpecialty,
          staffRoom,
          metadata: params.metadata || {},
          isRead: false,
          expiresAt,
        },
      });
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "admin_notifications" (
        "id", "type", "category", "title", "message", 
        "staffName", "staffEmail", "staffRole", "staffSpecialty", "staffRoom", 
        "metadata", "isRead", "expiresAt", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, false, $12, NOW(), NOW())`,
      id,
      type,
      category,
      title,
      message,
      staffName,
      staffEmail,
      staffRole,
      staffSpecialty,
      staffRoom,
      metadataStr,
      expiresAt
    );

    return { id, title, message };
  } catch (error) {
    console.error('Failed to create admin notification:', error);
    return null;
  }
}

export async function getAdminNotifications(limit = 50, options: { page?: number; status?: 'all' | 'read' | 'unread'; includeArchived?: boolean } = {}) {
  try {
    const page = Math.max(1, options.page || 1);
    const where: any = { expiresAt: { gt: new Date() } };
    if (!options.includeArchived) where.archivedAt = null;
    if (options.status === 'read') where.isRead = true;
    if (options.status === 'unread') where.isRead = false;
    await (prisma as any).adminNotification?.deleteMany?.({ where: { expiresAt: { lte: new Date() } } });
    if (false && (prisma as any).adminNotification?.findMany) {
      const rows = await (prisma as any).adminNotification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
      const total = await (prisma as any).adminNotification.count({ where });
      const unreadCount = await (prisma as any).adminNotification.count({
        where: { isRead: false },
      });
      return {
        notifications: rows.map((r: any) => ({
          ...r,
          createdAt: r.createdAt?.toISOString?.() || String(r.createdAt),
          readAt: r.readAt?.toISOString?.() || null,
          archivedAt: r.archivedAt?.toISOString?.() || null,
        })),
        unreadCount,
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    }

    await prisma.$executeRawUnsafe(`DELETE FROM "admin_notifications" WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= NOW()`);
    const clauses = ['("expiresAt" IS NULL OR "expiresAt" > NOW())'];
    if (!options.includeArchived) clauses.push('"archivedAt" IS NULL');
    if (options.status === 'read') clauses.push('"isRead" = true');
    if (options.status === 'unread') clauses.push('"isRead" = false');
    const whereSql = `WHERE ${clauses.join(' AND ')}`;
    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "admin_notifications" ${whereSql} ORDER BY "createdAt" DESC OFFSET $1 LIMIT $2`, (page - 1) * limit, limit);
    const totalRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "admin_notifications" ${whereSql}`);

    const countRes = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int as count FROM "admin_notifications" WHERE "isRead" = false AND "archivedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt" > NOW())`
    );

    const unreadCount = countRes?.[0]?.count ? Number(countRes[0].count) : 0;

    return {
      notifications: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        readAt: r.readAt instanceof Date ? r.readAt.toISOString() : r.readAt || null,
        archivedAt: r.archivedAt instanceof Date ? r.archivedAt.toISOString() : r.archivedAt || null,
      })),
      unreadCount,
      total: Number(totalRows[0]?.count || 0),
      page,
      totalPages: Math.max(1, Math.ceil(Number(totalRows[0]?.count || 0) / limit)),
    };
  } catch (error) {
    console.error('Failed to fetch admin notifications:', error);
    return { notifications: [], unreadCount: 0 };
  }
}

export async function markAdminNotificationRead(id?: string, markAll = false) {
  try {
    if (markAll) {
      if (false && (prisma as any).adminNotification?.updateMany) {
        return await (prisma as any).adminNotification.updateMany({
          where: { isRead: false },
          data: { isRead: true, readAt: new Date() },
        });
      }
      return await prisma.$executeRawUnsafe(
        `UPDATE "admin_notifications" SET "isRead" = true, "readAt" = COALESCE("readAt", NOW()), "updatedAt" = NOW() WHERE "isRead" = false`
      );
    }

    if (id) {
      if (false && (prisma as any).adminNotification?.update) {
        return await (prisma as any).adminNotification.update({
          where: { id },
          data: { isRead: true, readAt: new Date() },
        });
      }
      return await prisma.$executeRawUnsafe(
        `UPDATE "admin_notifications" SET "isRead" = true, "readAt" = COALESCE("readAt", NOW()), "updatedAt" = NOW() WHERE "id" = $1`,
        id
      );
    }
  } catch (error) {
    console.error('Failed to mark admin notification read:', error);
    throw error;
  }
}

export async function deleteAdminNotification(id?: string, clearAll = false) {
  try {
    if (clearAll) {
      if (false && (prisma as any).adminNotification?.deleteMany) {
        return await (prisma as any).adminNotification.updateMany({ where: { archivedAt: null }, data: { archivedAt: new Date(), isRead: true, readAt: new Date() } });
      }
      return await prisma.$executeRawUnsafe(`UPDATE "admin_notifications" SET "archivedAt" = NOW(), "isRead" = true, "readAt" = COALESCE("readAt", NOW()), "updatedAt" = NOW() WHERE "archivedAt" IS NULL`);
    }

    if (id) {
      if (false && (prisma as any).adminNotification?.delete) {
        return await (prisma as any).adminNotification.update({ where: { id }, data: { archivedAt: new Date(), isRead: true, readAt: new Date() } });
      }
      return await prisma.$executeRawUnsafe(
        `UPDATE "admin_notifications" SET "archivedAt" = NOW(), "isRead" = true, "readAt" = COALESCE("readAt", NOW()), "updatedAt" = NOW() WHERE "id" = $1`,
        id
      );
    }
  } catch (error) {
    console.error('Failed to delete admin notification:', error);
    throw error;
  }
}

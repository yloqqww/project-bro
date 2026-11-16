import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';

const PRIORITIES = ['ROUTINE', 'IMPORTANT', 'URGENT'] as const;
const ANNOUNCEMENT_TARGETS = ['ALL_STAFF', 'DOCTOR', 'NURSE', 'RECEPTIONIST'] as const;

type Actor = {
  id: string;
  role: string;
  name: string;
};

async function getActor(userId: string): Promise<Actor | null> {
  const rows = await prisma.$queryRawUnsafe<Actor[]>(
    `SELECT u."id", u."role"::text AS "role",
      COALESCE(
        NULLIF(TRIM(CONCAT(dp."firstName", ' ', dp."lastName")), ''),
        NULLIF(TRIM(CONCAT(sp."firstName", ' ', sp."lastName")), ''),
        u."email"
      ) AS "name"
    FROM "users" u
    LEFT JOIN "doctor_profiles" dp ON dp."userId" = u."id"
    LEFT JOIN "staff_profiles" sp ON sp."userId" = u."id"
    WHERE u."id" = $1
    LIMIT 1`,
    userId
  );
  return rows[0] || null;
}

async function canAccessConversation(userId: string, role: string, conversationId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT c."id"
    FROM "clinical_conversations" c
    JOIN "doctor_profiles" d ON d."id" = c."doctorId"
    WHERE c."id" = $1
      AND (
        ($2 = 'DOCTOR' AND d."userId" = $3)
        OR ($2 IN ('NURSE', 'RECEPTIONIST') AND (
          c."createdById" = $3 OR EXISTS (
            SELECT 1 FROM "clinical_messages" m
            WHERE m."conversationId" = c."id"
              AND (m."senderId" = $3 OR m."recipientId" = $3)
          )
        ))
      )
    LIMIT 1`,
    conversationId,
    role,
    userId
  );
  return Boolean(rows[0]);
}

export async function GET() {
  const auth = await authorizeApi(ACCESS.staffMessaging);
  if (!auth.ok) return auth.response;

  try {
    const actor = await getActor(auth.user.id);
    if (!actor) return NextResponse.json({ success: false, error: 'Staff account not found.' }, { status: 404 });

    const conversationRows = actor.role === 'ADMIN'
      ? []
      : await prisma.$queryRawUnsafe<any[]>(
        `SELECT
          c."id", c."queueTicketId", c."status", c."resolvedAt", c."createdAt", c."updatedAt",
          CONCAT(p."firstName", ' ', p."lastName") AS "patientName",
          p."id" AS "patientId",
          q."queueNumber", q."status"::text AS "queueStatus", q."priority" AS "queuePriority",
          CONCAT('Dr. ', d."firstName", ' ', d."lastName") AS "doctorName",
          d."roomNumber" AS "doctorRoom",
          m."id" AS "messageId", m."senderId", m."recipientId", m."senderName", m."senderRole",
          m."recipientRole", m."body", m."priority", m."readAt", m."acknowledgedAt", m."createdAt" AS "messageCreatedAt"
        FROM "clinical_conversations" c
        JOIN "queue_tickets" q ON q."id" = c."queueTicketId"
        JOIN "patient_profiles" p ON p."id" = c."patientId"
        JOIN "doctor_profiles" d ON d."id" = c."doctorId"
        LEFT JOIN "clinical_messages" m ON m."conversationId" = c."id"
        WHERE
          ($1 = 'DOCTOR' AND d."userId" = $2)
          OR ($1 IN ('NURSE', 'RECEPTIONIST') AND (
            c."createdById" = $2 OR EXISTS (
              SELECT 1 FROM "clinical_messages" involved
              WHERE involved."conversationId" = c."id"
                AND (involved."senderId" = $2 OR involved."recipientId" = $2)
            )
          ))
        ORDER BY c."updatedAt" DESC, m."createdAt" ASC`,
        actor.role,
        actor.id
      );

    const conversationsById = new Map<string, any>();
    for (const row of conversationRows) {
      if (!conversationsById.has(row.id)) {
        conversationsById.set(row.id, {
          id: row.id,
          queueTicketId: row.queueTicketId,
          status: row.status,
          resolvedAt: row.resolvedAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          patientId: row.patientId,
          patientName: row.patientName,
          queueNumber: row.queueNumber,
          queueStatus: row.queueStatus,
          queuePriority: row.queuePriority,
          doctorName: row.doctorName,
          doctorRoom: row.doctorRoom,
          messages: [],
        });
      }
      if (row.messageId) {
        conversationsById.get(row.id).messages.push({
          id: row.messageId,
          senderId: row.senderId,
          recipientId: row.recipientId,
          senderName: row.senderName,
          senderRole: row.senderRole,
          recipientRole: row.recipientRole,
          body: row.body,
          priority: row.priority,
          readAt: row.readAt,
          acknowledgedAt: row.acknowledgedAt,
          createdAt: row.messageCreatedAt,
        });
      }
    }

    const announcements = await prisma.$queryRawUnsafe<any[]>(
      `SELECT a."id", a."creatorName", a."targetRole", a."title", a."body", a."priority", a."createdAt",
        (r."id" IS NOT NULL) AS "isRead"
      FROM "staff_announcements" a
      LEFT JOIN "staff_announcement_reads" r
        ON r."announcementId" = a."id" AND r."userId" = $1
      WHERE $2 = 'ADMIN' OR a."targetRole" IN ('ALL_STAFF', $2)
      ORDER BY a."createdAt" DESC
      LIMIT 100`,
      actor.id,
      actor.role
    );

    const conversations = Array.from(conversationsById.values());
    const unreadClinical = conversations.reduce(
      (count, conversation) => count + conversation.messages.filter((message: any) => message.recipientId === actor.id && !message.readAt).length,
      0
    );
    const unreadAnnouncements = announcements.filter((announcement) => !announcement.isRead).length;

    return NextResponse.json({
      success: true,
      actor,
      conversations,
      announcements,
      unreadCount: unreadClinical + unreadAnnouncements,
    });
  } catch (error) {
    console.error('Failed to load staff messages:', error);
    return NextResponse.json({ success: false, error: 'Hindi ma-load ang staff messages.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorizeApi(ACCESS.staffMessaging);
  if (!auth.ok) return auth.response;

  try {
    const actor = await getActor(auth.user.id);
    if (!actor) return NextResponse.json({ success: false, error: 'Staff account not found.' }, { status: 404 });
    const body = await request.json();

    if (body?.action === 'announce') {
      if (actor.role !== 'ADMIN') {
        return NextResponse.json({ success: false, error: 'Admin access required.' }, { status: 403 });
      }
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const messageBody = typeof body.body === 'string' ? body.body.trim() : '';
      const targetRole = ANNOUNCEMENT_TARGETS.includes(body.targetRole) ? body.targetRole : 'ALL_STAFF';
      const priority = PRIORITIES.includes(body.priority) ? body.priority : 'ROUTINE';
      if (title.length < 3 || title.length > 120 || messageBody.length < 3 || messageBody.length > 1000) {
        return NextResponse.json({ success: false, error: 'Title at message ay required at dapat nasa tamang haba.' }, { status: 400 });
      }

      const id = randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "staff_announcements" ("id", "createdById", "creatorName", "targetRole", "title", "body", "priority", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        id,
        actor.id,
        actor.name,
        targetRole,
        title,
        messageBody,
        priority
      );
      return NextResponse.json({ success: true, id }, { status: 201 });
    }

    if (!ACCESS.clinicalHandoffWrite.includes(actor.role as 'DOCTOR' | 'NURSE' | 'RECEPTIONIST')) {
      return NextResponse.json({ success: false, error: 'Clinical handoff access required.' }, { status: 403 });
    }

    const queueTicketId = typeof body.queueTicketId === 'string' ? body.queueTicketId : '';
    const messageBody = typeof body.body === 'string' ? body.body.trim() : '';
    const priority = PRIORITIES.includes(body.priority) ? body.priority : 'ROUTINE';
    if (!queueTicketId || messageBody.length < 2 || messageBody.length > 1000) {
      return NextResponse.json({ success: false, error: 'Pumili ng patient at maglagay ng 2–1000 character message.' }, { status: 400 });
    }

    const tickets = await prisma.$queryRawUnsafe<any[]>(
      `SELECT q."id", q."patientId", q."doctorId", q."status"::text AS "status", d."userId" AS "doctorUserId"
       FROM "queue_tickets" q
       JOIN "doctor_profiles" d ON d."id" = q."doctorId"
       WHERE q."id" = $1
       LIMIT 1`,
      queueTicketId
    );
    const ticket = tickets[0];
    if (!ticket) return NextResponse.json({ success: false, error: 'Queue ticket not found.' }, { status: 404 });
    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(ticket.status)) {
      return NextResponse.json({ success: false, error: 'Closed na ang patient queue ticket na ito.' }, { status: 409 });
    }
    if (actor.role === 'DOCTOR' && ticket.doctorUserId !== actor.id) {
      return NextResponse.json({ success: false, error: 'Hindi sa iyo naka-assign ang patient na ito.' }, { status: 403 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.$queryRawUnsafe<Array<{ id: string; createdById: string | null; status: string }>>(
        `SELECT "id", "createdById", "status" FROM "clinical_conversations" WHERE "queueTicketId" = $1 FOR UPDATE`,
        queueTicketId
      );

      let conversation = existing[0];
      if (!conversation) {
        const conversationId = randomUUID();
        const created = await tx.$queryRawUnsafe<Array<{ id: string; createdById: string | null; status: string }>>(
          `INSERT INTO "clinical_conversations" ("id", "queueTicketId", "patientId", "doctorId", "createdById", "status", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 'OPEN', NOW(), NOW())
           RETURNING "id", "createdById", "status"`,
          conversationId,
          queueTicketId,
          ticket.patientId,
          ticket.doctorId,
          actor.id
        );
        conversation = created[0];
      }

      let recipientId = ticket.doctorUserId as string;
      if (actor.role === 'DOCTOR') {
        const recipients = await tx.$queryRawUnsafe<Array<{ senderId: string | null }>>(
          `SELECT "senderId" FROM "clinical_messages"
           WHERE "conversationId" = $1 AND "senderId" IS NOT NULL AND "senderId" <> $2
           ORDER BY "createdAt" DESC LIMIT 1`,
          conversation.id,
          actor.id
        );
        recipientId = recipients[0]?.senderId || (conversation.createdById !== actor.id ? conversation.createdById || '' : '');
        if (!recipientId) {
          const fallbackStaff = await tx.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT "id" FROM "users" WHERE "role"::text IN ('NURSE', 'RECEPTIONIST') AND "isActive" = true ORDER BY "createdAt" ASC LIMIT 1`
          );
          recipientId = fallbackStaff[0]?.id || '';
        }
      }
      if (!recipientId || recipientId === actor.id) throw new Error('RECIPIENT_MISSING');

      const recipientRows = await tx.$queryRawUnsafe<Array<{ role: string }>>(
        `SELECT "role"::text AS "role" FROM "users" WHERE "id" = $1 AND "isActive" = true LIMIT 1`,
        recipientId
      );
      if (!recipientRows[0]) throw new Error('RECIPIENT_MISSING');

      const messageId = randomUUID();
      await tx.$executeRawUnsafe(
        `INSERT INTO "clinical_messages" ("id", "conversationId", "senderId", "recipientId", "senderName", "senderRole", "recipientRole", "body", "priority", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        messageId,
        conversation.id,
        actor.id,
        recipientId,
        actor.name,
        actor.role,
        recipientRows[0].role,
        messageBody,
        priority
      );
      await tx.$executeRawUnsafe(
        `UPDATE "clinical_conversations" SET "status" = 'OPEN', "resolvedAt" = NULL, "resolvedById" = NULL, "updatedAt" = NOW() WHERE "id" = $1`,
        conversation.id
      );
      return { conversationId: conversation.id, messageId };
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'HANDOFF_REQUIRED') {
      return NextResponse.json({ success: false, error: 'Wala pang handoff thread para sa patient na ito.' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'RECIPIENT_MISSING') {
      return NextResponse.json({ success: false, error: 'Walang active recipient para sa message.' }, { status: 409 });
    }
    console.error('Failed to send staff message:', error);
    return NextResponse.json({ success: false, error: 'Hindi naipadala ang message.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeApi(ACCESS.staffMessaging);
  if (!auth.ok) return auth.response;

  try {
    const actor = await getActor(auth.user.id);
    if (!actor) return NextResponse.json({ success: false, error: 'Staff account not found.' }, { status: 404 });
    const body = await request.json();

    if (body?.action === 'readAnnouncement') {
      const announcementId = typeof body.announcementId === 'string' ? body.announcementId : '';
      if (!announcementId) return NextResponse.json({ success: false, error: 'Announcement ID required.' }, { status: 400 });
      const allowed = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "staff_announcements" WHERE "id" = $1 AND ($2 = 'ADMIN' OR "targetRole" IN ('ALL_STAFF', $2)) LIMIT 1`,
        announcementId,
        actor.role
      );
      if (!allowed[0]) return NextResponse.json({ success: false, error: 'Announcement not found.' }, { status: 404 });
      await prisma.$executeRawUnsafe(
        `INSERT INTO "staff_announcement_reads" ("id", "announcementId", "userId", "readAt")
         VALUES ($1, $2, $3, NOW()) ON CONFLICT ("announcementId", "userId") DO NOTHING`,
        randomUUID(),
        announcementId,
        actor.id
      );
      return NextResponse.json({ success: true });
    }

    if (actor.role === 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Admins cannot access clinical handoff threads.' }, { status: 403 });
    }
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
    if (!conversationId || !(await canAccessConversation(actor.id, actor.role, conversationId))) {
      return NextResponse.json({ success: false, error: 'Conversation not found.' }, { status: 404 });
    }

    if (body.action === 'markRead') {
      await prisma.$executeRawUnsafe(
        `UPDATE "clinical_messages" SET "readAt" = COALESCE("readAt", NOW()) WHERE "conversationId" = $1 AND "recipientId" = $2`,
        conversationId,
        actor.id
      );
    } else if (body.action === 'acknowledge') {
      const messageId = typeof body.messageId === 'string' ? body.messageId : '';
      const changed = await prisma.$executeRawUnsafe(
        `UPDATE "clinical_messages" SET "readAt" = COALESCE("readAt", NOW()), "acknowledgedAt" = COALESCE("acknowledgedAt", NOW())
         WHERE "id" = $1 AND "conversationId" = $2 AND "recipientId" = $3`,
        messageId,
        conversationId,
        actor.id
      );
      if (!changed) return NextResponse.json({ success: false, error: 'Message not found.' }, { status: 404 });
    } else if (body.action === 'resolve') {
      await prisma.$executeRawUnsafe(
        `UPDATE "clinical_conversations" SET "status" = 'RESOLVED', "resolvedAt" = NOW(), "resolvedById" = $2, "updatedAt" = NOW() WHERE "id" = $1`,
        conversationId,
        actor.id
      );
    } else {
      return NextResponse.json({ success: false, error: 'Unsupported action.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update staff message:', error);
    return NextResponse.json({ success: false, error: 'Hindi na-update ang message.' }, { status: 500 });
  }
}

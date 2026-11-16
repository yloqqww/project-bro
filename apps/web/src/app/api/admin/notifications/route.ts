import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminNotifications,
  markAdminNotificationRead,
  deleteAdminNotification,
  createAdminNotification,
} from '@/lib/notifications';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';

export async function GET(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const status = (searchParams.get('status') || 'all') as 'all' | 'read' | 'unread';
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const data = await getAdminNotifications(limit, { page, status, includeArchived });
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error('Error fetching admin notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications', details: error?.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const { id, markAll } = body;

    await markAdminNotificationRead(id, !!markAll);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating admin notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update notification', details: error?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const { id, clearAll } = body;

    await deleteAdminNotification(id, !!clearAll);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting admin notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete notification', details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const notif = await createAdminNotification(body);
    return NextResponse.json({ success: true, notification: notif });
  } catch (error: any) {
    console.error('Error creating admin notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create notification', details: error?.message },
      { status: 500 }
    );
  }
}

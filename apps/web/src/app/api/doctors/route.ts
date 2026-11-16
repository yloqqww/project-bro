import { NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { getClinicSettings, resolveQueuePrefix } from '@/lib/clinic-settings';

export async function GET() {
  try {
    const [doctors, settings] = await Promise.all([prisma.doctorProfile.findMany({
      where: {
        isActive: true,
        user: {
          isActive: true,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        queueServiceState: {
          select: {
            status: true,
            reason: true,
            updatedAt: true,
          },
        },
      },
      orderBy: {
        specialization: 'asc',
      },
    }), getClinicSettings()]);

    const formattedDoctors = doctors.map((doc) => ({
      id: doc.id,
      userId: doc.userId,
      name: `Dr. ${doc.firstName} ${doc.lastName}`,
      firstName: doc.firstName,
      lastName: doc.lastName,
      specialization: doc.specialization,
      roomNumber: doc.roomNumber || 'Consultation Room',
      prefix: resolveQueuePrefix(settings, doc.specialization),
      queueStatus: doc.queueServiceState?.status || 'OPEN',
      queueReason: doc.queueServiceState?.reason || null,
      queueUpdatedAt: doc.queueServiceState?.updatedAt ? doc.queueServiceState.updatedAt.toISOString() : null,
    }));

    return NextResponse.json({ success: true, doctors: formattedDoctors });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch doctors' },
      { status: 500 }
    );
  }
}

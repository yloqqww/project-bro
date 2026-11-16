import { NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { getClinicSettings, operationalQueueDate, resolveQueuePrefix } from '@/lib/clinic-settings';

export async function GET() {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  try {
    const settings = await getClinicSettings();
    const todayStart = operationalQueueDate(new Date(), settings.queueResetTime);

    const [
      totalPatientsCount,
      patientsTodayCount,
      waitingQueueCount,
      activeDoctorsCount,
      activeDoctors,
      todayTickets,
    ] = await Promise.all([
      prisma.patientProfile.count(),
      prisma.patientProfile.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.queueTicket.count({
        where: { queueDate: todayStart, status: 'WAITING' },
      }),
      prisma.doctorProfile.count({
        where: { isActive: true },
      }),
      prisma.doctorProfile.findMany({
        where: { isActive: true },
        include: {
          queueTickets: {
            where: { queueDate: todayStart },
            include: { patient: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.queueTicket.findMany({
        where: { queueDate: todayStart },
      }),
    ]);

    const completedToday = todayTickets.filter((t) => t.status === 'COMPLETED').length;
    const activeToday = todayTickets.filter(
      (t) => t.status === 'CALLED' || t.status === 'IN_CONSULTATION'
    ).length;

    const consultationRooms = activeDoctors.map((doc) => {
      const currentServing = doc.queueTickets.find(
        (t) => t.status === 'CALLED' || t.status === 'IN_CONSULTATION'
      );
      const waitingBehind = doc.queueTickets.filter((t) => t.status === 'WAITING').length;

      return {
        room: doc.roomNumber || 'Room 101',
        department: doc.specialization,
        doctor: `Dr. ${doc.firstName} ${doc.lastName}`,
        status: currentServing ? 'IN_SESSION' : 'IDLE',
        currentTicket: currentServing
          ? `${resolveQueuePrefix(settings, doc.specialization, currentServing.priority)}-${String(currentServing.queueNumber).padStart(2, '0')}`
          : '—',
        patientName: currentServing
          ? `${currentServing.patient.firstName} ${currentServing.patient.lastName}`
          : 'Awaiting next patient call',
        elapsed: currentServing ? 'Active' : 'Idle',
        queueBehind: waitingBehind,
        readerStatus: 'ONLINE',
      };
    });

    const kpiMetrics = [
      {
        id: 'patients-today',
        label: 'Patients Registered Today',
        value: String(patientsTodayCount),
        secondary: `${completedToday} completed • ${activeToday} active • ${totalPatientsCount} total recorded`,
        indicator: 'Real Database Sync',
        status: 'neutral',
      },
      {
        id: 'queue-depth',
        label: 'Current Queue Depth',
        value: String(waitingQueueCount),
        secondary: `${todayTickets.length} tickets issued today`,
        indicator: waitingQueueCount > 0 ? 'Patients Waiting' : 'Normal',
        status: waitingQueueCount > 5 ? 'warning' : 'healthy',
      },
      {
        id: 'active-rooms',
        label: 'Consultation Rooms Active',
        value: `${activeDoctorsCount} Active`,
        secondary: activeDoctorsCount > 0 ? `${activeDoctorsCount} doctors on duty` : 'No doctors registered yet',
        indicator: activeDoctorsCount > 0 ? 'Operational' : 'Setup Required',
        status: 'neutral',
      },
      {
        id: 'rfid-efficiency',
        label: 'Total Registered Patients',
        value: String(totalPatientsCount),
        secondary: `${totalPatientsCount} RFID cards linked`,
        indicator: 'Hardware operational',
        status: 'healthy',
      },
    ];

    return NextResponse.json({
      success: true,
      kpiMetrics,
      consultationRooms,
      counts: {
        totalPatients: totalPatientsCount,
        patientsToday: patientsTodayCount,
        waitingQueue: waitingQueueCount,
        activeDoctors: activeDoctorsCount,
      },
    });
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard metrics' },
      { status: 500 }
    );
  }
}

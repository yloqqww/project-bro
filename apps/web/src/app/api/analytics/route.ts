import { NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { getClinicSettings, operationalQueueDate } from '@/lib/clinic-settings';
import { zonedDateKey, zonedDayBounds } from '@/lib/clinic-time';

export async function GET(req: Request) {
  const auth = await authorizeApi(ACCESS.analytics);
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const station = searchParams.get('station') || 'all'; // 'all', 'triage', 'opd', 'doctor'

    const settings = await getClinicSettings();
    const todayKey = zonedDateKey(new Date(), settings.timezone);
    const { start: todayStart, end: todayEnd } = zonedDayBounds(todayKey, settings.timezone);
    const queueDate = operationalQueueDate(new Date(), settings.queueResetTime, settings.timezone);

    // ── 1. TRIAGE ANALYTICS ───────────────────────────────────────────
    let triageData: any = {
      totalTriagedToday: 0,
      totalTriagedAllTime: 0,
      pendingOpdCount: 0,
      opdProcessedCount: 0,
      departmentBreakdown: {
        OB_GYN: 0,
        PEDIATRICS: 0,
        INTERNAL_MEDICINE: 0,
        SURGERY: 0,
        EENT: 0,
      },
      priorityBreakdown: {
        STANDARD: 0,
        PRIORITY: 0,
        URGENT: 0,
        RESUSCITATION: 0,
      },
      clinicalAlerts: {
        hypertensionCount: 0,
        feverCount: 0,
        tachycardiaCount: 0,
        severePainCount: 0,
      },
      recentAssessments: [],
    };

    try {
      const triageRows: any[] = await prisma.$queryRawUnsafe(`
        SELECT * FROM "triage_assessments" ORDER BY "createdAt" DESC
      `);

      const triageToday = triageRows.filter(
        (r) => new Date(r.createdAt) >= todayStart
      );

      triageData.totalTriagedAllTime = triageRows.length;
      triageData.totalTriagedToday = triageToday.length;
      triageData.pendingOpdCount = triageRows.filter((r) => r.status === 'PENDING_OPD').length;
      triageData.opdProcessedCount = triageRows.filter((r) => r.status === 'OPD_PROCESSED').length;

      // Department & Priority counts
      triageRows.forEach((r) => {
        const dept = r.department;
        if (triageData.departmentBreakdown[dept] !== undefined) {
          triageData.departmentBreakdown[dept]++;
        } else {
          triageData.departmentBreakdown[dept] = 1;
        }

        const prio = r.priorityLevel || 'STANDARD';
        if (triageData.priorityBreakdown[prio] !== undefined) {
          triageData.priorityBreakdown[prio]++;
        } else {
          triageData.priorityBreakdown[prio] = 1;
        }

        // Clinical health alerts
        if (r.bloodPressure) {
          const parts = String(r.bloodPressure).split('/');
          const sys = parseInt(parts[0], 10);
          const dia = parseInt(parts[1], 10);
          if (sys >= 140 || dia >= 90) triageData.clinicalAlerts.hypertensionCount++;
        }
        if (r.temperature) {
          const temp = parseFloat(r.temperature);
          if (temp >= 37.8) triageData.clinicalAlerts.feverCount++;
        }
        if (r.heartRate) {
          const hr = parseInt(r.heartRate, 10);
          if (hr > 100) triageData.clinicalAlerts.tachycardiaCount++;
        }
        if (r.painScore && Number(r.painScore) >= 7) {
          triageData.clinicalAlerts.severePainCount++;
        }
      });

      triageData.recentAssessments = triageRows.slice(0, 10).map((r) => ({
        id: r.id,
        triageNumber: r.triageNumber,
        patientName: r.patientName,
        department: r.department,
        priorityLevel: r.priorityLevel,
        status: r.status,
        bloodPressure: r.bloodPressure,
        temperature: r.temperature,
        heartRate: r.heartRate,
        createdAt: r.createdAt,
      }));
    } catch (triageErr) {
      console.warn('Error reading triage assessments table:', triageErr);
    }

    // ── 2. OPD QUEUE & REGISTRATION ANALYTICS ────────────────────────
    let opdData: any = {
      totalTicketsToday: 0,
      totalTicketsAllTime: 0,
      statusBreakdown: {
        WAITING: 0,
        CALLED: 0,
        IN_CONSULTATION: 0,
        COMPLETED: 0,
        CANCELLED: 0,
      },
      priorityBreakdown: {
        Regular: 0,
        'Senior/PWD': 0,
        Urgent: 0,
      },
      departmentLoad: {},
      newPatientsRegisteredToday: 0,
      totalPatientsCount: 0,
      activeRfidCardsCount: 0,
      averageWaitMinutes: 12,
    };

    try {
      const [
        totalTicketsCount,
        ticketsToday,
        allTickets,
        newPatientsCount,
        totalPatients,
        rfidCount,
      ] = await Promise.all([
        prisma.queueTicket.count(),
        prisma.queueTicket.findMany({
          where: { queueDate },
          include: {
            doctor: true,
            patient: true,
          },
        }),
        prisma.queueTicket.findMany({
          take: 100,
          orderBy: { createdAt: 'desc' },
          include: {
            doctor: true,
          },
        }),
        prisma.patientProfile.count({
          where: { createdAt: { gte: todayStart, lte: todayEnd } },
        }),
        prisma.patientProfile.count(),
        prisma.rfidCard.count({
          where: { status: 'ACTIVE' },
        }),
      ]);

      opdData.totalTicketsAllTime = totalTicketsCount;
      opdData.totalTicketsToday = ticketsToday.length;
      opdData.newPatientsRegisteredToday = newPatientsCount;
      opdData.totalPatientsCount = totalPatients;
      opdData.activeRfidCardsCount = rfidCount;

      // Status breakdown
      ticketsToday.forEach((t) => {
        const s = t.status as keyof typeof opdData.statusBreakdown;
        if (opdData.statusBreakdown[s] !== undefined) {
          opdData.statusBreakdown[s]++;
        }

        const prio = t.priority === 1 ? 'Senior/PWD' : t.priority >= 2 ? 'Urgent' : 'Regular';
        if (opdData.priorityBreakdown[prio] !== undefined) {
          opdData.priorityBreakdown[prio]++;
        }

        const dept = t.doctor?.specialization || 'General OPD';
        opdData.departmentLoad[dept] = (opdData.departmentLoad[dept] || 0) + 1;
      });

      // Calculate average wait time (minutes from created to called)
      const waitTimes: number[] = [];
      allTickets.forEach((t) => {
        if (t.calledAt) {
          const waitMins = Math.round(
            (new Date(t.calledAt).getTime() - new Date(t.createdAt).getTime()) / 60000
          );
          if (waitMins >= 0 && waitMins < 300) {
            waitTimes.push(waitMins);
          }
        }
      });
      if (waitTimes.length > 0) {
        opdData.averageWaitMinutes = Math.round(
          waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
        );
      }
    } catch (opdErr) {
      console.warn('Error fetching OPD analytics data:', opdErr);
    }

    // ── 3. DOCTOR CONSULTATION & CLINICAL ANALYTICS ──────────────────
    let doctorData: any = {
      totalConsultationsToday: 0,
      totalConsultationsAllTime: 0,
      activeConsultationsCount: 0,
      averageConsultationMinutes: 15,
      totalPrescriptionsIssued: 0,
      topDiagnoses: [],
      topMedications: [],
      doctorPerformance: [],
    };

    try {
      const [
        completedTodayCount,
        allCompletedCount,
        activeConsultations,
        completedTicketsWithTimes,
        prescriptionsList,
        medicalRecordsList,
        activeDoctors,
      ] = await Promise.all([
        prisma.queueTicket.count({
          where: {
            queueDate,
            status: 'COMPLETED',
          },
        }),
        prisma.queueTicket.count({
          where: { status: 'COMPLETED' },
        }),
        prisma.queueTicket.count({
          where: { status: 'IN_CONSULTATION' },
        }),
        prisma.queueTicket.findMany({
          where: {
            status: 'COMPLETED',
            startedAt: { not: null },
            completedAt: { not: null },
          },
          take: 50,
          orderBy: { completedAt: 'desc' },
        }),
        prisma.prescription.findMany({
          take: 100,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.medicalRecord.findMany({
          take: 100,
          orderBy: { createdAt: 'desc' },
          select: { assessment: true },
        }),
        prisma.doctorProfile.findMany({
          where: { isActive: true },
          include: {
            queueTickets: {
              where: { queueDate },
            },
          },
        }),
      ]);

      doctorData.totalConsultationsToday = completedTodayCount;
      doctorData.totalConsultationsAllTime = allCompletedCount;
      doctorData.activeConsultationsCount = activeConsultations;
      doctorData.totalPrescriptionsIssued = prescriptionsList.length;

      // Calculate consultation duration
      const durations: number[] = [];
      completedTicketsWithTimes.forEach((t) => {
        if (t.startedAt && t.completedAt) {
          const diff = Math.round(
            (new Date(t.completedAt).getTime() - new Date(t.startedAt).getTime()) / 60000
          );
          if (diff > 0 && diff < 180) {
            durations.push(diff);
          }
        }
      });
      if (durations.length > 0) {
        doctorData.averageConsultationMinutes = Math.round(
          durations.reduce((a, b) => a + b, 0) / durations.length
        );
      }

      // Top diagnoses from clinical assessments
      const diagCounts: Record<string, number> = {};
      medicalRecordsList.forEach((r) => {
        if (r.assessment && r.assessment.trim()) {
          const diag = r.assessment.trim();
          diagCounts[diag] = (diagCounts[diag] || 0) + 1;
        }
      });
      doctorData.topDiagnoses = Object.entries(diagCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Top medications
      const medCounts: Record<string, number> = {};
      prescriptionsList.forEach((p) => {
        if (p.medicationName) {
          const med = p.medicationName.split(' ')[0].trim();
          medCounts[med] = (medCounts[med] || 0) + 1;
        }
      });
      doctorData.topMedications = Object.entries(medCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Doctor performance
      doctorData.doctorPerformance = activeDoctors.map((doc) => {
        const completed = doc.queueTickets.filter((t) => t.status === 'COMPLETED').length;
        const waiting = doc.queueTickets.filter((t) => t.status === 'WAITING').length;
        const active = doc.queueTickets.filter(
          (t) => t.status === 'CALLED' || t.status === 'IN_CONSULTATION'
        ).length;

        return {
          id: doc.id,
          name: `Dr. ${doc.firstName} ${doc.lastName}`,
          specialty: doc.specialization,
          room: doc.roomNumber || 'Room',
          completedToday: completed,
          waitingNow: waiting,
          inSessionNow: active,
          totalAssigned: doc.queueTickets.length,
        };
      });
    } catch (docErr) {
      console.warn('Error fetching doctor analytics data:', docErr);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      triage: triageData,
      opd: opdData,
      doctor: doctorData,
    });
  } catch (error) {
    console.error('Error generating hospital analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate hospital analytics' },
      { status: 500 }
    );
  }
}

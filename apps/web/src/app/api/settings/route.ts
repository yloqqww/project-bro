import { NextResponse } from 'next/server';
import { getClinicSettings } from '@/lib/clinic-settings';

export async function GET() {
  try {
    const settings = await getClinicSettings();
    return NextResponse.json({
      success: true,
      settings: {
        clinicName: settings.clinicName,
        shortName: settings.shortName,
        hotline: settings.hotline,
        address: settings.address,
        emergencyNotice: settings.emergencyNotice,
        queueResetTime: settings.queueResetTime,
        queuePrefixes: settings.queuePrefixes,
        timezone: settings.timezone,
        operatingDays: settings.operatingDays,
        holidayDates: settings.holidayDates,
        appointmentLeadTimeHours: settings.appointmentLeadTimeHours,
        bookingHorizonDays: settings.bookingHorizonDays,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching public clinic settings:', error);
    return NextResponse.json({ success: false, error: 'Failed to load clinic settings.' }, { status: 500 });
  }
}

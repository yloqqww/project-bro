import { NextRequest, NextResponse } from 'next/server';
import { getDoctorAvailability } from '@/lib/schedule-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const date = new URL(req.url).searchParams.get('date');
    if (!date) return NextResponse.json({ success: false, error: 'date is required.' }, { status: 400 });
    const availability = await getDoctorAvailability(id, date);
    if (!availability.found) {
      return NextResponse.json({ success: false, error: 'Doctor not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...availability });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load availability.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

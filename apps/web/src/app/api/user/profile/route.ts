import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import bcrypt from 'bcryptjs';
import { authorizeApi } from '@/lib/api-auth';

export async function GET() {
  const auth = await authorizeApi();
  if (!auth.ok) return auth.response;
  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      include: {
        doctorProfile: true,
        staffProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    let name = user.email.split('@')[0];
    let specialty: string | undefined = undefined;
    let room: string | undefined = undefined;
    let prcLicense: string | undefined = undefined;
    let contact = '+63 900 000 0000';

    if (user.doctorProfile) {
      name = `Dr. ${user.doctorProfile.firstName} ${user.doctorProfile.lastName}`.trim();
      specialty = user.doctorProfile.specialization || undefined;
      room = user.doctorProfile.roomNumber || undefined;
      prcLicense = user.doctorProfile.licenseNumber || undefined;
    } else if (user.staffProfile) {
      const fullName = `${user.staffProfile.firstName} ${user.staffProfile.lastName}`.trim();
      if (fullName) name = fullName;
      specialty = user.staffProfile.specialty || undefined;
      room = user.staffProfile.roomNumber || undefined;
      prcLicense = user.staffProfile.licenseNumber || undefined;
      if (user.staffProfile.phoneNumber) contact = user.staffProfile.phoneNumber;
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: user.id,
        name,
        email: user.email,
        role: user.role,
        specialty,
        room,
        prcLicense,
        contact,
      },
    });
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await authorizeApi();
  if (!auth.ok) return auth.response;
  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      include: {
        doctorProfile: true,
        staffProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { name, specialty, room, contact, prcLicense, password } = body;

    // Optional password update
    if (password && typeof password === 'string') {
      const cleanPassword = password.trim();
      if (cleanPassword.length < 12 || !/[A-Z]/.test(cleanPassword) || !/[a-z]/.test(cleanPassword) || !/\d/.test(cleanPassword)) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 12 characters and include uppercase, lowercase, and a number.' },
          { status: 400 }
        );
      }
      const hashedPassword = await bcrypt.hash(cleanPassword, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, passwordActivatedAt: new Date(), lastPasswordChangeAt: new Date(), passwordExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), sessionVersion: { increment: 1 } },
      });
    }

    // Name splitting
    let firstName = 'Staff';
    let lastName = 'Member';
    if (name && typeof name === 'string') {
      const clean = name.trim().replace(/^Dr\.\s+/i, '');
      const parts = clean.split(' ');
      firstName = parts[0] || 'Staff';
      lastName = parts.slice(1).join(' ') || (user.role === 'DOCTOR' ? 'Physician' : 'Staff');
    }

    if (user.doctorProfile) {
      await prisma.doctorProfile.update({
        where: { id: user.doctorProfile.id },
        data: {
          ...(name ? { firstName, lastName } : {}),
          ...(specialty !== undefined ? { specialization: specialty.trim() } : {}),
          ...(room !== undefined ? { roomNumber: room.trim() } : {}),
          ...(prcLicense !== undefined ? { licenseNumber: prcLicense.trim() } : {}),
        },
      });
    } else {
      const fallbackFirst = name ? firstName : user.staffProfile?.firstName || user.email.split('@')[0];
      const fallbackLast = name ? lastName : user.staffProfile?.lastName || 'Staff';

      await prisma.staffProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          firstName: fallbackFirst,
          lastName: fallbackLast,
          specialty: specialty !== undefined ? specialty.trim() : undefined,
          roomNumber: room !== undefined ? room.trim() : undefined,
          phoneNumber: contact !== undefined ? contact.trim() : '+63 900 000 0000',
          licenseNumber: prcLicense !== undefined ? prcLicense.trim() : undefined,
        },
        update: {
          ...(name ? { firstName, lastName } : {}),
          ...(specialty !== undefined ? { specialty: specialty.trim() } : {}),
          ...(room !== undefined ? { roomNumber: room.trim() } : {}),
          ...(contact !== undefined ? { phoneNumber: contact.trim() } : {}),
          ...(prcLicense !== undefined ? { licenseNumber: prcLicense.trim() } : {}),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Profile successfully updated.',
    });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}

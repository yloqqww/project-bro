import { NextRequest, NextResponse } from 'next/server';
import { prisma, UserRole } from '@clinic/db';
import bcrypt from 'bcryptjs';
import { sendStaffWelcomeEmail } from '@/lib/email';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { auditChanges, writeAuditLog } from '@/lib/audit';

export async function GET() {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  try {
    const staffUsers = await prisma.user.findMany({
      where: {
        role: {
          not: 'PATIENT',
        },
      },
      include: {
        doctorProfile: true,
        staffProfile: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const formattedStaff = staffUsers.map((user) => {
      let name = user.email.split('@')[0];
      let specialty: string | undefined = undefined;
      let room: string | undefined = undefined;
      let prcLicense: string | undefined = undefined;
      let contact = '+63 900 000 0000';

      if (user.doctorProfile) {
        name = `Dr. ${user.doctorProfile.firstName} ${user.doctorProfile.lastName}`.trim();
        specialty = user.doctorProfile.specialization || undefined;
        prcLicense = user.doctorProfile.licenseNumber || undefined;
        room = user.doctorProfile.roomNumber || undefined;
      } else if (user.staffProfile) {
        const fullStaffName = `${user.staffProfile.firstName} ${user.staffProfile.lastName}`.trim();
        if (fullStaffName) {
          name = fullStaffName;
        }
        specialty = user.staffProfile.specialty || undefined;
        room = user.staffProfile.roomNumber || undefined;
        prcLicense = user.staffProfile.licenseNumber || undefined;
        if (user.staffProfile.phoneNumber) {
          contact = user.staffProfile.phoneNumber;
        }
      } else if (user.role === 'ADMIN') {
        name = 'System Administrator';
      } else if (user.role === 'RECEPTIONIST') {
        name = `OPD (${user.email.split('@')[0]})`;
      } else if (user.role === 'NURSE') {
        name = `Triage (${user.email.split('@')[0]})`;
      }

      return {
        id: user.id,
        name,
        email: user.email,
        role: user.role,
        specialty,
        prcLicense,
        room,
        contact,
        status: user.isActive ? 'ACTIVE' : 'INACTIVE',
      };
    });

    return NextResponse.json({ success: true, staff: formattedStaff });
  } catch (error: any) {
    console.error('Error fetching staff:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch staff', details: error?.message || String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const { name, email, role, password, specialty, prcLicense, room, contact } = body;

    if (!email || !role || !password) {
      return NextResponse.json(
        { success: false, error: 'Email, role, and password are required.' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'User with this email already exists.' },
        { status: 400 }
      );
    }

    const cleanPassword = (password || '').trim();
    if (!cleanPassword || cleanPassword.length < 12 || !/[A-Z]/.test(cleanPassword) || !/[a-z]/.test(cleanPassword) || !/\d/.test(cleanPassword)) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 12 characters and include uppercase, lowercase, and a number.' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);
    let targetRole: any = 'RECEPTIONIST';

    if (role === 'ADMIN') targetRole = 'ADMIN';
    else if (role === 'DOCTOR') targetRole = 'DOCTOR';
    else if (role === 'RECEPTIONIST') targetRole = 'RECEPTIONIST';
    else if (role === 'NURSE') targetRole = 'NURSE';

    // Parse first name and last name
    const cleanName = (name || '').trim().replace(/^Dr\.\s+/i, '');
    const parts = cleanName.split(' ');
    const firstName = parts[0] || 'Staff';
    const lastName = parts.slice(1).join(' ') || (targetRole === 'DOCTOR' ? 'Physician' : 'Member');
    
    // Default fallback room assignments by role
    const finalRoom = (room || '').trim() || (
      targetRole === 'DOCTOR' ? 'Room 101' :
      targetRole === 'NURSE' ? 'Triage Station 1' :
      targetRole === 'RECEPTIONIST' ? 'OPD Counter 1' : undefined
    );

    // Default fallback specialties by role
    const finalSpecialty = (specialty || '').trim() || (
      targetRole === 'DOCTOR' ? 'General Medicine' :
      targetRole === 'NURSE' ? 'Triage / Vital Signs' :
      targetRole === 'RECEPTIONIST' ? 'OPD Counter' : undefined
    );

    const cleanContact = (contact || '').trim() || '+63 900 000 0000';
    const cleanLicense = (prcLicense || '').trim();

    if (targetRole === UserRole.DOCTOR) {
      const newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: targetRole,
          isActive: true,
          passwordExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          doctorProfile: {
            create: {
              firstName,
              lastName,
              specialization: finalSpecialty,
              licenseNumber: cleanLicense || `PRC-${Date.now().toString().slice(-6)}`,
              roomNumber: finalRoom,
              isActive: true,
            },
          },
        },
        include: {
          doctorProfile: true,
        },
      });

      const staffName = `Dr. ${newUser.doctorProfile?.firstName} ${newUser.doctorProfile?.lastName}`.trim();

      // Dispatch welcome credentials email with the EXACT clean password
      const emailNotice = await sendStaffWelcomeEmail({
        email: newUser.email,
        name: staffName,
        role: 'Doctor / Attending Physician',
        temporaryPassword: cleanPassword,
        room: newUser.doctorProfile?.roomNumber || undefined,
        specialty: newUser.doctorProfile?.specialization || undefined,
      });

      await writeAuditLog({ actor: auth.user, action: 'STAFF_CREATE', targetType: 'User', targetId: newUser.id, summary: `Created ${newUser.role} staff account ${newUser.email}.`, request: req, metadata: auditChanges(null, newUser, { emailDelivery: { sent: emailNotice.emailSent, provider: emailNotice.provider } }) });

      return NextResponse.json({
        success: true,
        staff: {
          id: newUser.id,
          name: staffName,
          email: newUser.email,
          role: newUser.role,
          specialty: newUser.doctorProfile?.specialization,
          prcLicense: newUser.doctorProfile?.licenseNumber,
          room: newUser.doctorProfile?.roomNumber,
          contact: cleanContact,
          status: 'ACTIVE',
        },
        emailNotice,
      });
    } else {
      const newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: targetRole,
          isActive: true,
          passwordExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          staffProfile: {
            create: {
              firstName,
              lastName,
              specialty: finalSpecialty,
              roomNumber: finalRoom,
              phoneNumber: cleanContact,
              licenseNumber: cleanLicense || undefined,
            },
          },
        },
        include: {
          staffProfile: true,
        },
      });

      const staffName = `${newUser.staffProfile?.firstName} ${newUser.staffProfile?.lastName}`.trim() || cleanName || email.split('@')[0];

      // Dispatch welcome credentials email with room and specialty
      const emailNotice = await sendStaffWelcomeEmail({
        email: newUser.email,
        name: staffName,
        role: targetRole === 'NURSE' ? 'Nurse Practitioner / Triage' :
              targetRole === 'RECEPTIONIST' ? 'Receptionist / Front Desk' : 'Administrator',
        temporaryPassword: cleanPassword,
        room: newUser.staffProfile?.roomNumber || undefined,
        specialty: newUser.staffProfile?.specialty || undefined,
      });

      await writeAuditLog({ actor: auth.user, action: 'STAFF_CREATE', targetType: 'User', targetId: newUser.id, summary: `Created ${newUser.role} staff account ${newUser.email}.`, request: req, metadata: auditChanges(null, newUser, { emailDelivery: { sent: emailNotice.emailSent, provider: emailNotice.provider } }) });

      return NextResponse.json({
        success: true,
        staff: {
          id: newUser.id,
          name: staffName,
          email: newUser.email,
          role: newUser.role,
          specialty: newUser.staffProfile?.specialty || undefined,
          prcLicense: newUser.staffProfile?.licenseNumber || undefined,
          room: newUser.staffProfile?.roomNumber || undefined,
          contact: newUser.staffProfile?.phoneNumber || cleanContact,
          status: 'ACTIVE',
        },
        emailNotice,
      });
    }
  } catch (error) {
    console.error('Error creating staff:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create staff member' },
      { status: 500 }
    );
  }
}

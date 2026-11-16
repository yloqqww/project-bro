import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import bcrypt from 'bcryptjs';
import { sendStaffWelcomeEmail } from '@/lib/email';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { auditChanges, writeAuditLog } from '@/lib/audit';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, password, name, specialty, room, prcLicense, contact, role } = body;

    const dataToUpdate: any = {};

    if (status !== undefined) {
      dataToUpdate.isActive = status === 'ACTIVE';
    }

    if (role && ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE'].includes(role)) {
      dataToUpdate.role = role;
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { doctorProfile: true, staffProfile: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found.' },
        { status: 404 }
      );
    }

    if (password) {
      const cleanPass = password.trim();
      if (cleanPass.length < 12 || !/[A-Z]/.test(cleanPass) || !/[a-z]/.test(cleanPass) || !/\d/.test(cleanPass)) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 12 characters and include uppercase, lowercase, and a number.' },
          { status: 400 }
        );
      }
      dataToUpdate.password = await bcrypt.hash(cleanPass, 10);
      dataToUpdate.lastPasswordChangeAt = new Date();
      dataToUpdate.passwordExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      dataToUpdate.sessionVersion = { increment: 1 };

      const staffName = targetUser.doctorProfile
        ? `Dr. ${targetUser.doctorProfile.firstName} ${targetUser.doctorProfile.lastName}`
        : targetUser.staffProfile
        ? `${targetUser.staffProfile.firstName} ${targetUser.staffProfile.lastName}`
        : targetUser.email.split('@')[0];

      await sendStaffWelcomeEmail({
        email: targetUser.email,
        name: staffName,
        role: targetUser.role,
        temporaryPassword: cleanPass,
        room: targetUser.doctorProfile?.roomNumber || targetUser.staffProfile?.roomNumber || undefined,
        specialty: targetUser.doctorProfile?.specialization || targetUser.staffProfile?.specialty || undefined,
      });
    }

    if (Object.keys(dataToUpdate).length > 0) {
      await prisma.user.update({
        where: { id },
        data: dataToUpdate,
      });
    }

    // Handle Profile Fields (name, specialty, room, prcLicense, contact)
    if (name !== undefined || specialty !== undefined || room !== undefined || prcLicense !== undefined || contact !== undefined) {
      let firstName: string | undefined = undefined;
      let lastName: string | undefined = undefined;

      if (name && typeof name === 'string') {
        const clean = name.trim().replace(/^Dr\.\s+/i, '');
        const parts = clean.split(' ');
        firstName = parts[0];
        lastName = parts.slice(1).join(' ') || (targetUser.role === 'DOCTOR' ? 'Physician' : 'Staff');
      }

      const effectiveRole = role || targetUser.role;

      if (effectiveRole === 'DOCTOR') {
        const docFirst = firstName || targetUser.doctorProfile?.firstName || targetUser.staffProfile?.firstName || targetUser.email.split('@')[0];
        const docLast = lastName || targetUser.doctorProfile?.lastName || targetUser.staffProfile?.lastName || 'Physician';

        if (targetUser.doctorProfile) {
          await prisma.doctorProfile.update({
            where: { id: targetUser.doctorProfile.id },
            data: {
              ...(firstName ? { firstName } : {}),
              ...(lastName ? { lastName } : {}),
              ...(specialty !== undefined ? { specialization: specialty.trim() } : {}),
              ...(room !== undefined ? { roomNumber: room.trim() } : {}),
              ...(prcLicense !== undefined ? { licenseNumber: prcLicense.trim() } : {}),
            },
          });
        } else {
          await prisma.doctorProfile.create({
            data: {
              userId: id,
              firstName: docFirst,
              lastName: docLast,
              specialization: specialty?.trim() || 'General Medicine',
              roomNumber: room?.trim() || 'Room 101',
              licenseNumber: prcLicense?.trim() || '0000000',
            },
          });
        }
      } else {
        const fallbackFirst = firstName || targetUser.staffProfile?.firstName || targetUser.doctorProfile?.firstName || targetUser.email.split('@')[0];
        const fallbackLast = lastName || targetUser.staffProfile?.lastName || targetUser.doctorProfile?.lastName || 'Member';

        await prisma.staffProfile.upsert({
          where: { userId: id },
          create: {
            userId: id,
            firstName: fallbackFirst,
            lastName: fallbackLast,
            specialty: specialty !== undefined ? specialty.trim() : undefined,
            roomNumber: room !== undefined ? room.trim() : undefined,
            phoneNumber: contact !== undefined ? contact.trim() : '+63 900 000 0000',
            licenseNumber: prcLicense !== undefined ? prcLicense.trim() : undefined,
          },
          update: {
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
            ...(specialty !== undefined ? { specialty: specialty.trim() } : {}),
            ...(room !== undefined ? { roomNumber: room.trim() } : {}),
            ...(contact !== undefined ? { phoneNumber: contact.trim() } : {}),
            ...(prcLicense !== undefined ? { licenseNumber: prcLicense.trim() } : {}),
          },
        });
      }
    }

    const updated = await prisma.user.findUnique({
      where: { id },
      include: { doctorProfile: true, staffProfile: true },
    });

    await writeAuditLog({ actor: auth.user, action: 'STAFF_UPDATE', targetType: 'User', targetId: id, summary: `Updated staff account ${targetUser.email}.`, request: req, metadata: auditChanges(targetUser, updated, { passwordChanged: Boolean(password) }) });

    return NextResponse.json({
      success: true,
      user: {
        id: updated?.id,
        email: updated?.email,
        isActive: updated?.isActive,
      },
    });
  } catch (error) {
    console.error('Error updating staff:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update staff member' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;

    // Protect super admin from deletion
    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { doctorProfile: true, patientProfile: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found in database.' },
        { status: 404 }
      );
    }

    if (targetUser.email === 'admin@clinic.local') {
      return NextResponse.json(
        { success: false, error: 'Hindi maaaring burahin ang pangunahing Super Admin account.' },
        { status: 400 }
      );
    }

    if (targetUser.patientProfile) {
      return NextResponse.json(
        { success: false, error: 'Patient master records cannot be deleted through staff administration. Archive or merge the patient record instead.' },
        { status: 409 }
      );
    }

    // Find fallback super admin for reassigning created records if needed
    const superAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN', NOT: { id } },
      select: { id: true },
    });

    // Reassign or clean up created appointments
    if (superAdmin) {
      await prisma.appointment.updateMany({
        where: { createdById: id },
        data: { createdById: superAdmin.id },
      });
    } else {
      await prisma.appointment.deleteMany({
        where: { createdById: id },
      });
    }

    // Reassign or clean up clinical records, prescriptions, attachments, and patient archive/merge references
    // so the staff/doctor account can be permanently deleted without losing patient history.
    await prisma.medicalRecord.updateMany({
      where: { finalizedById: id },
      data: { finalizedById: superAdmin ? superAdmin.id : null },
    });

    await prisma.medicalRecord.updateMany({
      where: { archivedById: id },
      data: { archivedById: superAdmin ? superAdmin.id : null },
    });

    await prisma.patientProfile.updateMany({
      where: { archivedById: id },
      data: { archivedById: superAdmin ? superAdmin.id : null },
    });

    if (superAdmin) {
      await prisma.medicalRecordAttachment.updateMany({
        where: { uploadedById: id },
        data: { uploadedById: superAdmin.id },
      });
      await prisma.prescription.updateMany({
        where: { doctorId: id },
        data: { doctorId: superAdmin.id },
      });
      await prisma.medicalRecord.updateMany({
        where: { doctorId: id },
        data: { doctorId: superAdmin.id },
      });
      await prisma.patientMergeHistory.updateMany({
        where: { mergedById: id },
        data: { mergedById: superAdmin.id },
      });
    } else {
      await prisma.medicalRecordAttachment.deleteMany({
        where: { uploadedById: id },
      });
      await prisma.prescription.deleteMany({
        where: { doctorId: id },
      });
      await prisma.medicalRecord.deleteMany({
        where: { doctorId: id },
      });
      await prisma.patientMergeHistory.deleteMany({
        where: { mergedById: id },
      });
    }

    // If staff has a doctor profile, delete queue tickets, appointments, and profile
    if (targetUser.doctorProfile) {
      await prisma.queueTicket.deleteMany({
        where: { doctorId: targetUser.doctorProfile.id },
      });
      await prisma.appointment.deleteMany({
        where: { doctorId: targetUser.doctorProfile.id },
      });
      await prisma.doctorProfile.delete({
        where: { id: targetUser.doctorProfile.id },
      });
    }

    // Permanently delete user from database
    await prisma.user.delete({
      where: { id },
    });

    await writeAuditLog({ actor: auth.user, action: 'STAFF_DELETE', targetType: 'User', targetId: id, summary: `Deleted staff account ${targetUser.email}.`, request: req, metadata: auditChanges(targetUser, null) });

    return NextResponse.json({
      success: true,
      message: `Matagumpay na nabura ang account na ${targetUser.email} sa database.`,
    });
  } catch (error: any) {
    console.error('Error deleting staff:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete staff member from database', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

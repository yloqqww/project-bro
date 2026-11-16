import { PrismaClient, UserRole, BloodType, AppointmentStatus, QueueStatus, RfidCardStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data in development
  await prisma.prescription.deleteMany();
  await prisma.medicalRecord.deleteMany();
  await prisma.queueTicket.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.rfidCard.deleteMany();
  await prisma.patientProfile.deleteMany();
  await prisma.doctorProfile.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Cleared existing data');

  const newSeedPassword = async () => bcrypt.hash(crypto.randomBytes(32).toString('base64url'), 12);

  // ============================================================
  // 1. CREATE ADMIN ACCOUNT
  // ============================================================
  const admin = await prisma.user.create({
    data: {
      email: 'admin@clinic.local',
      password: await newSeedPassword(),
      role: UserRole.ADMIN,
      isActive: true,
    },
  });
  console.log('✅ Created admin account');

  // ============================================================
  // 2. CREATE DOCTOR ACCOUNTS
  // ============================================================
  const cardiologyDoctor = await prisma.user.create({
    data: {
      email: 'cardio.doc@clinic.local',
      password: await newSeedPassword(),
      role: UserRole.DOCTOR,
      isActive: true,
      doctorProfile: {
        create: {
          firstName: 'Sarah',
          lastName: 'Martinez',
          specialization: 'Cardiology',
          licenseNumber: 'MD-CARD-2024-001',
          roomNumber: 'Room 201',
          isActive: true,
          availableFrom: '09:00',
          availableTo: '17:00',
        },
      },
    },
    include: {
      doctorProfile: true,
    },
  });

  const pediatricsDoctor = await prisma.user.create({
    data: {
      email: 'pedia.doc@clinic.local',
      password: await newSeedPassword(),
      role: UserRole.DOCTOR,
      isActive: true,
      doctorProfile: {
        create: {
          firstName: 'Michael',
          lastName: 'Chen',
          specialization: 'Pediatrics',
          licenseNumber: 'MD-PEDS-2024-002',
          roomNumber: 'Room 202',
          isActive: true,
          availableFrom: '08:00',
          availableTo: '16:00',
        },
      },
    },
    include: {
      doctorProfile: true,
    },
  });

  console.log('✅ Created 2 doctor accounts');

  // ============================================================
  // 3. CREATE RECEPTIONIST ACCOUNT
  // ============================================================
  const receptionist = await prisma.user.create({
    data: {
      email: 'reception@clinic.local',
      password: await newSeedPassword(),
      role: UserRole.RECEPTIONIST,
      isActive: true,
    },
  });
  console.log('✅ Created receptionist account');

  // ============================================================
  // 4. CREATE PATIENT ACCOUNTS WITH RFID CARDS
  // ============================================================
  
  // Patient 1: John Doe
  const patient1 = await prisma.user.create({
    data: {
      email: 'john.doe@example.com',
      password: await newSeedPassword(),
      role: UserRole.PATIENT,
      isActive: true,
      patientProfile: {
        create: {
          firstName: 'John',
          lastName: 'Doe',
          middleName: 'Michael',
          dateOfBirth: new Date('1985-06-15'),
          gender: 'MALE',
          phoneNumber: '+1-555-0101',
          address: '123 Main Street',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701',
          bloodType: BloodType.O_POSITIVE,
          allergies: JSON.stringify(['Penicillin', 'Peanuts']),
          chronicConditions: JSON.stringify(['Hypertension']),
          emergencyContactName: 'Jane Doe',
          emergencyContactPhone: '+1-555-0102',
          emergencyContactRelation: 'Spouse',
          rfidCards: {
            create: {
              cardUid: 'A1B2C3D4',
              status: RfidCardStatus.ACTIVE,
              issuedAt: new Date(),
            },
          },
        },
      },
    },
    include: {
      patientProfile: {
        include: {
          rfidCards: true,
        },
      },
    },
  });

  // Patient 2: Maria Garcia
  const patient2 = await prisma.user.create({
    data: {
      email: 'maria.garcia@example.com',
      password: await newSeedPassword(),
      role: UserRole.PATIENT,
      isActive: true,
      patientProfile: {
        create: {
          firstName: 'Maria',
          lastName: 'Garcia',
          middleName: 'Elena',
          dateOfBirth: new Date('1992-03-22'),
          gender: 'FEMALE',
          phoneNumber: '+1-555-0201',
          address: '456 Oak Avenue',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62702',
          bloodType: BloodType.A_POSITIVE,
          allergies: JSON.stringify(['Latex']),
          chronicConditions: JSON.stringify([]),
          emergencyContactName: 'Carlos Garcia',
          emergencyContactPhone: '+1-555-0202',
          emergencyContactRelation: 'Father',
          rfidCards: {
            create: {
              cardUid: 'E5F6G7H8',
              status: RfidCardStatus.ACTIVE,
              issuedAt: new Date(),
            },
          },
        },
      },
    },
    include: {
      patientProfile: {
        include: {
          rfidCards: true,
        },
      },
    },
  });

  // Patient 3: Robert Kim (Pediatric patient)
  const patient3 = await prisma.user.create({
    data: {
      email: 'robert.kim@example.com',
      password: await newSeedPassword(),
      role: UserRole.PATIENT,
      isActive: true,
      patientProfile: {
        create: {
          firstName: 'Robert',
          lastName: 'Kim',
          middleName: 'James',
          dateOfBirth: new Date('2015-11-08'),
          gender: 'MALE',
          phoneNumber: '+1-555-0301',
          address: '789 Elm Street',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62703',
          bloodType: BloodType.B_POSITIVE,
          allergies: JSON.stringify(['Shellfish']),
          chronicConditions: JSON.stringify(['Asthma']),
          emergencyContactName: 'Susan Kim',
          emergencyContactPhone: '+1-555-0302',
          emergencyContactRelation: 'Mother',
          rfidCards: {
            create: {
              cardUid: 'F1A2B3C4',
              status: RfidCardStatus.ACTIVE,
              issuedAt: new Date(),
            },
          },
        },
      },
    },
    include: {
      patientProfile: {
        include: {
          rfidCards: true,
        },
      },
    },
  });

  console.log('✅ Created 3 patient accounts with RFID cards');

  // ============================================================
  // 5. CREATE APPOINTMENTS FOR TODAY
  // ============================================================
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Appointment 1: John Doe with Cardiology (9:00 AM)
  const appointment1Time = new Date(today);
  appointment1Time.setHours(9, 0, 0, 0);

  const appointment1 = await prisma.appointment.create({
    data: {
      patientId: patient1.patientProfile!.id,
      doctorId: cardiologyDoctor.doctorProfile!.id,
      appointmentDate: appointment1Time,
      duration: 30,
      status: AppointmentStatus.CONFIRMED,
      reasonForVisit: 'Regular checkup - Blood pressure monitoring',
      notes: 'Patient has history of hypertension',
      createdById: receptionist.id,
      confirmedAt: new Date(),
    },
  });

  // Appointment 2: Maria Garcia with Cardiology (10:00 AM)
  const appointment2Time = new Date(today);
  appointment2Time.setHours(10, 0, 0, 0);

  const appointment2 = await prisma.appointment.create({
    data: {
      patientId: patient2.patientProfile!.id,
      doctorId: cardiologyDoctor.doctorProfile!.id,
      appointmentDate: appointment2Time,
      duration: 30,
      status: AppointmentStatus.SCHEDULED,
      reasonForVisit: 'Chest pain consultation',
      createdById: receptionist.id,
    },
  });

  // Appointment 3: Robert Kim with Pediatrics (11:00 AM)
  const appointment3Time = new Date(today);
  appointment3Time.setHours(11, 0, 0, 0);

  const appointment3 = await prisma.appointment.create({
    data: {
      patientId: patient3.patientProfile!.id,
      doctorId: pediatricsDoctor.doctorProfile!.id,
      appointmentDate: appointment3Time,
      duration: 30,
      status: AppointmentStatus.CONFIRMED,
      reasonForVisit: 'Asthma follow-up',
      notes: 'Recent asthma attack last week',
      createdById: receptionist.id,
      confirmedAt: new Date(),
    },
  });

  console.log('✅ Created 3 appointments for today');

  // ============================================================
  // 6. CREATE QUEUE TICKETS
  // ============================================================
  const queueDate = new Date();
  queueDate.setHours(0, 0, 0, 0);

  const queueTicket1 = await prisma.queueTicket.create({
    data: {
      queueNumber: 1,
      queueDate: queueDate,
      patientId: patient1.patientProfile!.id,
      doctorId: cardiologyDoctor.doctorProfile!.id,
      appointmentId: appointment1.id,
      status: QueueStatus.WAITING,
      priority: 0,
      station: 'Room 201',
      estimatedWaitMinutes: 15,
    },
  });

  const queueTicket2 = await prisma.queueTicket.create({
    data: {
      queueNumber: 2,
      queueDate: queueDate,
      patientId: patient2.patientProfile!.id,
      doctorId: cardiologyDoctor.doctorProfile!.id,
      appointmentId: appointment2.id,
      status: QueueStatus.WAITING,
      priority: 0,
      station: 'Room 201',
      estimatedWaitMinutes: 45,
    },
  });

  const queueTicket3 = await prisma.queueTicket.create({
    data: {
      queueNumber: 3,
      queueDate: queueDate,
      patientId: patient3.patientProfile!.id,
      doctorId: pediatricsDoctor.doctorProfile!.id,
      appointmentId: appointment3.id,
      status: QueueStatus.WAITING,
      priority: 1, // Higher priority due to chronic condition
      station: 'Room 202',
      estimatedWaitMinutes: 30,
    },
  });

  console.log('✅ Created 3 queue tickets');

  // ============================================================
  // 7. CREATE SAMPLE MEDICAL RECORD WITH PRESCRIPTION
  // ============================================================
  
  // Create a past medical record for John Doe
  const pastVisitDate = new Date();
  pastVisitDate.setDate(pastVisitDate.getDate() - 7); // 7 days ago

  const medicalRecord1 = await prisma.medicalRecord.create({
    data: {
      patientId: patient1.patientProfile!.id,
      doctorId: cardiologyDoctor.id,
      visitDate: pastVisitDate,
      subjective: 'Patient reports occasional chest discomfort and elevated blood pressure readings at home (averaging 145/95). No acute symptoms today.',
      objective: 'BP: 142/92 mmHg, HR: 78 bpm, Temp: 36.8°C. Cardiovascular exam: Regular rate and rhythm, no murmurs. Lungs clear bilaterally.',
      assessment: 'Uncontrolled hypertension (I10). Patient\'s current medication regimen appears insufficient.',
      plan: 'Increase Lisinopril dosage. Schedule follow-up in 2 weeks to reassess blood pressure control. Patient educated on dietary modifications and regular exercise.',
      vitals: {
        temperature: 36.8,
        bloodPressure: '142/92',
        heartRate: 78,
        weight: 85,
        height: 178,
        oxygenSaturation: 98,
      },
      followUpDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from past visit
      followUpNotes: 'Monitor blood pressure twice daily and maintain log',
    },
  });

  const prescription1 = await prisma.prescription.create({
    data: {
      medicalRecordId: medicalRecord1.id,
      doctorId: cardiologyDoctor.id,
      medicationName: 'Lisinopril',
      dosage: '20mg',
      frequency: 'Once daily in the morning',
      duration: '30 days',
      instructions: 'Take with or without food. Monitor blood pressure regularly.',
      quantity: 30,
      prescribedDate: pastVisitDate,
      startDate: pastVisitDate,
      endDate: new Date(pastVisitDate.getTime() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  });

  console.log('✅ Created sample medical record with prescription');

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n🎉 Database seeding completed successfully!\n');
  console.log('📊 Summary:');
  console.log('  - 1 Admin account');
  console.log('  - 2 Doctor accounts (Cardiology, Pediatrics)');
  console.log('  - 1 Receptionist account');
  console.log('  - 3 Patient accounts with RFID cards');
  console.log('  - 3 Active appointments for today');
  console.log('  - 3 Queue tickets ready for triage');
  console.log('  - 1 Sample medical record with prescription\n');
  
  console.log('Seeded accounts use unique random passwords. Use the approved password recovery flow to activate them.');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

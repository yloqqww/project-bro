# System Architecture - Phase 1

## Overview

The Clinic Management System is built as a **monorepo** using **Turborepo** with npm workspaces, containing a web portal, mobile app, and shared packages.

## Technology Stack

### Frontend
- **Web Portal**: Next.js 14+ (App Router, React Server Components)
- **Mobile App**: Expo SDK 50+ (React Native, Expo Router)
- **Styling**: Tailwind CSS (web), NativeWind (mobile)
- **Type Safety**: TypeScript 5.3+

### Backend
- **API Layer**: Next.js API Routes (web portal)
- **Database**: PostgreSQL 14+
- **ORM**: Prisma 5.8+
- **Validation**: Zod schemas

### DevOps
- **Monorepo**: Turborepo
- **Package Manager**: npm workspaces
- **Version Control**: Git
- **Development**: Hot reload, fast refresh

## Monorepo Structure

```
clinic-management-system/
├── apps/
│   ├── web/                    # Next.js web application
│   └── mobile/                 # Expo mobile application
├── packages/
│   ├── db/                     # Database layer (Prisma)
│   └── types/                  # Shared types and validation
├── package.json                # Root workspace configuration
└── turbo.json                 # Turborepo pipeline configuration
```

## Application Layers

### 1. Presentation Layer

#### Web Portal (`apps/web`)
**Purpose**: Administrative and staff interface

**Features**:
- Admin dashboard and user management
- Doctor consultation interface
- Reception desk and queue management
- Appointment scheduling
- Medical record entry (SOAP notes)
- Prescription management

**Technology**:
- Next.js 14 App Router
- React Server Components for data fetching
- Client Components for interactivity
- Tailwind CSS for styling

**Routes** (proposed):
```
/                          # Landing page
/login                     # Authentication
/admin/                    # Admin dashboard
  ├── users                # User management
  ├── doctors              # Doctor profiles
  └── system               # System settings
/doctor/                   # Doctor interface
  ├── queue                # Today's queue
  ├── appointments         # Appointment calendar
  ├── patients/:id         # Patient details
  └── records/new          # Create medical record
/reception/                # Reception interface
  ├── check-in             # RFID check-in
  ├── queue                # Queue display
  ├── appointments         # Schedule appointments
  └── walk-in              # Register walk-ins
```

#### Mobile App (`apps/mobile`)
**Purpose**: Patient self-service interface

**Features**:
- View personal appointments
- Access medical records and prescriptions
- View queue position and estimated wait time
- RFID card information
- Profile management

**Technology**:
- Expo (managed workflow)
- Expo Router (file-based routing)
- NativeWind (Tailwind for React Native)
- React Native components

**Screens** (proposed):
```
/                          # Home/Dashboard
/login                     # Patient authentication
/appointments              # Appointment list
/appointments/[id]         # Appointment details
/records                   # Medical records history
/records/[id]              # Medical record details
/queue                     # Current queue status
/profile                   # Patient profile
/rfid                      # RFID card info
```

---

### 2. Data Access Layer

#### Database Package (`packages/db`)

**Structure**:
```
packages/db/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Development seed data
├── index.ts               # Prisma Client export
└── package.json
```

**Key Features**:
- **Single Prisma Client instance** (singleton pattern)
- **Connection pooling** for production
- **Development logging** for debugging
- **Type-safe database queries**

**Usage**:
```typescript
import { prisma } from '@clinic/db';

// All queries are fully typed
const patients = await prisma.patientProfile.findMany({
  include: { rfidCards: true }
});
```

---

### 3. Business Logic Layer

#### Types Package (`packages/types`)

**Structure**:
```
packages/types/
├── schemas/
│   ├── user.ts            # User validation schemas
│   ├── patient.ts         # Patient schemas
│   ├── doctor.ts          # Doctor schemas
│   ├── appointment.ts     # Appointment schemas
│   ├── queue.ts           # Queue schemas
│   ├── medical-record.ts  # Medical record schemas
│   └── rfid.ts            # RFID schemas
└── index.ts               # Re-exports
```

**Purpose**:
- **Input validation** using Zod
- **Type inference** from schemas
- **Shared models** across web and mobile
- **API contract** enforcement

**Example**:
```typescript
import { CreateAppointmentSchema, type CreateAppointmentInput } from '@clinic/types';

// Runtime validation
const result = CreateAppointmentSchema.parse(formData);

// TypeScript types
function createAppointment(data: CreateAppointmentInput) {
  // data is fully typed
}
```

---

## Data Flow

### Example: Patient Check-in via RFID

```
┌─────────────────┐
│  RFID Scanner   │
│  (Hardware)     │
└────────┬────────┘
         │ Card UID: "A1B2C3D4"
         ▼
┌─────────────────┐
│  Reception UI   │  1. Scan RFID card
│  (Web Portal)   │
└────────┬────────┘
         │ POST /api/rfid/scan
         ▼
┌─────────────────┐
│  API Route      │  2. Validate card UID (Zod)
│  (Next.js)      │  3. Query database
└────────┬────────┘
         │ prisma.rfidCard.findUnique()
         ▼
┌─────────────────┐
│  Database       │  4. Return patient profile
│  (PostgreSQL)   │
└────────┬────────┘
         │ Patient data + appointments
         ▼
┌─────────────────┐
│  Queue Service  │  5. Create queue ticket
│  (API Route)    │  6. Auto-increment queue number
└────────┬────────┘
         │ QueueTicket created
         ▼
┌─────────────────┐
│  Reception UI   │  7. Display patient info
│                 │  8. Show queue number
└─────────────────┘
```

### Example: Doctor Creating Medical Record

```
┌─────────────────┐
│  Doctor UI      │  1. Fill SOAP notes form
│  (Web Portal)   │  2. Add vitals (JSON)
└────────┬────────┘
         │ POST /api/medical-records
         ▼
┌─────────────────┐
│  API Route      │  3. Validate with Zod schema
│  (Next.js)      │  4. Check authorization
└────────┬────────┘
         │ CreateMedicalRecordSchema.parse()
         ▼
┌─────────────────┐
│  Database       │  5. Create medical record
│  (Prisma)       │  6. Store vitals as JSONB
└────────┬────────┘
         │ MedicalRecord + ID
         ▼
┌─────────────────┐
│  Prescription   │  7. Create prescriptions
│  Service        │     (if any)
└────────┬────────┘
         │ Prescription records
         ▼
┌─────────────────┐
│  Queue Update   │  8. Mark queue as completed
│                 │  9. Update appointment status
└─────────────────┘
```

---

## Security Architecture

### Authentication Strategy (Phase 1 - Basic)

**Current Implementation** (to be enhanced):
- Email/password authentication
- Bcrypt password hashing
- Role-based access control (RBAC)

**Recommended Enhancement** (Phase 2):
- NextAuth.js for session management
- JWT tokens for API authentication
- Refresh token rotation
- MFA for admin/doctor accounts

### Authorization Model

**Role Hierarchy**:
```
ADMIN
  └─ Full system access
     ├─ User management
     ├─ System configuration
     └─ All data access

DOCTOR
  └─ Clinical functions
     ├─ View assigned patients
     ├─ Create medical records
     ├─ Issue prescriptions
     └─ View queue

RECEPTIONIST
  └─ Front desk operations
     ├─ Patient check-in
     ├─ Appointment scheduling
     ├─ Queue management
     └─ View patient demographics (no medical records)

PATIENT
  └─ Self-service
     ├─ View own appointments
     ├─ View own medical records
     ├─ View prescriptions
     └─ Update profile
```

### Data Access Rules

**Row-Level Security** (to be implemented):
```typescript
// Doctors can only access their own appointments
const appointments = await prisma.appointment.findMany({
  where: {
    doctorId: currentUser.doctorProfile.id,
  }
});

// Patients can only access their own records
const records = await prisma.medicalRecord.findMany({
  where: {
    patientId: currentUser.patientProfile.id,
  }
});
```

---

## RFID Integration Architecture

### Virtual RFID Simulator (Phase 1)

**Purpose**: Simulate RFID card scanning without physical hardware

**Implementation**:
```
┌──────────────────────────┐
│  Simulator UI            │
│  (Web Component)         │
│                          │
│  [Input: Card UID]       │
│  [Button: Scan]          │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  RFID API Endpoint       │
│  POST /api/rfid/scan     │
│                          │
│  1. Validate UID format  │
│  2. Check card status    │
│  3. Return patient info  │
└──────────────────────────┘
```

**Card UID Format**:
- 8 hexadecimal characters
- Example: `A1B2C3D4`, `E5F6G7H8`
- Regex validation: `^[A-F0-9]{8}$/i`

### Future: Physical RFID Integration (Phase 2+)

**Hardware Options**:
- USB RFID readers (HID mode)
- Serial/RS232 readers
- Network-connected readers

**Integration Pattern**:
```
Physical Reader → USB/Serial → Web Serial API → Reception UI → API
```

---

## Queue Management System

### Queue Number Generation

**Algorithm**:
```typescript
// Daily auto-incrementing queue numbers
async function generateQueueNumber(date: Date): Promise<number> {
  const lastTicket = await prisma.queueTicket.findFirst({
    where: { queueDate: date },
    orderBy: { queueNumber: 'desc' },
  });
  
  return (lastTicket?.queueNumber ?? 0) + 1;
}
```

### Priority System

**Priority Levels**:
- `0`: Normal (walk-ins, regular appointments)
- `1-5`: Elevated (chronic conditions, follow-ups)
- `6-10`: Emergency (severe symptoms, critical cases)

**Queue Sorting**:
```sql
ORDER BY priority DESC, queueNumber ASC
```

### Real-time Updates (Future)

**Proposed Technologies**:
- Server-Sent Events (SSE)
- WebSockets
- Polling (current fallback)

---

## Performance Considerations

### Database Optimization

**Indexes** (already implemented):
- Foreign keys: All relations indexed
- Lookup fields: email, cardUid, phoneNumber
- Composite: (appointmentDate, doctorId), (queueDate, queueNumber)

**Query Optimization**:
```typescript
// Use select to limit fields
const appointments = await prisma.appointment.findMany({
  select: {
    id: true,
    appointmentDate: true,
    patient: { select: { firstName: true, lastName: true } },
    doctor: { select: { firstName: true, lastName: true } },
  }
});

// Use pagination for large datasets
const records = await prisma.medicalRecord.findMany({
  take: 20,
  skip: page * 20,
  orderBy: { visitDate: 'desc' },
});
```

### Caching Strategy (Future)

**Recommended**:
- Redis for session storage
- Next.js revalidation for static data
- SWR/React Query for client-side caching

---

## Deployment Architecture (Future)

### Recommended Setup

```
┌─────────────────────────────────────┐
│  Load Balancer (HTTPS)              │
└───────────┬─────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│  Next.js App (Vercel/Docker)        │
│  - Web Portal                       │
│  - API Routes                       │
└───────────┬─────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│  PostgreSQL Database                │
│  - Primary (RW)                     │
│  - Replica (RO) - optional          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Mobile App Distribution            │
│  - iOS: TestFlight → App Store      │
│  - Android: Internal → Play Store   │
└─────────────────────────────────────┘
```

### Environment Separation

```
Development  → Local PostgreSQL, Prisma Studio
Staging      → Cloud PostgreSQL, Preview deployments
Production   → Managed PostgreSQL, CDN, Backups
```

---

## MVP Scope Summary

### ✅ Phase 1 (Current)

- [x] Monorepo architecture with Turborepo
- [x] Complete database schema with Prisma
- [x] Shared TypeScript types with Zod validation
- [x] Next.js web portal scaffolding
- [x] Expo mobile app scaffolding
- [x] Development seed data
- [x] RFID card data model

### 🔨 Phase 1 (Next Steps)

- [ ] Authentication system (NextAuth.js)
- [ ] API routes implementation
- [ ] Reception check-in UI
- [ ] Virtual RFID simulator component
- [ ] Queue management UI
- [ ] Appointment scheduling UI
- [ ] Basic medical record entry form
- [ ] Doctor dashboard

### 🚀 Phase 2+ (Future)

- [ ] Real-time queue updates
- [ ] Physical RFID hardware integration
- [ ] Advanced reporting and analytics
- [ ] Prescription printing
- [ ] Patient portal enhancements
- [ ] Mobile app push notifications
- [ ] Telemedicine integration

---

## Development Workflow

### Starting Development

```bash
# Install dependencies
npm install

# Set up database
npm run db:generate
npm run db:push
npm run db:seed

# Start all apps
npm run dev
```

### Making Changes

```bash
# Add a new API route
touch apps/web/src/app/api/patients/route.ts

# Update database schema
# 1. Edit packages/db/prisma/schema.prisma
# 2. Push changes
npm run db:push

# Create new validation schema
touch packages/types/schemas/new-entity.ts
# Export from packages/types/index.ts
```

### Testing

```bash
# Run all linters
npm run lint

# Test database connection
npm run db:studio

# Build all apps
npm run build
```

---

## Troubleshooting

### Common Issues

**Prisma Client not found**:
```bash
cd packages/db
npm run db:generate
```

**Port already in use**:
```bash
# Kill process on port 3000
npx kill-port 3000
```

**Database connection failed**:
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Ensure database exists

**Turbo cache issues**:
```bash
npx turbo clean
rm -rf node_modules
npm install
```

---

## Next Steps

1. Implement authentication system
2. Build RFID check-in flow
3. Create queue management interface
4. Develop appointment scheduling
5. Build medical record entry form
6. Test end-to-end patient flow

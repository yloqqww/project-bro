
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  password: 'password',
  role: 'role',
  isActive: 'isActive',
  passwordActivatedAt: 'passwordActivatedAt',
  lastPasswordChangeAt: 'lastPasswordChangeAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PatientAccountTokenScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  tokenHash: 'tokenHash',
  expiresAt: 'expiresAt',
  usedAt: 'usedAt',
  createdAt: 'createdAt'
};

exports.Prisma.MobileSessionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  tokenHash: 'tokenHash',
  deviceName: 'deviceName',
  userAgent: 'userAgent',
  ipAddress: 'ipAddress',
  lastUsedAt: 'lastUsedAt',
  expiresAt: 'expiresAt',
  revokedAt: 'revokedAt',
  createdAt: 'createdAt'
};

exports.Prisma.PatientPushDeviceScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  expoPushToken: 'expoPushToken',
  platform: 'platform',
  deviceName: 'deviceName',
  enabled: 'enabled',
  lastSeenAt: 'lastSeenAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PatientProfileScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  firstName: 'firstName',
  lastName: 'lastName',
  middleName: 'middleName',
  dateOfBirth: 'dateOfBirth',
  gender: 'gender',
  phoneNumber: 'phoneNumber',
  address: 'address',
  city: 'city',
  state: 'state',
  zipCode: 'zipCode',
  bloodType: 'bloodType',
  allergies: 'allergies',
  chronicConditions: 'chronicConditions',
  emergencyContactName: 'emergencyContactName',
  emergencyContactPhone: 'emergencyContactPhone',
  emergencyContactRelation: 'emergencyContactRelation',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RfidCardScalarFieldEnum = {
  id: 'id',
  cardUid: 'cardUid',
  status: 'status',
  patientId: 'patientId',
  issuedAt: 'issuedAt',
  expiresAt: 'expiresAt',
  revokedAt: 'revokedAt',
  revokedReason: 'revokedReason',
  lastScannedAt: 'lastScannedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DoctorProfileScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  firstName: 'firstName',
  lastName: 'lastName',
  specialization: 'specialization',
  licenseNumber: 'licenseNumber',
  roomNumber: 'roomNumber',
  isActive: 'isActive',
  availableFrom: 'availableFrom',
  availableTo: 'availableTo',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DoctorScheduleScalarFieldEnum = {
  id: 'id',
  doctorId: 'doctorId',
  slotDuration: 'slotDuration',
  maxPatientsPerDay: 'maxPatientsPerDay',
  bufferMinutes: 'bufferMinutes',
  timezone: 'timezone',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DoctorWeeklyAvailabilityScalarFieldEnum = {
  id: 'id',
  scheduleId: 'scheduleId',
  dayOfWeek: 'dayOfWeek',
  enabled: 'enabled',
  startTime: 'startTime',
  endTime: 'endTime',
  breakStart: 'breakStart',
  breakEnd: 'breakEnd',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DoctorScheduleExceptionScalarFieldEnum = {
  id: 'id',
  doctorId: 'doctorId',
  date: 'date',
  type: 'type',
  startTime: 'startTime',
  endTime: 'endTime',
  reason: 'reason',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DoctorLeaveRequestScalarFieldEnum = {
  id: 'id',
  doctorId: 'doctorId',
  date: 'date',
  message: 'message',
  status: 'status',
  adminReply: 'adminReply',
  exceptionId: 'exceptionId',
  createdAt: 'createdAt',
  reviewedAt: 'reviewedAt'
};

exports.Prisma.StaffProfileScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  firstName: 'firstName',
  lastName: 'lastName',
  specialty: 'specialty',
  roomNumber: 'roomNumber',
  phoneNumber: 'phoneNumber',
  licenseNumber: 'licenseNumber',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AppointmentScalarFieldEnum = {
  id: 'id',
  patientId: 'patientId',
  doctorId: 'doctorId',
  appointmentDate: 'appointmentDate',
  duration: 'duration',
  status: 'status',
  reasonForVisit: 'reasonForVisit',
  notes: 'notes',
  createdById: 'createdById',
  confirmedAt: 'confirmedAt',
  patientConfirmedAt: 'patientConfirmedAt',
  patientConfirmationSource: 'patientConfirmationSource',
  checkedInAt: 'checkedInAt',
  completedAt: 'completedAt',
  cancelledAt: 'cancelledAt',
  cancellationReason: 'cancellationReason',
  cancelledByRole: 'cancelledByRole',
  cancellationPolicyResult: 'cancellationPolicyResult',
  noShowMarkedAt: 'noShowMarkedAt',
  noShowMarkedBy: 'noShowMarkedBy',
  rescheduledFromId: 'rescheduledFromId',
  followUpFromRecordId: 'followUpFromRecordId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AppointmentWaitlistEntryScalarFieldEnum = {
  id: 'id',
  patientId: 'patientId',
  doctorId: 'doctorId',
  requestedDate: 'requestedDate',
  reasonForVisit: 'reasonForVisit',
  notes: 'notes',
  status: 'status',
  offeredAt: 'offeredAt',
  offerExpiresAt: 'offerExpiresAt',
  offeredSlot: 'offeredSlot',
  bookedAppointmentId: 'bookedAppointmentId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AppointmentReminderScalarFieldEnum = {
  id: 'id',
  appointmentId: 'appointmentId',
  reminderType: 'reminderType',
  scheduledFor: 'scheduledFor',
  status: 'status',
  deliveryChannel: 'deliveryChannel',
  sentAt: 'sentAt',
  lastError: 'lastError',
  dedupeKey: 'dedupeKey',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AppointmentBookingClaimScalarFieldEnum = {
  id: 'id',
  appointmentId: 'appointmentId',
  patientId: 'patientId',
  tokenHash: 'tokenHash',
  expiresAt: 'expiresAt',
  claimedAt: 'claimedAt',
  claimedEmail: 'claimedEmail',
  createdAt: 'createdAt'
};

exports.Prisma.QueueTicketScalarFieldEnum = {
  id: 'id',
  queueNumber: 'queueNumber',
  queueDate: 'queueDate',
  patientId: 'patientId',
  doctorId: 'doctorId',
  appointmentId: 'appointmentId',
  status: 'status',
  priority: 'priority',
  station: 'station',
  calledAt: 'calledAt',
  startedAt: 'startedAt',
  completedAt: 'completedAt',
  estimatedWaitMinutes: 'estimatedWaitMinutes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MedicalRecordScalarFieldEnum = {
  id: 'id',
  patientId: 'patientId',
  doctorId: 'doctorId',
  appointmentId: 'appointmentId',
  queueTicketId: 'queueTicketId',
  visitDate: 'visitDate',
  subjective: 'subjective',
  objective: 'objective',
  assessment: 'assessment',
  plan: 'plan',
  vitals: 'vitals',
  followUpDate: 'followUpDate',
  followUpNotes: 'followUpNotes',
  status: 'status',
  version: 'version',
  parentRecordId: 'parentRecordId',
  amendmentReason: 'amendmentReason',
  finalizedAt: 'finalizedAt',
  finalizedById: 'finalizedById',
  finalizedByName: 'finalizedByName',
  contentHash: 'contentHash',
  archivedAt: 'archivedAt',
  archivedById: 'archivedById',
  archiveReason: 'archiveReason',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MedicalRecordAttachmentScalarFieldEnum = {
  id: 'id',
  medicalRecordId: 'medicalRecordId',
  fileName: 'fileName',
  mimeType: 'mimeType',
  fileSize: 'fileSize',
  checksum: 'checksum',
  data: 'data',
  uploadedById: 'uploadedById',
  archivedAt: 'archivedAt',
  archiveReason: 'archiveReason',
  createdAt: 'createdAt'
};

exports.Prisma.PrescriptionScalarFieldEnum = {
  id: 'id',
  medicalRecordId: 'medicalRecordId',
  doctorId: 'doctorId',
  medicationName: 'medicationName',
  dosage: 'dosage',
  frequency: 'frequency',
  duration: 'duration',
  instructions: 'instructions',
  quantity: 'quantity',
  prescribedDate: 'prescribedDate',
  startDate: 'startDate',
  endDate: 'endDate',
  isActive: 'isActive',
  eSignedAt: 'eSignedAt',
  eSignatureName: 'eSignatureName',
  eSignatureLicense: 'eSignatureLicense',
  eSignatureHash: 'eSignatureHash',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ClinicSettingsScalarFieldEnum = {
  id: 'id',
  clinicName: 'clinicName',
  shortName: 'shortName',
  hotline: 'hotline',
  address: 'address',
  emergencyNotice: 'emergencyNotice',
  queueResetTime: 'queueResetTime',
  queuePrefixes: 'queuePrefixes',
  timezone: 'timezone',
  operatingDays: 'operatingDays',
  holidayDates: 'holidayDates',
  appointmentLeadTimeHours: 'appointmentLeadTimeHours',
  bookingHorizonDays: 'bookingHorizonDays',
  appointmentCancellationNoticeHours: 'appointmentCancellationNoticeHours',
  appointmentNoShowGraceMinutes: 'appointmentNoShowGraceMinutes',
  appointmentReminderLeadHours: 'appointmentReminderLeadHours',
  triagePriorityRules: 'triagePriorityRules',
  notificationRetentionDays: 'notificationRetentionDays',
  updatedById: 'updatedById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AdminNotificationScalarFieldEnum = {
  id: 'id',
  type: 'type',
  category: 'category',
  title: 'title',
  message: 'message',
  staffName: 'staffName',
  staffEmail: 'staffEmail',
  staffRole: 'staffRole',
  staffSpecialty: 'staffSpecialty',
  staffRoom: 'staffRoom',
  metadata: 'metadata',
  isRead: 'isRead',
  readAt: 'readAt',
  expiresAt: 'expiresAt',
  archivedAt: 'archivedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EmailDeliveryScalarFieldEnum = {
  id: 'id',
  recipient: 'recipient',
  subject: 'subject',
  template: 'template',
  status: 'status',
  provider: 'provider',
  messageId: 'messageId',
  attempts: 'attempts',
  maxAttempts: 'maxAttempts',
  nextAttemptAt: 'nextAttemptAt',
  lastAttemptAt: 'lastAttemptAt',
  sentAt: 'sentAt',
  lastError: 'lastError',
  payload: 'payload',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SystemAuditLogScalarFieldEnum = {
  id: 'id',
  actorId: 'actorId',
  actorEmail: 'actorEmail',
  actorRole: 'actorRole',
  action: 'action',
  targetType: 'targetType',
  targetId: 'targetId',
  summary: 'summary',
  ipAddress: 'ipAddress',
  userAgent: 'userAgent',
  metadata: 'metadata',
  createdAt: 'createdAt'
};

exports.Prisma.ClinicalConversationScalarFieldEnum = {
  id: 'id',
  queueTicketId: 'queueTicketId',
  patientId: 'patientId',
  doctorId: 'doctorId',
  createdById: 'createdById',
  status: 'status',
  resolvedAt: 'resolvedAt',
  resolvedById: 'resolvedById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ClinicalMessageScalarFieldEnum = {
  id: 'id',
  conversationId: 'conversationId',
  senderId: 'senderId',
  recipientId: 'recipientId',
  senderName: 'senderName',
  senderRole: 'senderRole',
  recipientRole: 'recipientRole',
  body: 'body',
  priority: 'priority',
  readAt: 'readAt',
  acknowledgedAt: 'acknowledgedAt',
  createdAt: 'createdAt'
};

exports.Prisma.StaffAnnouncementScalarFieldEnum = {
  id: 'id',
  createdById: 'createdById',
  creatorName: 'creatorName',
  targetRole: 'targetRole',
  title: 'title',
  body: 'body',
  priority: 'priority',
  createdAt: 'createdAt'
};

exports.Prisma.StaffAnnouncementReadScalarFieldEnum = {
  id: 'id',
  announcementId: 'announcementId',
  userId: 'userId',
  readAt: 'readAt'
};

exports.Prisma.TriageAssessmentScalarFieldEnum = {
  id: 'id',
  triageNumber: 'triageNumber',
  patientId: 'patientId',
  patientName: 'patientName',
  age: 'age',
  gender: 'gender',
  cardUid: 'cardUid',
  bloodPressure: 'bloodPressure',
  heartRate: 'heartRate',
  temperature: 'temperature',
  respiratoryRate: 'respiratoryRate',
  oxygenSaturation: 'oxygenSaturation',
  weightKg: 'weightKg',
  heightCm: 'heightCm',
  bmi: 'bmi',
  chiefComplaint: 'chiefComplaint',
  symptomsDuration: 'symptomsDuration',
  painScore: 'painScore',
  department: 'department',
  priorityLevel: 'priorityLevel',
  nurseId: 'nurseId',
  nurseName: 'nurseName',
  status: 'status',
  opdQueueTicketId: 'opdQueueTicketId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.UserRole = exports.$Enums.UserRole = {
  ADMIN: 'ADMIN',
  DOCTOR: 'DOCTOR',
  RECEPTIONIST: 'RECEPTIONIST',
  PATIENT: 'PATIENT',
  NURSE: 'NURSE'
};

exports.PatientAccountTokenType = exports.$Enums.PatientAccountTokenType = {
  ACTIVATION: 'ACTIVATION',
  PASSWORD_RESET: 'PASSWORD_RESET'
};

exports.BloodType = exports.$Enums.BloodType = {
  A_POSITIVE: 'A_POSITIVE',
  A_NEGATIVE: 'A_NEGATIVE',
  B_POSITIVE: 'B_POSITIVE',
  B_NEGATIVE: 'B_NEGATIVE',
  AB_POSITIVE: 'AB_POSITIVE',
  AB_NEGATIVE: 'AB_NEGATIVE',
  O_POSITIVE: 'O_POSITIVE',
  O_NEGATIVE: 'O_NEGATIVE',
  UNKNOWN: 'UNKNOWN'
};

exports.RfidCardStatus = exports.$Enums.RfidCardStatus = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  LOST: 'LOST',
  EXPIRED: 'EXPIRED'
};

exports.ScheduleExceptionType = exports.$Enums.ScheduleExceptionType = {
  LEAVE: 'LEAVE',
  HOLIDAY: 'HOLIDAY',
  UNAVAILABLE: 'UNAVAILABLE'
};

exports.AppointmentStatus = exports.$Enums.AppointmentStatus = {
  SCHEDULED: 'SCHEDULED',
  CONFIRMED: 'CONFIRMED',
  CHECKED_IN: 'CHECKED_IN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW'
};

exports.AppointmentWaitlistStatus = exports.$Enums.AppointmentWaitlistStatus = {
  WAITING: 'WAITING',
  OFFERED: 'OFFERED',
  BOOKED: 'BOOKED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED'
};

exports.AppointmentReminderStatus = exports.$Enums.AppointmentReminderStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

exports.QueueStatus = exports.$Enums.QueueStatus = {
  WAITING: 'WAITING',
  CALLED: 'CALLED',
  IN_CONSULTATION: 'IN_CONSULTATION',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW'
};

exports.MedicalRecordStatus = exports.$Enums.MedicalRecordStatus = {
  DRAFT: 'DRAFT',
  FINALIZED: 'FINALIZED',
  AMENDED: 'AMENDED'
};

exports.EmailDeliveryStatus = exports.$Enums.EmailDeliveryStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  SIMULATED: 'SIMULATED'
};

exports.Prisma.ModelName = {
  User: 'User',
  PatientAccountToken: 'PatientAccountToken',
  MobileSession: 'MobileSession',
  PatientPushDevice: 'PatientPushDevice',
  PatientProfile: 'PatientProfile',
  RfidCard: 'RfidCard',
  DoctorProfile: 'DoctorProfile',
  DoctorSchedule: 'DoctorSchedule',
  DoctorWeeklyAvailability: 'DoctorWeeklyAvailability',
  DoctorScheduleException: 'DoctorScheduleException',
  DoctorLeaveRequest: 'DoctorLeaveRequest',
  StaffProfile: 'StaffProfile',
  Appointment: 'Appointment',
  AppointmentWaitlistEntry: 'AppointmentWaitlistEntry',
  AppointmentReminder: 'AppointmentReminder',
  AppointmentBookingClaim: 'AppointmentBookingClaim',
  QueueTicket: 'QueueTicket',
  MedicalRecord: 'MedicalRecord',
  MedicalRecordAttachment: 'MedicalRecordAttachment',
  Prescription: 'Prescription',
  ClinicSettings: 'ClinicSettings',
  AdminNotification: 'AdminNotification',
  EmailDelivery: 'EmailDelivery',
  SystemAuditLog: 'SystemAuditLog',
  ClinicalConversation: 'ClinicalConversation',
  ClinicalMessage: 'ClinicalMessage',
  StaffAnnouncement: 'StaffAnnouncement',
  StaffAnnouncementRead: 'StaffAnnouncementRead',
  TriageAssessment: 'TriageAssessment'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)

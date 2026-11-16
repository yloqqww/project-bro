import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCESS, canAccessPatient, roleAllowed, roleMatchesLoginPortal } from '../src/lib/access-policy.ts';

test('only administrators may use staff administration', () => {
  assert.equal(roleAllowed('ADMIN', ACCESS.admin), true);
  for (const role of ['DOCTOR', 'NURSE', 'RECEPTIONIST', 'PATIENT']) {
    assert.equal(roleAllowed(role, ACCESS.admin), false);
  }
});

test('clinical writes are doctor-only', () => {
  assert.equal(roleAllowed('DOCTOR', ACCESS.medicalRecordWrite), true);
  assert.equal(roleAllowed('ADMIN', ACCESS.medicalRecordWrite), false);
  assert.equal(roleAllowed('PATIENT', ACCESS.prescriptionWrite), false);
});

test('triage nurses have read-only records while reception is limited to operational patient fields', () => {
  assert.equal(roleAllowed('NURSE', ACCESS.medicalRecordRead), true);
  assert.equal(roleAllowed('RECEPTIONIST', ACCESS.medicalRecordRead), false);
  assert.equal(roleAllowed('NURSE', ACCESS.medicalRecordWrite), false);
  assert.equal(roleAllowed('RECEPTIONIST', ACCESS.medicalRecordWrite), false);
});

test('patients cannot access another patient id', () => {
  assert.equal(canAccessPatient('PATIENT', 'patient-a', 'patient-a'), true);
  assert.equal(canAccessPatient('PATIENT', 'patient-a', 'patient-b'), false);
  assert.equal(canAccessPatient('PATIENT', null, 'patient-b'), false);
});

test('selecting another UI role cannot grant that role policy', () => {
  assert.equal(roleAllowed('NURSE', ACCESS.queueClinicalUpdate), false);
  assert.equal(roleAllowed('RECEPTIONIST', ACCESS.queueClinicalUpdate), false);
  assert.equal(roleAllowed('PATIENT', ACCESS.admin), false);
});

test('login credentials must match the selected portal role', () => {
  assert.equal(roleMatchesLoginPortal('ADMIN', 'ADMIN'), true);
  assert.equal(roleMatchesLoginPortal('NURSE', 'NURSE'), true);
  assert.equal(roleMatchesLoginPortal('ADMIN', 'NURSE'), false);
  assert.equal(roleMatchesLoginPortal('NURSE', 'ADMIN'), false);
  assert.equal(roleMatchesLoginPortal('PATIENT', 'NURSE'), false);
  assert.equal(roleMatchesLoginPortal('ADMIN', ''), false);
});

test('staff messaging separates clinical handoffs from admin announcements', () => {
  for (const role of ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST']) {
    assert.equal(roleAllowed(role, ACCESS.staffMessaging), true);
  }
  assert.equal(roleAllowed('PATIENT', ACCESS.staffMessaging), false);
  assert.equal(roleAllowed('ADMIN', ACCESS.clinicalHandoffWrite), false);
  assert.equal(roleAllowed('DOCTOR', ACCESS.clinicalHandoffWrite), true);
  assert.equal(roleAllowed('NURSE', ACCESS.clinicalHandoffWrite), true);
  assert.equal(roleAllowed('RECEPTIONIST', ACCESS.clinicalHandoffWrite), true);
  assert.equal(roleAllowed('ADMIN', ACCESS.staffAnnouncementWrite), true);
  assert.equal(roleAllowed('DOCTOR', ACCESS.staffAnnouncementWrite), false);
});

test('queue controls are limited to operational owners', () => {
  assert.equal(roleAllowed('ADMIN', ACCESS.queueManage), true);
  assert.equal(roleAllowed('DOCTOR', ACCESS.queueManage), true);
  assert.equal(roleAllowed('RECEPTIONIST', ACCESS.queueManage), true);
  assert.equal(roleAllowed('NURSE', ACCESS.queueManage), false);
  assert.equal(roleAllowed('PATIENT', ACCESS.queueManage), false);
});

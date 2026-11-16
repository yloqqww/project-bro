#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_S3_URI:?BACKUP_S3_URI is required}"
for command_name in aws jq; do
  command -v "$command_name" >/dev/null || { echo "Missing required command: $command_name" >&2; exit 1; }
done

gate_temp_dir="$(mktemp -d)"
trap 'rm -rf -- "$gate_temp_dir"' EXIT
prefix="${BACKUP_S3_URI%/}"
aws s3 cp "${prefix}/latest-success.json" "${gate_temp_dir}/backup.json" --only-show-errors
aws s3 cp "${prefix}/latest-restore-rehearsal.json" "${gate_temp_dir}/restore.json" --only-show-errors

node - "$gate_temp_dir" <<'NODE'
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
const backup = JSON.parse(fs.readFileSync(path.join(dir, 'backup.json'), 'utf8'));
const restore = JSON.parse(fs.readFileSync(path.join(dir, 'restore.json'), 'utf8'));
const now = Date.now();
const backupAgeHours = (now - Date.parse(backup.createdAt)) / 3_600_000;
const restoreAgeDays = (now - Date.parse(restore.completedAt)) / 86_400_000;
if (!Number.isFinite(backupAgeHours) || backupAgeHours > 26) throw new Error(`Production backup is stale: ${backupAgeHours.toFixed(1)} hours.`);
if (restore.status !== 'passed' || !Number.isFinite(restoreAgeDays) || restoreAgeDays > 35) throw new Error(`Restore rehearsal is missing or stale: ${restoreAgeDays.toFixed(1)} days.`);
console.log(`Release gates passed: backup ${backupAgeHours.toFixed(1)}h old; rehearsal ${restoreAgeDays.toFixed(1)}d old.`);
NODE

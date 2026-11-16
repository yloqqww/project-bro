CREATE OR REPLACE FUNCTION prevent_system_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'System audit logs are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "system_audit_logs_append_only" ON "system_audit_logs";
CREATE TRIGGER "system_audit_logs_append_only"
BEFORE UPDATE OR DELETE ON "system_audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_system_audit_log_mutation();

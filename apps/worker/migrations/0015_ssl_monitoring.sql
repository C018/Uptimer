-- SSL certificate expiry monitoring.

-- Per-monitor opt-in flags.
ALTER TABLE monitors ADD COLUMN ssl_check_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE monitors ADD COLUMN ssl_warn_days INTEGER NOT NULL DEFAULT 14;

-- Latest TLS certificate snapshot per monitor.
-- Kept in a dedicated table so monitors list queries stay untouched and
-- certificate facts are never mixed with probe liveness state.
CREATE TABLE IF NOT EXISTS monitor_ssl_state (
  monitor_id INTEGER PRIMARY KEY,
  hostname TEXT,
  port INTEGER,
  status TEXT NOT NULL,
  days_remaining INTEGER,
  valid_from INTEGER,
  valid_to INTEGER,
  issuer TEXT,
  subject TEXT,
  serial_number TEXT,
  last_error TEXT,
  checked_at INTEGER,
  last_notified_at INTEGER,
  last_notified_severity TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_monitor_ssl_state_checked_at
  ON monitor_ssl_state (checked_at);

CREATE INDEX IF NOT EXISTS idx_monitors_ssl_check_enabled
  ON monitors (ssl_check_enabled, is_active);

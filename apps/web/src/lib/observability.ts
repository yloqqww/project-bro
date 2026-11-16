import 'server-only';

type ErrorContext = Record<string, string | number | boolean | null | undefined>;

function safeContext(context: ErrorContext = {}) {
  return Object.fromEntries(
    Object.entries(context)
      .filter(([key]) => !/password|secret|token|authorization|cookie|patient|email/i.test(key))
      .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 500) : value]),
  );
}

async function postWebhook(url: string | undefined, payload: unknown) {
  if (!url) return false;
  if (process.env.NODE_ENV === 'production' && !url.startsWith('https://')) {
    console.error(JSON.stringify({ level: 'error', event: 'unsafe_observability_webhook', timestamp: new Date().toISOString() }));
    return false;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function reportServerError(error: unknown, context: ErrorContext = {}) {
  const normalized = error instanceof Error
    ? { name: error.name, message: error.message.slice(0, 1000), stack: error.stack?.slice(0, 8000) }
    : { name: 'UnknownError', message: String(error).slice(0, 1000) };
  const payload = {
    level: 'error',
    event: 'server_error',
    service: 'clinic-web',
    environment: process.env.DEPLOYMENT_ENV || process.env.NODE_ENV || 'unknown',
    release: process.env.APP_RELEASE || process.env.GITHUB_SHA || 'unknown',
    timestamp: new Date().toISOString(),
    error: normalized,
    context: safeContext(context),
  };
  console.error(JSON.stringify(payload));
  await postWebhook(process.env.ERROR_MONITOR_WEBHOOK_URL, payload);
}

export async function sendOperationalAlert(
  service: 'database' | 'email' | 'application' | 'backup' | 'deployment',
  status: 'degraded' | 'down' | 'recovered',
  context: ErrorContext = {},
) {
  const payload = {
    level: status === 'recovered' ? 'info' : 'critical',
    event: 'operational_alert',
    service,
    status,
    environment: process.env.DEPLOYMENT_ENV || process.env.NODE_ENV || 'unknown',
    release: process.env.APP_RELEASE || process.env.GITHUB_SHA || 'unknown',
    timestamp: new Date().toISOString(),
    fingerprint: `clinic-${service}-${status}`,
    context: safeContext(context),
  };
  console.log(JSON.stringify(payload));
  return postWebhook(process.env.ALERT_WEBHOOK_URL || process.env.ERROR_MONITOR_WEBHOOK_URL, payload);
}

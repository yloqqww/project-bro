export function getApiErrorMessage(error: unknown, fallback = 'Request failed.'): string {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  if (error && typeof error === 'object') {
    const errObj = error as { message?: unknown; code?: unknown; fields?: Record<string, unknown> };
    const baseMessage =
      (typeof errObj.message === 'string' && errObj.message.trim()) ||
      (typeof errObj.code === 'string' && errObj.code.trim()) ||
      '';
    if (errObj.fields && typeof errObj.fields === 'object') {
      const fieldMessages = Object.entries(errObj.fields).flatMap(([field, msgs]) =>
        Array.isArray(msgs)
          ? msgs.filter((m): m is string => typeof m === 'string' && Boolean(m.trim())).map((m) => `${field}: ${m}`)
          : typeof msgs === 'string' && msgs.trim()
          ? [`${field}: ${msgs}`]
          : []
      );
      if (fieldMessages.length > 0) {
        return baseMessage ? `${baseMessage} (${fieldMessages.join('; ')})` : fieldMessages.join('; ');
      }
    }
    if (baseMessage) {
      return baseMessage;
    }
  }
  return fallback;
}

export async function readJsonResponse<T = any>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`The server returned an empty response (${response.status}).`);
  }

  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && parsed.error && typeof parsed.error === 'object') {
      const message = getApiErrorMessage(parsed.error, `Request failed (${response.status}).`);
      Object.defineProperty(parsed.error, 'toString', {
        value: () => message,
        enumerable: false,
        configurable: true,
      });
    }
    return parsed as T;
  } catch {
    throw new Error(`The server returned an invalid response (${response.status}).`);
  }
}

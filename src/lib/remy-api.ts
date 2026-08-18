import { CONTROL_PLANE_URL, IS_CONFIGURED } from '@/lib/config';
import { getAccessToken } from '@/lib/supabase';
import type { RemyEvent, Site } from '@/lib/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * One authenticated request.
 *
 * `siteId` sets X-Remy-Home, which a shared site instance uses to decide which
 * home the request is for. Single-tenant instances ignore it, so it is always
 * safe to send.
 */
async function request<T>(
  baseUrl: string,
  path: string,
  opts: { siteId?: string; init?: RequestInit } = {}
): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new ApiError(401, 'Signed out');

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...opts.init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...(opts.siteId ? { 'X-Remy-Home': opts.siteId } : {}),
        ...opts.init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, `Can't reach ${hostOf(baseUrl)}`);
  }

  if (!res.ok) {
    throw new ApiError(res.status, await detailOf(res));
  }

  // A site that serves its web app from the same origin answers unknown paths
  // with 200 + index.html, so res.ok alone does not mean we reached the API.
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    throw new ApiError(
      res.status,
      `${hostOf(baseUrl)} returned ${contentType || 'an unknown type'} instead of JSON`
    );
  }

  return (await res.json()) as T;
}

async function detailOf(res: Response): Promise<string> {
  const body = await res.text().catch(() => '');
  try {
    // FastAPI puts the useful part in `detail`.
    const parsed = JSON.parse(body);
    if (typeof parsed?.detail === 'string') return parsed.detail;
  } catch {
    // Not JSON — fall through to the raw body.
  }
  return body || `${res.status} ${res.statusText}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

// --- control plane ---------------------------------------------------------

/** The homes this caregiver can see, with the access level they hold on each. */
export async function fetchSites(): Promise<Site[]> {
  if (!IS_CONFIGURED) {
    throw new ApiError(0, 'No control plane configured — set EXPO_PUBLIC_CONTROL_PLANE_URL');
  }
  const data = await request<{ sites: Site[] }>(CONTROL_PLANE_URL, '/me/sites');
  return data.sites ?? [];
}

// --- site instances --------------------------------------------------------

function endpointOf(site: Site): string {
  if (!site.endpoint) {
    throw new ApiError(0, `${site.name} has no endpoint registered`);
  }
  return site.endpoint.replace(/\/$/, '');
}

/**
 * The safety alerts for a home: events the pipeline flagged for caregiver
 * review. This is the app's main feed.
 */
export async function fetchSafetyAlerts(site: Site, limit = 50): Promise<RemyEvent[]> {
  const data = await request<{ events: RemyEvent[] }>(
    endpointOf(site),
    `/api/events/needs-review?limit=${limit}`,
    { siteId: site.id }
  );
  return data.events ?? [];
}

/** Everything recent, flagged or not — the "show me all activity" view. */
export async function fetchRecentEvents(site: Site, limit = 50): Promise<RemyEvent[]> {
  const data = await request<{ events: RemyEvent[] }>(
    endpointOf(site),
    `/api/events?limit=${limit}`,
    { siteId: site.id }
  );
  return data.events ?? [];
}

/** Detail view. The site wraps the event alongside its feedback history. */
export async function fetchEvent(site: Site, eventId: number): Promise<RemyEvent> {
  const data = await request<{ event: RemyEvent }>(
    endpointOf(site),
    `/api/events/${eventId}`,
    { siteId: site.id }
  );
  return data.event;
}

/**
 * Mark an event reviewed.
 *
 * The site models this as feedback: the literal type "reviewed" is the one value
 * that also flips event.reviewed (see EventService.add_feedback). Any other type
 * records an opinion without acknowledging.
 */
export async function acknowledgeEvent(site: Site, eventId: number): Promise<void> {
  await request(endpointOf(site), `/api/events/${eventId}/feedback`, {
    siteId: site.id,
    init: {
      method: 'POST',
      body: JSON.stringify({ feedback_type: 'reviewed' }),
    },
  });
}

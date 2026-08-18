/** Shapes returned by the remy-camera control plane and site instances. */

/** A monitored home. `endpoint` is the site instance the app talks to for events. */
export type Site = {
  id: string;
  name: string;
  deployment_type: 'cloud' | 'edge';
  endpoint: string | null;
  status: string;
  role: 'owner' | 'caregiver' | string;
  /** summary_only | summary_first | full_access — governs how much detail the site returns. */
  access_level: string;
};

/**
 * One event from a home's pipeline. Mirrors RemyEvent.to_dict() in
 * remy-camera/backend/app/models/remy_event.py — only the fields this app uses
 * are declared.
 */
export type RemyEvent = {
  id: number;
  remy_type: string;
  /** e.g. "stove_safety", "night_exit". Drives how urgent the row looks. */
  remy_category: string;
  room: string;
  camera_id: string | null;
  start_time: string;
  end_time: string | null;
  title: string | null;
  ai_summary: string | null;
  raw_summary: string | null;
  confidence: string | null;
  uncertainty_reason: string | null;
  evidence_status: string;
  /** Signed URL, present only when the event has a thumbnail. */
  thumbnail_url?: string;
  needs_review: boolean;
  reviewed: boolean;
  created_at: string;
};

/** How prominently an event is presented. Derived locally from its category. */
export type Severity = 'critical' | 'warning' | 'info';

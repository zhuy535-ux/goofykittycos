export type AvailabilityStatus = 'red' | 'yellow' | 'green';
export type Recurrence = 'None' | 'Weekly' | 'Monthly' | 'Yearly';
export type MeetingProvider = 'wechat' | 'tencent' | 'zoom' | 'google_meet';
// Category is freeform after the user picks "Other" — store as string.
export type Category = string;

export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  organization_id: string | null;
  role: 'admin' | 'member';
  timezone: string;
  sleep_start: number;
  sleep_end: number;
}

export interface Organization {
  id: string;
  name: string;
  invitation_code?: string;   // admins only
  created_by: string | null;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  start_iso: string;
  end_iso: string;
  timezone: string;
  category: Category;
  notes: string | null;
  alarm_iso: string | null;
  location: string | null;
  meeting_link: string | null;
  meeting_provider: MeetingProvider | null;
  recurrence: Recurrence;
  availability_status: AvailabilityStatus;
}

export interface Invitation {
  id: string;
  event_id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  message: string | null;
  event_title: string;
  start_iso: string;
  end_iso: string;
  meeting_link?: string | null;
  from_email: string;
  from_name: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  kind: 'invitation' | 'peer_note' | 'general';
  payload: Record<string, unknown>;
  read: 0 | 1;
  created_at: string;
}

export interface TeamNote {
  id: string;
  from_user_id: string;
  to_user_id: string;
  body: string;
  read: 0 | 1;
  created_at: string;
  from_name?: string | null;
  from_email?: string;
  to_name?: string | null;
  to_email?: string;
}

export interface WorkRemark {
  id: string;
  user_id: string;
  body: string;
  event_id: string | null;
  created_at: string;
}

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  done: 0 | 1;
  due_iso: string | null;
  created_at: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  event_id: string | null;
  link_name: string;
  url: string;
  created_at: string;
}

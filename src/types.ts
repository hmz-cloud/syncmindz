export type Lang = 'ar' | 'en';
export type TextScale = 'normal' | 'large' | 'xlarge';
export type ItemKind = 'alarm' | 'reminder';
export type Repeat = 'none' | 'daily' | 'weekly';
export type ItemStatus = 'pending' | 'scheduled' | 'snoozed' | 'done' | 'declined' | 'missed' | 'cancelled';
export type TrustLevel = 'auto' | 'ask' | 'blocked';

export interface Profile {
  id: string;
  display_name: string;
  avatar_color: string;
  language: Lang;
  simple_mode: boolean;
  text_scale: TextScale;
  invite_code: string;
}

export interface Connection {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  ended_at: string | null;
  created_at: string;
}

export interface TrustRule {
  owner_id: string;
  sender_id: string;
  level: TrustLevel;
  allow_alarms: boolean;
}

export interface Item {
  id: string;
  sender_id: string;
  receiver_id: string;
  kind: ItemKind;
  title: string;
  note: string | null;
  due_at: string;
  repeat: Repeat;
  status: ItemStatus;
  snooze_until: string | null;
  reply: string | null;
  done_at: string | null;
  created_at: string;
}

export interface NewItem {
  receiver_id: string;
  kind: ItemKind;
  title: string;
  note?: string;
  due_at: string;
  repeat: Repeat;
}

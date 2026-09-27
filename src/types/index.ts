export type TrustLevel = 'auto_accept' | 'require_approval' | 'blocked';

export type SyncItemType = 'alarm' | 'reminder' | 'calendar';

export type ItemCategory = 'health' | 'meds' | 'work' | 'urgent' | 'family' | 'personal';

export type AlarmSound = 'radar' | 'chime' | 'pulse' | 'siren' | 'zen';

export type SyncItemStatus = 
  | 'pending_approval' 
  | 'scheduled' 
  | 'ringing' 
  | 'snoozed' 
  | 'acknowledged' 
  | 'rejected' 
  | 'missed';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  deviceName: string;
  color: string;
  syncCode: string; // 6-digit pairing PIN e.g. "749210"
  relationship?: string; // e.g. "Partner", "Family", "Classmate", "Colleague"
  isOnline: boolean;
}

export interface TrustRule {
  targetUserId: string; // The user who is granted rights
  level: TrustLevel;
  allowAlarms: boolean;
  allowCalendar: boolean;
  allowReminders: boolean;
  allowLoudOverride: boolean;
  updatedAt: string;
}

export interface SyncItem {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  receiverId: string;
  receiverName: string;
  type: SyncItemType;
  title: string;
  notes?: string;
  targetDateTime: string; // ISO String
  category: ItemCategory;
  alarmSound: AlarmSound;
  status: SyncItemStatus;
  autoAccepted: boolean;
  repeat?: 'none' | 'daily' | 'weekdays' | 'weekly';
  createdAt: string;
  ringVolume: number; // 0.1 to 1.0
  snoozeUntil?: string; // ISO String
  triggeredAt?: string;
  acknowledgedAt?: string;
  responseNote?: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  receiverId: string;
  receiverName: string;
  type: 'auto_accept' | 'approval_needed' | 'manual_accept' | 'alarm_fired' | 'acknowledged' | 'snoozed' | 'created' | 'rejected' | 'rule_updated';
  title: string;
  details: string;
}

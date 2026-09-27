import { User, TrustRule, SyncItem, ActivityLog } from '../types';

const USERS_KEY = 'syncminds_users_v2';
const CURRENT_USER_KEY = 'syncminds_current_user_id_v2';
const TRUST_RULES_KEY = 'syncminds_trust_rules_v2';
const ITEMS_KEY = 'syncminds_items_v2';
const ACTIVITY_LOGS_KEY = 'syncminds_activity_logs_v2';

export const INITIAL_USERS: User[] = [
  {
    id: 'user_hassan',
    name: 'Hassan Zarroug',
    email: 'hassan.zarroug@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    deviceName: "Hassan's Pixel 9 Pro",
    color: '#3b82f6',
    syncCode: '749210',
    relationship: 'You',
    isOnline: true,
  },
  {
    id: 'user_sarah',
    name: 'Sarah Chen',
    email: 'sarah.chen@partner.net',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
    deviceName: "Sarah's iPhone 16",
    color: '#ec4899',
    syncCode: '839402',
    relationship: 'Partner / Best Friend',
    isOnline: true,
  },
  {
    id: 'user_mom',
    name: 'Mom (Amina)',
    email: 'amina.family@home.net',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80',
    deviceName: "Mom's Galaxy S24",
    color: '#10b981',
    syncCode: '512984',
    relationship: 'Family Caregiver',
    isOnline: true,
  },
  {
    id: 'user_omar',
    name: 'Omar Zarroug',
    email: 'omar.z@university.edu',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
    deviceName: "Omar's iPad Air",
    color: '#8b5cf6',
    syncCode: '629105',
    relationship: 'Brother / Classmate',
    isOnline: true,
  },
];

export const INITIAL_TRUST_RULES: Record<string, TrustRule[]> = {
  user_hassan: [
    {
      targetUserId: 'user_sarah',
      level: 'auto_accept',
      allowAlarms: true,
      allowCalendar: true,
      allowReminders: true,
      allowLoudOverride: true,
      updatedAt: new Date().toISOString(),
    },
    {
      targetUserId: 'user_mom',
      level: 'auto_accept',
      allowAlarms: true,
      allowCalendar: true,
      allowReminders: true,
      allowLoudOverride: true,
      updatedAt: new Date().toISOString(),
    },
    {
      targetUserId: 'user_omar',
      level: 'require_approval',
      allowAlarms: false,
      allowCalendar: true,
      allowReminders: true,
      allowLoudOverride: false,
      updatedAt: new Date().toISOString(),
    },
  ],
  user_sarah: [
    {
      targetUserId: 'user_hassan',
      level: 'auto_accept',
      allowAlarms: true,
      allowCalendar: true,
      allowReminders: true,
      allowLoudOverride: true,
      updatedAt: new Date().toISOString(),
    },
  ],
  user_mom: [
    {
      targetUserId: 'user_hassan',
      level: 'auto_accept',
      allowAlarms: true,
      allowCalendar: true,
      allowReminders: true,
      allowLoudOverride: true,
      updatedAt: new Date().toISOString(),
    },
  ],
};

function getSeedItems(): SyncItem[] {
  const now = new Date();

  // In 20 minutes
  const in20Min = new Date(now.getTime() + 20 * 60 * 1000);

  // Today evening 7:30 PM
  const todayEve = new Date(now);
  todayEve.setHours(19, 30, 0, 0);
  if (todayEve < now) {
    todayEve.setDate(todayEve.getDate() + 1);
  }

  // Tomorrow morning 08:00 AM
  const tomorrowMorn = new Date(now);
  tomorrowMorn.setDate(tomorrowMorn.getDate() + 1);
  tomorrowMorn.setHours(8, 0, 0, 0);

  return [
    {
      id: 'item_seed_1',
      senderId: 'user_sarah',
      senderName: 'Sarah Chen',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
      receiverId: 'user_hassan',
      receiverName: 'Hassan Zarroug',
      type: 'alarm',
      title: 'Take Blood Pressure Medication',
      notes: 'Pushed directly to your phone alarm so you don\'t skip it!',
      targetDateTime: in20Min.toISOString(),
      category: 'meds',
      alarmSound: 'radar',
      status: 'scheduled',
      autoAccepted: true,
      repeat: 'daily',
      createdAt: new Date(now.getTime() - 3600000).toISOString(),
      ringVolume: 0.9,
    },
    {
      id: 'item_seed_2',
      senderId: 'user_mom',
      senderName: 'Mom (Amina)',
      senderAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80',
      receiverId: 'user_hassan',
      receiverName: 'Hassan Zarroug',
      type: 'reminder',
      title: 'Family Dinner at Bistro Green',
      notes: 'Table booked under Hassan at 7:30 PM.',
      targetDateTime: todayEve.toISOString(),
      category: 'family',
      alarmSound: 'chime',
      status: 'scheduled',
      autoAccepted: true,
      repeat: 'none',
      createdAt: new Date(now.getTime() - 7200000).toISOString(),
      ringVolume: 0.7,
    },
    {
      id: 'item_seed_3',
      senderId: 'user_omar',
      senderName: 'Omar Zarroug',
      senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
      receiverId: 'user_hassan',
      receiverName: 'Hassan Zarroug',
      type: 'calendar',
      title: 'Study Session & Project Architecture',
      notes: 'Review sync protocol and share notes before the lab.',
      targetDateTime: tomorrowMorn.toISOString(),
      category: 'work',
      alarmSound: 'zen',
      status: 'pending_approval',
      autoAccepted: false,
      repeat: 'none',
      createdAt: new Date(now.getTime() - 1800000).toISOString(),
      ringVolume: 0.6,
    },
  ];
}

const seedActivityLogs: ActivityLog[] = [
  {
    id: 'log_1',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    actorId: 'user_sarah',
    actorName: 'Sarah Chen',
    receiverId: 'user_hassan',
    receiverName: 'Hassan Zarroug',
    type: 'auto_accept',
    title: '⚡ Autonomous Alarm Armed',
    details: 'Sarah pushed "Take Blood Pressure Medication". Auto-Accepted because Sarah has Auto-Accept turned ON.',
  },
  {
    id: 'log_2',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    actorId: 'user_mom',
    actorName: 'Mom (Amina)',
    receiverId: 'user_hassan',
    receiverName: 'Hassan Zarroug',
    type: 'auto_accept',
    title: '🔔 Reminder Scheduled',
    details: 'Mom scheduled Family Dinner reminder on Hassan\'s phone.',
  },
];

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('sync_minds_mesh_v2');
  }
} catch {
  // BroadcastChannel unavailable
}

export function subscribeToSyncChannel(callback: (msg: { action: string; payload?: unknown }) => void): () => void {
  if (!broadcastChannel) return () => {};
  const handler = (event: MessageEvent) => {
    callback(event.data);
  };
  broadcastChannel.addEventListener('message', handler);
  return () => {
    broadcastChannel?.removeEventListener('message', handler);
  };
}

export function broadcastMessage(action: string, payload?: unknown) {
  try {
    broadcastChannel?.postMessage({ action, payload });
  } catch (err) {
    console.warn('Broadcast error:', err);
  }
}

export function getUsers(): User[] {
  const data = localStorage.getItem(USERS_KEY);
  if (!data) {
    localStorage.setItem(USERS_KEY, JSON.stringify(INITIAL_USERS));
    return INITIAL_USERS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_USERS;
  }
}

export function saveUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  broadcastMessage('USERS_UPDATED');
}

export function getCurrentUserId(): string {
  const current = localStorage.getItem(CURRENT_USER_KEY);
  if (!current) {
    localStorage.setItem(CURRENT_USER_KEY, 'user_hassan');
    return 'user_hassan';
  }
  return current;
}

export function setCurrentUserId(userId: string) {
  localStorage.setItem(CURRENT_USER_KEY, userId);
  broadcastMessage('USER_SWITCHED', { userId });
}

export function getTrustRules(userId: string): TrustRule[] {
  const raw = localStorage.getItem(TRUST_RULES_KEY);
  let allRules: Record<string, TrustRule[]> = INITIAL_TRUST_RULES;
  if (raw) {
    try {
      allRules = JSON.parse(raw);
    } catch {
      allRules = INITIAL_TRUST_RULES;
    }
  } else {
    localStorage.setItem(TRUST_RULES_KEY, JSON.stringify(INITIAL_TRUST_RULES));
  }
  return allRules[userId] || [];
}

export function saveTrustRules(userId: string, rules: TrustRule[]) {
  const raw = localStorage.getItem(TRUST_RULES_KEY);
  let allRules: Record<string, TrustRule[]> = {};
  if (raw) {
    try {
      allRules = JSON.parse(raw);
    } catch {
      allRules = {};
    }
  }
  allRules[userId] = rules;
  localStorage.setItem(TRUST_RULES_KEY, JSON.stringify(allRules));
  broadcastMessage('TRUST_RULES_UPDATED', { userId });
}

export function getSyncItems(): SyncItem[] {
  const data = localStorage.getItem(ITEMS_KEY);
  if (!data) {
    const seeds = getSeedItems();
    localStorage.setItem(ITEMS_KEY, JSON.stringify(seeds));
    return seeds;
  }
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveSyncItems(items: SyncItem[]) {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  broadcastMessage('ITEMS_UPDATED');
}

export function getActivityLogs(): ActivityLog[] {
  const raw = localStorage.getItem(ACTIVITY_LOGS_KEY);
  if (!raw) {
    localStorage.setItem(ACTIVITY_LOGS_KEY, JSON.stringify(seedActivityLogs));
    return seedActivityLogs;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return seedActivityLogs;
  }
}

export function addActivityLog(log: Omit<ActivityLog, 'id' | 'timestamp'>) {
  const logs = getActivityLogs();
  const newLog: ActivityLog = {
    ...log,
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
  };
  const updated = [newLog, ...logs].slice(0, 100);
  localStorage.setItem(ACTIVITY_LOGS_KEY, JSON.stringify(updated));
  broadcastMessage('LOG_ADDED');
}

export function checkAutoAcceptPermission(receiverId: string, senderId: string, itemType: SyncItem['type']): boolean {
  if (receiverId === senderId) return true;
  const rules = getTrustRules(receiverId);
  const rule = rules.find((r) => r.targetUserId === senderId);
  if (!rule || rule.level !== 'auto_accept') {
    return false;
  }
  if (itemType === 'alarm' && !rule.allowAlarms) return false;
  if (itemType === 'calendar' && !rule.allowCalendar) return false;
  if (itemType === 'reminder' && !rule.allowReminders) return false;
  return true;
}

export function pairWithSyncCode(code: string, currentUserId: string): { success: boolean; user?: User; message: string } {
  const cleaned = code.trim().replace(/[^0-9]/g, '');
  if (cleaned.length !== 6) {
    return { success: false, message: 'Please enter a valid 6-digit sync PIN.' };
  }

  const users = getUsers();
  const matched = users.find((u) => u.syncCode === cleaned);
  if (!matched) {
    return { success: false, message: 'No device found with this PIN code. Double check the code and try again.' };
  }

  if (matched.id === currentUserId) {
    return { success: false, message: 'This is your own device sync PIN!' };
  }

  // Add rule if not exists
  const rules = getTrustRules(currentUserId);
  const existing = rules.find((r) => r.targetUserId === matched.id);
  if (!existing) {
    rules.push({
      targetUserId: matched.id,
      level: 'auto_accept',
      allowAlarms: true,
      allowCalendar: true,
      allowReminders: true,
      allowLoudOverride: true,
      updatedAt: new Date().toISOString(),
    });
    saveTrustRules(currentUserId, rules);
  }

  return { success: true, user: matched, message: `Connected with ${matched.name}! Auto-Accept is enabled.` };
}

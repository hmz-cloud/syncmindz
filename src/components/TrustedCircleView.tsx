import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  UserPlus, 
  Smartphone, 
  Check, 
  Copy, 
  Send,
  KeyRound,
  Sparkles,
  Search,
  CheckCircle2,
  X
} from 'lucide-react';
import { User, TrustRule } from '../types';
import { UserAvatar } from './UserAvatar';
import { pairWithSyncCode } from '../services/storageService';

interface TrustedCircleViewProps {
  currentUser: User;
  users: User[];
  trustRules: TrustRule[];
  onUpdateRule: (targetUserId: string, updates: Partial<TrustRule>) => void;
  onAddContact: (contact: { name: string; email: string; deviceName: string; autoAccept: boolean }) => void;
  onQuickSendToContact: (targetUserId: string) => void;
}

export const TrustedCircleView: React.FC<TrustedCircleViewProps> = ({
  currentUser,
  users,
  trustRules,
  onUpdateRule,
  onAddContact,
  onQuickSendToContact,
}) => {
  const [showPairModal, setShowPairModal] = useState(false);
  const [pairPinInput, setPairPinInput] = useState('');
  const [pairFeedback, setPairFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const contacts = users.filter((u) => u.id !== currentUser.id);

  const getRuleForUser = (targetUserId: string): TrustRule => {
    const existing = trustRules.find((r) => r.targetUserId === targetUserId);
    if (existing) return existing;
    return {
      targetUserId,
      level: 'require_approval',
      allowAlarms: false,
      allowCalendar: true,
      allowReminders: true,
      allowLoudOverride: false,
      updatedAt: new Date().toISOString(),
    };
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}?pin=${currentUser.syncCode}`;
    navigator.clipboard?.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPin = () => {
    navigator.clipboard?.writeText(currentUser.syncCode);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handlePairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = pairWithSyncCode(pairPinInput, currentUser.id);
    setPairFeedback(res);
    if (res.success && res.user) {
      setTimeout(() => {
        setShowPairModal(false);
        setPairFeedback(null);
        setPairPinInput('');
      }, 1500);
    }
  };

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.relationship && c.relationship.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Top Hero Card: Your Device Sync Identity & PIN */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Trusted Circle & Auto-Accept
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Zero Missed Alarms
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
            People with <strong>Auto-Accept ON</strong> can send alarms and reminders directly to your phone. They will ring out loud automatically so you never forget!
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium">
              <KeyRound className="w-3.5 h-3.5 text-blue-600" />
              <span>Your Pairing PIN: <strong className="font-mono text-slate-900 tracking-wider">{currentUser.syncCode}</strong></span>
              <button
                onClick={handleCopyPin}
                className="ml-1 text-[11px] text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
              >
                {copiedPin ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-all cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>{copiedLink ? 'Link Copied!' : 'Share Pairing Link'}</span>
            </button>
          </div>
        </div>

        {/* Action Button: Connect by PIN */}
        <button
          onClick={() => setShowPairModal(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/25 transition-all cursor-pointer active:scale-98 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Connect by 6-Digit PIN</span>
        </button>
      </div>

      {/* Search & Counter */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search friends, family, classmates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-slate-500">
          {filteredContacts.length} Connected {filteredContacts.length === 1 ? 'Mind' : 'Minds'}
        </span>
      </div>

      {/* Clean Contact Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredContacts.map((contact) => {
          const rule = getRuleForUser(contact.id);
          const isAutoAccept = rule.level === 'auto_accept';

          return (
            <div
              key={contact.id}
              className={`p-5 rounded-3xl border transition-all ${
                isAutoAccept
                  ? 'bg-white border-slate-200/90 shadow-sm'
                  : 'bg-slate-50/70 border-slate-200/60'
              }`}
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    name={contact.name}
                    avatar={contact.avatar}
                    color={contact.color}
                    size="md"
                    isOnline={contact.isOnline}
                  />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-tight">
                      {contact.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {contact.relationship || contact.deviceName}
                    </p>
                    <span className="inline-block text-[10px] font-mono text-slate-400">
                      PIN: {contact.syncCode}
                    </span>
                  </div>
                </div>

                {/* Direct Send Trigger Button */}
                <button
                  onClick={() => onQuickSendToContact(contact.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all cursor-pointer shrink-0"
                  title={`Send an alarm or reminder to ${contact.name}'s phone`}
                >
                  <Send className="w-3 h-3 text-blue-600" />
                  <span>Send</span>
                </button>
              </div>

              {/* Auto-Accept Toggle Switch */}
              <div className="mt-4 pt-1 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    {isAutoAccept ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                    )}
                    <span className="text-xs font-bold text-slate-800">
                      {isAutoAccept ? 'Auto-Accept Enabled' : 'Ask for Approval'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isAutoAccept
                      ? 'Their alarms ring out loud on your phone directly.'
                      : 'Requires you to approve each trigger first.'}
                  </p>
                </div>

                {/* Toggle Pill */}
                <button
                  onClick={() =>
                    onUpdateRule(contact.id, {
                      level: isAutoAccept ? 'require_approval' : 'auto_accept',
                      allowAlarms: !isAutoAccept,
                      allowCalendar: true,
                      allowReminders: true,
                      allowLoudOverride: !isAutoAccept,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isAutoAccept ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isAutoAccept ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect by PIN Modal */}
      {showPairModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Pair by 6-Digit PIN</h3>
              </div>
              <button
                onClick={() => {
                  setShowPairModal(false);
                  setPairFeedback(null);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Ask your friend or family member for their 6-digit Sync PIN shown in their app:
            </p>

            <form onSubmit={handlePairSubmit} className="mt-4 space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="e.g. 839402"
                  value={pairPinInput}
                  onChange={(e) => setPairPinInput(e.target.value)}
                  className="w-full text-center tracking-widest text-2xl font-mono font-bold bg-slate-50 border border-slate-200 rounded-2xl py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              {pairFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    pairFeedback.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {pairFeedback.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{pairFeedback.message}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPairModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/25"
                >
                  Connect & Auto-Accept
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

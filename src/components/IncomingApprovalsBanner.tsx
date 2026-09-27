import React from 'react';
import { Clock, ShieldCheck, Check, X, Bell, Calendar as CalendarIcon, Volume2 } from 'lucide-react';
import { SyncItem } from '../types';
import { UserAvatar } from './UserAvatar';

interface IncomingApprovalsBannerProps {
  pendingItems: SyncItem[];
  onApprove: (itemId: string, andTrustSender?: boolean) => void;
  onReject: (itemId: string) => void;
}

export const IncomingApprovalsBanner: React.FC<IncomingApprovalsBannerProps> = ({
  pendingItems,
  onApprove,
  onReject,
}) => {
  if (pendingItems.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {pendingItems.map((item) => {
        const isAlarm = item.type === 'alarm';
        const isReminder = item.type === 'reminder';

        return (
          <div
            key={item.id}
            className="p-4 sm:p-5 rounded-3xl bg-amber-50/90 border border-amber-200/80 text-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-2"
          >
            <div className="flex items-start gap-3.5">
              <UserAvatar
                name={item.senderName}
                avatar={item.senderAvatar}
                size="md"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    Approval Requested
                  </span>
                  <span className="text-xs text-slate-500">
                    From <strong className="text-slate-800">{item.senderName}</strong>
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                  {item.title}
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Scheduled for{' '}
                  <strong className="text-slate-900 font-mono">
                    {new Date(item.targetDateTime).toLocaleDateString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    at{' '}
                    {new Date(item.targetDateTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </strong>
                  {item.notes ? ` · "${item.notes}"` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                onClick={() => onReject(item.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
                title="Decline"
              >
                <X className="w-3.5 h-3.5" />
                <span>Decline</span>
              </button>

              <button
                onClick={() => onApprove(item.id, false)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                title="Approve for this event only"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve Once</span>
              </button>

              <button
                onClick={() => onApprove(item.id, true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                title="Approve and give sender Auto-Accept permissions for future items"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Approve & Auto-Trust</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

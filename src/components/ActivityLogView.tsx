import React from 'react';
import { 
  Activity, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  Volume2, 
  AlertCircle, 
  Smartphone,
  Check
} from 'lucide-react';
import { ActivityLog } from '../types';

interface ActivityLogViewProps {
  logs: ActivityLog[];
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({ logs }) => {
  const getLogIcon = (type: ActivityLog['type']) => {
    switch (type) {
      case 'auto_accept':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'alarm_fired':
        return <Volume2 className="w-4 h-4 text-rose-400 animate-pulse" />;
      case 'acknowledged':
        return <CheckCircle2 className="w-4 h-4 text-blue-400" />;
      case 'approval_needed':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'manual_accept':
        return <Check className="w-4 h-4 text-teal-400" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  const getLogBg = (type: ActivityLog['type']) => {
    switch (type) {
      case 'auto_accept':
        return 'bg-emerald-500/10 border-emerald-500/20';
      case 'alarm_fired':
        return 'bg-rose-500/10 border-rose-500/30';
      case 'acknowledged':
        return 'bg-blue-500/10 border-blue-500/20';
      case 'approval_needed':
        return 'bg-amber-500/10 border-amber-500/20';
      default:
        return 'bg-slate-800/40 border-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Live Mesh Activity & Audit Log
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
              Real-Time Feed
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Complete transparency of who sent what, auto-accepted triggers, autonomous alarm firings, and acknowledgements.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {logs.length === 0 ? (
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center text-slate-500">
            <Activity className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
            <p className="text-xs">No activity logged yet.</p>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${getLogBg(
                log.type
              )}`}
            >
              <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 mt-0.5 shrink-0">
                {getLogIcon(log.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                    {log.title}
                  </h4>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  {log.details}
                </p>

                <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                  <span>Actor: <strong className="text-slate-200">{log.actorName}</strong></span>
                  <span>•</span>
                  <span>Target: <strong className="text-slate-200">{log.receiverName}</strong></span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

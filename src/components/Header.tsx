import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Volume2, 
  ShieldCheck, 
  Plus, 
  ChevronDown, 
  Smartphone,
  Play,
  Check
} from 'lucide-react';
import { User } from '../types';
import { playSoundSample, getAudioContext } from '../services/audioService';
import { requestNotificationPermission, getNotificationPermission } from '../services/notificationService';
import { UserAvatar } from './UserAvatar';

interface HeaderProps {
  users: User[];
  currentUser: User;
  onSwitchUser: (userId: string) => void;
  onOpenSendModal: () => void;
  onTriggerInstantTestAlarm: () => void;
  pendingApprovalsCount: number;
  activeRingingCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  users,
  currentUser,
  onSwitchUser,
  onOpenSendModal,
  onTriggerInstantTestAlarm,
  pendingApprovalsCount,
  activeRingingCount,
}) => {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default');

  useEffect(() => {
    setNotifPerm(getNotificationPermission());
  }, []);

  const handleRequestNotif = async () => {
    const perm = await requestNotificationPermission();
    setNotifPerm(perm);
  };

  const handleQuickAudioTest = () => {
    getAudioContext();
    playSoundSample('radar', 0.85);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-18 gap-3">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold text-lg">
              SM
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
                  Sync Minds
                </span>
                <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> Auto-Accept
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Autonomous reminders & shared alarms among trusted people
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* 1-Click Test Alarm 5s */}
            <button
              onClick={() => {
                getAudioContext();
                onTriggerInstantTestAlarm();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-xs"
              title="Schedule an alarm that rings in 5 seconds to test audio & lockscreen takeover"
            >
              <Play className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span>Try 5s Alarm</span>
            </button>

            {/* Audio Tone Test */}
            <button
              onClick={handleQuickAudioTest}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
              title="Test Web Audio Tone"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            {/* Notification permission button */}
            {notifPerm !== 'granted' && (
              <button
                onClick={handleRequestNotif}
                className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                title="Enable browser notifications"
              >
                <Bell className="w-3.5 h-3.5 text-blue-600" />
                <span>Enable Alerts</span>
              </button>
            )}

            {/* Device Profile Switcher */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all cursor-pointer focus:outline-none"
                title="Switch active user to test sending alarms between phones"
              >
                <UserAvatar
                  name={currentUser.name}
                  avatar={currentUser.avatar}
                  color={currentUser.color}
                  size="sm"
                  isOnline={currentUser.isOnline}
                />
                <div className="hidden sm:block text-left pr-1">
                  <div className="text-xs font-bold text-slate-800 leading-tight">
                    {currentUser.name.split(' ')[0]}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[100px]">
                    {currentUser.deviceName}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setUserDropdownOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-40 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-2 border-b border-slate-100 mb-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Switch Active Phone
                      </p>
                      <p className="text-xs text-slate-600">
                        Test how reminders ring from one person to another!
                      </p>
                    </div>
                    <div className="space-y-1">
                      {users.map((u) => {
                        const isCurrent = u.id === currentUser.id;
                        return (
                          <button
                            key={u.id}
                            onClick={() => {
                              onSwitchUser(u.id);
                              setUserDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                              isCurrent 
                                ? 'bg-blue-50 text-blue-900 border border-blue-200 font-bold' 
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                name={u.name}
                                avatar={u.avatar}
                                color={u.color}
                                size="sm"
                                isOnline={u.isOnline}
                              />
                              <div>
                                <p className="text-xs font-bold text-slate-900">{u.name}</p>
                                <p className="text-[10px] text-slate-400">{u.deviceName}</p>
                              </div>
                            </div>
                            {isCurrent && (
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                Active
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Primary New Action */}
            <button
              onClick={() => {
                getAudioContext();
                onOpenSendModal();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Send</span>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};

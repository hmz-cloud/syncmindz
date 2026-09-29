import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Volume2, 
  ShieldCheck, 
  Plus, 
  ChevronDown, 
  Smartphone,
  Play,
  Check,
  KeyRound,
  X,
  Copy
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
  const [copiedPin, setCopiedPin] = useState(false);

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

  const handleCopyPin = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(currentUser.syncCode);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-18 gap-3">
          
          {/* Logo & Brand - High contrast, accessible, uncluttered */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 select-none">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-extrabold text-sm sm:text-base tracking-tight shrink-0">
              SMz
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-xl font-extrabold tracking-tight text-slate-900">
                  SyncMind<span className="text-blue-600">z</span>
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

          {/* Right Action Controls: Responsive and uncluttered */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Desktop Only: 1-Click Test Alarm 5s */}
            <button
              onClick={() => {
                getAudioContext();
                onTriggerInstantTestAlarm();
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-xs"
              title="Schedule an alarm that rings in 5 seconds to test audio & lockscreen takeover"
            >
              <Play className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span>Try 5s Alarm</span>
            </button>

            {/* Desktop Only: Audio Tone Test */}
            <button
              onClick={handleQuickAudioTest}
              className="hidden sm:inline-flex p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
              title="Test Web Audio Tone"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            {/* Desktop Only: Notification permission button */}
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

            {/* Profile & Device Switcher Button - Senior & Thumb-Friendly (min 44px tap target) */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-left transition-all cursor-pointer focus:outline-none min-h-[44px]"
                title="Device profile and testing tools"
                aria-label="User profile and settings"
              >
                <UserAvatar
                  name={currentUser.name}
                  avatar={currentUser.avatar}
                  color={currentUser.color}
                  size="sm"
                  isOnline={currentUser.isOnline}
                />
                <div className="text-left pr-1">
                  <div className="text-xs font-bold text-slate-900 leading-tight">
                    {currentUser.name.split(' ')[0]}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[85px] sm:max-w-[110px]">
                    {currentUser.deviceName}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Consolidated Dropdown Menu / Action Sheet */}
              {userDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-xs sm:bg-transparent sm:backdrop-blur-none" 
                    onClick={() => setUserDropdownOpen(false)} 
                  />
                  <div className="fixed sm:absolute bottom-0 sm:bottom-auto left-0 sm:left-auto right-0 sm:right-0 sm:mt-2 w-full sm:w-80 bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl shadow-2xl p-4 sm:p-3 z-40 animate-in fade-in slide-in-from-bottom-5 sm:slide-in-from-bottom-0 sm:zoom-in-95 max-h-[85vh] overflow-y-auto">
                    
                    {/* Header of sheet with close button on mobile */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          Device & Sync Profile
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Switch test devices or manage your sync PIN
                        </p>
                      </div>
                      <button
                        onClick={() => setUserDropdownOpen(false)}
                        className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 sm:hidden cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Active Device 6-Digit PIN Card (Large, readable for seniors) */}
                    <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200/80 mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <KeyRound className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                            Your Sync PIN
                          </p>
                          <p className="text-lg font-mono font-extrabold text-blue-950 tracking-wider">
                            {currentUser.syncCode}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleCopyPin}
                        className="px-3 py-1.5 rounded-xl bg-white text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                      >
                        {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPin ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {/* Mobile-Only Testing Tools Section */}
                    <div className="sm:hidden mb-3 space-y-1.5 pb-3 border-b border-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1">
                        Quick Testing Tools
                      </p>
                      <button
                        onClick={() => {
                          getAudioContext();
                          setUserDropdownOpen(false);
                          onTriggerInstantTestAlarm();
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-left transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Play className="w-4 h-4 fill-amber-500 text-amber-500 shrink-0" />
                          <div>
                            <p className="text-xs font-bold">Try 5-Second Test Alarm</p>
                            <p className="text-[10px] text-amber-800">Experience autonomous ring and overlay</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-extrabold bg-amber-200/80 px-2 py-0.5 rounded-full text-amber-900">
                          Test
                        </span>
                      </button>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={handleQuickAudioTest}
                          className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer"
                        >
                          <Volume2 className="w-4 h-4 text-slate-600" />
                          <span>Test Audio</span>
                        </button>

                        <button
                          onClick={handleRequestNotif}
                          className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer"
                        >
                          <Bell className="w-4 h-4 text-blue-600" />
                          <span>{notifPerm === 'granted' ? 'Alerts ON' : 'Enable Alerts'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Device & Profile Switcher List */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1.5">
                        Switch Active Device
                      </p>
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
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                                isCurrent 
                                  ? 'bg-blue-50 text-blue-900 border border-blue-200 font-bold' 
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <UserAvatar
                                  name={u.name}
                                  avatar={u.avatar}
                                  color={u.color}
                                  size="sm"
                                  isOnline={u.isOnline}
                                />
                                <div>
                                  <p className="text-xs font-bold text-slate-900">{u.name}</p>
                                  <p className="text-[10px] text-slate-400">{u.relationship || u.deviceName}</p>
                                </div>
                              </div>
                              {isCurrent ? (
                                <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                  Active
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  PIN: {u.syncCode}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </>
              )}
            </div>

            {/* Desktop Only: Primary New Send Action (Mobile uses thumb floating button) */}
            <button
              onClick={() => {
                getAudioContext();
                onOpenSendModal();
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer active:scale-95"
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

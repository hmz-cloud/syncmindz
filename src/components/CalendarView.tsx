import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  ShieldCheck, 
  Volume2, 
  Bell, 
  Plus,
  Play
} from 'lucide-react';
import { SyncItem, User } from '../types';

interface CalendarViewProps {
  items: SyncItem[];
  currentUser: User;
  onOpenSendModal: () => void;
  onTriggerNow: (item: SyncItem) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  items,
  currentUser,
  onOpenSendModal,
  onTriggerNow,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  const userItems = items.filter(
    (it) => (it.receiverId === currentUser.id || it.senderId === currentUser.id) && it.status !== 'rejected'
  );

  const prevMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const nextMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDay(today);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const selectedDateStr = selectedDay.toDateString();
  const selectedDateItems = userItems.filter((it) => {
    const itDate = new Date(it.targetDateTime);
    return itDate.toDateString() === selectedDateStr;
  });

  return (
    <div className="space-y-6">
      
      {/* Calendar Top Controls */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.05),0_10px_20px_-4px_rgba(15,23,42,0.03)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200/60">
            <button
              onClick={prevMonth}
              className="p-1 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToToday}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-1 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            {currentDate.toLocaleDateString([], { month: 'long', year: 'numeric' })}
          </h2>
        </div>

        <button
          onClick={onOpenSendModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Reminder</span>
        </button>
      </div>

      {/* Grid & Day Agenda layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Month Calendar Grid (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <span key={d} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {d}
              </span>
            ))}
          </div>

          {/* Month Day Cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-16 sm:h-20 rounded-2xl bg-slate-50/50" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const cellDate = new Date(year, month, dayNum);
              const isToday = cellDate.toDateString() === new Date().toDateString();
              const isSelected = cellDate.toDateString() === selectedDateStr;

              const dayItems = userItems.filter(
                (it) => new Date(it.targetDateTime).toDateString() === cellDate.toDateString()
              );

              return (
                <button
                  key={`day-${dayNum}`}
                  onClick={() => setSelectedDay(cellDate)}
                  className={`h-16 sm:h-20 p-2 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                      : isToday
                      ? 'bg-slate-100 border-slate-300 font-bold'
                      : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-indigo-600 text-white'
                          : isSelected
                          ? 'text-indigo-600 font-extrabold'
                          : 'text-slate-800'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {dayItems.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                    )}
                  </div>

                  {/* Micro item indicators */}
                  <div className="flex items-center gap-1 overflow-hidden">
                    {dayItems.slice(0, 3).map((item) => (
                      <span
                        key={item.id}
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.type === 'alarm' ? 'bg-rose-500' : 'bg-indigo-500'
                        }`}
                        title={item.title}
                      />
                    ))}
                    {dayItems.length > 3 && (
                      <span className="text-[9px] text-slate-400">+{dayItems.length - 3}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda (1 Col) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Day Schedule
              </p>
              <h3 className="text-base font-bold text-slate-900">
                {selectedDay.toLocaleDateString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </h3>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold font-mono">
              {selectedDateItems.length} {selectedDateItems.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          <div className="mt-4 space-y-3 flex-1 overflow-y-auto max-h-[460px]">
            {selectedDateItems.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <CalendarIcon className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-500">Nothing scheduled for this day</p>
                <button
                  onClick={onOpenSendModal}
                  className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-bold"
                >
                  + Add Alarm or Reminder
                </button>
              </div>
            ) : (
              selectedDateItems.map((item) => {
                const isAlarm = item.type === 'alarm';
                const timeStr = new Date(item.targetDateTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-900 font-mono">
                        {timeStr}
                      </span>
                      {item.autoAccepted && (
                        <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Auto
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900">
                      {item.title}
                    </h4>

                    {item.notes && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        "{item.notes}"
                      </p>
                    )}

                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                      <span>From {item.senderName}</span>
                      <button
                        onClick={() => onTriggerNow(item)}
                        className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-indigo-600" />
                        <span>Test Ring</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

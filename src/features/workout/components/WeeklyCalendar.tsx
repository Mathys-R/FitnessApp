'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Moon, Check, Calendar as CalendarIcon } from 'lucide-react';
import { getLocalTodayIso, getWeekDatesIso, shiftDateIso, formatShortFrenchDate } from '@/lib/date.utils';
import { getWeekSessions } from '../services/calendar.service';
import type { WorkoutSessionRow } from '../services/sessions.service';
import { CalendarSessionDrawer } from './CalendarSessionDrawer';

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export interface WeeklyCalendarProps {
  onEditSession: (sessionId: string) => void;
  onStartPlannedSession: (session: WorkoutSessionRow) => void;
}

export function WeeklyCalendar({ onEditSession, onStartPlannedSession }: WeeklyCalendarProps) {
  const todayIso = useMemo(() => getLocalTodayIso(), []);
  const [refDateIso, setRefDateIso] = useState(todayIso);
  const [sessions, setSessions] = useState<WorkoutSessionRow[]>([]);
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const weekDates = useMemo(() => getWeekDatesIso(refDateIso), [refDateIso]);

  const loadSessions = useCallback(async () => {
    try {
      const data = await getWeekSessions(weekDates[0], weekDates[6]);
      setSessions(data);
    } catch {
      // Ignorer silencieusement ou garder l'état précédent
    }
  }, [weekDates]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const openDayDrawer = (dateIso: string) => {
    setSelectedDayIso(dateIso);
    setDrawerOpen(true);
  };

  const selectedSession = sessions.find((s) => s.session_date === selectedDayIso);

  return (
    <div className="ios-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-[#0A84FF]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">
            {formatShortFrenchDate(weekDates[0])} — {formatShortFrenchDate(weekDates[6])}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setRefDateIso(todayIso)}
            className="min-h-[36px] rounded-lg px-2.5 text-xs font-medium text-[#0A84FF] hover:bg-white/5 active:scale-95"
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            aria-label="Semaine précédente"
            onClick={() => setRefDateIso((prev) => shiftDateIso(prev, -7))}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#8E8E93] hover:bg-white/5 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Semaine suivante"
            onClick={() => setRefDateIso((prev) => shiftDateIso(prev, 7))}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#8E8E93] hover:bg-white/5 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {weekDates.map((dateIso, idx) => {
          const session = sessions.find((s) => s.session_date === dateIso);
          const isToday = dateIso === todayIso;
          const dayNum = dateIso.slice(8);

          return (
            <button
              key={dateIso}
              type="button"
              onClick={() => openDayDrawer(dateIso)}
              className={`flex flex-col items-center justify-between rounded-xl p-2 min-h-[64px] transition-all active:scale-95 ${
                isToday ? 'border border-[#0A84FF] bg-[#0A84FF]/10' : 'bg-[#2C2C2E]/60 hover:bg-[#2C2C2E]'
              }`}
            >
              <span className={`text-[10px] font-semibold ${isToday ? 'text-[#0A84FF]' : 'text-[#8E8E93]'}`}>
                {DAY_LABELS[idx]}
              </span>
              <span className="text-sm font-bold text-white tabular-nums">{dayNum}</span>
              <div className="flex h-4 w-4 items-center justify-center">
                {session?.status === 'completed' && (
                  <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#30D158]">
                    <Check className="h-2.5 w-2.5 stroke-[3] text-black" />
                  </div>
                )}
                {session?.status === 'planned' && (
                  <div className="h-3 w-3 rounded-full border-2 border-dashed border-[#0A84FF]" />
                )}
                {session?.status === 'rest_day' && (
                  <Moon className="h-3.5 w-3.5 fill-[#8E8E93] text-[#8E8E93]" />
                )}
                {!session && <div className="h-1.5 w-1.5 rounded-full bg-white/10" />}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDayIso && (
        <CalendarSessionDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          selectedDateIso={selectedDayIso}
          session={selectedSession}
          onSessionUpdated={loadSessions}
          onEditSession={onEditSession}
          onStartPlannedSession={onStartPlannedSession}
        />
      )}
    </div>
  );
}

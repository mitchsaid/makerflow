import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, Play, Pause, RotateCcw, Plus, Check, Trash2, 
  ChevronDown, ChevronUp, History, X, AlertCircle, Bookmark, Tag
} from 'lucide-react';
import { Job, TimeLogEntry } from '../types';

interface TimeTrackerProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: Job[];
  onTimeLogged?: (entry: TimeLogEntry) => void;
}

const STORAGE_KEY_TIMER_STATE = 'makerflow_timer_state';
const STORAGE_KEY_TIME_LOGS = 'makerflow_time_logs';

export default function TimeTracker({ isOpen, onClose, jobs, onTimeLogged }: TimeTrackerProps) {
  // Timer state
  const [seconds, setSeconds] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_TIMER_STATE);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.seconds || 0;
      } catch (e) {
        return 0;
      }
    }
    return 0;
  });

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [customActivity, setCustomActivity] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Log History
  const [timeLogs, setTimeLogs] = useState<TimeLogEntry[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_TIME_LOGS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [loggedSuccess, setLoggedSuccess] = useState<boolean>(false);

  // Interval reference
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TIMER_STATE, JSON.stringify({ seconds, isRunning }));
  }, [seconds, isRunning]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TIME_LOGS, JSON.stringify(timeLogs));
  }, [timeLogs]);

  // Stopwatch interval handler
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Selected job helper
  const activeJob = jobs.find(j => j.id === selectedJobId);
  const activeTask = activeJob?.items.find(i => i.id === selectedTaskId);

  const formatTimeDisplay = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  const handleStartPause = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setSeconds(0);
  };

  const handleAddMinutes = (mins: number) => {
    setSeconds(prev => Math.max(0, prev + mins * 60));
  };

  const handleLogTime = () => {
    if (seconds <= 0) return;

    let activityName = 'General Workshop Time';
    if (customActivity.trim()) {
      activityName = customActivity.trim();
    } else if (activeTask) {
      activityName = activeTask.title;
    } else if (activeJob) {
      activityName = `Job ${activeJob.jobNumber} Production`;
    }

    const newEntry: TimeLogEntry = {
      id: `time_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      jobId: activeJob?.id,
      jobNumber: activeJob?.jobNumber,
      clientName: activeJob?.clientName,
      taskTitle: activeTask?.title,
      activityName,
      durationSeconds: seconds,
      timestamp: new Date().toISOString(),
      notes: notes.trim() || undefined
    };

    setTimeLogs(prev => [newEntry, ...prev]);
    if (onTimeLogged) {
      onTimeLogged(newEntry);
    }

    // Success feedback
    setLoggedSuccess(true);
    setTimeout(() => setLoggedSuccess(false), 2500);

    // Reset timer & form notes
    setIsRunning(false);
    setSeconds(0);
    setNotes('');
  };

  const handleDeleteLog = (id: string) => {
    setTimeLogs(prev => prev.filter(l => l.id !== id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-6 w-auto sm:w-[420px] max-w-full bg-white rounded-2xl shadow-2xl border border-stone-300/90 z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-[#421a08] text-amber-50 flex items-center justify-between gap-2 select-none border-b border-[#5e260c]">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isRunning ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : 'bg-amber-500/20 text-amber-300'}`}>
            <Clock size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-amber-100 leading-tight">Time Tracker</h3>
            <span className="text-[10px] text-amber-200/70 font-mono">
              {isRunning ? '● Recording active session...' : 'Ready to track'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`px-2 py-1 text-[10px] font-bold rounded-md transition flex items-center gap-1 cursor-pointer ${
              showHistory ? 'bg-amber-600 text-white' : 'bg-[#58250f] text-amber-100 hover:bg-[#6e2f13]'
            }`}
            title="Toggle Log History"
          >
            <History size={12} />
            <span>Logs ({timeLogs.length})</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-amber-200 hover:bg-rose-900/60 hover:text-rose-100 rounded-md transition cursor-pointer"
            title="Close timer"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Main Timer Display */}
      <div className="p-4 bg-[#331406] text-white flex flex-col items-center justify-center border-b border-[#52220b]">
        <div className="text-4xl sm:text-5xl font-black font-mono tracking-wider text-amber-400 my-1">
          {formatTimeDisplay(seconds)}
        </div>

        {/* Quick controls */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleStartPause}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-md cursor-pointer ${
              isRunning 
                ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isRunning ? (
              <>
                <Pause size={15} />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play size={15} />
                <span>{seconds > 0 ? 'Resume' : 'Start Timer'}</span>
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            disabled={seconds === 0}
            className="p-2.5 bg-[#52220b] hover:bg-[#682d0e] text-amber-100 rounded-xl transition disabled:opacity-40 cursor-pointer"
            title="Reset to 00:00:00"
          >
            <RotateCcw size={15} />
          </button>

          <div className="h-4 w-px bg-[#52220b] mx-1" />

          <button
            onClick={() => handleAddMinutes(5)}
            className="px-2.5 py-2 bg-[#52220b] hover:bg-[#682d0e] text-amber-100 rounded-xl text-xs font-mono font-bold transition cursor-pointer"
            title="Add 5 minutes"
          >
            +5m
          </button>
          <button
            onClick={() => handleAddMinutes(15)}
            className="px-2.5 py-2 bg-[#52220b] hover:bg-[#682d0e] text-amber-100 rounded-xl text-xs font-mono font-bold transition cursor-pointer"
            title="Add 15 minutes"
          >
            +15m
          </button>
        </div>
      </div>

      {/* Main Form or Log History View */}
      {showHistory ? (
        <div className="p-4 max-h-72 overflow-y-auto space-y-2 bg-stone-50">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Time Log History
            </h4>
            <span className="text-[10px] text-stone-500 font-bold">
              Total Recorded: {formatTimeDisplay(timeLogs.reduce((acc, l) => acc + l.durationSeconds, 0))}
            </span>
          </div>

          {timeLogs.length === 0 ? (
            <div className="text-center py-6 text-stone-400 text-xs">
              No logged sessions yet. Start the timer and click "Log Time" to keep track!
            </div>
          ) : (
            timeLogs.map(log => {
              const dt = new Date(log.timestamp);
              const dateStr = dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
              const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div 
                  key={log.id} 
                  className="p-2.5 bg-white rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-stone-800">
                        {log.activityName}
                      </span>
                      {log.jobNumber && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                          #{log.jobNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-stone-500">
                      {dateStr} at {timeStr} {log.clientName ? `• ${log.clientName}` : ''}
                    </p>
                    {log.notes && (
                      <p className="text-[11px] text-stone-600 italic mt-0.5">"{log.notes}"</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                      {formatTimeDisplay(log.durationSeconds)}
                    </span>
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      className="text-stone-300 hover:text-rose-600 p-1 cursor-pointer transition"
                      title="Delete log"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="p-4 space-y-3 bg-stone-50">
          {/* Target Job Context */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-stone-700 flex items-center justify-between">
              <span>Link to Active Job (Optional)</span>
              {selectedJobId && (
                <button 
                  onClick={() => { setSelectedJobId(''); setSelectedTaskId(''); }}
                  className="text-[10px] text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </label>
            <select
              value={selectedJobId}
              onChange={(e) => {
                setSelectedJobId(e.target.value);
                setSelectedTaskId('');
              }}
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">-- No Specific Job (General Activity) --</option>
              {jobs.filter(j => j.status !== 'Done').map(job => (
                <option key={job.id} value={job.id}>
                  #{job.jobNumber} • {job.clientName} ({job.status})
                </option>
              ))}
            </select>
          </div>

          {/* Target Task Item within Job */}
          {activeJob && activeJob.items.length > 0 && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-stone-700">Select Specific Task / Item</label>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">All Tasks for Job #{activeJob.jobNumber}</option>
                {activeJob.items.map(task => (
                  <option key={task.id} value={task.id}>
                    {task.title} (Qty: {task.quantity})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Activity Name */}
          {!selectedJobId && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-stone-700">Activity / Task Label</label>
              <input
                type="text"
                value={customActivity}
                onChange={(e) => setCustomActivity(e.target.value)}
                placeholder="e.g., Sourcing leather, Hand sanding, Design layout..."
                className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-stone-700">Session Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Completed initial batch, applied coat 1..."
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Log button */}
          <button
            onClick={handleLogTime}
            disabled={seconds <= 0}
            className={`w-full py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs ${
              loggedSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-800 hover:bg-amber-900 text-white disabled:opacity-40'
            }`}
          >
            {loggedSuccess ? (
              <>
                <Check size={15} />
                <span>Session Logged to History!</span>
              </>
            ) : (
              <>
                <Bookmark size={15} />
                <span>Log Tracked Time ({formatTimeDisplay(seconds)})</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

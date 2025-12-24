
import React, { useState, useEffect, useMemo } from 'react';
import { 
  PlusIcon, 
  CalendarIcon, 
  ClockIcon, 
  SparklesIcon, 
  SettingsIcon, 
  CheckCircleIcon, 
  TrashIcon, 
  BellIcon,
  XIcon,
  TrendingUpIcon,
  LayoutIcon,
  ExternalLinkIcon,
  FlaskConIcon
} from './components/Icons';
import { Routine, Event, DayOfWeek, Timetable, TimeBlock } from './types';
import { generateRoutineWithSearch } from './services/geminiService';

const STORAGE_KEY = 'synclife_data_v3';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'routines' | 'events' | 'planner' | 'ai' | 'settings'>('routines');
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSources, setAiSources] = useState<{ uri: string; title: string }[]>([]);
  
  const [isAddingRoutine, setIsAddingRoutine] = useState(false);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [isAddingTimetable, setIsAddingTimetable] = useState(false);
  const [selectedTimetable, setSelectedTimetable] = useState<Timetable | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setRoutines(parsed.routines || []);
      setEvents(parsed.events || []);
      setTimetables(parsed.timetables || []);
    }
    
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ routines, events, timetables }));
  }, [routines, events, timetables]);

  // Reminder Logic
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setEvents(prevEvents => {
        let changed = false;
        const updated = prevEvents.map(event => {
          const eventTime = new Date(event.dateTime).getTime();
          const reminderTime = eventTime - (event.reminderMinutes * 60 * 1000);
          
          if (!event.notified && now.getTime() >= reminderTime && now.getTime() < eventTime) {
            changed = true;
            triggerNotification(`Upcoming Event`, `${event.title} starts in ${event.reminderMinutes} minutes!`);
            return { ...event, notified: true };
          }
          return event;
        });
        return changed ? updated : prevEvents;
      });
    }, 15000); // Check every 15 seconds for snappier notifications
    return () => clearInterval(interval);
  }, []);

  const triggerNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    setNotifications(prev => [...prev, `${title}: ${body}`]);
    setTimeout(() => {
      setNotifications(prev => prev.slice(1));
    }, 8000);
  };

  const addRoutine = (r: Routine) => setRoutines([...routines, { ...r, completionHistory: [] }]);
  const deleteRoutine = (id: string) => setRoutines(routines.filter(r => r.id !== id));
  
  const toggleRoutine = (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    setRoutines(routines.map(r => {
      if (r.id === id) {
        const isCurrentlyCompleted = r.completionHistory?.includes(today);
        let newHistory = [...(r.completionHistory || [])];
        if (!isCurrentlyCompleted) {
          if (!newHistory.includes(today)) newHistory.push(today);
          return { ...r, completed: true, lastCompletedDate: today, completionHistory: newHistory };
        } else {
          newHistory = newHistory.filter(date => date !== today);
          return { ...r, completed: false, lastCompletedDate: undefined, completionHistory: newHistory };
        }
      }
      return r;
    }));
  };

  const addEvent = (e: Event) => setEvents([...events, e]);
  const deleteEvent = (id: string) => setEvents(events.filter(e => e.id !== id));

  const addTimetable = (t: Timetable) => setTimetables([...timetables, t]);
  const deleteTimetable = (id: string) => setTimetables(timetables.filter(t => t.id !== id));

  const handleAiGenerate = async () => {
    if (!aiPrompt) return;
    setIsAiLoading(true);
    setAiSources([]);
    const { routines: suggestions, sources } = await generateRoutineWithSearch(aiPrompt);
    
    const newRoutines: Routine[] = suggestions.map((s) => ({
      id: Math.random().toString(36).substr(2, 9),
      title: s.title || 'Routine Task',
      time: s.time || '08:00',
      category: s.category || 'personal',
      days: s.days as DayOfWeek[] || [DayOfWeek.MONDAY],
      completed: false,
      completionHistory: []
    }));
    
    setRoutines([...routines, ...newRoutines]);
    setAiSources(sources);
    setIsAiLoading(false);
    setAiPrompt('');
  };

  const weeklyStats = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });
    return last7Days.map(date => {
      const completions = routines.filter(r => r.completionHistory?.includes(date)).length;
      return {
        date,
        day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        count: completions,
        total: routines.length
      };
    });
  }, [routines]);

  const completionRate = useMemo(() => {
    if (routines.length === 0) return 0;
    const today = new Date().toISOString().split('T')[0];
    const completedToday = routines.filter(r => r.completionHistory?.includes(today)).length;
    return Math.round((completedToday / routines.length) * 100);
  }, [routines]);

  // Test Runner for Demonstration
  const runTestDiagnostics = () => {
    triggerNotification("Test Successful", "Notifications are active and working!");
    // Add a dummy event 1 minute from now
    const minuteFromNow = new Date(Date.now() + 65000).toISOString();
    addEvent({
      id: "test-event",
      title: "Self-Test Event",
      dateTime: minuteFromNow,
      reminderMinutes: 1,
      description: "This is an automated test event.",
      notified: false
    });
    alert("Diagnostic initiated: Test event created for 1 minute from now. Test notification sent.");
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 border-b border-slate-200 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          {selectedTimetable && activeTab === 'planner' && (
            <button onClick={() => setSelectedTimetable(null)} className="p-1 -ml-2 hover:bg-slate-100 rounded-full">
              <XIcon size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">SyncLife</h1>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest opacity-70">Intelligent Pulse</p>
          </div>
        </div>
        <button onClick={() => setActiveTab('settings')} className="p-2 hover:bg-slate-100 rounded-full transition-colors relative">
          <SettingsIcon size={24} />
          {notifications.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-28 pt-4 hide-scrollbar">
        <div className="fixed top-20 right-4 left-4 z-50 pointer-events-none space-y-2">
          {notifications.map((notif, idx) => (
            <div key={idx} className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex justify-between items-center animate-in slide-in-from-top-10 duration-500 pointer-events-auto border border-slate-800">
              <div className="flex items-center gap-3"><BellIcon size={20} className="text-indigo-400" /><span className="text-sm font-semibold">{notif}</span></div>
              <button onClick={() => setNotifications(prev => prev.filter((_, i) => i !== idx))} className="p-1 hover:bg-white/10 rounded-lg"><XIcon size={16} /></button>
            </div>
          ))}
        </div>

        {activeTab === 'routines' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><TrendingUpIcon size={20} /></div>
                  <h3 className="font-bold text-slate-700">Momentum</h3>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-indigo-600">{completionRate}%</span>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Done Today</p>
                </div>
              </div>
              <div className="flex justify-between items-end h-28 gap-2 px-1">
                {weeklyStats.map((stat, idx) => {
                  const height = stat.total > 0 ? (stat.count / stat.total) * 100 : 0;
                  const isToday = idx === 6;
                  return (
                    <div key={stat.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <div className="relative w-full flex-1 flex flex-col justify-end bg-slate-50 rounded-lg overflow-hidden">
                        <div 
                          className={`w-full rounded-t-lg transition-all duration-1000 ease-out ${isToday ? 'bg-indigo-600 shadow-lg shadow-indigo-200' : 'bg-indigo-100'}`} 
                          style={{ height: `${Math.max(height, 5)}%` }} 
                        />
                      </div>
                      <span className={`text-[10px] font-black uppercase ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>{stat.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between items-center px-2">
              <h2 className="text-xl font-black text-slate-800">Your Pulse</h2>
              <button onClick={() => setIsAddingRoutine(true)} className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-100 active:scale-90 transition-all">
                <PlusIcon size={24} />
              </button>
            </div>

            <div className="grid gap-4">
              {routines.length === 0 ? (
                <EmptyState icon={<ClockIcon size={48} />} title="Quiet for now" text="Add routines to build consistent momentum." action={() => setIsAddingRoutine(true)} />
              ) : (
                routines.map(routine => {
                  const today = new Date().toISOString().split('T')[0];
                  const isDoneToday = routine.completionHistory?.includes(today);
                  return (
                    <div key={routine.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between group transition-all hover:shadow-md">
                      <div className="flex items-center gap-4">
                        <button onClick={() => toggleRoutine(routine.id)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isDoneToday ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}><CheckCircleIcon size={32} /></button>
                        <div>
                          <h3 className={`font-bold text-slate-800 ${isDoneToday ? 'line-through opacity-40' : ''}`}>{routine.title}</h3>
                          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1"><ClockIcon size={12} /> {routine.time} <span className="w-1 h-1 bg-slate-200 rounded-full" /> {routine.days.join('·')}</div>
                        </div>
                      </div>
                      <button onClick={() => deleteRoutine(routine.id)} className="p-3 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"><TrashIcon size={20} /></button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
             <div className="flex justify-between items-center px-2">
                <h2 className="text-xl font-black text-slate-800">Timeline</h2>
                <button onClick={() => setIsAddingEvent(true)} className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-100 active:scale-90 transition-all">
                  <PlusIcon size={24} />
                </button>
            </div>
            <div className="grid gap-4">
              {events.length === 0 ? (
                <EmptyState icon={<CalendarIcon size={48} />} title="Free Schedule" text="Add events to stay organized." action={() => setIsAddingEvent(true)} />
              ) : (
                events.sort((a,b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).map(event => (
                  <div key={event.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-black text-xl text-slate-800">{event.title}</h3>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1 uppercase tracking-wider"><CalendarIcon size={12} /> {new Date(event.dateTime).toLocaleDateString()}</span>
                          <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1 uppercase tracking-wider"><ClockIcon size={12} /> {new Date(event.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          {event.reminderMinutes > 0 && <span className="bg-orange-50 text-orange-600 text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1 uppercase tracking-wider"><BellIcon size={12} /> {event.reminderMinutes}m</span>}
                        </div>
                      </div>
                      <button onClick={() => deleteEvent(event.id)} className="p-2 text-slate-200 hover:text-red-500 transition-all"><TrashIcon size={20} /></button>
                    </div>
                    {event.description && <p className="text-slate-500 text-sm mt-4 font-medium border-l-4 border-slate-100 pl-4">{event.description}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'planner' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {!selectedTimetable ? (
              <>
                <div className="flex justify-between items-center px-2">
                  <h2 className="text-xl font-black text-slate-800">Blueprints</h2>
                  <button onClick={() => setIsAddingTimetable(true)} className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg active:scale-90 transition-all"><PlusIcon size={24} /></button>
                </div>
                <div className="grid gap-4">
                  {timetables.length === 0 ? (
                    <EmptyState icon={<LayoutIcon size={48} />} title="No Maps Found" text="Craft your blueprints for study or work." action={() => setIsAddingTimetable(true)} />
                  ) : (
                    timetables.map(t => (
                      <div key={t.id} onClick={() => setSelectedTimetable(t)} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex justify-between items-center group">
                        <div className="flex items-center gap-5">
                          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-[1.5rem] flex items-center justify-center font-black text-2xl">{t.name[0]}</div>
                          <div>
                            <h3 className="font-black text-lg text-slate-800">{t.name}</h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{t.blocks.length} Blocks defined</p>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteTimetable(t.id); }} className="p-3 opacity-0 group-hover:opacity-100 text-slate-200 hover:text-red-500 transition-all"><TrashIcon size={20} /></button>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{selectedTimetable.name}</h2>
                    <p className="text-sm text-slate-400 font-medium italic mt-1">{selectedTimetable.description}</p>
                  </div>
                  <button onClick={() => setSelectedTimetable(null)} className="p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all"><XIcon size={24} /></button>
                </div>
                <div className="relative border-l-4 border-slate-100 ml-6 space-y-6 pb-12 pl-10">
                  {selectedTimetable.blocks.sort((a,b) => a.startTime.localeCompare(b.startTime)).map((block, idx) => (
                    <div key={block.id} className="relative group">
                      <div className="absolute -left-[54px] top-1/2 -translate-y-1/2 w-8 h-8 rounded-2xl border-4 border-white bg-indigo-500 shadow-lg z-10" />
                      <div className={`p-6 rounded-[2rem] shadow-sm border border-l-[12px] ${block.color} flex justify-between items-center hover:scale-[1.02] transition-transform`}>
                        <div>
                          <div className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-2">{block.startTime} — {block.endTime}</div>
                          <h4 className="font-black text-slate-800 text-lg">{block.label}</h4>
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-white/30 flex items-center justify-center text-slate-700"><ClockIcon size={20} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 max-w-lg mx-auto pb-10">
             <div className="text-center space-y-3">
                <div className="inline-flex p-4 bg-indigo-600 text-white rounded-[2rem] shadow-xl shadow-indigo-100 mb-2 rotate-3 hover:rotate-0 transition-transform"><SparklesIcon size={36} /></div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">AI Architect</h2>
                <p className="text-slate-400 font-medium px-4">Leveraging live search to build the perfect routine for your specific goals.</p>
              </div>
              
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-4 focus-within:shadow-xl transition-shadow">
                <textarea 
                  value={aiPrompt} 
                  onChange={(e) => setAiPrompt(e.target.value)} 
                  placeholder="Tell me your goal (e.g., 'Study for GRE and exercise more')..." 
                  className="w-full min-h-[140px] p-6 rounded-[2rem] bg-slate-50 border-none focus:ring-4 focus:ring-indigo-100 focus:outline-none transition-all resize-none text-slate-700 font-medium" 
                />
                <button 
                  disabled={isAiLoading || !aiPrompt} 
                  onClick={handleAiGenerate} 
                  className={`w-full py-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 transition-all ${isAiLoading ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-black shadow-2xl active:scale-95'}`}
                >
                  {isAiLoading ? <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : <><SparklesIcon size={20} /> Build Routine</>}
                </button>
              </div>

              {aiSources.length > 0 && (
                <div className="bg-indigo-50/50 p-6 rounded-[2rem] space-y-3">
                  <h4 className="text-xs font-black uppercase text-indigo-400 tracking-widest flex items-center gap-2"><FlaskConIcon size={14} /> Knowledge Sources</h4>
                  <div className="flex flex-wrap gap-2">
                    {aiSources.map((source, i) => (
                      <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="bg-white border border-indigo-100 text-indigo-600 px-4 py-2 rounded-2xl text-[11px] font-bold flex items-center gap-2 hover:bg-indigo-600 hover:text-white transition-all">
                        <ExternalLinkIcon size={12} /> {source.title.length > 25 ? source.title.substring(0,25) + '...' : source.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
             <h2 className="text-xl font-black text-slate-800">Preferences</h2>
             <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                <SettingsToggle label="Push Notifications" active={Notification.permission === 'granted'} onClick={() => Notification.requestPermission()} />
                <div className="p-5 flex items-center justify-between border-b border-slate-50">
                  <span className="font-bold text-slate-600">Sync Engine</span>
                  <span className="text-xs font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-tighter">Live v3.0</span>
                </div>
                <div className="p-5 flex items-center justify-between border-b border-slate-50 group cursor-pointer hover:bg-slate-50 transition-colors" onClick={runTestDiagnostics}>
                  <div className="flex items-center gap-3">
                    <FlaskConIcon size={20} className="text-indigo-500" />
                    <span className="font-bold text-slate-600">Run Diagnostics</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-300 uppercase">Test Suite</span>
                </div>
                <div className="p-5 flex items-center justify-between text-red-500 font-bold cursor-pointer hover:bg-red-50 transition-colors" onClick={() => { if(confirm('Wipe all local data? This cannot be undone.')) { localStorage.clear(); window.location.reload(); } }}>
                  <span>Hard Reset</span>
                  <TrashIcon size={18} />
                </div>
             </div>
             <div className="p-8 text-center space-y-2 opacity-30">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Built for the future of productivity</p>
                <p className="text-[9px] font-bold text-slate-400 italic">SyncLife Core Engine • Powered by Google DeepMind</p>
             </div>
          </div>
        )}
      </main>

      {/* Modern Float Nav */}
      <nav className="fixed bottom-6 left-6 right-6 bg-slate-900/95 backdrop-blur-2xl border border-white/10 px-8 py-3 rounded-[2.5rem] z-50 shadow-2xl">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <NavItem active={activeTab === 'routines'} onClick={() => setActiveTab('routines')} icon={<ClockIcon size={22} />} label="Pulse" />
          <NavItem active={activeTab === 'events'} onClick={() => setActiveTab('events')} icon={<CalendarIcon size={22} />} label="Flow" />
          <div className="relative -top-8">
            <button 
              onClick={() => setActiveTab('ai')} 
              className={`w-16 h-16 rounded-[2rem] flex items-center justify-center transition-all shadow-2xl shadow-indigo-500/30 active:scale-90 ${activeTab === 'ai' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-900'}`}
            >
              <SparklesIcon size={30} />
            </button>
          </div>
          <NavItem active={activeTab === 'planner'} onClick={() => setActiveTab('planner')} icon={<LayoutIcon size={22} />} label="Map" />
          <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<SettingsIcon size={22} />} label="User" />
        </div>
      </nav>

      {/* Unified Modals */}
      {isAddingRoutine && (
        <Modal onClose={() => setIsAddingRoutine(false)} title="New Pulse">
          <RoutineForm onSave={(r) => { addRoutine(r); setIsAddingRoutine(false); }} onCancel={() => setIsAddingRoutine(false)} />
        </Modal>
      )}

      {isAddingEvent && (
        <Modal onClose={() => setIsAddingEvent(false)} title="New Entry">
          <EventForm onSave={(e) => { addEvent(e); setIsAddingEvent(false); }} onCancel={() => setIsAddingEvent(false)} />
        </Modal>
      )}

      {isAddingTimetable && (
        <Modal onClose={() => setIsAddingTimetable(false)} title="New Blueprint">
          <TimetableForm onSave={(t) => { addTimetable(t); setIsAddingTimetable(false); }} onCancel={() => setIsAddingTimetable(false)} />
        </Modal>
      )}
    </div>
  );
};

// Sub-components for cleaner structure
const NavItem: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-white'}`}>
    {icon}
    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const EmptyState: React.FC<{ icon: React.ReactNode, title: string, text: string, action: () => void }> = ({ icon, title, text, action }) => (
  <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] p-12 text-center space-y-4 hover:border-indigo-200 transition-colors cursor-pointer" onClick={action}>
    <div className="text-slate-200 mx-auto w-fit scale-125">{icon}</div>
    <div>
      <h4 className="font-black text-slate-700 text-lg">{title}</h4>
      <p className="text-slate-400 text-xs font-medium">{text}</p>
    </div>
  </div>
);

const SettingsToggle: React.FC<{ label: string, active: boolean, onClick: () => void }> = ({ label, active, onClick }) => (
  <div className="p-5 flex items-center justify-between border-b border-slate-50" onClick={onClick}>
    <span className="font-bold text-slate-600">{label}</span>
    <div className={`w-14 h-7 rounded-full transition-all relative cursor-pointer p-1 shadow-inner ${active ? 'bg-indigo-600' : 'bg-slate-200'}`}>
      <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-all transform ${active ? 'translate-x-7' : 'translate-x-0'}`} />
    </div>
  </div>
);

const Modal: React.FC<{ onClose: () => void, title: string, children: React.ReactNode }> = ({ onClose, title, children }) => (
  <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
    <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-12 duration-500 max-h-[90vh] flex flex-col">
      <div className="flex justify-between items-center p-8 border-b border-slate-50 flex-shrink-0">
        <h3 className="text-2xl font-black text-slate-800 tracking-tight">{title}</h3>
        <button onClick={onClose} className="p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all"><XIcon size={24} /></button>
      </div>
      <div className="p-8 overflow-y-auto hide-scrollbar">{children}</div>
    </div>
  </div>
);

// Form Components
const RoutineForm: React.FC<{ onSave: (r: Routine) => void, onCancel: () => void }> = ({ onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('08:00');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY]);
  const toggleDay = (day: DayOfWeek) => setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Title</label>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-5 bg-slate-50 rounded-[1.5rem] border-none focus:ring-4 focus:ring-indigo-100 font-bold" placeholder="Morning Zen..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Time</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full p-5 bg-slate-50 rounded-[1.5rem] border-none font-bold" />
        </div>
      </div>
      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Frequency</label>
        <div className="flex flex-wrap gap-2">
          {Object.values(DayOfWeek).map(day => (
            <button key={day} onClick={() => toggleDay(day)} className={`w-12 h-12 rounded-[1rem] text-xs font-black transition-all ${selectedDays.includes(day) ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{day[0]}</button>
          ))}
        </div>
      </div>
      <div className="flex gap-4 pt-6">
        <button onClick={onCancel} className="flex-1 py-5 text-slate-400 font-black uppercase tracking-widest text-[11px]">Discard</button>
        <button onClick={() => onSave({ id: Math.random().toString(), title, time, days: selectedDays, completed: false, category: 'personal', completionHistory: [] })} disabled={!title} className="flex-[2] py-5 bg-indigo-600 text-white font-black rounded-[1.5rem] shadow-xl shadow-indigo-200 disabled:opacity-40 uppercase tracking-widest text-[11px] active:scale-95">Commit</button>
      </div>
    </div>
  );
};

const EventForm: React.FC<{ onSave: (e: Event) => void, onCancel: () => void }> = ({ onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [reminder, setReminder] = useState(15);
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Name</label>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-5 bg-slate-50 rounded-[1.5rem] border-none font-bold" placeholder="Design Review..." />
      </div>
      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Schedule</label>
        <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} className="w-full p-5 bg-slate-50 rounded-[1.5rem] border-none font-bold" />
      </div>
      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Alert Buffer</label>
        <select value={reminder} onChange={(e) => setReminder(parseInt(e.target.value))} className="w-full p-5 bg-slate-50 rounded-[1.5rem] border-none font-bold outline-none appearance-none">
          <option value={5}>5 mins before</option>
          <option value={15}>15 mins before</option>
          <option value={30}>30 mins before</option>
          <option value={60}>1 hour before</option>
        </select>
      </div>
      <div className="flex gap-4 pt-6">
        <button onClick={onCancel} className="flex-1 py-5 text-slate-400 font-black uppercase tracking-widest text-[11px]">Discard</button>
        <button onClick={() => onSave({ id: Math.random().toString(), title, dateTime, reminderMinutes: reminder, notified: false })} disabled={!title || !dateTime} className="flex-[2] py-5 bg-blue-600 text-white font-black rounded-[1.5rem] shadow-xl shadow-blue-200 uppercase tracking-widest text-[11px] active:scale-95">Lock Entry</button>
      </div>
    </div>
  );
};

const TimetableForm: React.FC<{ onSave: (t: Timetable) => void, onCancel: () => void }> = ({ onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  
  const addBlock = () => setBlocks([...blocks, { id: Math.random().toString(), label: '', startTime: '09:00', endTime: '10:00', color: 'bg-indigo-50 border-indigo-200' }]);
  const updateBlock = (id: string, field: keyof TimeBlock, value: string) => setBlocks(blocks.map(b => b.id === id ? { ...b, [field]: value } : b));

  const palette = [
    'bg-indigo-50 border-indigo-200', 'bg-emerald-50 border-emerald-200', 'bg-amber-50 border-amber-200', 'bg-rose-50 border-rose-200', 'bg-blue-50 border-blue-200'
  ];

  return (
    <div className="space-y-8 pb-8">
      <div className="space-y-4">
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full p-5 bg-slate-50 rounded-[1.5rem] border-none font-black text-lg" placeholder="Blueprint Name..." />
        <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-4 bg-slate-50 rounded-[1.5rem] border-none font-medium text-sm" placeholder="Description..." />
      </div>
      
      <div className="space-y-6">
        <div className="flex justify-between items-center px-2">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Map Nodes</label>
          <button onClick={addBlock} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest hover:bg-indigo-100 transition-colors">+ Add Node</button>
        </div>
        
        {blocks.map((block) => (
          <div key={block.id} className="p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 space-y-4">
            <div className="flex gap-4">
              <input value={block.label} onChange={(e) => updateBlock(block.id, 'label', e.target.value)} className="flex-1 p-3 bg-white border-none rounded-2xl text-sm font-bold shadow-sm" placeholder="Node Objective" />
              <button onClick={() => setBlocks(blocks.filter(b => b.id !== block.id))} className="text-red-300 p-2"><TrashIcon size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-300 uppercase ml-2 tracking-widest">Start</label>
                <input type="time" value={block.startTime} onChange={(e) => updateBlock(block.id, 'startTime', e.target.value)} className="w-full p-3 bg-white border-none rounded-xl text-xs font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-300 uppercase ml-2 tracking-widest">End</label>
                <input type="time" value={block.endTime} onChange={(e) => updateBlock(block.id, 'endTime', e.target.value)} className="w-full p-3 bg-white border-none rounded-xl text-xs font-bold" />
              </div>
            </div>
            <div className="flex gap-2">
              {palette.map(c => (
                <button 
                  key={c} 
                  onClick={() => updateBlock(block.id, 'color', c)}
                  className={`w-8 h-8 rounded-xl border-4 transition-all ${c} ${block.color === c ? 'scale-110 shadow-lg' : 'opacity-40'}`} 
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 pt-6">
        <button onClick={onCancel} className="flex-1 py-5 text-slate-400 font-black uppercase tracking-widest text-[11px]">Discard</button>
        <button onClick={() => onSave({ id: Math.random().toString(), name, description, blocks })} disabled={!name || blocks.length === 0} className="flex-[2] py-5 bg-indigo-600 text-white font-black rounded-[1.5rem] shadow-xl uppercase tracking-widest text-[11px] active:scale-95">Deploy</button>
      </div>
    </div>
  );
};

export default App;

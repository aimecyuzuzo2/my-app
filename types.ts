
export enum DayOfWeek {
  MONDAY = 'Mon',
  TUESDAY = 'Tue',
  WEDNESDAY = 'Wed',
  THURSDAY = 'Thu',
  FRIDAY = 'Fri',
  SATURDAY = 'Sat',
  SUNDAY = 'Sun'
}

export interface Routine {
  id: string;
  title: string;
  time: string; // HH:mm
  days: DayOfWeek[];
  category: 'health' | 'work' | 'personal' | 'education';
  completed: boolean;
  lastCompletedDate?: string; // YYYY-MM-DD
  completionHistory: string[]; // Array of YYYY-MM-DD strings
}

export interface Event {
  id: string;
  title: string;
  dateTime: string; // ISO string
  reminderMinutes: number;
  description?: string;
  location?: string;
  notified?: boolean;
}

export interface TimeBlock {
  id: string;
  label: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  color: string;
}

export interface Timetable {
  id: string;
  name: string;
  description: string;
  blocks: TimeBlock[];
}

export interface AppState {
  routines: Routine[];
  events: Event[];
  timetables: Timetable[];
  theme: 'light' | 'dark';
}

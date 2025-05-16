export interface WorkOrder {
  id: string;
  customer: Customer;
  workOrderNumber?: string;
  nextVisitDate?: string;
  visitDate?: string;
  scheduledDate?: string;
  date?: string;
  instructions?: string;
  services?: Service[];
  dispensers?: Dispenser[];
  timeWindows?: TimeWindow[];
  visits?: {
    nextVisit?: {
      date?: string;
      number?: number;
      url?: string;
    };
    visits?: Visit[];
  };
}

export interface Customer {
  id: string;
  name: string;
  storeNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  territory?: string;
}

export interface Dispenser {
  id: string;
  brand?: string;
  serialNumber?: string;
  model?: string;
  grades?: Grade[];
  positions?: Position[];
  blends?: Blend[];
  meters?: Meter[];
  lastCalibrationDate?: string;
}

export interface Grade {
  id?: string;
  dispenserId?: string;
  number?: number;
  name?: string;
  position?: number;
  price?: number;
  [key: string]: any;
}

export interface Position {
  id?: string;
  number?: number;
  side?: string;
  grade?: string | number;
  gradeName?: string;
  gradeNumber?: number;
  handle?: number;
  productCode?: string;
  [key: string]: any;
}

export interface Blend {
  id?: string;
  product?: string;
  components?: BlendComponent[];
  startGallon?: number;
  endGallon?: number;
  [key: string]: any;
}

export interface BlendComponent {
  id?: string;
  product?: string;
  percentage?: number;
  position?: number;
  productCode?: string;
  [key: string]: any;
}

export interface Meter {
  id?: string;
  type?: string;
  number?: number;
  position?: number;
  [key: string]: any;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
}

export interface Visit {
  id: string;
  number: number;
  date: string;
  status?: string;
  url?: string;
}

export interface TimeWindow {
  start: string;
  end: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  storeType: string;
  storeNumber?: string;
  visitNumber?: string;
  dispensers?: Dispenser[];
  instructions?: string;
  services?: Service[];
}

export interface WorkWeekDates {
  currentWeekStart: Date;
  currentWeekEnd: Date;
  nextWeekStart: Date;
  nextWeekEnd: Date;
}

export interface GroupedWorkOrders {
  currentDay: WorkOrder[];
  thisWeek: WorkOrder[];
  nextWeek: WorkOrder[];
  other: WorkOrder[];
}

export type StoreFilter = 'all' | '7-eleven' | 'circle-k' | 'wawa' | 'other';
export type ViewMode = 'weekly' | 'calendar' | 'compact';

export interface StoreStyles {
  cardBorder: string;
  headerBg: string;
  badge: string;
  cardBg: string;
  text: string;
  dot: string;
}

export interface ScheduleStats {
  currentWeekJobCount: number;
  nextWeekJobCount: number;
  storeDistributionForCurrentWeek: Record<string, number>;
  storeDistributionForNextWeek: Record<string, number>;
}
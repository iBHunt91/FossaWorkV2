import { WorkOrder } from './workOrder';

declare module '*.json' {
  export const workOrders: WorkOrder[];
} 
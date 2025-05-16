// Types for the change history data
export interface ChangeItem {
  type: string; // 'added', 'removed', 'modified', 'swapped'
  jobId?: string;
  store?: string;
  storeName?: string;
  date?: string;
  dispensers?: number;
  oldDate?: string;
  newDate?: string;
  removedJobId?: string;
  removedStore?: string;
  removedStoreName?: string;
  removedDispensers?: number;
  location?: string;
  address?: any;
  job1Id?: string;
  job1Store?: string;
  job1StoreName?: string;
  job1Dispensers?: number;
  job1Location?: string;
  job1Address?: any;
  job2Id?: string;
  job2Store?: string;
  job2StoreName?: string;
  job2Dispensers?: number;
  job2Location?: string;
  job2Address?: any;
  oldDate1?: string;
  newDate1?: string;
  oldDate2?: string;
  newDate2?: string;
}

export interface ChangeRecord {
  timestamp: string;
  changes: {
    critical?: ChangeItem[];
    high?: ChangeItem[];
    medium?: ChangeItem[];
    low?: ChangeItem[];
    allChanges?: ChangeItem[];
    summary: {
      removed: number;
      added: number;
      modified: number;
      swapped?: number;
    }
  }
}

export interface WorkOrder {
  id: string;
  customer: {
    name: string;
    storeNumber: string;
    address: {
      street: string;
      intersection: string;
      cityState: string;
      county: string;
    };
  };
  services?: Array<{
    type: string;
    quantity: number;
    description: string;
    code: string;
  }>;
  visits: {
    nextVisit: {
      visitId: string;
      date: string;
      time: string;
      url: string;
    };
  };
  instructions?: string;
  rawHtml?: string;
  dispenserHtml?: string;
  dispensers?: Array<{
    title?: string;
    serial?: string;
    make?: string;
    model?: string;
    fields?: {
      [key: string]: string | undefined;
      Grade?: string;
      'Stand Alone Code'?: string;
      'Number of Nozzles (per side)'?: string;
      'Meter Type'?: string;
    };
  }>;
}

export interface FilterNeed {
  partNumber: string;
  type: 'GAS' | 'DIESEL';
  quantity: number;
  stores: string[];
  stationType: '7-Eleven' | 'Wawa' | 'Circle K';
  warnings?: string[];
} 
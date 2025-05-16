// WorkOrder related types
export interface WorkOrder {
  id: string;
  customer: {
    name: string;
    storeNumber: string;
    address: {
      street: string;
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
    id: string;
    date: string;
    status: string;
    url?: string;
  }[];
  [key: string]: any;
}
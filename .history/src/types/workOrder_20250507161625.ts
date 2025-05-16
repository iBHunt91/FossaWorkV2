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
    storeUrl: string;
  };
  services: Array<{
    type: string;
    quantity: number;
    description: string;
    code: string;
  }>;
  visits: {
    nextVisit: {
      date: string;
      time: string;
      url: string;
      visitId: string;
    };
  };
  instructions: string;
  rawHtml?: string;
} 
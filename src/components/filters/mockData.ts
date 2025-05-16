/**
 * Mock data for testing filter components
 * Contains sample work orders, dispensers, and filter needs
 */

import { WorkOrder } from '../types';
import { ExtendedFilterNeed, ExtendedFilterWarning } from './FilterTypes';

// Sample work orders
export const mockWorkOrders: WorkOrder[] = [
  {
    id: 'WF-1001',
    title: '7-Eleven Store #4523',
    customer: {
      name: '7-Eleven',
      id: 'C001'
    },
    scheduledDate: '2025-05-20T10:00:00.000Z',
    createdDate: '2025-05-01T08:30:00.000Z',
    status: 'scheduled',
    location: {
      address: {
        city: 'Orlando',
        state: 'FL',
        street: '123 Main St',
        zip: '32801'
      }
    },
    description: 'Regular maintenance and filter replacement',
    dispensers: [
      {
        title: 'Dispenser #1',
        serial: 'DSP-9876',
        make: 'Wayne',
        model: 'Ovation2',
        fields: {
          'fuel_type': 'Regular Unleaded',
          'filter_type': 'Particulate',
          'last_replaced': '2024-11-15'
        }
      },
      {
        title: 'Dispenser #2',
        serial: 'DSP-9877',
        make: 'Wayne',
        model: 'Ovation2',
        fields: {
          'fuel_type': 'Premium Unleaded',
          'filter_type': 'Particulate',
          'last_replaced': '2024-11-15'
        }
      }
    ],
    visits: {
      nextVisit: {
        date: '2025-05-20T10:00:00.000Z',
        status: 'scheduled'
      }
    }
  },
  {
    id: 'WF-1002',
    title: 'Circle K #785',
    customer: {
      name: 'Circle K',
      id: 'C002'
    },
    scheduledDate: '2025-05-21T09:00:00.000Z',
    createdDate: '2025-05-02T10:15:00.000Z',
    status: 'scheduled',
    location: {
      address: {
        city: 'Tampa',
        state: 'FL',
        street: '456 Oak Avenue',
        zip: '33601'
      }
    },
    description: 'Filter replacement and DEF system check',
    dispensers: [
      {
        title: 'Dispenser #1',
        serial: 'DSP-5432',
        make: 'Gilbarco',
        model: 'Encore 700 S',
        fields: {
          'fuel_type': 'Regular Unleaded',
          'filter_type': 'Particulate',
          'last_replaced': '2024-11-20'
        }
      },
      {
        title: 'DEF Dispenser',
        serial: 'DEF-1234',
        make: 'Gilbarco',
        model: 'Encore DEF',
        fields: {
          'fuel_type': 'DEF',
          'filter_type': 'DEF',
          'last_replaced': '2024-12-05'
        }
      }
    ],
    visits: {
      nextVisit: {
        date: '2025-05-21T09:00:00.000Z',
        status: 'scheduled'
      }
    }
  },
  {
    id: 'WF-1003',
    title: 'Wawa #321',
    customer: {
      name: 'Wawa',
      id: 'C003'
    },
    scheduledDate: '2025-05-23T14:00:00.000Z',
    createdDate: '2025-05-03T11:45:00.000Z',
    status: 'scheduled',
    location: {
      address: {
        city: 'Jacksonville',
        state: 'FL',
        street: '789 Pine Road',
        zip: '32256'
      }
    },
    description: 'Diesel filter replacement and dispenser maintenance',
    dispensers: [
      {
        title: 'Dispenser #3',
        serial: 'DSP-7890',
        make: 'Wayne',
        model: 'Helix 6000',
        fields: {
          'fuel_type': 'Diesel',
          'filter_type': 'Particulate',
          'last_replaced': '2024-12-10'
        }
      },
      {
        title: 'Diesel High Flow',
        serial: 'DSP-7895',
        make: 'Wayne',
        model: 'Helix 6000 HF',
        fields: {
          'fuel_type': 'Diesel High Flow',
          'filter_type': 'Diesel High Flow',
          'last_replaced': '2024-12-10'
        }
      }
    ],
    visits: {
      nextVisit: {
        date: '2025-05-23T14:00:00.000Z',
        status: 'scheduled'
      }
    }
  },
  {
    id: 'WF-1004',
    title: '7-Eleven Store #4789',
    customer: {
      name: '7-Eleven',
      id: 'C001'
    },
    scheduledDate: '2025-05-24T11:30:00.000Z',
    createdDate: '2025-05-04T09:20:00.000Z',
    status: 'scheduled',
    location: {
      address: {
        city: 'Miami',
        state: 'FL',
        street: '555 Beach Blvd',
        zip: '33139'
      }
    },
    description: 'Regular maintenance and filter replacement',
    dispensers: [
      {
        title: 'Dispenser #1',
        serial: 'DSP-2345',
        make: 'Wayne',
        model: 'Ovation2',
        fields: {
          'fuel_type': 'Regular Unleaded',
          'filter_type': 'Particulate',
          'last_replaced': '2024-12-01'
        }
      },
      {
        title: 'Dispenser #2',
        serial: 'DSP-2346',
        make: 'Wayne',
        model: 'Ovation2',
        fields: {
          'fuel_type': 'Premium Unleaded',
          'filter_type': 'Particulate',
          'last_replaced': '2024-12-01'
        }
      }
    ],
    visits: {
      nextVisit: {
        date: '2025-05-24T11:30:00.000Z',
        status: 'scheduled'
      }
    }
  },
  {
    id: 'WF-1005',
    title: 'Circle K #542',
    customer: {
      name: 'Circle K',
      id: 'C002'
    },
    scheduledDate: '2025-05-27T08:00:00.000Z',
    createdDate: '2025-05-05T14:10:00.000Z',
    status: 'scheduled',
    location: {
      address: {
        city: 'Fort Lauderdale',
        state: 'FL',
        street: '222 Ocean Drive',
        zip: '33301'
      }
    },
    description: 'Filter replacement and system inspection',
    dispensers: [
      {
        title: 'Dispenser #1',
        serial: 'DSP-6789',
        make: 'Gilbarco',
        model: 'Encore 700 S',
        fields: {
          'fuel_type': 'Regular Unleaded',
          'filter_type': 'Particulate',
          'last_replaced': '2024-12-15'
        }
      },
      {
        title: 'Dispenser #2',
        serial: 'DSP-6790',
        make: 'Gilbarco',
        model: 'Encore 700 S',
        fields: {
          'fuel_type': 'Premium Unleaded',
          'filter_type': 'Particulate',
          'last_replaced': '2024-12-15'
        }
      }
    ],
    visits: {
      nextVisit: {
        date: '2025-05-27T08:00:00.000Z',
        status: 'scheduled'
      }
    }
  }
];

// Sample filter needs
export const mockFilterNeeds: ExtendedFilterNeed[] = [
  {
    partNumber: '400MB-10',
    type: 'particulate',
    quantity: 4,
    stores: ['7-Eleven Store #4523', '7-Eleven Store #4789'],
    orderId: 'WF-1001',
    visitId: 'WF-1001',
    visitDate: '2025-05-20T10:00:00.000Z',
    storeName: '7-Eleven Store #4523',
    filterType: 'particulate'
  },
  {
    partNumber: '40510D-AD',
    type: 'particulate',
    quantity: 2,
    stores: ['Circle K #785', 'Circle K #542'],
    orderId: 'WF-1002',
    visitId: 'WF-1002',
    visitDate: '2025-05-21T09:00:00.000Z',
    storeName: 'Circle K #785',
    filterType: 'particulate'
  },
  {
    partNumber: '800HS-30',
    type: 'def',
    quantity: 1,
    stores: ['Circle K #785'],
    orderId: 'WF-1002',
    visitId: 'WF-1002',
    visitDate: '2025-05-21T09:00:00.000Z',
    storeName: 'Circle K #785',
    filterType: 'def'
  },
  {
    partNumber: '450MG-10',
    type: 'diesel',
    quantity: 1,
    stores: ['Wawa #321'],
    orderId: 'WF-1003',
    visitId: 'WF-1003',
    visitDate: '2025-05-23T14:00:00.000Z',
    storeName: 'Wawa #321',
    filterType: 'diesel'
  },
  {
    partNumber: '400HS-10',
    type: 'diesel',
    quantity: 1,
    stores: ['Wawa #321'],
    orderId: 'WF-1003',
    visitId: 'WF-1003',
    visitDate: '2025-05-23T14:00:00.000Z',
    storeName: 'Wawa #321',
    filterType: 'diesel_highflow'
  }
];

// Sample filter warnings
export const mockFilterWarnings = new Map<string, ExtendedFilterWarning[]>([
  ['WF-1001', [
    {
      partNumber: '400MB-10',
      message: 'Filter approaching end of service life',
      severity: 2,
      orderId: 'WF-1001',
      storeName: '7-Eleven Store #4523'
    }
  ]],
  ['WF-1002', [
    {
      partNumber: '40510D-AD',
      message: 'Filter replacement overdue',
      severity: 3,
      orderId: 'WF-1002',
      storeName: 'Circle K #785'
    },
    {
      partNumber: '800HS-30',
      message: 'DEF filter needs inspection',
      severity: 1,
      orderId: 'WF-1002',
      storeName: 'Circle K #785'
    }
  ]],
  ['WF-1003', [
    {
      partNumber: '450MG-10',
      message: 'Diesel filter replacement recommended',
      severity: 2,
      orderId: 'WF-1003',
      storeName: 'Wawa #321'
    }
  ]]
]);

// Export default mock data object
export default {
  workOrders: mockWorkOrders,
  filterNeeds: mockFilterNeeds,
  filterWarnings: mockFilterWarnings
};
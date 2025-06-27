import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import CompactFilterWidgetImproved from '../CompactFilterWidgetImproved';
import { AuthContext } from '../../../contexts/AuthContext';
import * as api from '../../../services/api';

// Mock the API module
jest.mock('../../../services/api');

const mockUser = {
  id: 'test-user-123',
  username: 'testuser',
  email: 'test@example.com'
};

const mockAuthContext = {
  user: mockUser,
  token: 'test-token',
  login: jest.fn(),
  logout: jest.fn(),
  loading: false
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderComponent = () => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <CompactFilterWidgetImproved />
        </AuthContext.Provider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('CompactFilterWidgetImproved', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it('renders loading state initially', () => {
    renderComponent();
    expect(screen.getByText('Filter Requirements')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading filter data...')).toBeInTheDocument();
  });

  it('renders filter data when loaded', async () => {
    const mockWorkOrders = [
      { id: '1', site_name: 'Store #123', scheduled_date: new Date().toISOString() }
    ];
    
    const mockFilterData = {
      totalFilters: 45,
      totalBoxes: 5,
      summary: [
        { partNumber: 'GF-001', description: 'Gas Filter Standard', quantity: 30 },
        { partNumber: 'DF-001', description: 'Diesel Filter', quantity: 10 },
        { partNumber: 'DEF-001', description: 'DEF Filter', quantity: 5 }
      ],
      warnings: [
        { id: '1', severity: 8, message: 'Missing dispenser data' }
      ]
    };

    (api.apiClient.get as jest.Mock).mockResolvedValue({ data: mockWorkOrders });
    (api.apiClient.post as jest.Mock).mockResolvedValue({ data: mockFilterData });
    (api.getUserPreferences as jest.Mock).mockResolvedValue({ work_week: { days: [1, 2, 3, 4, 5] } });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText('Total Filters')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Total Boxes')).toBeInTheDocument();
    });

    expect(screen.getByText('Gas Filter Standard')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('shows warning badge for high severity warnings', async () => {
    const mockFilterData = {
      totalFilters: 10,
      totalBoxes: 2,
      summary: [],
      warnings: [
        { id: '1', severity: 8, message: 'High severity warning' },
        { id: '2', severity: 5, message: 'Low severity warning' }
      ]
    };

    (api.apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
    (api.apiClient.post as jest.Mock).mockResolvedValue({ data: mockFilterData });
    (api.getUserPreferences as jest.Mock).mockResolvedValue({});

    renderComponent();

    await waitFor(() => {
      const warningBadge = screen.getByRole('status');
      expect(warningBadge).toHaveTextContent('1'); // Only high severity
    });
  });

  it('switches between current and next week tabs', async () => {
    renderComponent();

    const nextWeekButton = screen.getByRole('tab', { name: /next week/i });
    fireEvent.click(nextWeekButton);

    expect(nextWeekButton).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /current week/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('shows error state and retry button on failure', async () => {
    (api.apiClient.get as jest.Mock).mockRejectedValue(new Error('Network error'));
    (api.getUserPreferences as jest.Mock).mockResolvedValue({});

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Unable to load filter data')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('shows empty state when no filters needed', async () => {
    (api.apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
    (api.getUserPreferences as jest.Mock).mockResolvedValue({});

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('No filters needed')).toBeInTheDocument();
    });
  });

  it('provides link to full filters page', async () => {
    renderComponent();

    const filterLink = screen.getByRole('link', { name: /view all filters/i });
    expect(filterLink).toHaveAttribute('href', '/filters');
  });

  it('handles refresh button click', async () => {
    renderComponent();

    const refreshButton = screen.getByLabelText('Refresh filter data');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(api.apiClient.get).toHaveBeenCalled();
    });
  });
});
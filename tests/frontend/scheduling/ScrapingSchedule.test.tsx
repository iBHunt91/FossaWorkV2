import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ScrapingSchedule from '@/components/ScrapingSchedule';
import { AuthContext } from '@/contexts/AuthContext';
import { apiClient } from '@/services/api';

// Mock API client
vi.mock('@/services/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock auth context
const mockAuthContext = {
  isAuthenticated: true,
  token: 'test-token',
  user: { id: 'test-user-123', username: 'testuser' },
  login: vi.fn(),
  logout: vi.fn(),
};

const renderWithAuth = (component: React.ReactElement, authOverrides = {}) => {
  return render(
    <AuthContext.Provider value={{ ...mockAuthContext, ...authOverrides }}>
      {component}
    </AuthContext.Provider>
  );
};

// Sample data
const mockSchedule = {
  id: 1,
  user_id: 'test-user-123',
  schedule_type: 'work_orders',
  interval_hours: 2.0,
  active_hours: { start: 6, end: 22 },
  enabled: true,
  last_run: '2024-01-13T10:00:00Z',
  next_run: '2024-01-13T12:00:00Z',
  consecutive_failures: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-13T10:00:00Z',
  status: 'active',
};

const mockHistory = [
  {
    id: 1,
    started_at: '2024-01-13T10:00:00Z',
    completed_at: '2024-01-13T10:05:00Z',
    success: true,
    items_processed: 150,
    error_message: null,
    duration_seconds: 300,
    trigger_type: 'scheduled',
  },
  {
    id: 2,
    started_at: '2024-01-13T08:00:00Z',
    completed_at: '2024-01-13T08:03:00Z',
    success: false,
    items_processed: 0,
    error_message: 'Authentication failed',
    duration_seconds: 180,
    trigger_type: 'manual',
  },
];

const mockDaemonStatus = {
  daemon_status: 'running',
  last_execution: '2024-01-13T11:00:00Z',
  total_schedules: 5,
  active_schedules: 3,
  message: 'Scheduler daemon runs as a separate process.',
};

describe('ScrapingSchedule Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should show login message when not authenticated', () => {
      renderWithAuth(<ScrapingSchedule />, { isAuthenticated: false });
      
      expect(screen.getByText(/please log in/i)).toBeInTheDocument();
    });

    it('should load schedule data when authenticated', async () => {
      apiClient.get.mockResolvedValueOnce({ data: [mockSchedule] })
        .mockResolvedValueOnce({ data: mockHistory })
        .mockResolvedValueOnce({ data: mockDaemonStatus });

      renderWithAuth(<ScrapingSchedule />);

      await waitFor(() => {
        expect(screen.getByText('Work Order Scraping Schedule')).toBeInTheDocument();
      });

      expect(apiClient.get).toHaveBeenCalledWith('/api/scraping-schedules/');
    });
  });

  describe('Schedule Display', () => {
    it('should display schedule information correctly', async () => {
      apiClient.get.mockResolvedValueOnce({ data: [mockSchedule] })
        .mockResolvedValueOnce({ data: mockHistory })
        .mockResolvedValueOnce({ data: mockDaemonStatus });

      renderWithAuth(<ScrapingSchedule />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('2')).toBeInTheDocument(); // Interval hours
        expect(screen.getByDisplayValue('6')).toBeInTheDocument(); // Start hour
        expect(screen.getByDisplayValue('22')).toBeInTheDocument(); // End hour
        expect(screen.getByText('Active')).toBeInTheDocument(); // Status badge
      });
    });

    it('should display daemon status', async () => {
      apiClient.get.mockResolvedValueOnce({ data: [mockSchedule] })
        .mockResolvedValueOnce({ data: mockHistory })
        .mockResolvedValueOnce({ data: mockDaemonStatus });

      renderWithAuth(<ScrapingSchedule />);

      await waitFor(() => {
        expect(screen.getByText('Scheduler Status')).toBeInTheDocument();
        expect(screen.getByText('Running')).toBeInTheDocument();
        expect(screen.getByText('Total Schedules:')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
      });
    });

    it('should display execution history', async () => {
      apiClient.get.mockResolvedValueOnce({ data: [mockSchedule] })
        .mockResolvedValueOnce({ data: mockHistory })
        .mockResolvedValueOnce({ data: mockDaemonStatus });

      renderWithAuth(<ScrapingSchedule />);

      await waitFor(() => {
        expect(screen.getByText('Recent Execution History')).toBeInTheDocument();
        expect(screen.getByText('Success')).toBeInTheDocument();
        expect(screen.getByText('Failed')).toBeInTheDocument();
        expect(screen.getByText('150 items')).toBeInTheDocument();
        expect(screen.getByText('Authentication failed')).toBeInTheDocument();
      });
    });
  });

  describe('Schedule Creation', () => {
    it('should create a new schedule', async () => {
      apiClient.get.mockResolvedValueOnce({ data: [] }) // No existing schedule
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: mockDaemonStatus });

      apiClient.post.mockResolvedValueOnce({ data: mockSchedule });

      renderWithAuth(<ScrapingSchedule />);

      await waitFor(() => {
        expect(screen.getByText('Create Schedule')).toBeInTheDocument();
      });

      // Set interval
      const intervalInput = screen.getByLabelText(/scraping interval/i);
      await userEvent.clear(intervalInput);
      await userEvent.type(intervalInput, '3');

      // Click create
      fireEvent.click(screen.getByText('Create Schedule'));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/api/scraping-schedules/', {
          schedule_type: 'work_orders',
          interval_hours: 3,
          active_hours: { start: 6, end: 22 },
          enabled: true,
        });
      });
    });

    it('should handle creation errors', async () => {
      apiClient.get.mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: mockDaemonStatus });

      apiClient.post.mockRejectedValueOnce({
        response: { data: { detail: 'Schedule already exists' } },
      });

      renderWithAuth(<ScrapingSchedule />);

      await waitFor(() => {
        expect(screen.getByText('Create Schedule')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Schedule'));

      await waitFor(() => {
        expect(screen.getByText('Schedule already exists')).toBeInTheDocument();
      });
    });
  });

  describe('Schedule Updates', () => {
    it('should update schedule interval', async () => {
      apiClient.get.mockResolvedValueOnce({ data: [mockSchedule] })
        .mockResolvedValueOnce({ data: mockHistory })
        .mockResolvedValueOnce({ data: mockDaemonStatus });

      apiClient.put.mockResolvedValueOnce({ data: { ...mockSchedule, interval_hours: 4 } });

      renderWithAuth(<ScrapingSchedule />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('2')).toBeInTheDocument();
      });

      // Change interval
      const intervalInput = screen.getByLabelText(/scraping interval/i);
      await userEvent.clear(intervalInput);
      await userEvent.type(intervalInput, '4');

      // Update schedule
      fireEvent.click(screen.getByText('Pause Schedule'));

      await waitFor(() => {
        expect(apiClient.put).toHaveBeenCalledWith('/api/scraping-schedules/1', {
          interval_hours: 4,
          active_hours: { start: 6, end: 22 },
          enabled: false,
        });
      });
    });

    it('should toggle active hours', async () => {
      apiClient.get.mockResolvedValueOnce({ data: [mockSchedule] })
        .mockResolvedValueOnce({ data: mockHistory })
        .mockResolvedValueOnce({ data: mockDaemonStatus });

      renderWithAuth(<ScrapingSchedule />);

      await waitFor(() => {
        expect(screen.getByLabelText(/limit to specific hours/i)).toBeChecked();
      });

      // Toggle active hours
      const checkbox = screen.getByLabelText(/limit to specific hours/i);
      fireEvent.click(checkbox);

      // Should hide hour inputs
      expect(screen.queryByLabelText('Start:')).not.toBeInTheDocument();
    });

    it('should enable/disable schedule', async () => {
      apiClient.get.mockResolvedValueOnce({ data: [mockSchedule] })
        .mockResolvedValueOnce({ data: mockHistory })
        .mockResolvedValueOnce({ data: mockDaemonStatus });

      apiClient.put.mockResolvedValueOnce({ 
        data: { ...mockSchedule, enabled: false, status: 'paused' } 
      });

      renderWithAuth(<ScrapingSchedule />);

      await waitFor(() => {
        expect(screen.getByText('Pause Schedule')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Pause Schedule'));

      await waitFor(() => {
        expect(apiClient.put).toHaveBeenCalledWith('/api/scraping-schedules/1', {
          interval_hours: 2,
          active_hours: { start: 6, end: 22 },
          enabled: false,
        });
      });
    });
  });

  describe('Manual Run', () => {
    it('should trigger manual run', async () => {
      apiClient.get.mockResolvedValueOnce({ data: [mockSchedule] })
        .mockResolvedValueOnce({ data: mockHistory })
        .mockResolvedValueOnce({ data: mockDaemonStatus });

      apiClient.post.mockResolvedValueOnce({ 
        data: { message: 'Schedule will run within the next minute', schedule_id: 1 } 
      });

      renderWithAuth(<ScrapingSchedule />);

      await waitFor(() => {
        expect(screen.getByText('Run Now')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Run Now'));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/api/scraping-schedules/1/run');
        expect(screen.getByText(/will run within the next minute/i)).toBeInTheDocument();
      });
    });

    it('should show loading state during manual run', async () => {
      apiClient.get.mockResolvedValueOnce({ data: [mockSchedule] })
        .mockResolvedValueOnce({ data: mockHistory })
        .mockResolvedValueOnce({ data: mockDaemonStatus });

      apiClient.post.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderWithAuth(<ScrapingSchedule />);

      await waitFor(() => {
        expect(screen.getByText('Run Now')).toBeInTheDocument();
      });

      const runButton = screen.getByText('Run Now');
      fireEvent.click(runButton);

      // Check for spinning icon
      const icon = within(runButton).getByRole('img', { hidden: true });
      expect(icon).toHaveClass('animate-spin');
    });
  });

  describe('Schedule Deletion', () => {
    it('should delete schedule', async () => {
      apiClient.get.mockResolvedValueOnce({ data: [mockSchedule] })
        .mockResolvedValueOnce({ data: mockHistory })
        .mockResolvedValueOnce({ data: mockDaemonStatus });

      apiClient.delete.mockResolvedValueOnce({ data: { message: 'Schedule deleted' } });

      renderWithAuth(<ScrapingSchedule />);

      await waitFor(() => {
        expect(screen.getByText('Delete Schedule')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Delete Schedule'));

      await waitFor(() => {
        expect(apiClient.delete).toHaveBeenCalledWith('/api/scraping-schedules/1');
        expect(screen.getByText(/deleted successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display API errors', async () => {
      apiClient.get.mockRejectedValueOnce(new Error('Network error'));

      renderWithAuth(<ScrapingSchedule />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load schedule')).toBeInTheDocument();
      });
    });

    it('should handle failed schedule status', async () => {
      const failedSchedule = { 
        ...mockSchedule, 
        consecutive_failures: 5,
        status: 'failed' 
      };

      apiClient.get.mockResolvedValueOnce({ data: [failedSchedule] })
        .mockResolvedValueOnce({ data: mockHistory })
        .mockResolvedValueOnce({ data: mockDaemonStatus });

      renderWithAuth(<ScrapingSchedule />);

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument();
        expect(screen.getByText(/consecutive failures/i)).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
      });
    });
  });

  describe('Auto-refresh', () => {
    it('should refresh data every 30 seconds', async () => {
      vi.useFakeTimers();

      apiClient.get.mockResolvedValue({ data: [] });

      renderWithAuth(<ScrapingSchedule />);

      // Initial calls
      expect(apiClient.get).toHaveBeenCalledTimes(3);

      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledTimes(6); // 3 more calls
      });

      vi.useRealTimers();
    });

    it('should cleanup interval on unmount', async () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      apiClient.get.mockResolvedValue({ data: [] });

      const { unmount } = renderWithAuth(<ScrapingSchedule />);

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Edge Cases', () => {
    it('should handle schedules with no history', async () => {
      apiClient.get.mockResolvedValueOnce({ data: [mockSchedule] })
        .mockResolvedValueOnce({ data: [] }) // No history
        .mockResolvedValueOnce({ data: mockDaemonStatus });

      renderWithAuth(<ScrapingSchedule />);

      await waitFor(() => {
        expect(screen.queryByText('Recent Execution History')).not.toBeInTheDocument();
      });
    });

    it('should handle invalid hour inputs', async () => {
      apiClient.get.mockResolvedValueOnce({ data: [mockSchedule] })
        .mockResolvedValueOnce({ data: mockHistory })
        .mockResolvedValueOnce({ data: mockDaemonStatus });

      renderWithAuth(<ScrapingSchedule />);

      await waitFor(() => {
        expect(screen.getByLabelText('Start:')).toBeInTheDocument();
      });

      const startHourInput = screen.getByLabelText('Start:');
      await userEvent.clear(startHourInput);
      await userEvent.type(startHourInput, '25'); // Invalid hour

      // Should be clamped to valid range
      expect(startHourInput).toHaveValue(23);
    });

    it('should format durations correctly', async () => {
      const historyWithVariousDurations = [
        { ...mockHistory[0], duration_seconds: 45.5 }, // < 1 minute
        { ...mockHistory[1], duration_seconds: 125 },   // > 1 minute
      ];

      apiClient.get.mockResolvedValueOnce({ data: [mockSchedule] })
        .mockResolvedValueOnce({ data: historyWithVariousDurations })
        .mockResolvedValueOnce({ data: mockDaemonStatus });

      renderWithAuth(<ScrapingSchedule />);

      await waitFor(() => {
        expect(screen.getByText('45.5s')).toBeInTheDocument();
        expect(screen.getByText('2m 5s')).toBeInTheDocument();
      });
    });
  });
});
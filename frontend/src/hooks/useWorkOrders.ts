import { useQuery } from '@tanstack/react-query';
import { fetchWorkOrders, type WorkOrder } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export interface UseWorkOrdersResult {
  workOrders: WorkOrder[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export const useWorkOrders = (): UseWorkOrdersResult => {
  const { user } = useAuth();

  const {
    data: workOrders = [],
    isLoading: loading,
    error,
    refetch
  } = useQuery({
    queryKey: ['workOrders', user?.id],
    queryFn: () => fetchWorkOrders(user?.id || ''),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });

  return {
    workOrders,
    loading,
    error: error as Error | null,
    refetch
  };
};
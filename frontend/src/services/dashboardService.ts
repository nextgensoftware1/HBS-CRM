// frontend/src/services/dashboardService.ts
import api from './api';
import { DashboardStats } from '../types/types';

export const dashboardService = {
  // Get overview statistics
  async getOverview(): Promise<DashboardStats> {
    const response = await api.get<{ status: string; data: DashboardStats }>('/dashboard/overview');
    return response.data.data;
  },

  // Get client-specific stats
  async getClientStats(clientId: string): Promise<any> {
    const response = await api.get(`/dashboard/client/${clientId}`);
    return response.data.data;
  },

  // Get provider-specific stats
  async getProviderStats(providerId: string): Promise<any> {
    const response = await api.get(`/dashboard/provider/${providerId}`);
    return response.data.data;
  },

  // Get operational metrics
  async getOperationalMetrics(): Promise<any> {
    const response = await api.get('/dashboard/operational');
    return response.data.data;
  },
};
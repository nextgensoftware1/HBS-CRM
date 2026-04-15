// frontend/src/services/providerService.ts
import api from './api';
import { Provider, Client } from '../types/types';

type Pagination = {
  total: number;
  page: number;
  pages: number;
};

type ListResult<T> = {
  items: T[];
  pagination: Pagination;
};

type ProviderProfileResult = {
  provider: Provider;
  enrollments: any[];
  recentDocuments: any[];
};

export const providerService = {
  // Get all providers with pagination
  async getProviders(page = 1, limit = 10, search = '', clientId = ''): Promise<ListResult<Provider>> {
    const response = await api.get('/providers', {
      params: { page, limit, search, clientId },
    });
    return {
      items: response.data?.data?.providers || [],
      pagination: response.data?.data?.pagination || { total: 0, page, pages: 0 },
    };
  },

  // Get single provider by ID
  async getProviderById(id: string): Promise<Provider> {
    const response = await api.get<{ status: string; data: { provider: Provider } }>(`/providers/${id}`);
    return response.data.data.provider;
  },

  // Get provider profile details with enrollments/documents
  async getProviderProfile(id: string): Promise<ProviderProfileResult> {
    const response = await api.get(`/providers/${id}`);
    return {
      provider: response.data?.data?.provider,
      enrollments: response.data?.data?.enrollments || [],
      recentDocuments: response.data?.data?.recentDocuments || [],
    };
  },

  // Create new provider
  async createProvider(data: Record<string, any>): Promise<Provider> {
    const response = await api.post<{ status: string; data: { provider: Provider } }>('/providers', data);
    return response.data.data.provider;
  },

  // Update provider
  async updateProvider(id: string, data: Record<string, any>): Promise<Provider> {
    const response = await api.put<{ status: string; data: { provider: Provider } }>(`/providers/${id}`, data);
    return response.data.data.provider;
  },

  // Delete provider
  async deleteProvider(id: string): Promise<void> {
    await api.delete(`/providers/${id}`);
  },

  // Get provider statistics
  async getProviderStats(id: string): Promise<any> {
    const response = await api.get(`/providers/${id}/stats`);
    return response.data.data;
  },

  // Get clients for provider creation form
  async getClientOptions(): Promise<Client[]> {
    const response = await api.get('/providers/client-options');
    return response.data?.data?.clients || [];
  },
};
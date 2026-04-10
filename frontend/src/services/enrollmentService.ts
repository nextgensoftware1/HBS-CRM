// frontend/src/services/enrollmentService.ts
import api from './api';
import { Enrollment } from '../types/types';

type Pagination = {
  total: number;
  page: number;
  pages: number;
};

type ListResult<T> = {
  items: T[];
  pagination: Pagination;
};

export const enrollmentService = {
  // Get all enrollments
  async getEnrollments(page = 1, limit = 10, filters = {}): Promise<ListResult<Enrollment>> {
    const response = await api.get('/enrollments', {
      params: { page, limit, ...filters },
    });
    return {
      items: response.data?.data?.enrollments || [],
      pagination: response.data?.data?.pagination || { total: 0, page, pages: 0 },
    };
  },

  // Get single enrollment
  async getEnrollmentById(id: string): Promise<Enrollment> {
    const response = await api.get<{ status: string; data: { enrollment: Enrollment } }>(`/enrollments/${id}`);
    return response.data.data.enrollment;
  },

  // Create enrollment
  async createEnrollment(data: Partial<Enrollment>): Promise<Enrollment> {
    const response = await api.post<{ status: string; data: { enrollment: Enrollment } }>('/enrollments', data);
    return response.data.data.enrollment;
  },

  // Update enrollment status
  async updateEnrollmentStatus(id: string, status: string, notes?: string): Promise<Enrollment> {
    const response = await api.put<{ status: string; data: { enrollment: Enrollment } }>(
      `/enrollments/${id}/status`,
      { status, notes }
    );
    return response.data.data.enrollment;
  },

  // Delete enrollment
  async deleteEnrollment(id: string): Promise<void> {
    await api.delete(`/enrollments/${id}`);
  },

  // Get Kanban board data
  async getKanbanBoard(filters = {}): Promise<any> {
    const response = await api.get('/enrollments/kanban/board', { params: filters });
    return response.data.data;
  },

  // Add note to enrollment
  async addNote(id: string, note: any): Promise<Enrollment> {
    const response = await api.post<{ status: string; data: { enrollment: Enrollment } }>(
      `/enrollments/${id}/notes`,
      note
    );
    return response.data.data.enrollment;
  },
};
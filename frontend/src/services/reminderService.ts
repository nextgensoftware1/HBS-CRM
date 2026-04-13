import api from './api';

type Pagination = {
  total: number;
  page: number;
  pages: number;
};

type ListResult<T> = {
  items: T[];
  pagination: Pagination;
};

export const reminderService = {
  async getReminders(page = 1, limit = 10, filters = {}): Promise<ListResult<any>> {
    const response = await api.get('/reminders', {
      params: { page, limit, ...filters },
    });

    return {
      items: response.data?.data?.reminders || [],
      pagination: response.data?.data?.pagination || { total: 0, page, pages: 0 },
    };
  },

  async completeReminder(id: string, actionNote?: string): Promise<void> {
    await api.put(`/reminders/${id}/complete`, { actionNote });
  },

  async dismissReminder(id: string, actionNote?: string): Promise<void> {
    await api.put(`/reminders/${id}/dismiss`, { actionNote });
  },

  async deleteReminder(id: string, actionNote?: string): Promise<void> {
    await api.delete(`/reminders/${id}`, { data: { actionNote } });
  },

  async createReminder(payload: {
    enrollmentId?: string;
    providerId: string;
    reminderType: string;
    title: string;
    description: string;
    dueDate: string;
    priority: string;
    assignedTo: string;
    metadata?: Record<string, any>;
  }): Promise<any> {
    const response = await api.post('/reminders', payload);
    return response.data?.data?.reminder;
  },
};

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
};

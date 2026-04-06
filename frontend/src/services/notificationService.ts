import api from './api';

type NotificationActor = {
  _id: string;
  fullName?: string;
  email?: string;
  role?: string;
};

export type AppNotification = {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actor?: NotificationActor;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
};

export const notificationService = {
  async getNotifications(page = 1, limit = 15, unreadOnly = false): Promise<{ items: AppNotification[]; total: number }> {
    const response = await api.get('/notifications', {
      params: { page, limit, unreadOnly },
    });

    return {
      items: response.data?.data?.notifications || [],
      total: response.data?.data?.pagination?.total || 0,
    };
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get('/notifications/unread-count');
    return response.data?.data?.unreadCount || 0;
  },

  async markAsRead(notificationId: string): Promise<void> {
    await api.put(`/notifications/${notificationId}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/read-all');
  },
};

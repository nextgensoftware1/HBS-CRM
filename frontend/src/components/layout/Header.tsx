// frontend/src/components/layout/Header.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { FiBell, FiUser, FiLogOut, FiSettings } from 'react-icons/fi';
import { notificationService, type AppNotification } from '../../services/notificationService';

export default function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(false);

  const isAdmin = user?.role === 'admin';
  const profilePath = isAdmin ? '/admin' : '/workspace';
  const settingsPath = isAdmin ? '/admin/enrollments' : '/workspace';
  const profileLabel = isAdmin ? 'Admin Dashboard' : 'User Dashboard';
  const settingsLabel = isAdmin ? 'Admin Routes' : 'Workspace';

  const handleLogout = () => {
    const logoutPath = user?.role === 'admin' ? '/admin/login' : '/login';
    logout();
    navigate(logoutPath);
  };

  const loadNotificationCount = async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Keep header resilient even if notifications API is temporarily unavailable.
    }
  };

  const loadNotifications = async () => {
    try {
      setNotificationLoading(true);
      const data = await notificationService.getNotifications(1, 12, false);
      setNotifications(data.items);
    } catch {
      setNotifications([]);
    } finally {
      setNotificationLoading(false);
    }
  };

  const openNotifications = async () => {
    const nextOpen = !showNotificationMenu;
    setShowNotificationMenu(nextOpen);
    setShowUserMenu(false);

    if (nextOpen) {
      await loadNotifications();
      await loadNotificationCount();
    }
  };

  const markOneAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications((prev) => prev.map((item) => (
        item._id === notificationId ? { ...item, isRead: true } : item
      )));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // no-op
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    loadNotificationCount();
    const intervalId = window.setInterval(loadNotificationCount, 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Search Bar */}
      <div className="flex-1 max-w-2xl">
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <div className="absolute left-3 top-2.5">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-4 ml-6">
        {/* Notifications */}
        <button
          onClick={openNotifications}
          className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <FiBell className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-danger-500 ring-2 ring-white"></span>
          )}
        </button>

        {showNotificationMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowNotificationMenu(false)} />
            <div className="absolute right-20 top-14 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Notifications</p>
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  Mark all as read
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notificationLoading ? (
                  <p className="px-4 py-3 text-sm text-gray-500">Loading notifications...</p>
                ) : notifications.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-500">No notifications yet.</p>
                ) : notifications.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => markOneAsRead(item._id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${item.isRead ? 'bg-white' : 'bg-blue-50/40'}`}
                  >
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{item.message}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotificationMenu(false);
            }}
            className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user?.fullName?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />
              
              {/* Menu */}
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate(profilePath);
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <FiUser className="mr-3 h-4 w-4" />
                  {profileLabel}
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate(settingsPath);
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <FiSettings className="mr-3 h-4 w-4" />
                  {settingsLabel}
                </button>
                <hr className="my-1 border-gray-200" />
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-2 text-sm text-danger-600 hover:bg-danger-50"
                >
                  <FiLogOut className="mr-3 h-4 w-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
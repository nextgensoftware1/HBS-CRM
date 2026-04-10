// frontend/src/components/layout/Header.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { FiBell, FiUser, FiLogOut, FiSettings, FiMenu } from 'react-icons/fi';
import { notificationService, type AppNotification } from '../../services/notificationService';

type HeaderProps = {
  onMenuToggle: () => void;
};

export default function Header({ onMenuToggle }: HeaderProps) {
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
  const userInitial = user?.fullName?.trim()?.charAt(0)?.toUpperCase() || 'U';
  const userDisplayName = user?.fullName || 'User';
  const userRoleLabel = user?.role?.replace('_', ' ') || 'member';

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

  const getNotificationTargetPath = (item: AppNotification) => {
    const entityType = String(item.entityType || '').toLowerCase();
    const type = String(item.type || '').toLowerCase();
    const entityId = item.entityId || '';

    if (entityType === 'document') {
      if (!entityId) return '/documents';

      if (type === 'document_deleted') {
        return '/documents';
      }

      return `/documents/${entityId}/submission`;
    }

    if (entityType === 'enrollment') {
      return '/enrollments';
    }

    return '/documents';
  };

  const handleNotificationClick = async (item: AppNotification) => {
    if (!item.isRead) {
      await markOneAsRead(item._id);
    }

    setShowNotificationMenu(false);
    setShowUserMenu(false);
    navigate(getNotificationTargetPath(item));
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
    <header className="relative z-40 h-16 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 gap-3 shadow-[0_1px_0_0_rgba(148,163,184,.15)]">
      {/* Search Bar */}
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onMenuToggle}
          className="lg:hidden inline-flex items-center justify-center p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
          aria-label="Open menu"
        >
          <FiMenu className="h-5 w-5" />
        </button>

        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            placeholder="Search..."
            className="w-full min-w-0 pl-10 pr-4 py-2 border border-slate-300 rounded-xl bg-white/90 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <div className="absolute left-3 top-2.5">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Right Section */}
  <div className="flex items-center space-x-1 sm:space-x-4 ml-1 sm:ml-6">
        {/* Notifications */}
        <button
          onClick={openNotifications}
          className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <FiBell className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-danger-500 ring-2 ring-white"></span>
          )}
        </button>

        {showNotificationMenu && (
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setShowNotificationMenu(false)} />
            <div className="fixed right-2 sm:right-6 top-[4.25rem] w-[calc(100vw-1rem)] max-w-sm sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-[80] overflow-hidden">
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
                    onClick={() => handleNotificationClick(item)}
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
            className="flex items-center space-x-3 p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center shadow-sm shadow-primary-300/40">
              <span className="text-white text-sm font-medium">
                {userInitial}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-900">{userDisplayName}</p>
              <p className="text-xs text-gray-500 capitalize">{userRoleLabel}</p>
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
                className="fixed inset-0 z-[70]"
                onClick={() => setShowUserMenu(false)}
              />
              
              {/* Menu */}
              <div className="fixed right-2 sm:right-6 top-[4.25rem] w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-[80]">
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
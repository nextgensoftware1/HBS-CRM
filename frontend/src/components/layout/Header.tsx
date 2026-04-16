// frontend/src/components/layout/Header.tsx
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { FiBell, FiUser, FiLogOut, FiSettings, FiMenu, FiSearch, FiX } from 'react-icons/fi';
import { notificationService, type AppNotification } from '../../services/notificationService';
import { reminderService } from '../../services/reminderService';

type HeaderProps = {
  onMenuToggle: () => void;
};

export default function Header({ onMenuToggle }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const notificationContainerRef = useRef<HTMLDivElement | null>(null);
  const userMenuContainerRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = user?.role === 'admin';
  const profilePath = isAdmin ? '/admin' : '/workspace';
  const settingsPath = isAdmin ? '/admin/enrollments' : '/workspace';
  const profileLabel = isAdmin ? 'Admin Dashboard' : 'User Dashboard';
  const settingsLabel = isAdmin ? 'Admin Routes' : 'Workspace';
  const userInitial = user?.fullName?.trim()?.charAt(0)?.toUpperCase() || 'U';
  const userDisplayName = user?.fullName || 'User';
  const userRoleLabel = user?.role?.replace(/_/g, ' ') || 'member';

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
    setShowSearchBar(false);

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

    const meta = item.metadata || {};

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

    // If notification is about a reminder (missing document request), prefer opening the related submission
    if (entityType === 'reminder') {
      const submissionId = String(meta.submissionId || '').trim();
      if (submissionId) {
        return `/documents/${submissionId}/submission`;
      }

      // If reminder references an enrollment, try opening that enrollment's submission view
      if (item.entityId) {
        return `/reminders/${item.entityId}`;
      }

      return '/documents';
    }

    return '/documents';
  };

  const handleNotificationClick = async (item: AppNotification) => {
    if (!item.isRead) {
      await markOneAsRead(item._id);
    }

    setShowNotificationMenu(false);
    setShowUserMenu(false);

    try {
      // If this is a reminder notification but metadata lacks submissionId, fetch the reminder
      // to attempt to find a submissionId to open the correct submission view.
      const entityType = String(item.entityType || '').toLowerCase();
      if (entityType === 'reminder') {
        const metaSubmissionId = String(item.metadata?.submissionId || '').trim();
        const lowered = (metaSubmissionId || '').toLowerCase();
        const hasValidMetaSubmission = !!metaSubmissionId && lowered !== 'undefined' && lowered !== 'null';
        if (hasValidMetaSubmission) {
          navigate(`/documents/${metaSubmissionId}/submission`);
          return;
        }

        // Try to fetch reminder details as a fallback to locate submissionId
        if (item.entityId) {
          try {
            // Use the single-reminder endpoint which reliably returns populated metadata
            const reminder = await reminderService.getReminder(item.entityId);
            const fetchedSubmissionId = String(reminder?.metadata?.submissionId || '').trim();
            const loweredFetched = (fetchedSubmissionId || '').toLowerCase();
            const hasFetchedValid = !!fetchedSubmissionId && loweredFetched !== 'undefined' && loweredFetched !== 'null';
            if (hasFetchedValid) {
              navigate(`/documents/${fetchedSubmissionId}/submission`);
              return;
            }
          } catch (e) {
            // ignore and fall back
          }
        }

        // fallback to reminder view
        if (item.entityId) {
          navigate(`/reminders/${item.entityId}`);
          return;
        }
      }

      // default handling
      navigate(getNotificationTargetPath(item));
    } catch (err) {
      // fallback safe navigation
      navigate(getNotificationTargetPath(item));
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

  useEffect(() => {
    setShowUserMenu(false);
    setShowNotificationMenu(false);
    setShowSearchBar(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowUserMenu(false);
        setShowNotificationMenu(false);
        setShowSearchBar(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    if (!showSearchBar) return;
    searchInputRef.current?.focus();
  }, [showSearchBar]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (showSearchBar && searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setShowSearchBar(false);
      }

      if (showNotificationMenu && notificationContainerRef.current && !notificationContainerRef.current.contains(target)) {
        setShowNotificationMenu(false);
      }

      if (showUserMenu && userMenuContainerRef.current && !userMenuContainerRef.current.contains(target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showNotificationMenu, showSearchBar, showUserMenu]);

  return (
    <header className="sticky top-0 z-40 h-16 bg-[var(--color-background)]/95 backdrop-blur border-b border-[var(--color-border-soft)] flex items-center justify-between px-3 sm:px-5 lg:px-6 gap-3 shadow-[0_1px_0_0_rgba(74,144,217,.12)]">
      {/* Search Bar */}
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onMenuToggle}
          className="lg:hidden inline-flex items-center justify-center p-2 rounded-lg border border-[var(--color-border-soft)] text-[var(--color-text-dark)] hover:bg-[var(--color-light-section)]"
          aria-label="Open menu"
        >
          <FiMenu className="h-5 w-5" />
        </button>

        <div ref={searchContainerRef} className="relative min-w-0">
          {!showSearchBar ? (
            <button
              type="button"
              onClick={() => {
                setShowSearchBar(true);
                setShowNotificationMenu(false);
                setShowUserMenu(false);
              }}
              className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-[var(--color-border-soft)] text-[var(--color-secondary)] hover:text-[var(--color-text-dark)] hover:bg-[var(--color-light-section)] transition-colors"
              aria-label="Open search"
              title="Search"
            >
              <FiSearch className="h-5 w-5" />
            </button>
          ) : (
            <div className="flex items-center h-10 w-[min(68vw,18rem)] sm:w-64 lg:w-72 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-background)] shadow-sm pl-3 pr-1 transition-all duration-200">
              <FiSearch className="h-4 w-4 text-[var(--color-secondary)] shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search"
                className="w-full min-w-0 px-2 py-2 text-sm bg-transparent text-[var(--color-text-dark)] placeholder:text-[var(--color-secondary)]/70 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowSearchBar(false)}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-[var(--color-secondary)] hover:text-[var(--color-text-dark)] hover:bg-[var(--color-light-section)]"
                aria-label="Close search"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-1 sm:space-x-3 ml-1 sm:ml-4 lg:ml-6">
        {/* Notifications */}
        <div ref={notificationContainerRef} className="relative">
          <button
            onClick={openNotifications}
            className="relative p-2 text-[var(--color-secondary)] hover:text-[var(--color-text-dark)] hover:bg-[var(--color-light-section)] rounded-lg transition-colors"
            aria-label="Open notifications"
          >
            <FiBell className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 inline-flex items-center justify-center rounded-full bg-[var(--color-primary)] text-white text-[10px] font-semibold ring-2 ring-[var(--color-background)]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotificationMenu && (
            <div className="fixed right-2 sm:right-6 top-[4.25rem] w-[calc(100vw-1rem)] max-w-sm sm:w-96 bg-[var(--color-background)] rounded-xl shadow-xl border border-[var(--color-border-soft)] z-[80] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--color-border-soft)] bg-[var(--color-light-section)] flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--color-text-dark)]">Notifications</p>
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs text-[var(--color-secondary)] hover:text-[var(--color-text-dark)]"
                >
                  Mark all as read
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notificationLoading ? (
                  <p className="px-4 py-3 text-sm text-[var(--color-secondary)]">Loading notifications...</p>
                ) : notifications.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-[var(--color-secondary)]">No notifications yet.</p>
                ) : notifications.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => handleNotificationClick(item)}
                    className={`w-full text-left px-4 py-3 border-b border-[var(--color-border-soft)] hover:bg-[var(--color-light-section)] ${item.isRead ? 'bg-[var(--color-background)]' : 'bg-[var(--color-secondary-soft)]'}`}
                  >
                    <p className="text-sm font-medium text-[var(--color-text-dark)]">{item.title}</p>
                    <p className="text-xs text-[var(--color-text-dark)]/80 mt-1">{item.message}</p>
                    <p className="text-[11px] text-[var(--color-secondary)] mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div ref={userMenuContainerRef} className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotificationMenu(false);
              setShowSearchBar(false);
            }}
            className="flex items-center space-x-2 sm:space-x-3 p-2 hover:bg-[var(--color-light-section)] rounded-xl transition-colors"
            aria-label="Open user menu"
          >
            <div className="w-8 h-8 bg-[var(--color-primary)] rounded-full flex items-center justify-center shadow-sm shadow-[rgba(106,193,67,0.35)]">
              <span className="text-white text-sm font-medium">
                {userInitial}
              </span>
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-sm font-medium text-[var(--color-text-dark)]">{userDisplayName}</p>
              <p className="text-xs text-[var(--color-secondary)] capitalize">{userRoleLabel}</p>
            </div>
            <svg className="hidden sm:block h-4 w-4 text-[var(--color-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
              <div className="fixed right-2 sm:right-6 top-[4.25rem] w-56 bg-[var(--color-background)] rounded-xl shadow-xl border border-[var(--color-border-soft)] py-1 z-[80]">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate(profilePath);
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-[var(--color-text-dark)] hover:bg-[var(--color-light-section)]"
                >
                  <FiUser className="mr-3 h-4 w-4" />
                  {profileLabel}
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate(settingsPath);
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-[var(--color-text-dark)] hover:bg-[var(--color-light-section)]"
                >
                  <FiSettings className="mr-3 h-4 w-4" />
                  {settingsLabel}
                </button>
                <hr className="my-1 border-[var(--color-border-soft)]" />
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-2 text-sm text-[var(--color-primary)] hover:bg-[var(--color-secondary-soft)]"
                >
                  <FiLogOut className="mr-3 h-4 w-4" />
                  Sign out
                </button>
              </div>
          )}
        </div>
      </div>
    </header>
  );
}
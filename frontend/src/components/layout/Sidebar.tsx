// frontend/src/components/layout/Sidebar.tsx
import { NavLink, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import logoImage from '../../assets/logo/logo.png';
import {
  FiHome,
  FiUsers,
  FiUserCheck,
  FiFileText,
  FiFile,
  FiBell,
  FiSettings,
  FiShield,
  FiUpload,
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiMenu,
} from 'react-icons/fi';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: FiHome },
  { name: 'Providers', href: '/providers', icon: FiUserCheck },
  { name: 'Enrollments', href: '/enrollments', icon: FiFileText },
  { name: 'Documents', href: '/documents', icon: FiFile },
  { name: 'Reminders', href: '/reminders', icon: FiBell },
  { name: 'Settings', href: '/settings', icon: FiSettings },
];

const adminNavigation = [
  { name: 'Admin Console', href: '/admin', icon: FiShield },
  { name: 'User Access', href: '/admin/users', icon: FiUsers },
];

const userNavigation = [
  { name: 'Workspace', href: '/workspace', icon: FiHome },
  { name: 'Providers', href: '/providers', icon: FiUserCheck },
  { name: 'Enrollments', href: '/enrollments', icon: FiFileText },
  { name: 'Documents', href: '/documents', icon: FiFile },
  { name: 'Upload Document', href: '/documents/upload', icon: FiUpload },
  { name: 'Reminders', href: '/reminders', icon: FiBell },
];

type SidebarProps = {
  isOpen: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
};

export default function Sidebar({
  isOpen,
  isCollapsed,
  onToggleCollapse,
  onClose,
}: SidebarProps) {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';
  const userDisplayName = user?.fullName || 'User';
  const userRoleLabel = user?.role?.replace(/_/g, ' ') || 'member';
  const userInitial = userDisplayName.trim().charAt(0).toUpperCase() || 'U';

  const primaryItems = isAdmin ? navigation : userNavigation;
  const secondaryItems = isAdmin ? adminNavigation : [];

  /**
   * Unified toggle handler.
   * - On mobile (< lg): closes the drawer overlay.
   * - On desktop (lg+): collapses / expands the sidebar rail.
   */
  const handleToggle = () => {
    if (window.innerWidth < 1024) {
      onClose();
    } else {
      onToggleCollapse();
    }
  };

  /**
   * Resolve the correct icon for the unified toggle button.
   * - Mobile: always show X (drawer is open when this button is visible).
   * - Desktop collapsed: show ChevronRight (expand).
   * - Desktop expanded: show ChevronLeft (collapse).
   */
  const ToggleIcon = () => (
    <>
      {/* Mobile — always X to close the drawer */}
      <FiX className="h-5 w-5 lg:hidden" />

      {/* Desktop — chevron direction reflects collapsed state */}
      {isCollapsed ? (
        <FiChevronRight className="hidden lg:block h-4 w-4" />
      ) : (
        <FiChevronLeft className="hidden lg:block h-4 w-4" />
      )}
    </>
  );

  const renderNavItems = (
    items: Array<{ name: string; href: string; icon: any }>
  ) =>
    items.map((item) => (
      <NavLink
        key={item.name}
        to={item.href}
        onClick={() => {
          // Auto-close drawer on mobile after navigation
          if (window.innerWidth < 1024) {
            onClose();
          }
        }}
        title={isCollapsed ? item.name : undefined}
        className={({ isActive }) =>
          `group flex items-center ${
            isCollapsed ? 'justify-center px-2.5' : 'px-3'
          } py-2.5 text-sm font-medium rounded-xl transition-all duration-200 border ${
            isActive
              ? 'bg-[var(--color-secondary-soft)] text-[var(--color-text-dark)] border-[var(--color-border-soft)] shadow-sm'
              : 'text-[var(--color-text-dark)]/85 border-transparent hover:bg-[var(--color-background)] hover:text-[var(--color-text-dark)] hover:border-[var(--color-border-soft)]'
          }`
        }
        aria-label={item.name}
      >
        <item.icon
          className={`h-5 w-5 shrink-0 text-[var(--color-secondary)] group-hover:text-[var(--color-primary)] ${
            isCollapsed ? '' : 'mr-3'
          }`}
        />
        {!isCollapsed && <span className="truncate">{item.name}</span>}
      </NavLink>
    ));

  return (
    <>
      {/* ── Mobile backdrop overlay ─────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar panel ──────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          w-72 max-w-[88vw]
          bg-gradient-to-b from-[var(--color-background)] to-[var(--color-light-section)]
          border-r border-[var(--color-border-soft)]
          flex flex-col overflow-hidden
          transform transition-all duration-200 ease-out
          lg:max-w-none lg:translate-x-0
          lg:shadow-[0_1px_0_rgba(255,255,255,.8)_inset]
          ${isCollapsed ? 'lg:w-20' : 'lg:w-[17.5rem]'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* ── Logo bar ─────────────────────────────────────────────── */}
        <div
          className={`relative h-16 border-b border-[var(--color-border-soft)] flex items-center gap-2 ${
            isCollapsed ? 'px-2 justify-center' : 'px-4 sm:px-5 justify-between'
          }`}
        >
          {/* Logo image */}
          <div className={`flex items-center min-w-0 ${isCollapsed ? 'justify-center' : ''}`}>
              <Link to="/" title="Home" aria-label="Home" className="inline-flex items-center">
                <img
                  src={logoImage}
                  alt="Healthcare CRM Logo"
                  className={`${isCollapsed ? 'w-10 h-10' : 'w-36 h-10'} rounded-lg object-contain shrink-0 transition-all duration-200 cursor-pointer`}
                />
              </Link>
          </div>

          {/* ── Unified toggle button (always visible) ─────────────
               • Mobile  → FiX    → calls onClose()
               • Desktop → FiChevronLeft/Right → calls onToggleCollapse()
          ──────────────────────────────────────────────────────── */}
          <button
            type="button"
            onClick={handleToggle}
            aria-label={
              typeof window !== 'undefined' && window.innerWidth < 1024
                ? 'Close menu'
                : isCollapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
            }
            title={
              isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
            }
            className={`
              inline-flex items-center justify-center
              h-8 w-8 rounded-lg shrink-0
              border border-[var(--color-border-soft)]
              bg-[var(--color-background)]
              text-[var(--color-secondary)]
              shadow-sm
              hover:bg-[var(--color-light-section)]
              hover:text-[var(--color-primary)]
              transition-colors duration-150
              ${isCollapsed ? 'lg:mx-auto' : ''}
            `}
          >
            <ToggleIcon />
          </button>
        </div>

        {/* ── Navigation ───────────────────────────────────────────── */}
        <nav
          className={`flex-1 overflow-y-auto ${
            isCollapsed ? 'px-2 py-4' : 'px-3 sm:px-4 py-4 sm:py-6'
          }`}
        >
          {!isCollapsed && (
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-secondary)]">
              Main Menu
            </p>
          )}
          <div className="space-y-1">{renderNavItems(primaryItems)}</div>

          {secondaryItems.length > 0 && (
            <>
              <div className="my-4 border-t border-[var(--color-border-soft)]" />
              {!isCollapsed && (
                <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-secondary)]">
                  Administration
                </p>
              )}
              <div className="space-y-1">{renderNavItems(secondaryItems)}</div>
            </>
          )}
        </nav>

        {/* ── Footer (user info) ───────────────────────────────────── */}
        <div
          className={`mt-auto border-t border-[var(--color-border-soft)] bg-[var(--color-background)]/70 backdrop-blur-sm ${
            isCollapsed ? 'p-3' : 'p-4'
          }`}
        >
          {isCollapsed ? (
            <div className="flex justify-center" title={userDisplayName}>
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white text-sm font-semibold flex items-center justify-center shadow-sm shadow-[rgba(106,193,67,0.35)]">
                {userInitial}
              </div>
            </div>
          ) : (
            <div className="px-2">
              <p className="text-sm font-semibold text-[var(--color-text-dark)] truncate">
                {userDisplayName}
              </p>
              <p className="text-xs text-[var(--color-secondary)] capitalize">
                {userRoleLabel}
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
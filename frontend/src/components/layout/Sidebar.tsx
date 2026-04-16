// frontend/src/components/layout/Sidebar.tsx
import { NavLink } from 'react-router-dom';
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
  FiX,
  FiChevronLeft,
  FiChevronRight
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

export default function Sidebar({ isOpen, isCollapsed, onToggleCollapse, onClose }: SidebarProps) {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';
  const userDisplayName = user?.fullName || 'User';
  const userRoleLabel = user?.role?.replace(/_/g, ' ') || 'member';
  const userInitial = userDisplayName.trim().charAt(0).toUpperCase() || 'U';

  const primaryItems = isAdmin ? navigation : userNavigation;
  const secondaryItems = isAdmin ? adminNavigation : [];

  const renderNavItems = (items: Array<{ name: string; href: string; icon: any }>) => (
    items.map((item) => (
      <NavLink
        key={item.name}
        to={item.href}
        onClick={() => {
          if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            onClose();
          }
        }}
        title={isCollapsed ? item.name : undefined}
        className={({ isActive }) =>
          `group flex items-center ${isCollapsed ? 'justify-center px-2.5' : 'px-3'} py-2.5 text-sm font-medium rounded-xl transition-all duration-200 border ${
            isActive
              ? 'bg-[var(--color-secondary-soft)] text-[var(--color-text-dark)] border-[var(--color-border-soft)] shadow-sm'
              : 'text-[var(--color-text-dark)]/85 border-transparent hover:bg-[var(--color-background)] hover:text-[var(--color-text-dark)] hover:border-[var(--color-border-soft)]'
          }`
        }
        aria-label={item.name}
      >
        <item.icon className={`h-5 w-5 shrink-0 text-[var(--color-secondary)] group-hover:text-[var(--color-primary)] ${isCollapsed ? '' : 'mr-3'}`} />
        {!isCollapsed && <span className="truncate">{item.name}</span>}
      </NavLink>
    ))
  );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[88vw] bg-gradient-to-b from-[var(--color-background)] to-[var(--color-light-section)] border-r border-[var(--color-border-soft)] flex flex-col overflow-hidden transform transition-all duration-200 ease-out ${isCollapsed ? 'lg:w-20' : 'lg:w-[17.5rem]'} lg:max-w-none lg:translate-x-0 lg:shadow-[0_1px_0_rgba(255,255,255,.8)_inset] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className={`relative h-16 border-b border-[var(--color-border-soft)] ${isCollapsed ? 'px-2' : 'px-4 sm:px-6'}`}>
          <div className="h-full flex items-center justify-between gap-2">
            <div className={`flex items-center min-w-0 ${isCollapsed ? 'justify-center flex-1' : ''}`}>
              <img
                src={logoImage}
                alt="Healthcare CRM Logo"
                className={`${isCollapsed ? 'w-12 h-12' : 'w-36 h-12'} rounded-lg object-contain shrink-0`}
              />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="lg:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg border border-[var(--color-border-soft)] text-[var(--color-secondary)] hover:bg-[var(--color-light-section)]"
              aria-label="Close menu"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:inline-flex absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 items-center justify-center h-8 w-8 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-background)] text-[var(--color-secondary)] shadow-sm hover:bg-[var(--color-light-section)] hover:text-[var(--color-primary)] z-20"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <FiChevronRight className="h-4 w-4" /> : <FiChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 ${isCollapsed ? 'px-2 py-4' : 'px-3 sm:px-4 py-4 sm:py-6'}`}>
          {!isCollapsed && <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-secondary)]">Main Menu</p>}
          <div className="space-y-1">
            {renderNavItems(primaryItems)}
          </div>

          {secondaryItems.length > 0 && (
            <>
              <div className="my-4 border-t border-[var(--color-border-soft)]" />
              {!isCollapsed && <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-secondary)]">Administration</p>}
              <div className="space-y-1">
                {renderNavItems(secondaryItems)}
              </div>
            </>
          )}
        </nav>

        {/* Footer (anchored) */}
        <div className={`mt-auto border-t border-[var(--color-border-soft)] bg-[var(--color-background)]/70 backdrop-blur-sm ${isCollapsed ? 'p-3' : 'p-4'}`}>
          {isCollapsed ? (
            <div className="flex justify-center" title={userDisplayName}>
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white text-sm font-semibold flex items-center justify-center shadow-sm shadow-[rgba(106,193,67,0.35)]">
                {userInitial}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-3 px-2 ">
                <p className="text-sm font-semibold text-[var(--color-text-dark)] truncate">{userDisplayName}</p>
                <p className="text-xs text-[var(--color-secondary)] capitalize">{userRoleLabel}</p>
              </div>
              {/* <div className="text-xs text-gray-500 ">
                <p>HBS CRM v1.0</p>
                <p className="mt-1">&copy; 2026 All rights reserved</p>
              </div> */}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
// frontend/src/components/layout/Sidebar.tsx
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
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
  FiX
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
  { name: 'Enrollment Oversight', href: '/admin/enrollments', icon: FiFileText },
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
  onClose: () => void;
};

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';
  const userDisplayName = user?.fullName || 'User';
  const userRoleLabel = user?.role?.replace(/_/g, ' ') || 'member';

  const primaryItems = isAdmin ? navigation : userNavigation;
  const secondaryItems = isAdmin ? adminNavigation : [];

  const renderNavItems = (items: Array<{ name: string; href: string; icon: any }>) => (
    items.map((item) => (
      <NavLink
        key={item.name}
        to={item.href}
        onClick={onClose}
        className={({ isActive }) =>
          `group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150 border ${
            isActive
              ? 'bg-primary-50 text-primary-700 border-primary-100 shadow-sm shadow-primary-100/70'
              : 'text-gray-700 border-transparent hover:bg-white/80 hover:text-gray-900 hover:border-slate-200'
          }`
        }
      >
        <item.icon className="mr-3 h-5 w-5 shrink-0" />
        <span className="truncate">{item.name}</span>
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
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[88vw] bg-gradient-to-b from-white to-slate-50 border-r border-slate-200 flex flex-col overflow-hidden transform transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-[17.5rem] lg:max-w-none lg:translate-x-0 lg:shadow-[0_1px_0_rgba(255,255,255,.8)_inset] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-slate-200/80">
          <div className="flex items-center min-w-0">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm shadow-primary-300/40">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="ml-3 text-lg font-semibold text-slate-900 truncate tracking-tight">Healthcare CRM</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 sm:px-4 py-4 sm:py-6 overflow-y-auto">
          <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Main Menu</p>
          <div className="space-y-1">
            {renderNavItems(primaryItems)}
          </div>

          {secondaryItems.length > 0 && (
            <>
              <div className="my-4 border-t border-slate-200/80" />
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Administration</p>
              <div className="space-y-1">
                {renderNavItems(secondaryItems)}
              </div>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200/80 bg-white/60 backdrop-blur-sm">
          <div className="mb-3 px-2">
            <p className="text-sm font-semibold text-gray-800 truncate">{userDisplayName}</p>
            <p className="text-xs text-gray-500 capitalize">{userRoleLabel}</p>
          </div>
          <div className="text-xs text-gray-500 text-center">
            <p>Healthcare CRM v1.0</p>
            <p className="mt-1">&copy; 2024 All rights reserved</p>
          </div>
        </div>
      </aside>
    </>
  );
}
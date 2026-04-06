// frontend/src/components/layout/Sidebar.tsx
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { 
  FiHome, 
  FiUsers, 
  FiUserCheck, 
  FiDollarSign, 
  FiFileText, 
  FiFile, 
  FiBell,
  FiSettings,
  FiShield,
  FiUpload
} from 'react-icons/fi';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: FiHome },
  { name: 'Providers', href: '/providers', icon: FiUserCheck },
  { name: 'Payers', href: '/payers', icon: FiDollarSign },
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

export default function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  const navItems = isAdmin ? [...navigation, ...adminNavigation] : userNavigation;

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="ml-3 text-lg font-semibold text-gray-900">Healthcare CRM</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <item.icon className="mr-3 h-5 w-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          <p>Healthcare CRM v1.0</p>
          <p className="mt-1">&copy; 2024 All rights reserved</p>
        </div>
      </div>
    </div>
  );
}
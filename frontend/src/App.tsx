import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminClients from './pages/admin/AdminClients';
import Layout from './components/layout/Layout';
import Dashboard from './pages/dashboard/Dashboard.tsx';
import UserDashboard from './pages/dashboard/UserDashboard';
import ProviderList from './pages/providers/ProviderList';
import ProviderDetail from './pages/providers/ProviderDetail.tsx';
import EnrollmentList from './pages/enrollments/EnrollmentList';
import DocumentList from './pages/documents/DocumentList';
import DocumentUpload from './pages/documents/DocumentUpload';
import DocumentSubmissionDetail from './pages/documents/DocumentSubmissionDetail';
import ReminderList from './pages/reminders/ReminderList';

const RoleHomeRedirect = () => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/workspace" replace />;
};

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/workspace" replace />;
  }

  return <>{children}</>;
};

const NonAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RoleHomeRedirect />} />

          <Route
            path="workspace"
            element={
              <NonAdminRoute>
                <UserDashboard />
              </NonAdminRoute>
            }
          />

          <Route
            path="dashboard"
            element={
              <AdminRoute>
                <Dashboard />
              </AdminRoute>
            }
          />

          <Route
            path="providers"
            element={<ProviderList />}
          />
          <Route
            path="providers/:id"
            element={
              <AdminRoute>
                <ProviderDetail />
              </AdminRoute>
            }
          />
          <Route
            path="enrollments"
            element={<EnrollmentList />}
          />
          <Route
            path="documents"
            element={<DocumentList />}
          />
          <Route
            path="documents/upload"
            element={
              <NonAdminRoute>
                <DocumentUpload />
              </NonAdminRoute>
            }
          />
          <Route
            path="documents/:id/submission"
            element={
              <ProtectedRoute>
                <DocumentSubmissionDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="reminders"
            element={<ReminderList />}
          />

          <Route
            path="admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="admin/users"
            element={
              <AdminRoute>
                <AdminClients />
              </AdminRoute>
            }
          />
          <Route
            path="admin/enrollments"
            element={
              <AdminRoute>
                <EnrollmentList />
              </AdminRoute>
            }
          />
        </Route>
        
        {/* 404 */}
        <Route path="*" element={<RoleHomeRedirect />} />
      </Routes>
    </Router>
  );
}

export default App;
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { FiShield } from 'react-icons/fi';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';
import { notify } from '../../utils/notify';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { isAuthenticated, user, setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const isAdmin = useMemo(() => user?.role === 'admin', [user]);

  if (isAuthenticated && isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isAuthenticated && !isAdmin) {
    return <Navigate to="/workspace" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authService.login(formData.email, formData.password);
      const loggedInUser = response.data.user;

      if (loggedInUser.role !== 'admin') {
        notify.error('This account does not have admin access.');
        return;
      }

      setAuth(loggedInUser, response.data.token);
      notify.success('Admin login successful!');
      navigate('/dashboard');
    } catch (error: any) {
      notify.error(error.response?.data?.message || 'Admin login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
            <FiShield className="w-9 h-9 text-slate-800" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Healthcare CRM</h1>
          <p className="text-slate-200">Administrator Access</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin sign in</h2>
          <p className="text-sm text-gray-500 mb-6">Use an administrator account to continue.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="label">
                Admin email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="input"
                placeholder="admin@company.com"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="input"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center"
            >
              {loading ? 'Signing in...' : 'Sign in as Admin'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>
              Need standard user login?{' '}
              <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
                Go to user sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

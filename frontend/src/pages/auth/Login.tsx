// frontend/src/pages/auth/Login.tsx
import { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';
import { notify } from '../../utils/notify';
import logoImage from '../../assets/logo/logo.png';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authService.login(formData.email, formData.password);
      setAuth(response.data.user, response.data.token);
      notify.success('Login successful!');
      const homePath = response.data.user.role === 'admin' ? '/dashboard' : '/workspace';
      navigate(homePath);
    } catch (error: any) {
      notify.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)' }}
    >
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-[var(--color-background)] rounded-full mb-4 shadow-sm">
            <img src={logoImage} alt="Healthcare CRM logo" className="w-14 h-14 sm:w-18 sm:h-18 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">HBS CRM</h1>
          {/* <p className="text-white/90">Credentialing Management System</p> */}
        </div>

        {/* Login Card */}
        <div className="card p-8">
          <h2 className="text-2xl font-bold text-[var(--color-text-dark)] mb-6">Sign in to your account</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="input"
                placeholder="admin@test.com"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input pr-10"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading}
                  aria-describedby="toggle-password-visibility"
                />
                <button
                  type="button"
                  id="toggle-password-visibility"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-9 w-9 rounded-md text-[var(--color-secondary)] hover:text-[var(--color-text-dark)] hover:bg-[var(--color-light-section)]"
                >
                  {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Remember me & Forgot password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded"
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-[var(--color-text-dark)]">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-[var(--color-primary)] hover:opacity-90">
                  Forgot password?
                </a>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary flex items-center justify-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--color-text-dark)]">
              Don't have an account?{' '}
              <Link to="/register" className="font-medium text-[var(--color-primary)] hover:opacity-90">
                Register here
              </Link>
            </p>
            <p className="text-sm text-[var(--color-text-dark)] mt-2">
              Admin access?{' '}
              <Link to="/admin/login" className="font-medium text-[var(--color-primary)] hover:opacity-90">
                Sign in as admin
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-white/80 text-sm">
          <p>&copy; 2026 Healthcare CRM. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
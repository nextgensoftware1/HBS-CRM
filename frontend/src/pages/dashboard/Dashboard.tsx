import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardService } from '../../services/dashboardService';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';
import { DashboardStats } from '../../types';

import Card from '../../components/common/Card';
import {
	FiUsers,
	FiUserCheck,
	FiFileText,
	FiFile,
	FiTrendingUp,
	FiClock,
	FiCheckCircle,
	FiAlertCircle,
} from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Dashboard() {
	const currentUser = useAuthStore((state) => state.user);
	const [stats, setStats] = useState<DashboardStats | null>(null);
	const [userAccessCount, setUserAccessCount] = useState<number>(0);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadDashboard();
	}, [currentUser?.role]);

	const loadDashboard = async () => {
		try {
			const data = await dashboardService.getOverview();
			setStats(data);

			if (currentUser?.role === 'admin') {
				const users = await authService.getAllUsers();
				setUserAccessCount(Array.isArray(users) ? users.length : 0);
			}
		} catch (error) {
			console.error('Failed to load dashboard:', error);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
			</div>
		);
	}

	if (!stats) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-gray-500">Failed to load dashboard data</p>
			</div>
		);
	}

	// Prepare chart data
	const enrollmentStatusData = stats.enrollments.byStatus.map((item: { _id: string; count: number }) => ({
		name: item._id.replace('_', ' ').toUpperCase(),
		count: item.count,
	}));

	const enrollmentPriorityData = stats.enrollments.byPriority.map((item: { _id: string; count: number }) => ({
		name: item._id.toUpperCase(),
		count: item.count,
	}));

	const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
				<p className="text-gray-600 mt-1">Overview of your credentialing operations</p>
			</div>

			{/* KPI Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				{/* User Accounts */}
				<Card>
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium text-gray-600">User Access Records</p>
							<p className="text-3xl font-bold text-gray-900 mt-2">{currentUser?.role === 'admin' ? userAccessCount : 0}</p>
						</div>
						<div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
							<FiUsers className="w-6 h-6 text-primary-600" />
						</div>
					</div>
					<Link to="/admin/users" className="text-sm text-primary-600 hover:text-primary-700 mt-4 inline-block">
						Manage user access →
					</Link>
				</Card>

				{/* Total Providers */}
				<Card>
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium text-gray-600">Total Providers</p>
							<p className="text-3xl font-bold text-gray-900 mt-2">{stats.totals.providers}</p>
						</div>
						<div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
							<FiUserCheck className="w-6 h-6 text-success-600" />
						</div>
					</div>
					<Link to="/providers" className="text-sm text-success-600 hover:text-success-700 mt-4 inline-block">
						View all providers →
					</Link>
				</Card>

				{/* Total Enrollments */}
				<Card>
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium text-gray-600">Total Enrollments</p>
							<p className="text-3xl font-bold text-gray-900 mt-2">{stats.totals.enrollments}</p>
						</div>
						<div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center">
							<FiFileText className="w-6 h-6 text-warning-600" />
						</div>
					</div>
					<Link to="/enrollments" className="text-sm text-warning-600 hover:text-warning-700 mt-4 inline-block">
						View all enrollments →
					</Link>
				</Card>

				{/* Total Documents */}
				<Card>
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium text-gray-600">Total Documents</p>
							<p className="text-3xl font-bold text-gray-900 mt-2">{stats.totals.documents}</p>
						</div>
						<div className="w-12 h-12 bg-danger-100 rounded-lg flex items-center justify-center">
							<FiFile className="w-6 h-6 text-danger-600" />
						</div>
					</div>
					<Link to="/documents" className="text-sm text-danger-600 hover:text-danger-700 mt-4 inline-block">
						View all documents →
					</Link>
				</Card>
			</div>

			{/* Charts Row */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Enrollments by Status */}
				<Card>
					<h3 className="text-lg font-semibold text-gray-900 mb-4">Enrollments by Status</h3>
					<ResponsiveContainer width="100%" height={300}>
						<BarChart data={enrollmentStatusData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
							<YAxis />
							<Tooltip />
							<Legend />
							<Bar dataKey="count" fill="#3b82f6" />
						</BarChart>
					</ResponsiveContainer>
				</Card>

				{/* Enrollments by Priority */}
				<Card>
					<h3 className="text-lg font-semibold text-gray-900 mb-4">Enrollments by Priority</h3>
					<ResponsiveContainer width="100%" height={300}>
						<PieChart>
							<Pie
								data={enrollmentPriorityData}
								cx="50%"
								cy="50%"
								labelLine={false}
								label={({ name, percent }) => `${name}: ${(((percent ?? 0) * 100)).toFixed(0)}%`}
								outerRadius={100}
								fill="#8884d8"
								dataKey="count"
							>
									{enrollmentPriorityData.map((_, index) => (
										<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
									))}
							</Pie>
							<Tooltip />
						</PieChart>
					</ResponsiveContainer>
				</Card>
			</div>

			{/* Action Items */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Pending Reminders */}
				<Card>
					<div className="flex items-center space-x-3">
						<div className="w-10 h-10 bg-warning-100 rounded-lg flex items-center justify-center">
							<FiClock className="w-5 h-5 text-warning-600" />
						</div>
						<div>
							<p className="text-sm font-medium text-gray-600">Pending Reminders</p>
							<p className="text-2xl font-bold text-gray-900">{stats.pendingActions.reminders}</p>
						</div>
					</div>
					<Link to="/reminders" className="text-sm text-warning-600 hover:text-warning-700 mt-4 inline-block">
						View reminders →
					</Link>
				</Card>

				{/* Documents to Review */}
				<Card>
					<div className="flex items-center space-x-3">
						<div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
							<FiCheckCircle className="w-5 h-5 text-primary-600" />
						</div>
						<div>
							<p className="text-sm font-medium text-gray-600">Documents to Review</p>
							<p className="text-2xl font-bold text-gray-900">{stats.pendingActions.documentsToReview}</p>
						</div>
					</div>
					<Link to="/documents" className="text-sm text-primary-600 hover:text-primary-700 mt-4 inline-block">
						Review documents →
					</Link>
				</Card>

				{/* Expiring Soon */}
				<Card>
					<div className="flex items-center space-x-3">
						<div className="w-10 h-10 bg-danger-100 rounded-lg flex items-center justify-center">
							<FiAlertCircle className="w-5 h-5 text-danger-600" />
						</div>
						<div>
							<p className="text-sm font-medium text-gray-600">Expiring Soon</p>
							<p className="text-2xl font-bold text-gray-900">{stats.documents.expiringSoon}</p>
						</div>
					</div>
					<Link to="/documents?filter=expiring" className="text-sm text-danger-600 hover:text-danger-700 mt-4 inline-block">
						View expiring →
					</Link>
				</Card>
			</div>

			{/* Recent Activity */}
			<Card>
				<h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
						<div className="flex items-center space-x-3">
							<FiTrendingUp className="w-5 h-5 text-success-600" />
							<span className="text-sm font-medium text-gray-700">New Enrollments</span>
						</div>
						<span className="text-lg font-bold text-gray-900">{stats.recentActivity.newEnrollments}</span>
					</div>
					<div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
						<div className="flex items-center space-x-3">
							<FiFile className="w-5 h-5 text-primary-600" />
							<span className="text-sm font-medium text-gray-700">New Documents</span>
						</div>
						<span className="text-lg font-bold text-gray-900">{stats.recentActivity.newDocuments}</span>
					</div>
				</div>
			</Card>
		</div>
	);
}

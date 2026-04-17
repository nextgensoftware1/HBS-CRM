import { useEffect, useState } from 'react';
import { authService } from '../../services/authService';
import { providerService } from '../../services/providerService';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/common/Modal';
import { FiEye, FiEyeOff } from 'react-icons/fi';

type UserRow = {
	_id?: string;
	id?: string;
	fullName: string;
	email: string;
	role: string;
	isActive?: boolean;
	isOnline?: boolean;
	lastSeenAt?: string;
	lastLogin?: string;
	lastLoginDisplay?: string;
	createdAt?: string;
	assignedProviders?: Array<string | { _id: string; firstName?: string; lastName?: string; npi?: string }>;
};

type ProviderOption = {
	_id: string;
	firstName: string;
	lastName: string;
	npi: string;
};

export default function AdminClients() {
	const currentUser = useAuthStore((state) => state.user);
	const currentUserId = (currentUser as any)?._id || (currentUser as any)?.id;
	const [users, setUsers] = useState<UserRow[]>([]);
	const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
	const [assigningProviderUserId, setAssigningProviderUserId] = useState<string | null>(null);
	const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
	const [creatingUser, setCreatingUser] = useState(false);
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [showCreatePassword, setShowCreatePassword] = useState(false);
	const [createForm, setCreateForm] = useState({
		fullName: '',
		email: '',
		password: '',
		role: 'credentialing_specialist',
	});

	const roleOptions = [
		{ label: 'Admin', value: 'admin' },
		{ label: 'Credentialing Specialist', value: 'credentialing_specialist' },
	];

	const loadUsers = async () => {
		try {
			const [userData, providerData] = await Promise.all([
				authService.getAllUsers(),
				providerService.getProviders(1, 1000),
			]);
			const data = userData;
			setUsers(data);
			setProviderOptions((providerData.items || []).map((provider: any) => ({
				_id: provider._id,
				firstName: provider.firstName,
				lastName: provider.lastName,
				npi: provider.npi,
			})));
			setError(null);
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to load users');
		} finally {
			setLoading(false);
		}
	};

	const getAssignedProviderId = (user: UserRow): string => {
		const first = user.assignedProviders?.[0];
		if (!first) return '';
		return typeof first === 'string' ? first : first._id;
	};

	const getUserId = (user: UserRow): string => user._id || user.id || '';

	const handleAssignProvider = async (user: UserRow, providerId: string) => {
		const userId = user._id || user.id;
		if (!userId) return;

		setAssigningProviderUserId(userId);
		setError(null);
		setSuccessMessage(null);

		try {
			const updated = await authService.assignUserProvider(userId, providerId || null);
			setUsers((prev) => prev.map((item) => {
				const itemId = item._id || item.id;
				if (itemId !== userId) return item;
				return {
					...item,
					assignedProviders: updated?.assignedProviders || [],
				};
			}));
			setSuccessMessage(providerId ? 'Provider assigned successfully' : 'Provider assignment cleared');
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to assign provider');
		} finally {
			setAssigningProviderUserId(null);
		}
	};

	useEffect(() => {
		loadUsers();
	}, []);

	const handleRoleChange = async (user: UserRow, role: string) => {
		const userId = user._id || user.id;
		if (!userId) return;

		setUpdatingUserId(userId);
		try {
			await authService.updateUserRole(userId, role);
			setUsers((prev) => prev.map((item) => {
				const itemId = item._id || item.id;
				if (itemId !== userId) return item;
				return { ...item, role };
			}));
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to update user role');
		} finally {
			setUpdatingUserId(null);
		}
	};

	const handleCreateUser = async () => {
		setError(null);
		setSuccessMessage(null);

		if (!createForm.fullName.trim() || !createForm.email.trim() || !createForm.password) {
			setError('Please fill full name, email, and password');
			return;
		}

		if (createForm.password.length < 6) {
			setError('Password must be at least 6 characters');
			return;
		}

		setCreatingUser(true);
		try {
			const createdUser = await authService.createUser({
				fullName: createForm.fullName.trim(),
				email: createForm.email.trim(),
				password: createForm.password,
				role: createForm.role as 'admin' | 'credentialing_specialist',
			});

			setUsers((prev) => [{
				...createdUser,
				isOnline: false,
				lastLoginDisplay: createdUser?.lastLogin || createdUser?.lastSeenAt || null,
			}, ...prev]);
			setCreateForm({
				fullName: '',
				email: '',
				password: '',
				role: 'credentialing_specialist',
			});
			setShowCreatePassword(false);
			setIsCreateModalOpen(false);
			setSuccessMessage('User created successfully');
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to create user');
		} finally {
			setCreatingUser(false);
		}
	};

	const handleDeleteUser = async (user: UserRow) => {
		const userId = getUserId(user);
		if (!userId) return;

		if (userId === currentUserId) {
			setError('You cannot delete your own account');
			return;
		}

		const confirmed = window.confirm(`Delete user ${user.fullName} (${user.email})? This action cannot be undone.`);
		if (!confirmed) return;

		setError(null);
		setSuccessMessage(null);
		setDeletingUserId(userId);

		try {
			await authService.deleteUser(userId);
			setUsers((prev) => prev.filter((item) => getUserId(item) !== userId));
			setSuccessMessage('User deleted successfully');
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to delete user');
		} finally {
			setDeletingUserId(null);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">User Access</h1>
					<p className="text-gray-600">All users who have signed up in the system and admin-created accounts.</p>
				</div>
				<button
					type="button"
					onClick={() => {
						setError(null);
						setSuccessMessage(null);
							setShowCreatePassword(false);
						setIsCreateModalOpen(true);
					}}
					className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
				>
					Add User
				</button>
			</div>

			{loading && <p className="text-sm text-gray-600">Loading users...</p>}
			{error && <p className="text-sm text-red-600">{error}</p>}
			{successMessage && <p className="text-sm text-emerald-600">{successMessage}</p>}

			{!loading && !error && (
				<div className="space-y-3">
					<div className="md:hidden space-y-3">
						{users.length === 0 ? (
							<div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">No users found.</div>
						) : (
							users.map((user) => {
								const selectedRole = roleOptions.some((option) => option.value === user.role)
									? user.role
									: 'credentialing_specialist';
								const userId = getUserId(user);
								const selectedProviderId = getAssignedProviderId(user);
								const isCurrentUser = userId === currentUserId;
								const isDeleting = deletingUserId === userId;

								return (
									<div key={userId || user.email} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
										<div>
											<p className="text-sm font-semibold text-gray-900">{user.fullName}</p>
											<p className="text-xs text-gray-600 break-all">{user.email}</p>
										</div>

										<div>
											<label className="mb-1 block text-xs font-medium text-gray-600">Assigned Provider</label>
											<select
												value={selectedProviderId}
												onChange={(e) => handleAssignProvider(user, e.target.value)}
												disabled={assigningProviderUserId === userId || user.role === 'admin'}
												className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-700"
											>
												<option value="">No provider assigned</option>
												{providerOptions.map((provider) => (
													<option key={provider._id} value={provider._id}>
														{provider.firstName} {provider.lastName} ({provider.npi})
													</option>
												))}
											</select>
										</div>

										<div className="grid grid-cols-2 gap-2">
											<div>
												<label className="mb-1 block text-xs font-medium text-gray-600">Role</label>
												<select
													value={selectedRole}
													onChange={(e) => handleRoleChange(user, e.target.value)}
													disabled={updatingUserId === userId || isCurrentUser}
													className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-700"
												>
													{roleOptions.map((option) => (
														<option key={option.value} value={option.value}>
															{option.label}
														</option>
													))}
												</select>
											</div>
											<div>
												<label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
												<span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${user.isActive === false ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
													{user.isActive === false ? 'Inactive' : 'Active'}
												</span>
											</div>
										</div>

										<div className="flex items-center justify-between gap-2 text-xs text-gray-600">
											<span>
												Presence: <strong>{user.isOnline ? 'Online' : 'Offline'}</strong>
											</span>
											<span>
												Last Login: {(user.lastLoginDisplay || user.lastLogin || user.lastSeenAt)
													? new Date(user.lastLoginDisplay || user.lastLogin || user.lastSeenAt || '').toLocaleString()
													: 'Never'}
											</span>
										</div>

										<div className="flex justify-end">
											<button
												type="button"
												onClick={() => handleDeleteUser(user)}
												disabled={isCurrentUser || isDeleting}
												className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
											>
												{isDeleting ? 'Deleting...' : 'Delete User'}
											</button>
										</div>
									</div>
								);
							})
						)}
					</div>

					<div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
						<div className="overflow-x-auto">
							<table className="min-w-full text-sm">
								<thead className="bg-gray-50">
									<tr>
										<th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
										<th className="px-4 py-3 text-left font-medium text-gray-700">Email</th>
										<th className="px-4 py-3 text-left font-medium text-gray-700">Assigned Provider</th>
										<th className="px-4 py-3 text-left font-medium text-gray-700">Presence</th>
										<th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
										<th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
										<th className="px-4 py-3 text-left font-medium text-gray-700">Last Login</th>
										<th className="px-4 py-3 text-left font-medium text-gray-700">Joined</th>
										<th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
									</tr>
								</thead>
								<tbody>
									{users.length === 0 ? (
										<tr>
											<td className="px-4 py-4 text-gray-500" colSpan={9}>No users found.</td>
										</tr>
									) : (
										users.map((user) => {
											const selectedRole = roleOptions.some((option) => option.value === user.role)
												? user.role
												: 'credentialing_specialist';
											const userId = getUserId(user);
											const selectedProviderId = getAssignedProviderId(user);
											const isCurrentUser = userId === currentUserId;

											return <tr key={userId || user.email} className="border-t border-gray-100">
												<td className="px-4 py-3 text-gray-900">{user.fullName}</td>
												<td className="px-4 py-3 text-gray-700">{user.email}</td>
												<td className="px-4 py-3">
													<select
														value={selectedProviderId}
														onChange={(e) => handleAssignProvider(user, e.target.value)}
														disabled={assigningProviderUserId === userId || user.role === 'admin'}
														className="min-w-[220px] rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-700"
													>
														<option value="">No provider assigned</option>
														{providerOptions.map((provider) => (
															<option key={provider._id} value={provider._id}>
																{provider.firstName} {provider.lastName} ({provider.npi})
															</option>
														))}
													</select>
												</td>
												<td className="px-4 py-3">
													<div className="flex flex-col">
														<span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium w-fit ${user.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
															{user.isOnline ? 'Online' : 'Offline'}
														</span>
														{!user.isOnline && user.lastSeenAt && (
															<span className="text-xs text-gray-500 mt-1">Last seen {new Date(user.lastSeenAt).toLocaleString()}</span>
														)}
													</div>
												</td>
												<td className="px-4 py-3">
													<select
														value={selectedRole}
														onChange={(e) => handleRoleChange(user, e.target.value)}
														disabled={updatingUserId === userId || isCurrentUser}
														className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-700"
													>
														{roleOptions.map((option) => (
															<option key={option.value} value={option.value}>
																{option.label}
															</option>
														))}
													</select>
												</td>
												<td className="px-4 py-3">
													<span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${user.isActive === false ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
														{user.isActive === false ? 'Inactive' : 'Active'}
													</span>
												</td>
												<td className="px-4 py-3 text-gray-700">
													{(user.lastLoginDisplay || user.lastLogin || user.lastSeenAt)
														? new Date(user.lastLoginDisplay || user.lastLogin || user.lastSeenAt || '').toLocaleString()
														: 'Never'}
												</td>
												<td className="px-4 py-3 text-gray-700">
													{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
												</td>
												<td className="px-4 py-3">
													<button
														type="button"
														onClick={() => handleDeleteUser(user)}
														disabled={isCurrentUser || deletingUserId === userId}
														className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
													>
														{deletingUserId === userId ? 'Deleting...' : 'Delete'}
													</button>
												</td>
											</tr>;
										})
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			<Modal
				isOpen={isCreateModalOpen}
				title="Add New User"
				message="Create a new account for admin or credentialing specialist."
				confirmLabel="Create Account"
				isLoading={creatingUser}
				onClose={() => {
					if (creatingUser) return;
					setShowCreatePassword(false);
					setIsCreateModalOpen(false);
				}}
				onConfirm={handleCreateUser}
			>
				<div className="space-y-3">
					<input
						type="text"
						placeholder="Full name"
						value={createForm.fullName}
						onChange={(e) => setCreateForm((prev) => ({ ...prev, fullName: e.target.value }))}
						className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
						required
					/>
					<input
						type="email"
						placeholder="Email"
						value={createForm.email}
						onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
						className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
						required
					/>
					<div className="relative">
						<input
							type={showCreatePassword ? 'text' : 'password'}
							placeholder="Password (min 6 chars)"
							value={createForm.password}
							onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-700"
							required
							minLength={6}
						/>
						<button
							type="button"
							onClick={() => setShowCreatePassword((prev) => !prev)}
							className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
							aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
						>
							{showCreatePassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
						</button>
					</div>
					<select
						value={createForm.role}
						onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value }))}
						className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
					>
						{roleOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</div>
			</Modal>
		</div>
	);
}

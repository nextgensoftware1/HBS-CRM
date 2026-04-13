import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { enrollmentService } from '../../services/enrollmentService';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/common/Modal';
import { providerService } from '../../services/providerService';
import { authService } from '../../services/authService';

type EnrollmentRow = {
	_id: string;
	providerId: { clientName?: string; firstName?: string; lastName?: string } | string;
	enrollmentProfile?: {
		clientName?: string;
		firstName?: string;
		lastName?: string;
		npi?: string;
		insuranceServices?: string[];
	};
	insuranceService?: string;
	insuranceServices?: string[];
	documentsCount?: number;
	hasUploadedDocuments?: boolean;
	assignedTo?: { _id?: string; fullName?: string; email?: string } | string | null;
	status: string;
	priority: string;
	progressPercentage: number;
};

type UserOption = {
	_id: string;
	fullName: string;
	email: string;
	role: string;
	isActive?: boolean;
};

type ProviderOption = {
	_id: string;
	firstName?: string;
	lastName?: string;
	npi?: string;
	insuranceServices?: string[];
};

const PROVIDER_CATEGORIES = ['Individual', 'Group', 'Facility', 'Multiple'] as const;

export default function EnrollmentList() {
	const user = useAuthStore((state) => state.user);
	const isAdmin = user?.role === 'admin';
	const [searchParams, setSearchParams] = useSearchParams();
	const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
	const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
	const [userOptions, setUserOptions] = useState<UserOption[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [actionLoading, setActionLoading] = useState(false);
	const [creatingEnrollment, setCreatingEnrollment] = useState(false);
	const [deletingEnrollmentId, setDeletingEnrollmentId] = useState<string | null>(null);
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [createForm, setCreateForm] = useState({
		providerId: '',
		priority: 'medium',
		assignedTo: '',
		notes: '',
		clientName: '',
		firstName: '',
		lastName: '',
		npi: '',
		specialization: '',
		providerCategory: 'Individual' as (typeof PROVIDER_CATEGORIES)[number],
		dateOfBirth: '',
		email: '',
		phone: '',
		ssn: '',
		caqhId: '',
		medicarePTAN: '',
		medicaidId: '',
		licenseNumber: '',
		licenseState: '',
		licenseExpiryDate: '',
		pecosUsername: '',
		pecosPassword: '',
		caqhUsername: '',
		caqhPassword: '',
	});
	const [selectedProviderInsurances, setSelectedProviderInsurances] = useState<string[]>([]);
	const [actionModal, setActionModal] = useState<{
		open: boolean;
		enrollmentId?: string;
		status?: string;
	}>({ open: false });
	const statusFilter = searchParams.get('status') || '';
	const selectedProvider = providerOptions.find((provider) => provider._id === createForm.providerId);
	const availableInsuranceServices = Array.from(
		new Set(
			(selectedProvider?.insuranceServices || [])
				.map((value) => String(value || '').trim())
				.filter(Boolean)
		)
	);

	const statusOptions = [
		{ label: 'All', value: '' },
		{ label: 'Pending', value: 'in_review' },
		{ label: 'Approved', value: 'approved' },
		{ label: 'Rejected', value: 'rejected' },
		{ label: 'Submitted', value: 'submitted' },
		{ label: 'Intake', value: 'intake' },
	];

	const loadEnrollments = async () => {
		try {
			const filters = statusFilter ? { status: statusFilter } : {};
			const data = await enrollmentService.getEnrollments(1, 50, filters);
			setEnrollments(data.items);
			setError(null);
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to load enrollments');
		} finally {
			setLoading(false);
		}
	};

	const loadCreateOptions = async () => {
		if (!isAdmin) return;

		try {
			const [providersResponse, usersResponse] = await Promise.all([
				providerService.getProviders(1, 1000),
				authService.getAllUsers(),
			]);

			const providers = (providersResponse.items || []).map((provider: any) => ({
				_id: provider._id,
				firstName: provider.firstName,
				lastName: provider.lastName,
				npi: provider.npi,
				insuranceServices: Array.isArray(provider.insuranceServices) ? provider.insuranceServices : [],
			}));

			const users = (usersResponse || [])
				.filter((item: any) => item?.isActive !== false)
				.map((item: any) => ({
					_id: item._id,
					fullName: item.fullName,
					email: item.email,
					role: item.role,
					isActive: item.isActive,
				}));

			setProviderOptions(providers);
			setUserOptions(users);

			if (!createForm.assignedTo && users.length > 0) {
				setCreateForm((prev) => ({ ...prev, assignedTo: users[0]._id }));
			}
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to load enrollment form options');
		}
	};

	useEffect(() => {
		loadEnrollments();
	}, [statusFilter]);

	useEffect(() => {
		loadCreateOptions();
	}, [isAdmin]);

	const applyStatusFilter = (value: string) => {
		if (!value) {
			searchParams.delete('status');
			setSearchParams(searchParams);
			return;
		}

		searchParams.set('status', value);
		setSearchParams(searchParams);
	};

	const handleStatusUpdate = async (id: string, status: string, notes?: string) => {
		try {
			setSuccessMessage(null);
			await enrollmentService.updateEnrollmentStatus(id, status, notes);
			await loadEnrollments();
			setSuccessMessage(`Enrollment marked as ${status}`);
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to update enrollment status');
		}
	};

	const openCreateEnrollmentModal = () => {
		setError(null);
		setSuccessMessage(null);
		setIsCreateModalOpen(true);
	};

	const closeCreateEnrollmentModal = () => {
		if (creatingEnrollment) return;
		setIsCreateModalOpen(false);
	};

	const handleCreateEnrollment = async () => {
		setError(null);
		setSuccessMessage(null);

		if (!createForm.providerId || !createForm.assignedTo) {
			setError('Please select provider and assigned user');
			return;
		}

		if (selectedProviderInsurances.length === 0) {
			setError('Please select at least one insurance service');
			return;
		}

		const requiredProviderFields = [
			['clientName', createForm.clientName],
			['firstName', createForm.firstName],
			['lastName', createForm.lastName],
			['npi', createForm.npi],
			['specialization', createForm.specialization],
			['licenseNumber', createForm.licenseNumber],
			['licenseState', createForm.licenseState],
			['licenseExpiryDate', createForm.licenseExpiryDate],
			['email', createForm.email],
		];

		const missingField = requiredProviderFields.find(([, value]) => !String(value || '').trim());
		if (missingField) {
			setError(`Enrollment ${missingField[0]} is required`);
			return;
		}

		if (!/^\d{10}$/.test(createForm.npi.trim())) {
			setError('NPI must be exactly 10 digits');
			return;
		}

		setCreatingEnrollment(true);
		try {
			await enrollmentService.createEnrollment({
				providerId: createForm.providerId as any,
				insuranceService: selectedProviderInsurances[0] as any,
				insuranceServices: selectedProviderInsurances as any,
				priority: createForm.priority as any,
				assignedTo: createForm.assignedTo as any,
				notes: createForm.notes || undefined,
				providerData: {
					clientName: createForm.clientName,
					firstName: createForm.firstName,
					lastName: createForm.lastName,
					npi: createForm.npi,
					specialization: createForm.specialization,
					providerCategory: createForm.providerCategory,
					dateOfBirth: createForm.dateOfBirth || null,
					email: createForm.email,
					phone: createForm.phone,
					ssn: createForm.ssn,
					caqhId: createForm.caqhId,
					medicarePTAN: createForm.medicarePTAN,
					medicaidId: createForm.medicaidId,
					licenseNumber: createForm.licenseNumber,
					licenseState: createForm.licenseState,
					licenseExpiryDate: createForm.licenseExpiryDate,
					pecosUsername: createForm.pecosUsername,
					pecosPassword: createForm.pecosPassword,
					caqhUsername: createForm.caqhUsername,
					caqhPassword: createForm.caqhPassword,
					insuranceServices: selectedProviderInsurances,
				},
			} as any);

			setCreateForm({
				providerId: '',
				priority: 'medium',
				assignedTo: userOptions[0]?._id || '',
				notes: '',
				clientName: '',
				firstName: '',
				lastName: '',
				npi: '',
				specialization: '',
				providerCategory: 'Individual',
				dateOfBirth: '',
				email: '',
				phone: '',
				ssn: '',
				caqhId: '',
				medicarePTAN: '',
				medicaidId: '',
				licenseNumber: '',
				licenseState: '',
				licenseExpiryDate: '',
				pecosUsername: '',
				pecosPassword: '',
				caqhUsername: '',
				caqhPassword: '',
			});
			setSelectedProviderInsurances([]);
			setIsCreateModalOpen(false);
			await loadEnrollments();
			setSuccessMessage(`Enrollment created successfully with ${selectedProviderInsurances.length} insurance service(s)`);
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to create enrollment. Enrollment does not create provider records.');
		} finally {
			setCreatingEnrollment(false);
		}
	};

	const handleDeleteEnrollment = async (enrollment: EnrollmentRow) => {
		if (!isAdmin) {
			setError('Only admin can delete enrollments');
			return;
		}

		const providerName = typeof enrollment.providerId === 'object'
			? `${enrollment.providerId.firstName || ''} ${enrollment.providerId.lastName || ''}`.trim()
			: 'this provider';
		const insuranceName = getEnrollmentInsuranceLabel(enrollment);

		const confirmed = window.confirm(`Delete enrollment for ${providerName} / ${insuranceName}?`);
		if (!confirmed) return;

		setDeletingEnrollmentId(enrollment._id);
		setError(null);
		setSuccessMessage(null);

		try {
			await enrollmentService.deleteEnrollment(enrollment._id);
			setEnrollments((prev) => prev.filter((item) => item._id !== enrollment._id));
			setSuccessMessage('Enrollment deleted successfully');
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to delete enrollment');
		} finally {
			setDeletingEnrollmentId(null);
		}
	};

	const openActionModal = (enrollmentId: string, status: string) => {
		setActionModal({ open: true, enrollmentId, status });
	};

	const getAssignedUserDisplay = (assignedTo: EnrollmentRow['assignedTo']) => {
		if (!assignedTo || typeof assignedTo === 'string') {
			return { name: 'Unassigned', email: '' };
		}

		return {
			name: assignedTo.fullName || 'Unassigned',
			email: assignedTo.email || '',
		};
	};

	const getEnrollmentProviderLabel = (enrollment: EnrollmentRow) => {
		if (typeof enrollment.providerId === 'object' && enrollment.providerId) {
			return `${enrollment.providerId.firstName || ''} ${enrollment.providerId.lastName || ''}`.trim() || 'N/A';
		}

		const profile = enrollment.enrollmentProfile || {};
		const profileName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
		return profileName || profile.npi || 'N/A';
	};

	const getEnrollmentClientLabel = (enrollment: EnrollmentRow) => {
		const profileClientName = String(enrollment.enrollmentProfile?.clientName || '').trim();
		if (profileClientName) {
			return profileClientName;
		}

		if (typeof enrollment.providerId === 'object' && enrollment.providerId) {
			const providerClientName = String(enrollment.providerId.clientName || '').trim();
			if (providerClientName) {
				return providerClientName;
			}
		}

		return 'N/A';
	};

	const getEnrollmentInsuranceLabel = (enrollment: EnrollmentRow) => {
		const values = Array.from(new Set(
			[
				...(Array.isArray(enrollment.insuranceServices) ? enrollment.insuranceServices : []),
				...(Array.isArray(enrollment.enrollmentProfile?.insuranceServices) ? enrollment.enrollmentProfile.insuranceServices : []),
				enrollment.insuranceService || '',
			]
				.map((value) => String(value || '').trim())
				.filter(Boolean)
		));

		return values.length ? values.join(', ') : 'N/A';
	};

	const hasEnrollmentDocuments = (enrollment: EnrollmentRow) => {
		if (typeof enrollment.hasUploadedDocuments === 'boolean') {
			return enrollment.hasUploadedDocuments;
		}

		return Number(enrollment.documentsCount || 0) > 0;
	};

	const getProgressBarClass = (value: number) => {
		if (value >= 80) return 'bg-emerald-500';
		if (value >= 50) return 'bg-blue-500';
		if (value >= 20) return 'bg-amber-500';
		return 'bg-rose-400';
	};

	const closeActionModal = () => {
		if (actionLoading) return;
		setActionModal({ open: false });
	};

	const confirmAction = async (note?: string) => {
		if (!actionModal.enrollmentId || !actionModal.status) return;

		setActionLoading(true);
		try {
			await handleStatusUpdate(actionModal.enrollmentId, actionModal.status, note);
			setActionModal({ open: false });
		} finally {
			setActionLoading(false);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">Enrollments</h1>
					<p className="text-gray-600">Track enrollment statuses across providers and insurance services.</p>
				</div>
				{isAdmin && (
					<button
						type="button"
						onClick={openCreateEnrollmentModal}
						className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
					>
						Add Enrollment
					</button>
				)}
			</div>

			<div className="flex flex-wrap gap-2">
				{statusOptions.map((option) => {
					const isActive = statusFilter === option.value;
					return (
						<button
							key={option.label}
							onClick={() => applyStatusFilter(option.value)}
							className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
								isActive
									? 'bg-primary-600 text-white border-primary-600'
									: 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'
							}`}
						>
							{option.label}
						</button>
					);
				})}
			</div>

			{loading && <p className="text-sm text-gray-600">Loading enrollments...</p>}
			{error && <p className="text-sm text-red-600">{error}</p>}
			{successMessage && <p className="text-sm text-emerald-600">{successMessage}</p>}

			{!loading && !error && (
				<div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
					<table className="min-w-full text-sm">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Provider</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Client Name</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Insurance Service</th>
								{isAdmin && <th className="px-4 py-3 text-left font-medium text-gray-700">Assigned User</th>}
								<th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Priority</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Progress</th>
								{isAdmin && <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>}
							</tr>
						</thead>
						<tbody>
							{enrollments.length === 0 ? (
								<tr><td className="px-4 py-4 text-gray-500" colSpan={isAdmin ? 8 : 6}>No enrollments found.</td></tr>
							) : enrollments.map((enrollment) => (
								<tr key={enrollment._id} className="border-t border-gray-100">
									<td className="px-4 py-3 text-gray-900">{getEnrollmentProviderLabel(enrollment)}</td>
									<td className="px-4 py-3 text-gray-700">{getEnrollmentClientLabel(enrollment)}</td>
									<td className="px-4 py-3 text-gray-700">{getEnrollmentInsuranceLabel(enrollment)}</td>
									{isAdmin && (
										<td className="px-4 py-3 text-gray-700">
											<div className="leading-tight">
												<p className="text-sm text-gray-900">{getAssignedUserDisplay(enrollment.assignedTo).name}</p>
												{getAssignedUserDisplay(enrollment.assignedTo).email && (
													<p className="text-xs text-gray-500">{getAssignedUserDisplay(enrollment.assignedTo).email}</p>
												)}
											</div>
										</td>
									)}
									<td className="px-4 py-3"><span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{enrollment.status}</span></td>
									<td className="px-4 py-3 text-gray-700">{enrollment.priority}</td>
									<td className="px-4 py-3 text-gray-700">
										<div className="w-28">
											<div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
												<div
													className={`h-full rounded-full transition-all ${getProgressBarClass(Number(enrollment.progressPercentage || 0))}`}
													style={{ width: `${Math.max(0, Math.min(100, Number(enrollment.progressPercentage || 0)))}%` }}
												/>
											</div>
											<p className="mt-1 text-xs text-gray-600">{Math.round(Number(enrollment.progressPercentage || 0))}%</p>
										</div>
									</td>
									{isAdmin && (
										<td className="px-4 py-3">
											<div className="flex flex-wrap gap-2">
												{hasEnrollmentDocuments(enrollment) ? (
													<>
														{enrollment.status !== 'submitted' && (
															<button onClick={() => openActionModal(enrollment._id, 'submitted')} className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">Submit</button>
														)}
														{enrollment.status !== 'approved' && (
															<button onClick={() => openActionModal(enrollment._id, 'approved')} className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700">Approve</button>
														)}
														{enrollment.status !== 'rejected' && (
															<button onClick={() => openActionModal(enrollment._id, 'rejected')} className="px-2 py-1 text-xs rounded bg-rose-100 text-rose-700">Reject</button>
														)}
													</>
												) : (
													<span className="px-2 py-1 text-xs rounded bg-amber-100 text-amber-700">Waiting for documents</span>
												)}
												<button
													onClick={() => handleDeleteEnrollment(enrollment)}
													disabled={deletingEnrollmentId === enrollment._id}
													className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 disabled:opacity-60"
												>
													{deletingEnrollmentId === enrollment._id ? 'Deleting...' : 'Delete'}
												</button>
											</div>
										</td>
									)}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<Modal
				isOpen={isCreateModalOpen}
				title="Add Enrollment"
				message="Create and assign enrollment with selected provider insurance services."
				maxWidthClass="max-w-4xl"
				confirmLabel="Create Enrollment"
				isLoading={creatingEnrollment}
				onClose={closeCreateEnrollmentModal}
				onConfirm={handleCreateEnrollment}
			>
				<div className="space-y-6 pt-1">
					<fieldset className="space-y-3">
						<legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
							<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-[10px] font-bold">1</span>
							Enrollment Details
						</legend>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
							<div>
								<label className="mb-1 block text-xs font-medium text-gray-600">Provider <span className="text-red-500">*</span></label>
								<select
									value={createForm.providerId}
									onChange={(e) => {
										const providerId = e.target.value;
										setCreateForm((prev) => ({ ...prev, providerId }));
										setSelectedProviderInsurances([]);
									}}
									className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
								>
									<option value="">Select Provider</option>
									{providerOptions.map((provider) => (
										<option key={provider._id} value={provider._id}>
											{provider.firstName || ''} {provider.lastName || ''} ({provider.npi || 'N/A'})
										</option>
									))}
								</select>
							</div>

							<div>
								<label className="mb-1 block text-xs font-medium text-gray-600">Assigned To User <span className="text-red-500">*</span></label>
								<select
									value={createForm.assignedTo}
									onChange={(e) => setCreateForm((prev) => ({ ...prev, assignedTo: e.target.value }))}
									className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
								>
									<option value="">Assign To User</option>
									{userOptions.map((option) => (
										<option key={option._id} value={option._id}>
											{option.fullName} ({option.email})
										</option>
									))}
								</select>
							</div>

							<div>
								<label className="mb-1 block text-xs font-medium text-gray-600">Priority</label>
								<select
									value={createForm.priority}
									onChange={(e) => setCreateForm((prev) => ({ ...prev, priority: e.target.value }))}
									className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
								>
									<option value="low">Low</option>
									<option value="medium">Medium</option>
									<option value="high">High</option>
									<option value="urgent">Urgent</option>
								</select>
							</div>

							{selectedProvider && (
								<div className="sm:col-span-2 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-2.5 text-xs text-gray-600">
									<span className="font-medium text-gray-700">Selected Provider:</span>{' '}
									{selectedProvider.firstName || ''} {selectedProvider.lastName || ''} ({selectedProvider.npi || 'N/A'})
								</div>
							)}
						</div>
					</fieldset>

					<>
							<div className="border-t border-gray-100" />

							<fieldset className="space-y-3">
								<legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
									<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-[10px] font-bold">2</span>
									Basic Information
								</legend>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
									<div className="sm:col-span-2">
										<label className="mb-1 block text-xs font-medium text-gray-600">Client Name <span className="text-red-500">*</span></label>
										<input type="text" placeholder="Enter client / practice name" value={createForm.clientName} onChange={(e) => setCreateForm((prev) => ({ ...prev, clientName: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" />
									</div>
									<div>
										<label className="mb-1 block text-xs font-medium text-gray-600">First Name <span className="text-red-500">*</span></label>
										<input type="text" placeholder="First name" value={createForm.firstName} onChange={(e) => setCreateForm((prev) => ({ ...prev, firstName: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" />
									</div>
									<div>
										<label className="mb-1 block text-xs font-medium text-gray-600">Last Name <span className="text-red-500">*</span></label>
										<input type="text" placeholder="Last name" value={createForm.lastName} onChange={(e) => setCreateForm((prev) => ({ ...prev, lastName: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" />
									</div>
									<div>
										<label className="mb-1 block text-xs font-medium text-gray-600">NPI <span className="text-red-500">*</span></label>
										<input type="text" placeholder="10-digit NPI number" value={createForm.npi} onChange={(e) => setCreateForm((prev) => ({ ...prev, npi: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-mono text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" />
									</div>
									<div>
										<label className="mb-1 block text-xs font-medium text-gray-600">Specialization <span className="text-red-500">*</span></label>
										<input type="text" placeholder="e.g. Internal Medicine" value={createForm.specialization} onChange={(e) => setCreateForm((prev) => ({ ...prev, specialization: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" />
									</div>
									<div className="sm:col-span-2">
										<label className="mb-1 block text-xs font-medium text-gray-600">Provider Category <span className="text-red-500">*</span></label>
										<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
											{PROVIDER_CATEGORIES.map((category) => {
												const checked = createForm.providerCategory === category;
												return (
													<label key={category} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium cursor-pointer transition-all ${checked ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-primary-200'}`}>
														<input type="radio" name="providerCategory" value={category} checked={checked} onChange={() => setCreateForm((prev) => ({ ...prev, providerCategory: category }))} className="h-3.5 w-3.5 text-primary-600 focus:ring-primary-400" />
														<span>{category}</span>
													</label>
												);
											})}
										</div>
									</div>
									<div>
										<label className="mb-1 block text-xs font-medium text-gray-600">Date of Birth</label>
										<input type="date" value={createForm.dateOfBirth} onChange={(e) => setCreateForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" />
									</div>
									<div>
										<label className="mb-1 block text-xs font-medium text-gray-600">Email <span className="text-red-500">*</span></label>
										<input type="email" placeholder="provider@example.com" value={createForm.email} onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" />
									</div>
									<div>
										<label className="mb-1 block text-xs font-medium text-gray-600">Phone</label>
										<input type="text" placeholder="+1 (555) 000-0000" value={createForm.phone} onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" />
									</div>
								</div>
							</fieldset>

							<div className="border-t border-gray-100" />

							<fieldset className="space-y-3">
								<legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-[10px] font-bold">3</span>Identifiers &amp; IDs</legend>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
									<div><label className="mb-1 block text-xs font-medium text-gray-600">SSN</label><input type="text" placeholder="Optional" value={createForm.ssn} onChange={(e) => setCreateForm((prev) => ({ ...prev, ssn: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" /></div>
									<div><label className="mb-1 block text-xs font-medium text-gray-600">CAQH ID</label><input type="text" placeholder="Optional" value={createForm.caqhId} onChange={(e) => setCreateForm((prev) => ({ ...prev, caqhId: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" /></div>
									<div><label className="mb-1 block text-xs font-medium text-gray-600">Medicare PTAN</label><input type="text" placeholder="Optional" value={createForm.medicarePTAN} onChange={(e) => setCreateForm((prev) => ({ ...prev, medicarePTAN: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" /></div>
									<div><label className="mb-1 block text-xs font-medium text-gray-600">Medicaid ID</label><input type="text" placeholder="Optional" value={createForm.medicaidId} onChange={(e) => setCreateForm((prev) => ({ ...prev, medicaidId: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" /></div>
								</div>
							</fieldset>

							<div className="border-t border-gray-100" />

							<fieldset className="space-y-3">
								<legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-[10px] font-bold">4</span>License Details</legend>
								<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
									<div><label className="mb-1 block text-xs font-medium text-gray-600">License Number <span className="text-red-500">*</span></label><input type="text" placeholder="License #" value={createForm.licenseNumber} onChange={(e) => setCreateForm((prev) => ({ ...prev, licenseNumber: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" /></div>
									<div><label className="mb-1 block text-xs font-medium text-gray-600">State <span className="text-red-500">*</span></label><input type="text" placeholder="e.g. TX" value={createForm.licenseState} onChange={(e) => setCreateForm((prev) => ({ ...prev, licenseState: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" /></div>
									<div><label className="mb-1 block text-xs font-medium text-gray-600">Expiry Date <span className="text-red-500">*</span></label><input type="date" value={createForm.licenseExpiryDate} onChange={(e) => setCreateForm((prev) => ({ ...prev, licenseExpiryDate: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" /></div>
								</div>
							</fieldset>

							<div className="border-t border-gray-100" />

							<fieldset className="space-y-3">
								<legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-[10px] font-bold">5</span>Credential Logins</legend>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
									{[
										{ label: 'PECOS Username', key: 'pecosUsername' },
										{ label: 'PECOS Password', key: 'pecosPassword' },
										{ label: 'CAQH Username', key: 'caqhUsername' },
										{ label: 'CAQH Password', key: 'caqhPassword' },
									].map(({ label, key }) => (
										<div key={key}>
											<label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
											<input type="text" placeholder="Optional" value={(createForm as any)[key]} onChange={(e) => setCreateForm((prev) => ({ ...prev, [key]: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" />
										</div>
									))}
								</div>
							</fieldset>

							<div className="border-t border-gray-100" />

							<fieldset className="space-y-3">
								<legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-[10px] font-bold">6</span>Insurance Services</legend>
								<div className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
									{!createForm.providerId && (
										<p className="text-sm text-gray-500">Select a provider to load insurance services.</p>
									)}
									{createForm.providerId && availableInsuranceServices.length === 0 && (
										<p className="text-sm text-amber-700">No insurance services found for selected provider.</p>
									)}
									{availableInsuranceServices.map((insurance) => {
										const checked = selectedProviderInsurances.includes(insurance);
										return (
											<label key={insurance} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer transition-all ${checked ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-gray-200 bg-white text-gray-700 hover:border-primary-200'}`}>
												<input
													type="checkbox"
													checked={checked}
													onChange={(e) => {
														if (e.target.checked) {
															setSelectedProviderInsurances((prev) => (prev.includes(insurance) ? prev : [...prev, insurance]));
															return;
														}
														setSelectedProviderInsurances((prev) => prev.filter((item) => item !== insurance));
													}}
													className="h-4 w-4 text-primary-600 focus:ring-primary-400"
												/>
												<span>{insurance}</span>
											</label>
										);
									})}
								</div>
							</fieldset>
					</>

					<div className="border-t border-gray-100" />

					<fieldset className="space-y-2">
						<legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
							<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-[10px] font-bold">7</span>
							Notes
						</legend>

						<textarea
							rows={3}
							placeholder="Optional internal notes about this enrollment…"
							value={createForm.notes}
							onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
							className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
						/>
					</fieldset>
				</div>
			</Modal>

			<Modal
				isOpen={actionModal.open}
				title={`Update Enrollment to ${actionModal.status || ''}`}
				message="Add an optional internal note and confirm the status update."
				requireNote={false}
				noteLabel="Internal Note"
				notePlaceholder="Optional status update note..."
				confirmLabel="Update Status"
				isLoading={actionLoading}
				onClose={closeActionModal}
				onConfirm={confirmAction}
			/>
		</div>
	);
}

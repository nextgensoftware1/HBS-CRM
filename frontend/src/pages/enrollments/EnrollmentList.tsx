import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { enrollmentService } from '../../services/enrollmentService';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/common/Modal';

type EnrollmentRow = {
	_id: string;
	providerId: { firstName?: string; lastName?: string } | string;
	payerId: { payerName?: string } | string;
	status: string;
	priority: string;
	progressPercentage: number;
};

export default function EnrollmentList() {
	const user = useAuthStore((state) => state.user);
	const isAdmin = user?.role === 'admin';
	const [searchParams, setSearchParams] = useSearchParams();
	const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [actionLoading, setActionLoading] = useState(false);
	const [actionModal, setActionModal] = useState<{
		open: boolean;
		enrollmentId?: string;
		status?: string;
	}>({ open: false });
	const statusFilter = searchParams.get('status') || '';

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

	useEffect(() => {
		loadEnrollments();
	}, [statusFilter]);

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
			await enrollmentService.updateEnrollmentStatus(id, status, notes);
			await loadEnrollments();
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to update enrollment status');
		}
	};

	const openActionModal = (enrollmentId: string, status: string) => {
		setActionModal({ open: true, enrollmentId, status });
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
			<div>
				<h1 className="text-2xl font-bold text-gray-900">Enrollments</h1>
				<p className="text-gray-600">Track enrollment statuses across providers and payers.</p>
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

			{!loading && !error && (
				<div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
					<table className="min-w-full text-sm">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Provider</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Payer</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Priority</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Progress</th>
								{isAdmin && <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>}
							</tr>
						</thead>
						<tbody>
							{enrollments.length === 0 ? (
								<tr><td className="px-4 py-4 text-gray-500" colSpan={isAdmin ? 6 : 5}>No enrollments found.</td></tr>
							) : enrollments.map((enrollment) => (
								<tr key={enrollment._id} className="border-t border-gray-100">
									<td className="px-4 py-3 text-gray-900">{typeof enrollment.providerId === 'object' ? `${enrollment.providerId.firstName || ''} ${enrollment.providerId.lastName || ''}`.trim() : 'N/A'}</td>
									<td className="px-4 py-3 text-gray-700">{typeof enrollment.payerId === 'object' ? enrollment.payerId.payerName || 'N/A' : 'N/A'}</td>
									<td className="px-4 py-3"><span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{enrollment.status}</span></td>
									<td className="px-4 py-3 text-gray-700">{enrollment.priority}</td>
									<td className="px-4 py-3 text-gray-700">{enrollment.progressPercentage || 0}%</td>
									{isAdmin && (
										<td className="px-4 py-3">
											<div className="flex flex-wrap gap-2">
												{enrollment.status !== 'submitted' && (
													<button onClick={() => openActionModal(enrollment._id, 'submitted')} className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">Submit</button>
												)}
												{enrollment.status !== 'approved' && (
													<button onClick={() => openActionModal(enrollment._id, 'approved')} className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700">Approve</button>
												)}
												{enrollment.status !== 'rejected' && (
													<button onClick={() => openActionModal(enrollment._id, 'rejected')} className="px-2 py-1 text-xs rounded bg-rose-100 text-rose-700">Reject</button>
												)}
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

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { reminderService } from '../../services/reminderService';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/common/Modal';

type ReminderRow = {
	_id: string;
	title: string;
	description?: string;
	reminderType: string;
	dueDate: string;
	priority: string;
	status: string;
	metadata?: {
		requestedDocuments?: string[];
	};
	enrollmentId?: { _id?: string } | string | null;
	providerId?: { _id?: string } | string | null;
};

export default function ReminderList() {
	const user = useAuthStore((state) => state.user);
	const isAdmin = user?.role === 'admin';
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [reminders, setReminders] = useState<ReminderRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [actionLoading, setActionLoading] = useState(false);
	const [actionModal, setActionModal] = useState<{
		open: boolean;
		reminderId?: string;
		type?: 'complete' | 'dismiss' | 'delete';
	}>({ open: false });
	const statusFilter = searchParams.get('status') || '';

	const statusOptions = [
		{ label: 'All', value: '' },
		{ label: 'Pending', value: 'pending' },
		{ label: 'Sent', value: 'sent' },
		{ label: 'Completed', value: 'completed' },
		{ label: 'Dismissed', value: 'dismissed' },
	];

	const loadReminders = async () => {
		try {
			const filters = statusFilter ? { status: statusFilter } : {};
			const data = await reminderService.getReminders(1, 50, filters);
			setReminders(data.items);
			setError(null);
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to load reminders');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadReminders();
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

	const openActionModal = (type: 'complete' | 'dismiss' | 'delete', reminderId: string) => {
		setActionModal({ open: true, type, reminderId });
	};

	const closeActionModal = () => {
		if (actionLoading) return;
		setActionModal({ open: false });
	};

	const confirmAction = async (note?: string) => {
		if (!actionModal.type || !actionModal.reminderId) return;

		setActionLoading(true);
		try {
			if (actionModal.type === 'complete') {
				await reminderService.completeReminder(actionModal.reminderId, note);
			}
			if (actionModal.type === 'dismiss') {
				await reminderService.dismissReminder(actionModal.reminderId, note);
			}
			if (actionModal.type === 'delete') {
				await reminderService.deleteReminder(actionModal.reminderId, note);
			}

			await loadReminders();
			setActionModal({ open: false });
		} catch (err: any) {
			setError(err.response?.data?.message || 'Action failed');
		} finally {
			setActionLoading(false);
		}
	};

	const openUploadForReminder = (reminder: ReminderRow) => {
		const enrollmentId = typeof reminder.enrollmentId === 'object'
			? reminder.enrollmentId?._id
			: reminder.enrollmentId;

		const providerId = typeof reminder.providerId === 'object'
			? reminder.providerId?._id
			: reminder.providerId;

		const query = new URLSearchParams();
		query.set('fromReminder', '1');
		if (enrollmentId) query.set('enrollmentId', String(enrollmentId));
		if (providerId) query.set('providerId', String(providerId));

		navigate(`/documents/upload?${query.toString()}`);
	};

	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-2xl font-bold text-gray-900">Reminders</h1>
				<p className="text-gray-600">Tasks and follow-ups requiring action.</p>
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

			{loading && <p className="text-sm text-gray-600">Loading reminders...</p>}
			{error && <p className="text-sm text-red-600">{error}</p>}

			{!loading && !error && (
				<div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
					<table className="min-w-full text-sm">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Title</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Message</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Due Date</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Priority</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
							</tr>
						</thead>
						<tbody>
							{reminders.length === 0 ? (
								<tr><td className="px-4 py-4 text-gray-500" colSpan={7}>No reminders found.</td></tr>
							) : reminders.map((reminder) => (
								<tr key={reminder._id} className="border-t border-gray-100">
									<td className="px-4 py-3 text-gray-900">{reminder.title}</td>
									<td className="px-4 py-3 text-gray-700 max-w-md">
										<p className="text-sm break-words">{reminder.description || 'N/A'}</p>
										{Array.isArray(reminder.metadata?.requestedDocuments) && reminder.metadata!.requestedDocuments!.length > 0 && (
											<p className="mt-1 text-xs text-amber-700 break-words">
												Requested: {reminder.metadata!.requestedDocuments!.join(', ')}
											</p>
										)}
									</td>
									<td className="px-4 py-3 text-gray-700">{reminder.reminderType}</td>
									<td className="px-4 py-3 text-gray-700">{new Date(reminder.dueDate).toLocaleDateString()}</td>
									<td className="px-4 py-3 text-gray-700">{reminder.priority}</td>
									<td className="px-4 py-3"><span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{reminder.status}</span></td>
									<td className="px-4 py-3">
										<div className="flex flex-wrap gap-2">
											{!isAdmin && reminder.reminderType === 'missing_document' && reminder.status !== 'completed' && (
												<button onClick={() => openUploadForReminder(reminder)} className="px-2 py-1 text-xs rounded bg-primary-100 text-primary-700">Upload Requested Docs</button>
											)}
											{isAdmin && reminder.status !== 'completed' && (
												<button onClick={() => openActionModal('complete', reminder._id)} className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700">Complete</button>
											)}
											{isAdmin && reminder.status !== 'dismissed' && (
												<button onClick={() => openActionModal('dismiss', reminder._id)} className="px-2 py-1 text-xs rounded bg-amber-100 text-amber-700">Dismiss</button>
											)}
											{isAdmin && <button onClick={() => openActionModal('delete', reminder._id)} className="px-2 py-1 text-xs rounded bg-red-100 text-red-700">Delete</button>}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<Modal
				isOpen={actionModal.open}
				title={
					actionModal.type === 'complete'
						? 'Complete Reminder'
						: actionModal.type === 'dismiss'
							? 'Dismiss Reminder'
							: 'Delete Reminder'
				}
				message="Add an optional audit note and confirm this action."
				requireNote={false}
				noteLabel="Audit Note"
				notePlaceholder="Optional reason or context..."
				confirmLabel={actionModal.type === 'delete' ? 'Delete' : 'Confirm'}
				isLoading={actionLoading}
				onClose={closeActionModal}
				onConfirm={confirmAction}
			/>
		</div>
	);
}

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

	const formatStatusLabel = (status: string) => String(status || '').replace(/_/g, ' ') || 'unknown';
	const formatTypeLabel = (type: string) => String(type || '').replace(/_/g, ' ') || 'general';

	const getStatusBadgeClass = (status: string) => {
		switch (status) {
			case 'completed':
				return 'bg-emerald-100 text-emerald-700';
			case 'dismissed':
				return 'bg-rose-100 text-rose-700';
			case 'sent':
				return 'bg-indigo-100 text-indigo-700';
			default:
				return 'bg-blue-100 text-blue-700';
		}
	};

	const getPriorityBadgeClass = (priority: string) => {
		switch (priority) {
			case 'urgent':
				return 'bg-rose-100 text-rose-700';
			case 'high':
				return 'bg-amber-100 text-amber-700';
			case 'medium':
				return 'bg-blue-100 text-blue-700';
			default:
				return 'bg-slate-100 text-slate-700';
		}
	};

	const actionBtnClass = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md font-medium whitespace-nowrap transition-colors';

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur px-4 py-4 sm:px-5 sm:py-5 shadow-sm">
				<h1 className="text-2xl font-bold tracking-tight text-slate-900">Reminders</h1>
				<p className="text-slate-600">Tasks and follow-ups requiring action.</p>

				<div className="mt-4 -mx-1 px-1 overflow-x-auto">
					<div className="flex w-max min-w-full gap-2">
						{statusOptions.map((option) => {
							const isActive = statusFilter === option.value;
							return (
								<button
									key={option.label}
									onClick={() => applyStatusFilter(option.value)}
									className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-all ${
										isActive
											? 'bg-primary-600 text-white border-primary-600'
											: 'bg-white text-slate-700 border-slate-300 hover:border-primary-400'
									}`}
								>
									{option.label}
								</button>
							);
						})}
					</div>
				</div>
			</div>

			{loading && <p className="text-sm text-slate-600">Loading reminders...</p>}
			{error && <p className="text-sm text-red-600 rounded-xl border border-red-200 bg-red-50 px-3 py-2">{error}</p>}

			{!loading && !error && (
				<>
					<div className="lg:hidden space-y-3">
						{reminders.length === 0 ? (
							<div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-500">No reminders found.</div>
						) : reminders.map((reminder) => (
							<div key={`mobile-${reminder._id}`} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
								<div className="flex items-start justify-between gap-3">
									<p className="font-semibold text-slate-900 break-words">{reminder.title}</p>
									<span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(reminder.status)}`}>
										{formatStatusLabel(reminder.status)}
									</span>
								</div>

								<p className="text-sm text-slate-700 break-words">{reminder.description || 'N/A'}</p>
								{Array.isArray(reminder.metadata?.requestedDocuments) && reminder.metadata.requestedDocuments.length > 0 && (
									<p className="text-xs text-amber-700 break-words">Requested: {reminder.metadata.requestedDocuments.join(', ')}</p>
								)}

								<div className="flex flex-wrap gap-2">
									<span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{formatTypeLabel(reminder.reminderType)}</span>
									<span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getPriorityBadgeClass(reminder.priority)}`}>{reminder.priority}</span>
									<span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">Due {new Date(reminder.dueDate).toLocaleDateString()}</span>
								</div>

								<div className="flex flex-wrap gap-2 pt-1">
									{!isAdmin && reminder.reminderType === 'missing_document' && reminder.status !== 'completed' && (
										<button onClick={() => openUploadForReminder(reminder)} className={`${actionBtnClass} bg-primary-100 text-primary-700`}>Upload Requested Docs</button>
									)}
									{isAdmin && reminder.status !== 'completed' && (
										<button onClick={() => openActionModal('complete', reminder._id)} className={`${actionBtnClass} bg-emerald-100 text-emerald-700`}>Complete</button>
									)}
									{isAdmin && reminder.status !== 'dismissed' && (
										<button onClick={() => openActionModal('dismiss', reminder._id)} className={`${actionBtnClass} bg-amber-100 text-amber-700`}>Dismiss</button>
									)}
									{isAdmin && <button onClick={() => openActionModal('delete', reminder._id)} className={`${actionBtnClass} bg-red-100 text-red-700`}>Delete</button>}
								</div>
							</div>
						))}
					</div>

					<div className="hidden lg:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
						<div className="overflow-x-auto">
							<table className="min-w-[1080px] w-full text-sm">
								<thead className="bg-slate-50/90">
									<tr>
										<th className="px-4 py-3 text-left font-semibold text-slate-700">Title</th>
										<th className="px-4 py-3 text-left font-semibold text-slate-700">Message</th>
										<th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
										<th className="px-4 py-3 text-left font-semibold text-slate-700">Due Date</th>
										<th className="px-4 py-3 text-left font-semibold text-slate-700">Priority</th>
										<th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
										<th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
									</tr>
								</thead>
								<tbody>
									{reminders.length === 0 ? (
										<tr><td className="px-4 py-4 text-slate-500" colSpan={7}>No reminders found.</td></tr>
									) : reminders.map((reminder) => (
										<tr key={reminder._id} className="border-t border-slate-100 hover:bg-slate-50/40">
											<td className="px-4 py-3 text-slate-900 max-w-[180px] break-words">{reminder.title}</td>
											<td className="px-4 py-3 text-slate-700 max-w-md">
												<p className="text-sm break-words">{reminder.description || 'N/A'}</p>
												{Array.isArray(reminder.metadata?.requestedDocuments) && reminder.metadata.requestedDocuments.length > 0 && (
													<p className="mt-1 text-xs text-amber-700 break-words">
														Requested: {reminder.metadata.requestedDocuments.join(', ')}
													</p>
												)}
											</td>
											<td className="px-4 py-3 text-slate-700">{formatTypeLabel(reminder.reminderType)}</td>
											<td className="px-4 py-3 text-slate-700">{new Date(reminder.dueDate).toLocaleDateString()}</td>
											<td className="px-4 py-3"><span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getPriorityBadgeClass(reminder.priority)}`}>{reminder.priority}</span></td>
											<td className="px-4 py-3"><span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(reminder.status)}`}>{formatStatusLabel(reminder.status)}</span></td>
											<td className="px-4 py-3">
												<div className="flex flex-wrap gap-2">
													{!isAdmin && reminder.reminderType === 'missing_document' && reminder.status !== 'completed' && (
														<button onClick={() => openUploadForReminder(reminder)} className={`${actionBtnClass} bg-primary-100 text-primary-700`}>Upload Requested Docs</button>
													)}
													{isAdmin && reminder.status !== 'completed' && (
														<button onClick={() => openActionModal('complete', reminder._id)} className={`${actionBtnClass} bg-emerald-100 text-emerald-700`}>Complete</button>
													)}
													{isAdmin && reminder.status !== 'dismissed' && (
														<button onClick={() => openActionModal('dismiss', reminder._id)} className={`${actionBtnClass} bg-amber-100 text-amber-700`}>Dismiss</button>
													)}
													{isAdmin && <button onClick={() => openActionModal('delete', reminder._id)} className={`${actionBtnClass} bg-red-100 text-red-700`}>Delete</button>}
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</>
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

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { documentService } from '../../services/documentService';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/common/Modal';

type DocumentRow = {
	_id: string;
	documentType: string;
	fileName: string;
	fileNames?: string[];
	filesCount?: number;
	status: string;
	providerId: { _id?: string; firstName?: string; lastName?: string } | string;
	uploadedBy?: { _id?: string; fullName?: string; email?: string } | string;
	metadata?: {
		insuranceService?: string;
	};
	createdAt: string;
};

export default function DocumentList() {
	const user = useAuthStore((state) => state.user);
	const isAdmin = user?.role === 'admin';
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [documents, setDocuments] = useState<DocumentRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [actionLoading, setActionLoading] = useState(false);
	const [actionModal, setActionModal] = useState<{
		open: boolean;
		documentId?: string;
		type?: 'approve' | 'reject' | 'delete';
	}>({ open: false });
	const statusFilter = searchParams.get('status') || '';

	const statusOptions = [
		{ label: 'All', value: '' },
		{ label: 'Pending', value: 'pending' },
		{ label: 'Under Review', value: 'under_review' },
		{ label: 'Approved', value: 'approved' },
		{ label: 'Rejected', value: 'rejected' },
		{ label: 'Submitted', value: 'submitted' },
	];

	const loadDocuments = async () => {
		try {
			const filters = statusFilter ? { status: statusFilter } : {};
			const data = await documentService.getDocuments(1, 50, filters);
			setDocuments(data.items);
			setError(null);
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to load documents');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadDocuments();
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

	const openActionModal = (type: 'approve' | 'reject' | 'delete', documentId: string) => {
		setActionModal({ open: true, type, documentId });
	};

	const closeActionModal = () => {
		if (actionLoading) return;
		setActionModal({ open: false });
	};

	const handleApprove = async (id: string, adminNote?: string) => {
		try {
			await documentService.updateStatus(id, 'approved', undefined, adminNote);
			await loadDocuments();
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to approve document');
		}
	};

	const handleReject = async (id: string, reason: string) => {
		try {
			await documentService.updateStatus(id, 'rejected', reason, reason);
			await loadDocuments();
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to reject document');
		}
	};

	const handleDelete = async (id: string) => {
		try {
			await documentService.deleteDocument(id);
			await loadDocuments();
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to delete document');
		}
	};

	const handleOpen = (id: string) => {
		navigate(`/documents/${id}/submission`);
	};

	const handleReUpload = (doc: DocumentRow) => {
		navigate(`/documents/${doc._id}/submission`);
	};

	const confirmAction = async (note?: string) => {
		if (!actionModal.documentId || !actionModal.type) return;

		setActionLoading(true);
		try {
			if (actionModal.type === 'approve') {
				await handleApprove(actionModal.documentId, note);
			}

			if (actionModal.type === 'reject') {
				if (!note) {
					setError('Rejection reason is required');
					return;
				}
				await handleReject(actionModal.documentId, note);
			}

			if (actionModal.type === 'delete') {
				await handleDelete(actionModal.documentId);
			}
			setActionModal({ open: false });
		} finally {
			setActionLoading(false);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">Documents</h1>
					<p className="text-gray-600">
						{isAdmin
							? 'Uploaded credentialing documents and review status.'
							: 'Your uploaded credentialing documents and review status.'}
					</p>
				</div>
				<Link to="/documents/upload" className="px-3 py-2 rounded-lg bg-primary-600 text-white text-sm">
					Upload Document
				</Link>
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

			{loading && <p className="text-sm text-gray-600">Loading documents...</p>}
			{error && <p className="text-sm text-red-600">{error}</p>}

			{!loading && !error && (
				<div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
					<table className="min-w-full text-sm">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Document</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">File</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Provider</th>
								{isAdmin && <th className="px-4 py-3 text-left font-medium text-gray-700">Submitted By</th>}
								<th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Uploaded</th>
								<th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
							</tr>
						</thead>
						<tbody>
							{documents.length === 0 ? (
								<tr><td className="px-4 py-4 text-gray-500" colSpan={isAdmin ? 7 : 6}>No documents found.</td></tr>
							) : documents.map((doc) => (
								<tr key={doc._id} className="border-t border-gray-100">
									<td className="px-4 py-3 text-gray-900">{doc.documentType}</td>
									<td className="px-4 py-3 text-gray-700">
										{doc.filesCount && doc.filesCount > 1 ? (
											<div>
												<p className="font-medium">{doc.filesCount} files submitted</p>
												<p className="text-xs text-gray-500">{doc.fileName}</p>
											</div>
										) : (
											doc.fileName
										)}
									</td>
									<td className="px-4 py-3 text-gray-700">{typeof doc.providerId === 'object' ? `${doc.providerId.firstName || ''} ${doc.providerId.lastName || ''}`.trim() : 'N/A'}</td>
									{isAdmin && (
										<td className="px-4 py-3 text-gray-700">
											{typeof doc.uploadedBy === 'object'
												? (doc.uploadedBy.fullName || doc.uploadedBy.email || 'N/A')
												: 'N/A'}
										</td>
									)}
									<td className="px-4 py-3"><span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{doc.status}</span></td>
									<td className="px-4 py-3 text-gray-700">{new Date(doc.createdAt).toLocaleDateString()}</td>
									<td className="px-4 py-3">
										<div className="flex flex-wrap gap-2">
											<button onClick={() => handleOpen(doc._id)} className="px-2 py-1 text-xs rounded bg-slate-100 text-slate-700">Open</button>
											{isAdmin ? (
												<>
													{doc.status !== 'approved' && (
														<button onClick={() => openActionModal('approve', doc._id)} className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700">Approve</button>
													)}
													{doc.status !== 'rejected' && (
														<button onClick={() => openActionModal('reject', doc._id)} className="px-2 py-1 text-xs rounded bg-rose-100 text-rose-700">Reject</button>
													)}
													<button onClick={() => openActionModal('delete', doc._id)} className="px-2 py-1 text-xs rounded bg-red-100 text-red-700">Delete</button>
												</>
											) : (
												doc.status === 'rejected' && (
													<button onClick={() => handleReUpload(doc)} className="px-2 py-1 text-xs rounded bg-amber-100 text-amber-700">Re-upload</button>
												)
											)}
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
					actionModal.type === 'approve'
						? 'Approve Document'
						: actionModal.type === 'reject'
							? 'Reject Document'
							: 'Delete Document'
				}
				message={
					actionModal.type === 'approve'
						? 'Approve this document and mark it verified.'
						: actionModal.type === 'reject'
							? 'Reject this document. Please provide a reason.'
							: 'Delete this document from records.'
				}
				requireNote={actionModal.type === 'reject'}
				noteLabel={actionModal.type === 'reject' ? 'Rejection Reason' : 'Admin Note (optional)'}
				notePlaceholder={actionModal.type === 'reject' ? 'Enter rejection reason...' : 'Enter optional audit note...'}
				confirmLabel={actionModal.type === 'delete' ? 'Delete' : 'Confirm'}
				isLoading={actionLoading}
				onClose={closeActionModal}
				onConfirm={confirmAction}
			/>
		</div>
	);
}

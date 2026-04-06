import { ReactNode, useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';

type ModalProps = {
	isOpen: boolean;
	title: string;
	message?: string;
	maxWidthClass?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	isLoading?: boolean;
	requireNote?: boolean;
	noteLabel?: string;
	notePlaceholder?: string;
	initialNote?: string;
	children?: ReactNode;
	onClose: () => void;
	onConfirm: (note?: string) => void | Promise<void>;
};

export default function Modal({
	isOpen,
	title,
	message,
	maxWidthClass = 'max-w-md',
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	isLoading = false,
	requireNote = false,
	noteLabel = 'Note',
	notePlaceholder = 'Enter note...',
	initialNote = '',
	children,
	onClose,
	onConfirm,
}: ModalProps) {
	const [note, setNote] = useState(initialNote);

	useEffect(() => {
		if (isOpen) {
			setNote(initialNote);
		}
	}, [isOpen, initialNote]);

	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
			<div className="absolute inset-0 bg-black/40" onClick={onClose} />
			<div className={`relative w-full ${maxWidthClass} max-h-[92vh] rounded-xl bg-white shadow-xl border border-gray-200 flex flex-col`}>
				<button
					type="button"
					onClick={onClose}
					disabled={isLoading}
					className="absolute right-3 top-3 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-60"
					aria-label="Close modal"
				>
					<FiX className="h-5 w-5" />
				</button>

				<div className="px-5 pt-5 pb-3 border-b border-gray-100">
					<h3 className="text-lg font-semibold text-gray-900">{title}</h3>
					{message && <p className="mt-1 text-sm text-gray-600">{message}</p>}
				</div>

				<div className="px-5 py-4 space-y-4 overflow-y-auto">
					{children}

					{(requireNote || note.length > 0) && (
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">{noteLabel}</label>
							<textarea
								value={note}
								onChange={(e) => setNote(e.target.value)}
								placeholder={notePlaceholder}
								rows={3}
								className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
							/>
						</div>
					)}
				</div>

				<div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 bg-white">
					<button
						type="button"
						onClick={onClose}
						disabled={isLoading}
						className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700"
					>
						{cancelLabel}
					</button>
					<button
						type="button"
						onClick={() => onConfirm(note.trim() || undefined)}
						disabled={isLoading || (requireNote && note.trim().length === 0)}
						className="px-3 py-2 rounded-lg bg-primary-600 text-sm text-white disabled:opacity-60"
					>
						{isLoading ? 'Saving...' : confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}

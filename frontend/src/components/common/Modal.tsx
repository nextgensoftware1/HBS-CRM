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

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
			<div className="absolute inset-0 bg-black/40" onClick={onClose} />
			<div
				className={`relative w-[calc(100vw-1rem)] sm:w-full ${maxWidthClass} max-h-[92dvh] sm:max-h-[92vh] rounded-xl bg-[var(--color-background)] shadow-xl border border-[var(--color-border-soft)] flex flex-col overflow-hidden`}
			>
				<button
					type="button"
					onClick={onClose}
					disabled={isLoading}
					className="absolute right-2.5 top-2.5 sm:right-3 sm:top-3 rounded-md p-1 text-[var(--color-text-light)] hover:bg-[var(--color-background)]/50 disabled:opacity-60"
					aria-label="Close modal"
				>
					<FiX className="h-5 w-5" />
				</button>

				<div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-[var(--color-border-soft)]">
					<h3 className="text-lg font-semibold text-[var(--color-text-dark)]">{title}</h3>
					{message && <p className="mt-1 text-sm text-[var(--color-text-light)]">{message}</p>}
				</div>

				<div className="px-4 sm:px-5 py-4 space-y-4 overflow-y-auto overflow-x-hidden">
					{children}

					{(requireNote || note.length > 0) && (
						<div>
							<label className="block text-sm font-medium text-[var(--color-text-light)] mb-1">{noteLabel}</label>
							<textarea
								value={note}
								onChange={(e) => setNote(e.target.value)}
								placeholder={notePlaceholder}
								rows={3}
								className="w-full rounded-lg border border-[var(--color-border-soft)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]"
							/>
						</div>
					)}
				</div>

				<div className="px-4 sm:px-5 py-3 border-t border-[var(--color-border-soft)] flex flex-col-reverse sm:flex-row sm:justify-end gap-2 bg-[var(--color-background)]">
					<button
						type="button"
						onClick={onClose}
						disabled={isLoading}
						className="w-full sm:w-auto px-3 py-2 rounded-lg border border-[var(--color-border-soft)] text-sm text-[var(--color-text-light)]"
					>
						{cancelLabel}
					</button>
					<button
						type="button"
						onClick={() => onConfirm(note.trim() || undefined)}
						disabled={isLoading || (requireNote && note.trim().length === 0)}
						className="w-full sm:w-auto px-3 py-2 rounded-lg bg-[var(--color-primary)] text-sm text-white disabled:opacity-60"
					>
						{isLoading ? 'Saving...' : confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}

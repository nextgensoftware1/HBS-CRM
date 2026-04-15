import { Link } from 'react-router-dom';

export default function EnrollmentDetail() {
	return (
		<div className="max-w-4xl mx-auto space-y-4">
			<div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur px-5 py-5 shadow-sm">
				<h1 className="text-2xl font-bold tracking-tight text-slate-900">Enrollment Detail</h1>
				<p className="mt-1 text-slate-600">
					This detailed enrollment screen is ready for expansion with timeline, notes, and document history sections.
				</p>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
				<p className="text-sm text-slate-700">
					Continue using the Enrollments list for current workflow actions.
				</p>
				<Link
					to="/enrollments"
					className="inline-flex mt-3 rounded-xl border border-primary-200 bg-white px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50"
				>
					Back to Enrollments
				</Link>
			</div>
		</div>
	);
}

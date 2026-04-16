import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiUpload, FiFile, FiFileText, FiClock, FiCheckCircle } from 'react-icons/fi';
import Card from '../../components/common/Card';
import { useAuthStore } from '../../store/authStore';
import { documentService } from '../../services/documentService';
import { enrollmentService } from '../../services/enrollmentService';
import { reminderService } from '../../services/reminderService';
import { providerService } from '../../services/providerService';
import type { Document as AppDocument } from '../../types/types';

type SummaryStats = {
  totalDocuments: number;
  pendingDocuments: number;
  approvedDocuments: number;
  rejectedDocuments: number;
  totalEnrollments: number;
  inReviewEnrollments: number;
  pendingReminders: number;
  totalProviders: number;
};

type DashboardReminder = {
  _id: string;
  title: string;
  dueDate?: string;
  priority?: string;
  status: string;
};

const emptyStats: SummaryStats = {
  totalDocuments: 0,
  pendingDocuments: 0,
  approvedDocuments: 0,
  rejectedDocuments: 0,
  totalEnrollments: 0,
  inReviewEnrollments: 0,
  pendingReminders: 0,
  totalProviders: 0,
};

export default function UserDashboard() {
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SummaryStats>(emptyStats);
  const [recentDocuments, setRecentDocuments] = useState<AppDocument[]>([]);
  const [pendingReminders, setPendingReminders] = useState<DashboardReminder[]>([]);

  const reviewProgressRate = useMemo(() => {
    const reviewedCount = stats.approvedDocuments + stats.rejectedDocuments;
    if (reviewedCount === 0) return 0;
    return Math.round((stats.approvedDocuments / reviewedCount) * 100);
  }, [stats.approvedDocuments, stats.rejectedDocuments]);

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        setLoading(true);
        setError(null);

        const [
          docsTotal,
          docsPending,
          docsApproved,
          docsRejected,
          enrollmentsTotal,
          enrollmentsInReview,
          remindersPending,
          providersTotal,
          latestDocs,
          latestReminders,
        ] = await Promise.all([
          documentService.getDocuments(1, 1),
          documentService.getDocuments(1, 1, { status: 'pending' }),
          documentService.getDocuments(1, 1, { status: 'approved' }),
          documentService.getDocuments(1, 1, { status: 'rejected' }),
          enrollmentService.getEnrollments(1, 1),
          enrollmentService.getEnrollments(1, 1, { status: 'in_review' }),
          reminderService.getReminders(1, 1, { status: 'pending' }),
          providerService.getProviders(1, 1),
          documentService.getDocuments(1, 5),
          reminderService.getReminders(1, 5, { status: 'pending' }),
        ]);

        setStats({
          totalDocuments: docsTotal.pagination.total,
          pendingDocuments: docsPending.pagination.total,
          approvedDocuments: docsApproved.pagination.total,
          rejectedDocuments: docsRejected.pagination.total,
          totalEnrollments: enrollmentsTotal.pagination.total,
          inReviewEnrollments: enrollmentsInReview.pagination.total,
          pendingReminders: remindersPending.pagination.total,
          totalProviders: providersTotal.pagination.total,
        });

        setRecentDocuments(latestDocs.items || []);
        setPendingReminders((latestReminders.items || []) as DashboardReminder[]);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load workspace dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadWorkspace();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-background)]/85 min-h-[18rem]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  const getStatusBadgeClass = (status: string) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'approved') return 'bg-[rgba(106,193,67,0.18)] text-[var(--color-primary)] border border-[rgba(106,193,67,0.28)]';
    if (normalized === 'rejected') return 'bg-[rgba(74,144,217,0.16)] text-[var(--color-secondary)] border border-[rgba(74,144,217,0.28)]';
    if (normalized === 'under_review') return 'bg-[var(--color-light-section)] text-[var(--color-text-dark)] border border-[var(--color-border-soft)]';
    if (normalized === 'submitted') return 'bg-[var(--color-secondary-soft)] text-[var(--color-secondary)] border border-[var(--color-border-soft)]';
    return 'bg-[var(--color-light-section)] text-[var(--color-text-dark)] border border-[var(--color-border-soft)]';
  };

  const formatStatus = (status: string) => String(status || '').replace(/_/g, ' ') || 'pending';

  return (
    <div className="space-y-6 pb-3">
      <div className="reveal-on-scroll rounded-2xl border border-[var(--color-border-soft)] bg-gradient-to-r from-[var(--color-background)] via-[var(--color-light-section)] to-[var(--color-secondary-soft)] p-5 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-[var(--color-secondary)]/20 blur-2xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-40 w-40 rounded-full bg-[var(--color-primary)]/20 blur-3xl" />
        <div className="relative">
          <p className="text-xs sm:text-sm font-semibold tracking-[0.18em] uppercase text-[var(--color-secondary)]">User Workspace</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text-dark)] mt-1">Workspace Dashboard</h1>
          <p className="text-[var(--color-text-dark)]/80 mt-2 max-w-3xl">
          Welcome {user?.fullName}. Track documents, enrollments, reminders, and your completion progress in one place.
          </p>
          {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="reveal-on-scroll border-l-4 border-l-[var(--color-secondary)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-dark)]/70">My Documents</p>
              <p className="text-3xl font-bold text-[var(--color-text-dark)] mt-1">{stats.totalDocuments}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-[var(--color-secondary-soft)] flex items-center justify-center">
              <FiFile className="h-6 w-6 text-[var(--color-secondary)]" />
            </div>
          </div>
        </Card>

        <Card className="reveal-on-scroll border-l-4 border-l-[var(--color-primary)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-dark)]/70">Pending Docs</p>
              <p className="text-3xl font-bold text-[var(--color-text-dark)] mt-1">{stats.pendingDocuments}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-[rgba(106,193,67,0.15)] flex items-center justify-center">
              <FiClock className="h-6 w-6 text-[var(--color-primary)]" />
            </div>
          </div>
        </Card>

        <Card className="reveal-on-scroll border-l-4 border-l-[var(--color-secondary)]/80 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-dark)]/70">My Enrollments</p>
              <p className="text-3xl font-bold text-[var(--color-text-dark)] mt-1">{stats.totalEnrollments}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-[var(--color-secondary-soft)] flex items-center justify-center">
              <FiFileText className="h-6 w-6 text-[var(--color-secondary)]" />
            </div>
          </div>
        </Card>

        <Card className="reveal-on-scroll border-l-4 border-l-[var(--color-primary)]/80 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-dark)]/70">Pending Reminders</p>
              <p className="text-3xl font-bold text-[var(--color-text-dark)] mt-1">{stats.pendingReminders}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-[rgba(106,193,67,0.15)] flex items-center justify-center">
              <FiClock className="h-6 w-6 text-[var(--color-primary)]" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="reveal-on-scroll hover:shadow-md transition-shadow duration-200">
          <h2 className="text-lg font-semibold text-[var(--color-text-dark)] mb-3">Quick Actions</h2>
          <div className="space-y-2">
            <Link to="/documents/upload" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white text-sm font-semibold shadow-sm hover:brightness-95 transition-all duration-200">
              <FiUpload className="h-4 w-4" /> Upload New Document
            </Link>
            <Link to="/documents" className="block px-3 py-2 rounded-lg border border-[var(--color-border-soft)] hover:border-[var(--color-secondary)] hover:bg-[var(--color-secondary-soft)] text-sm text-[var(--color-text-dark)] transition-colors">
              Open Document History
            </Link>
            <Link to="/enrollments" className="block px-3 py-2 rounded-lg border border-[var(--color-border-soft)] hover:border-[var(--color-secondary)] hover:bg-[var(--color-secondary-soft)] text-sm text-[var(--color-text-dark)] transition-colors">
              Track Enrollment Progress
            </Link>
            <Link to="/providers" className="block px-3 py-2 rounded-lg border border-[var(--color-border-soft)] hover:border-[var(--color-secondary)] hover:bg-[var(--color-secondary-soft)] text-sm text-[var(--color-text-dark)] transition-colors">
              View Providers ({stats.totalProviders})
            </Link>
            <Link to="/reminders" className="block px-3 py-2 rounded-lg border border-[var(--color-border-soft)] hover:border-[var(--color-secondary)] hover:bg-[var(--color-secondary-soft)] text-sm text-[var(--color-text-dark)] transition-colors">
              Review Reminders ({stats.pendingReminders})
            </Link>
          </div>
        </Card>

        <Card className="reveal-on-scroll hover:shadow-md transition-shadow duration-200">
          <h2 className="text-lg font-semibold text-[var(--color-text-dark)] mb-3">Performance</h2>
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--color-border-soft)] bg-gradient-to-r from-[var(--color-secondary-soft)] to-[var(--color-light-section)] p-3">
              <p className="text-sm text-[var(--color-text-dark)]/70">Approval Progress (Approved vs Rejected)</p>
              <p className="text-2xl font-bold text-[var(--color-text-dark)]">{reviewProgressRate}%</p>
            </div>
            <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-light-section)] p-3 hover:bg-[var(--color-secondary-soft)] transition-colors">
              <p className="text-sm text-[var(--color-text-dark)]/70">Enrollments In Review</p>
              <p className="text-2xl font-bold text-[var(--color-text-dark)]">{stats.inReviewEnrollments}</p>
            </div>
            <div className="rounded-xl border border-[rgba(106,193,67,0.25)] bg-[rgba(106,193,67,0.12)] p-3">
              <p className="text-sm text-[var(--color-primary)]">Approved Documents</p>
              <p className="text-2xl font-bold text-[var(--color-text-dark)]">{stats.approvedDocuments}</p>
            </div>
            <div className="rounded-xl border border-[rgba(74,144,217,0.28)] bg-[rgba(74,144,217,0.12)] p-3">
              <p className="text-sm text-[var(--color-secondary)]">Rejected Documents</p>
              <p className="text-2xl font-bold text-[var(--color-text-dark)]">{stats.rejectedDocuments}</p>
            </div>
          </div>
        </Card>

        <Card className="reveal-on-scroll hover:shadow-md transition-shadow duration-200">
          <h2 className="text-lg font-semibold text-[var(--color-text-dark)] mb-3">Reminder Snapshot</h2>
          <div className="space-y-2">
            {pendingReminders.length === 0 ? (
              <p className="text-sm text-[var(--color-text-dark)]/65">No pending reminders. Great job.</p>
            ) : (
              pendingReminders.slice(0, 4).map((item) => (
                <div key={item._id} className="rounded-xl border border-[var(--color-border-soft)] p-3 hover:border-[var(--color-secondary)] hover:bg-[var(--color-secondary-soft)] transition-colors">
                  <p className="text-sm font-medium text-[var(--color-text-dark)]">{item.title}</p>
                  <p className="text-xs text-[var(--color-text-dark)]/75 mt-1">
                    Due: {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'Not set'}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="reveal-on-scroll overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-[var(--color-text-dark)]">Recent Uploads</h2>
          <Link to="/documents" className="text-sm font-semibold text-[var(--color-secondary)] hover:text-[var(--color-primary)]">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--color-light-section)]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-dark)]/85">Document</th>
                <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-dark)]/85">Provider</th>
                <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-dark)]/85">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-dark)]/85">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {recentDocuments.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-[var(--color-text-dark)]/65" colSpan={4}>No uploads yet.</td>
                </tr>
              ) : (
                recentDocuments.map((doc) => {
                  const providerName = typeof doc.providerId === 'object'
                    ? `${doc.providerId?.firstName || ''} ${doc.providerId?.lastName || ''}`.trim() || 'N/A'
                    : 'N/A';

                  return (
                    <tr key={doc._id} className="border-t border-[var(--color-border-soft)] hover:bg-[var(--color-light-section)] transition-colors">
                      <td className="px-3 py-3 text-[var(--color-text-dark)]">{doc.documentType}</td>
                      <td className="px-3 py-3 text-[var(--color-text-dark)]/80">{providerName}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(doc.status)}`}>
                          {formatStatus(doc.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[var(--color-text-dark)]/80">{new Date(doc.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="reveal-on-scroll rounded-xl border border-[rgba(106,193,67,0.3)] bg-gradient-to-r from-[rgba(106,193,67,0.14)] to-[rgba(74,144,217,0.12)] px-4 py-3 flex items-center gap-2">
        <FiCheckCircle className="h-5 w-5 text-[var(--color-primary)]" />
        <p className="text-sm text-[var(--color-text-dark)]">
          Tip: Keep your profile active by uploading documents promptly and closing pending reminders.
        </p>
      </div>
    </div>
  );
}

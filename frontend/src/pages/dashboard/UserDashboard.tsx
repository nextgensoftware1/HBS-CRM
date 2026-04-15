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
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-6">
        <h1 className="text-2xl font-bold text-slate-900">Workspace Dashboard</h1>
        <p className="text-slate-600 mt-1">
          Welcome {user?.fullName}. This workspace shows your documents, enrollments, reminders, and progress.
        </p>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">My Documents</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalDocuments}</p>
            </div>
            <FiFile className="h-7 w-7 text-blue-600" />
          </div>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Docs</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.pendingDocuments}</p>
            </div>
            <FiClock className="h-7 w-7 text-amber-600" />
          </div>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">My Enrollments</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalEnrollments}</p>
            </div>
            <FiFileText className="h-7 w-7 text-emerald-600" />
          </div>
        </Card>

        <Card className="border-l-4 border-l-violet-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Reminders</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.pendingReminders}</p>
            </div>
            <FiClock className="h-7 w-7 text-violet-600" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h2>
          <div className="space-y-2">
            <Link to="/documents/upload" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium">
              <FiUpload className="h-4 w-4" /> Upload New Document
            </Link>
            <Link to="/documents" className="block px-3 py-2 rounded-lg border border-gray-200 hover:border-primary-400 text-sm text-gray-700">
              Open Document History
            </Link>
            <Link to="/enrollments" className="block px-3 py-2 rounded-lg border border-gray-200 hover:border-primary-400 text-sm text-gray-700">
              Track Enrollment Progress
            </Link>
            <Link to="/providers" className="block px-3 py-2 rounded-lg border border-gray-200 hover:border-primary-400 text-sm text-gray-700">
              View Providers ({stats.totalProviders})
            </Link>
            <Link to="/reminders" className="block px-3 py-2 rounded-lg border border-gray-200 hover:border-primary-400 text-sm text-gray-700">
              Review Reminders ({stats.pendingReminders})
            </Link>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Performance</h2>
          <div className="space-y-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-sm text-gray-600">Approval Progress (Approved vs Rejected)</p>
              <p className="text-2xl font-bold text-gray-900">{reviewProgressRate}%</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-sm text-gray-600">Enrollments In Review</p>
              <p className="text-2xl font-bold text-gray-900">{stats.inReviewEnrollments}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-sm text-gray-600">Approved Documents</p>
              <p className="text-2xl font-bold text-gray-900">{stats.approvedDocuments}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-sm text-gray-600">Rejected Documents</p>
              <p className="text-2xl font-bold text-gray-900">{stats.rejectedDocuments}</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Reminder Snapshot</h2>
          <div className="space-y-2">
            {pendingReminders.length === 0 ? (
              <p className="text-sm text-gray-500">No pending reminders. Great job.</p>
            ) : (
              pendingReminders.slice(0, 4).map((item) => (
                <div key={item._id} className="rounded-lg border border-gray-200 p-3">
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Due: {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'Not set'}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Recent Uploads</h2>
          <Link to="/documents" className="text-sm text-primary-600">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Document</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Provider</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {recentDocuments.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-gray-500" colSpan={4}>No uploads yet.</td>
                </tr>
              ) : (
                recentDocuments.map((doc) => {
                  const providerName = typeof doc.providerId === 'object'
                    ? `${doc.providerId?.firstName || ''} ${doc.providerId?.lastName || ''}`.trim() || 'N/A'
                    : 'N/A';

                  return (
                    <tr key={doc._id} className="border-t border-gray-100">
                      <td className="px-3 py-3 text-gray-900">{doc.documentType}</td>
                      <td className="px-3 py-3 text-gray-700">{providerName}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-700">{new Date(doc.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2">
        <FiCheckCircle className="h-5 w-5 text-emerald-700" />
        <p className="text-sm text-emerald-800">
          Tip: Keep your profile active by uploading documents promptly and closing pending reminders.
        </p>
      </div>
    </div>
  );
}

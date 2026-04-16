import { useAuthStore } from '../../store/authStore';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { FiShield, FiUsers, FiSettings, FiDatabase } from 'react-icons/fi';
import { enrollmentService } from '../../services/enrollmentService';
import { documentService } from '../../services/documentService';
import { reminderService } from '../../services/reminderService';

const cards = [
  {
    title: 'User Access',
    description: 'Manage user roles and permissions across the CRM.',
    icon: FiUsers,
  },
  {
    title: 'System Settings',
    description: 'Configure application defaults, security, and workflows.',
    icon: FiSettings,
  },
  {
    title: 'Data Controls',
    description: 'Review backups, integrations, and platform-level operations.',
    icon: FiDatabase,
  },
];

export default function AdminDashboard() {
  const user = useAuthStore((state) => state.user);
  const [queueCounts, setQueueCounts] = useState({
    pendingEnrollments: 0,
    approvedEnrollments: 0,
    pendingDocuments: 0,
    approvedDocuments: 0,
    pendingReminders: 0,
    completedReminders: 0,
  });

  useEffect(() => {
    const loadQueueCounts = async () => {
      try {
        const [
          pendingEnrollments,
          approvedEnrollments,
          pendingDocuments,
          approvedDocuments,
          pendingReminders,
          completedReminders,
        ] = await Promise.all([
          enrollmentService.getEnrollments(1, 1, { status: 'in_review' }),
          enrollmentService.getEnrollments(1, 1, { status: 'approved' }),
          documentService.getDocuments(1, 1, { status: 'pending' }),
          documentService.getDocuments(1, 1, { status: 'approved' }),
          reminderService.getReminders(1, 1, { status: 'pending' }),
          reminderService.getReminders(1, 1, { status: 'completed' }),
        ]);

        setQueueCounts({
          pendingEnrollments: pendingEnrollments.pagination.total,
          approvedEnrollments: approvedEnrollments.pagination.total,
          pendingDocuments: pendingDocuments.pagination.total,
          approvedDocuments: approvedDocuments.pagination.total,
          pendingReminders: pendingReminders.pagination.total,
          completedReminders: completedReminders.pagination.total,
        });
      } catch (error) {
        console.error('Failed to load admin queue counts:', error);
      }
    };

    loadQueueCounts();
  }, []);

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-md bg-[var(--color-secondary-soft)]">
            <FiShield className="h-6 w-6 text-[var(--color-secondary)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text-dark)]">Admin Console</h1>
        </div>
        <p className="text-sm text-[var(--color-text-light)]">
          Welcome {user?.fullName}. This area is restricted to administrator accounts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-background)] p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-md bg-[var(--color-light-section)]">
                <card.icon className="h-5 w-5 text-[var(--color-secondary)]" />
              </div>
              <h2 className="text-lg font-semibold text-[var(--color-text-dark)]">{card.title}</h2>
            </div>
            <p className="text-sm text-[var(--color-text-light)] mt-1">{card.description}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold text-[var(--color-text-dark)] mb-3">Operational Queues</h2>
        <p className="text-sm text-[var(--color-text-light)] mb-4">
          Quickly review pending and approved work across enrollments, documents, and reminders.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link to="/enrollments?status=in_review" className="rounded-lg border border-[var(--color-border-soft)] px-4 py-3 hover:border-[var(--color-secondary)] hover:bg-[var(--color-secondary-soft)] transition-colors">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--color-text-dark)]">Pending Enrollments</p>
              <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                {queueCounts.pendingEnrollments}
              </span>
            </div>
              <p className="text-xs text-[var(--color-text-light)] mt-1">Review enrollments in progress</p>
          </Link>

          <Link to="/enrollments?status=approved" className="rounded-lg border border-[var(--color-border-soft)] px-4 py-3 hover:border-[var(--color-secondary)] hover:bg-[var(--color-secondary-soft)] transition-colors">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--color-text-dark)]">Approved Enrollments</p>
              <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                {queueCounts.approvedEnrollments}
              </span>
            </div>
              <p className="text-xs text-[var(--color-text-light)] mt-1">View successfully approved enrollments</p>
          </Link>

          <Link to="/documents?status=pending" className="rounded-lg border border-[var(--color-border-soft)] px-4 py-3 hover:border-[var(--color-secondary)] hover:bg-[var(--color-secondary-soft)] transition-colors">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--color-text-dark)]">Pending Documents</p>
              <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                {queueCounts.pendingDocuments}
              </span>
            </div>
              <p className="text-xs text-[var(--color-text-light)] mt-1">Check documents waiting for review</p>
          </Link>

          <Link to="/documents?status=approved" className="rounded-lg border border-[var(--color-border-soft)] px-4 py-3 hover:border-[var(--color-secondary)] hover:bg-[var(--color-secondary-soft)] transition-colors">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--color-text-dark)]">Approved Documents</p>
              <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                {queueCounts.approvedDocuments}
              </span>
            </div>
              <p className="text-xs text-[var(--color-text-light)] mt-1">Track already approved documents</p>
          </Link>

          <Link to="/reminders?status=pending" className="rounded-lg border border-[var(--color-border-soft)] px-4 py-3 hover:border-[var(--color-secondary)] hover:bg-[var(--color-secondary-soft)] transition-colors">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--color-text-dark)]">Pending Reminders</p>
              <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                {queueCounts.pendingReminders}
              </span>
            </div>
              <p className="text-xs text-[var(--color-text-light)] mt-1">Follow up on open reminders</p>
          </Link>

          <Link to="/reminders?status=completed" className="rounded-lg border border-[var(--color-border-soft)] px-4 py-3 hover:border-[var(--color-secondary)] hover:bg-[var(--color-secondary-soft)] transition-colors">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--color-text-dark)]">Completed Reminders</p>
              <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                {queueCounts.completedReminders}
              </span>
            </div>
              <p className="text-xs text-[var(--color-text-light)] mt-1">Audit finished reminder actions</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

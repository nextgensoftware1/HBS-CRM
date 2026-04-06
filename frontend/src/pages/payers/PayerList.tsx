import { useEffect, useState } from 'react';
import api from '../../services/api';

type Payer = {
  _id: string;
  payerName: string;
  payerType: string;
  processingTimeDays: number;
  isActive: boolean;
};

export default function PayerList() {
  const [payers, setPayers] = useState<Payer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPayers = async () => {
      try {
        const response = await api.get('/payers', { params: { page: 1, limit: 50 } });
        setPayers(response.data?.data?.payers || []);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load payers');
      } finally {
        setLoading(false);
      }
    };

    loadPayers();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payers</h1>
        <p className="text-gray-600">Manage payer setup and processing rules.</p>
      </div>

      {loading && <p className="text-sm text-gray-600">Loading payers...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Payer Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Processing Days</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {payers.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={4}>No payers found.</td>
                </tr>
              ) : (
                payers.map((payer) => (
                  <tr key={payer._id} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-gray-900">{payer.payerName}</td>
                    <td className="px-4 py-3 text-gray-700">{payer.payerType}</td>
                    <td className="px-4 py-3 text-gray-700">{payer.processingTimeDays}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${payer.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {payer.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

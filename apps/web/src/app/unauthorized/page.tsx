import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function Unauthorized() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <ShieldAlert className="w-20 h-20 text-red-600 mx-auto mb-6" />
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Access Denied</h1>
        <p className="text-lg text-gray-600 mb-8">
          You don&apos;t have permission to access this page. Please contact your administrator if you believe this is an error.
        </p>
        <div className="space-y-3">
          <Link
            href="/"
            className="block w-full bg-slate-900 text-white py-2.5 rounded hover:bg-slate-800 transition font-medium text-sm"
          >
            Back to Staff Access Portal
          </Link>
          <Link
            href="/"
            className="block w-full border-2 border-gray-300 text-gray-700 py-3 rounded-lg hover:border-teal-600 hover:text-teal-600 transition font-semibold"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

import { Suspense } from 'react';
import ReportForm from './ReportForm';

export default function ReportRequestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center">
        <div className="h-4 w-4 rounded-full border-2 border-[#8B5E3C] border-t-transparent animate-spin" />
      </div>
    }>
      <ReportForm />
    </Suspense>
  );
}

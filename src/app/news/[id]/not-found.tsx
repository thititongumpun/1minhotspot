import Link from 'next/link';
import { ArrowLeft, FileX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
      <div className="text-center px-4">
        <div className="mb-8">
          <FileX className="w-24 h-24 text-slate-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-slate-900 mb-2">ไม่พบข่าว</h1>
          <p className="text-slate-600 text-lg">
            ข่าวที่คุณกำลังมองหาอาจถูกลบหรือย้ายแล้ว
          </p>
        </div>
        
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          กลับหน้าหลัก
        </Link>
      </div>
    </div>
  );
}
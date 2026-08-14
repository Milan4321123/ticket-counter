import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminRequest } from '@/lib/auth';
import CheckinClient from './CheckinClient';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Door check-in — Admin' };

export default async function AdminCheckinPage() {
  if (!(await isAdminRequest())) redirect('/admin/login');

  return (
    <div className="container container-narrow section">
      <div
        className="anim-fade-up"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <h1 className="page-title" style={{ margin: 0 }}>
          Door check-in
        </h1>
        <Link href="/admin" className="btn btn-sm">
          ← Dashboard
        </Link>
      </div>
      <div className="anim-fade-up anim-d1">
        <CheckinClient />
      </div>
    </div>
  );
}

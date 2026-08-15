import { redirect } from 'next/navigation';
import { adminEnabled, isAdminRequest } from '@/lib/auth';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Admin sign in', robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (await isAdminRequest()) redirect('/admin');
  const enabled = adminEnabled();

  return (
    <div className="container container-narrow section">
      <div className="anim-fade-up" style={{ maxWidth: 460, margin: '0 auto' }}>
        <h1 className="page-title" style={{ textAlign: 'center' }}>
          Admin sign in
        </h1>
        {enabled ? (
          <div className="card glow-card">
            <LoginForm />
          </div>
        ) : (
          <div className="card">
            <div className="notice notice-warn">The admin area is currently disabled.</div>
            <p className="muted">
              To enable it, add these to your <span className="mono">.env</span> file and restart the server:
            </p>
            <p className="mono small">
              ADMIN_PASSWORD=pick-a-strong-password
              <br />
              APP_SECRET=a-long-random-string
            </p>
            <p className="muted small">
              Both are required in production: the password lets you in, and <span className="mono">APP_SECRET</span>{' '}
              signs your session so it can&rsquo;t be forged. Generate one with{' '}
              <span className="mono">openssl rand -hex 32</span>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

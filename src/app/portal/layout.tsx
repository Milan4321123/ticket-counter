import type { ReactNode } from 'react';
import './hub.css';

/**
 * The seller hub's frame. No sidebar and no tab bar: the home screen is the
 * hub (its cards lead everywhere), each listing's tool board leads to its
 * tools, and every page has one slim line back up (see ./PortalNav) —
 * Home ← All tools ← a tool. Sign-in, password reset and the forced
 * password change render bare, as before.
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="hub hub-flat">
      <div className="hub-main">{children}</div>
    </div>
  );
}

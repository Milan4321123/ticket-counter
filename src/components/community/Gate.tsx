// The door to every members-only page. Server component: given who is
// looking (lib/community communityState), it shows the right next step —
// sign in, join, or a plain note that their access was removed — with a
// short line about what is behind the door.
import Link from 'next/link';
import { COMMUNITY_MIN_AGE, COMMUNITY_RULES, type CommunityState } from '@/lib/community';
import JoinForm from './JoinForm';

interface Props {
  state: Exclude<CommunityState, { kind: 'member' }>;
  /** Where to come back to after signing in. */
  back: string;
  kicker: string;
  title: string;
  intro: React.ReactNode;
}

export default function Gate({ state, back, kicker, title, intro }: Props) {
  return (
    <div className="container section cm-gate">
      <div className="acc-card anim-fade-up">
        <p className="feed-kicker">{kicker}</p>
        <h1 className="page-title">{title}</h1>
        <div className="muted cm-gate-intro">{intro}</div>
        {state.kind === 'signed-out' && (
          <>
            <p className="cm-gate-why">
              Only signed-in members see what people post here — no strangers, no search engines. Signing in takes a
              code sent to your email, no password.
            </p>
            <p>
              <Link href={`/account?back=${encodeURIComponent(back)}`} className="btn btn-brand">
                Sign in to join
              </Link>
            </p>
          </>
        )}
        {state.kind === 'not-joined' && (
          <JoinForm draft={state.draft} rules={COMMUNITY_RULES} minAge={COMMUNITY_MIN_AGE} rejoin={Boolean(state.draft.name && state.draft.city)} />
        )}
        {state.kind === 'banned' && (
          <p className="notice notice-error">
            Your community access was removed because of reports about your posts. Your customer account, orders and
            tickets are not affected. If you think this is a mistake, <Link href="/contact">write to us</Link>.
          </p>
        )}
      </div>
    </div>
  );
}

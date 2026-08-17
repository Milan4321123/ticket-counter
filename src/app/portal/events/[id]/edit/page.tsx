import { redirect } from 'next/navigation';
import { aiAssistantEnabled, aiDesignerEnabled } from '@/lib/ai';
import {
  countPaidOrdersForEvent,
  getEventById,
  getEventFaqs,
  getEventMedia,
  getEventTiers,
  getEventVideos,
  cropTag,
  listEventPosts,
  listEventQuestions,
  mediaUrl,
  parseCropRect,
  parsePageDesign,
  quoteEventFee,
} from '@/lib/events';
import { MAX_PHOTOS_PER_EVENT, MAX_VIDEOS_PER_EVENT } from '@/lib/media';
import { formatMoney } from '@/lib/money';
import { getStats } from '@/lib/orders';
import { organizerPlanActive } from '@/lib/organizers';
import { eventFeeBasis, eventFeeReference, platformBank } from '@/lib/platform';
import PlanExpired from '../../../PlanExpired';
import PortalNav from '../../../PortalNav';
import { requirePortalOrganizer } from '../../../guard';
import AssistantPanel from './AssistantPanel';
import { organizerTotpEnabled } from '@/lib/organizerTotp';
import { effectivePayout, queuedPayoutChange } from '@/lib/payout';
import BankForm from './BankForm';
import DangerZone from './DangerZone';
import DesignPanel from './DesignPanel';
import EditorSection, { EditorSectionGroup } from './EditorSection';
import GoToTab from './GoToTab';
import EditorTabs from './EditorTabs';
import DetailsForm from './DetailsForm';
import { FAQ_SUGGESTIONS_EVENT } from './faqBridge';
import MediaPanel from './MediaPanel';
import PageContentPanel from './PageContentPanel';
import PublishPanel from './PublishPanel';
import QuestionsPanel from './QuestionsPanel';
import TiersEditor from './TiersEditor';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit event — Organizer portal', robots: { index: false, follow: false } };

/** Section heading inside a tab: title + one plain-language helper line. */
function SectionHead({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="card-step-head">
      <div>
        <div className="card-title">{title}</div>
        <p className="card-hint">{hint}</p>
      </div>
    </div>
  );
}

/**
 * Which collapsible section a tab opens on: the first one still needing work,
 * or nothing at all once the tab is finished. Never all of them — a wall of
 * open forms is exactly what organizers asked us to get rid of.
 */
function firstTodo(sections: { id: string; done: boolean }[]): string | null {
  return sections.find((s) => !s.done)?.id ?? null;
}

export default async function EventEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organizer = await requirePortalOrganizer();
  if (!organizerPlanActive(organizer)) return <PlanExpired organizer={organizer} />;

  const event = getEventById(id);
  if (!event || event.organizerId !== organizer.id) redirect('/portal');

  const tiers = getEventTiers(event.id);
  const media = getEventMedia(event.id);
  const videos = getEventVideos(event.id);
  // Everything an update post can be attached to, labelled for the composer.
  const attachables = [
    ...media.map((m, i) => ({ id: m.id, url: mediaUrl(m.id), label: `Photo ${i + 1}`, kind: 'photo' as const })),
    ...videos.map((v, i) => ({ id: v.id, url: mediaUrl(v.id), label: `Video ${i + 1}`, kind: 'video' as const })),
  ];
  const faqs = getEventFaqs(event.id);
  const posts = listEventPosts(event.id);
  // Real questions from real buyers, waiting on the organizer — not the FAQ
  // they write in advance, which is PageContentPanel's job.
  const openQuestions = listEventQuestions(event.id, 'open');
  const answeredQuestionCount = listEventQuestions(event.id, 'answered').length;
  const design = parsePageDesign(event.pageDesign);
  const stats = getStats(event.id);
  // Buyers already holding a paid ticket — the number the Danger Zone puts in
  // red before it will let this event be deleted.
  const paidOrders = countPaidOrdersForEvent(event.id);
  const soldByTierKey: Record<string, number> = {};
  for (const t of stats.perTier) soldByTierKey[t.tierId] = t.sold;

  const checklist = [
    { ok: Boolean(event.dateDisplay.trim() || event.eventDate), label: 'Add a date' },
    { ok: Boolean(event.venueName.trim() && event.address.trim()), label: 'Add the venue name and address' },
    { ok: tiers.length > 0, label: 'Add at least one ticket type' },
    {
      // EITHER route counts. Demanding an IBAN from an organizer who collects
      // by PayPal blocks a perfectly sellable event, and it was doing exactly
      // that. What publishing actually needs is one working way to be paid.
      ok: Boolean(
        (event.bankIban.trim() && event.bankAccountHolder.trim()) || event.paypalAccount.trim()
      ),
      label: 'Add a way to be paid — bank account (holder and IBAN) or PayPal',
    },
    { ok: Boolean(event.description.trim()), label: 'Write a short description' },
    {
      ok: organizerTotpEnabled(organizer.id),
      label: 'Set up your authenticator app (Settings) — required before you can sell tickets',
    },
  ];

  // The platform fee is charged per event and follows the capacity, so the
  // amount is quoted (and locked) here — this page is where the organizer is
  // asked to pay. Publishing stays locked until the owner confirms the transfer.
  const platformFeeBank = platformBank();
  const feeCents = quoteEventFee(event);
  const fee = {
    paid: event.feeStatus === 'paid',
    amount: formatMoney(feeCents, 'EUR'),
    amountPlain: (feeCents / 100).toFixed(2),
    basis: eventFeeBasis(event.totalCapacity),
    reference: eventFeeReference(event.id),
    bank: platformFeeBank
      ? {
          accountHolder: platformFeeBank.accountHolder,
          iban: platformFeeBank.iban,
          bic: platformFeeBank.bic,
          bankName: platformFeeBank.bankName,
        }
      : null,
  };

  // Tab and section completion: what still needs doing, at a glance.
  const detailsDone = Boolean(
    event.name.trim() &&
      (event.dateDisplay.trim() || event.eventDate) &&
      event.venueName.trim() &&
      event.address.trim() &&
      event.description.trim()
  );
  // What buyers are being given today, and any change still inside its waiting
  // period. The form shows the former and warns about the latter — showing the
  // queued values as if they were live would hide the very thing the delay
  // exists to make visible.
  const effective = effectivePayout(event);
  const queued = queuedPayoutChange(event);
  const bankDone = Boolean(effective.iban.trim() && effective.holder.trim());
  const basicsDone = detailsDone && bankDone;
  const ticketsDone = tiers.length > 0;
  // Any visual at all counts — a video-only event still has something to show.
  const photosDone = media.length > 0 || videos.length > 0;
  const publishDone = event.status === 'published';
  const stepsDone = [basicsDone, ticketsDone, photosDone, publishDone].filter(Boolean).length;

  const tabs = [
    { key: 'basics', label: 'Basics', status: basicsDone ? ('done' as const) : ('todo' as const) },
    { key: 'tickets', label: 'Tickets', status: ticketsDone ? ('done' as const) : ('todo' as const) },
    { key: 'media', label: 'Photos & videos', status: photosDone ? ('done' as const) : ('todo' as const) },
    // One tab per job, rather than four unrelated jobs stacked inside a single
    // "Page & content" page. Posting an update is a weekly errand; writing the
    // FAQ is a once-off; answering a visitor is somebody waiting on a reply.
    // Behind one heading, the two that matter were the two you had to scroll
    // past a form to reach.
    { key: 'design', label: 'Design', status: 'neutral' as const },
    { key: 'updates', label: 'Updates', status: 'neutral' as const },
    { key: 'faq', label: 'FAQ', status: 'neutral' as const, revealOn: FAQ_SUGGESTIONS_EVENT },
    {
      key: 'questions',
      label: 'Questions',
      status: 'neutral' as const,
      // Green, and on the tab itself: this is the only thing in the editor with
      // a person on the other end of it, and it should be readable from the
      // strip without opening anything.
      badge: openQuestions.length > 0 ? `${openQuestions.length} new` : undefined,
    },
    { key: 'publish', label: 'Publish', status: publishDone ? ('done' as const) : ('todo' as const) },
  ];

  const panels = {
    basics: (
      <EditorSectionGroup
        initialOpen={firstTodo([
          { id: 'details', done: detailsDone },
          { id: 'bank', done: bankDone },
        ])}
      >
        <EditorSection
          id="details"
          title="Event details"
          hint="The basics buyers see first — name, date, venue, and capacity."
          status={detailsDone ? 'done' : 'todo'}
        >
          <DetailsForm
            eventId={event.id}
            isDraft={event.status === 'draft'}
            initial={{
              name: event.name,
              artist: event.artist,
              description: event.description,
              dateDisplay: event.dateDisplay,
              eventDate: event.eventDate ?? '',
              venueName: event.venueName,
              address: event.address,
              city: event.city,
              currency: event.currency,
              totalCapacity: event.totalCapacity,
              showRemaining: event.showRemaining,
              maxPerOrder: event.maxPerOrder,
              payWithinDays: event.payWithinDays,
              salesOpen: event.salesOpen,
              closedMessage: event.closedMessage,
              whatsapp: event.whatsapp,
              whatsappName: event.whatsappName,
              // The bubble wears the event's own profile photo rather than a
              // second upload of the same face — one picture, already cropped
              // to a circle, already inside the media quota.
              profilePhotoUrl: event.profileMediaId
                ? mediaUrl(event.profileMediaId, 'avatar', cropTag(parseCropRect(event.profileCrop)))
                : '',
              accountName: organizer.name?.trim() || 'you',
            }}
          />
        </EditorSection>

        <EditorSection
          id="bank"
          title="How you get paid"
          hint="Ticket money goes straight to you — double-check the IBAN. Add PayPal too if you want to offer it."
          status={bankDone ? 'done' : 'todo'}
        >
          <BankForm
            eventId={event.id}
            initial={{
              bankAccountHolder: effective.holder,
              bankIban: effective.iban,
              bankBic: effective.bic,
              bankName: effective.bankName,
              paypalAccount: effective.paypal,
            }}
            queued={
              queued && {
                holder: queued.holder,
                iban: queued.iban,
                paypal: queued.paypal,
                effectiveAt: queued.effectiveAt,
              }
            }
          />
        </EditorSection>
      </EditorSectionGroup>
    ),
    tickets: (
      <div className="card">
        <SectionHead title="Tickets" hint="Your ticket types and prices — you need at least one to publish." />
        {/* Two switches produce the same words on the page — this one per ticket
            type, and the event-wide pause in Basics — and an organizer who
            unticks "Coming soon" here while the event-wide one is on sees
            nothing change and no reason why. Said plainly, where they are
            looking, with the way out attached. */}
        {!event.salesOpen && (
          <div className="notice notice-warn" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ flex: 1, minWidth: 260 }}>
              Ticket sales are switched <strong>off</strong> for this whole event, so your page shows{' '}
              <strong>
                {event.closedMessage === 'coming-soon' ? '“Tickets coming soon”' : '“Sales closed”'}
              </strong>{' '}
              and nothing here can be bought — whatever you set per ticket type below.
            </span>
            <GoToTab tab="basics">Switch sales on in Basics →</GoToTab>
          </div>
        )}
        <TiersEditor
            eventId={event.id}
            initialTiers={tiers.map((t) => ({
              tierKey: t.tierKey,
              name: t.name,
              priceCents: t.priceCents,
              cap: t.cap,
              unlimited: t.unlimited,
              comingSoon: t.comingSoon,
              studentOnly: t.studentOnly,
              description: t.description,
            }))}
          soldByTierKey={soldByTierKey}
        />
      </div>
    ),
    media: (
      <div className="card">
        <SectionHead
          title="Photos & videos"
          hint="A good cover sells tickets — add photos and short videos, then pick the one people see first."
        />
        <MediaPanel
            eventId={event.id}
            media={media.map((m) => ({ id: m.id, url: mediaUrl(m.id) }))}
            videos={videos.map((v) => ({ id: v.id, url: mediaUrl(v.id) }))}
            posterMediaId={event.posterMediaId}
            profileMediaId={event.profileMediaId}
            coverMediaId={event.coverMediaId}
            crops={{
              cover: parseCropRect(event.coverCrop),
              profile: parseCropRect(event.profileCrop),
              poster: parseCropRect(event.posterCrop),
            }}
            videoUrl={event.videoUrl}
          maxPhotos={MAX_PHOTOS_PER_EVENT}
          maxVideos={MAX_VIDEOS_PER_EVENT}
        />
      </div>
    ),
    design: (
      <EditorSectionGroup initialOpen="design">
        <EditorSection
          id="design"
          title="Page design"
          hint="Pick colors and words that match the mood of the night."
          status="optional"
        >
          <DesignPanel eventId={event.id} aiEnabled={aiDesignerEnabled()} initial={design} />
        </EditorSection>

        {/* Kept beside the design rather than beside the FAQ, even though its
            suggestions land there: both of these are things you set up once so
            the page can look after itself. The FAQ tab opens on its own when
            suggestions arrive, so the hand-off still works across tabs. */}
        <EditorSection
          id="assistant"
          title="What the assistant should know"
          hint="Tell the AI on your page the things buyers ask about — parking, food, age limits, doors."
          status="optional"
        >
          <AssistantPanel eventId={event.id} aiEnabled={aiAssistantEnabled()} initial={event.assistantContext} />
        </EditorSection>
      </EditorSectionGroup>
    ),
    updates: (
      <div className="card">
        <SectionHead
          title="Updates"
          hint="Post news the way you would on a social page — it appears in the Updates feed on your event page."
        />
        <PageContentPanel
          show="updates"
          eventId={event.id}
          media={attachables}
          posts={posts.map((p) => ({ id: p.id, body: p.body, mediaId: p.mediaId, createdAt: p.createdAt }))}
          faqs={faqs.map((f) => ({ question: f.question, answer: f.answer }))}
          maxPhotos={MAX_PHOTOS_PER_EVENT}
          maxVideos={MAX_VIDEOS_PER_EVENT}
        />
      </div>
    ),
    faq: (
      <div className="card">
        <SectionHead
          title="FAQ"
          hint="Answer the questions buyers keep asking, so they do not have to ask you at all."
        />
        <PageContentPanel
          show="faq"
          eventId={event.id}
          media={attachables}
          posts={posts.map((p) => ({ id: p.id, body: p.body, mediaId: p.mediaId, createdAt: p.createdAt }))}
          faqs={faqs.map((f) => ({ question: f.question, answer: f.answer }))}
          maxPhotos={MAX_PHOTOS_PER_EVENT}
          maxVideos={MAX_VIDEOS_PER_EVENT}
        />
      </div>
    ),
    // Its own tab, because it is the one place in the editor where somebody is
    // waiting. The FAQ above is what the organizer writes in advance; this is
    // what buyers actually asked and nobody has answered yet. A reply here
    // publishes to the event page and teaches the assistant.
    questions: (
      <div className="card">
        <SectionHead
          title="Visitor questions"
          hint="Questions buyers asked on your page that the assistant could not answer — your reply goes live and teaches it."
        />
        <QuestionsPanel
          eventId={event.id}
          questions={openQuestions.map((q) => ({
            id: q.id,
            question: q.question,
            askedAt: q.askedAt,
            askerName: q.askerName,
            askerEmail: q.askerEmail,
          }))}
          answeredCount={answeredQuestionCount}
        />
      </div>
    ),
    publish: (
      <EditorSectionGroup initialOpen={firstTodo([{ id: 'publish', done: publishDone }])}>
        <EditorSection
          id="publish"
          className="glow-card"
          title={event.status === 'published' ? 'Your event is live' : 'Publish'}
          hint={
            event.status === 'published'
              ? 'Buyers can find your page and reserve tickets.'
              : fee.paid
                ? 'One last look — the button unlocks when everything below is done.'
                : `One last look — and the ${fee.amount} fee for this event.`
          }
          status={publishDone ? 'done' : 'todo'}
        >
          <PublishPanel
            eventId={event.id}
            status={event.status}
            slug={event.slug}
            checklist={checklist}
            fee={fee}
          />
        </EditorSection>

        {/* Archived events are the platform's to remove, not the organizer's. */}
        {event.status !== 'archived' && (
          <EditorSection
            id="delete"
            className="editor-section-danger"
            title="Delete this event"
            hint="Takes the event and everything on it off the platform, permanently."
          >
            <DangerZone
              eventId={event.id}
              eventName={event.name}
              paidOrders={paidOrders}
              counts={{
                photos: media.length,
                videos: videos.length,
                posts: posts.length,
                faqs: faqs.length,
                ticketsSold: stats.ticketsSold,
              }}
            />
          </EditorSection>
        )}
      </EditorSectionGroup>
    ),
  };

  return (
    <>
      <PortalNav
        event={{ id: event.id, name: event.name, slug: event.slug, published: event.status === 'published' }}
        tab="edit"
      />
      <div className="container section">
        <div
          className="anim-fade-up editor-summary"
          style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}
        >
          <h1 className="page-title" style={{ margin: 0 }}>
            {event.name}
          </h1>
          <span
            className={`badge ${event.status === 'published' ? 'badge-green' : event.status === 'draft' ? 'badge-amber' : 'badge-red'}`}
          >
            {event.status === 'published' ? 'Live' : event.status === 'draft' ? 'Draft' : 'Archived'}
          </span>
          {/* "Live" alone was a half-truth on a published event whose sales are
              switched off: the page is up, but nobody can buy. Shown beside it,
              from every tab, in the words the page itself is using. */}
          {!event.salesOpen && event.status === 'published' && (
            <span className={`badge ${event.closedMessage === 'coming-soon' ? 'badge-green' : 'badge-amber'}`}>
              {event.closedMessage === 'coming-soon' ? 'Tickets coming soon' : 'Sales closed'}
            </span>
          )}
          <span className="badge badge-accent">{stepsDone} of 4 steps done</span>
          <span style={{ flex: 1 }} />
          {event.status === 'published' && (
            <a href={`/e/${event.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
              View page ↗
            </a>
          )}
        </div>

        <EditorTabs tabs={tabs} panels={panels} />
      </div>
    </>
  );
}

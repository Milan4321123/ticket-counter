import { redirect } from 'next/navigation';
import { aiAssistantEnabled, aiDesignerEnabled } from '@/lib/ai';
import {
  countPaidOrdersForEvent,
  getEventById,
  getEventFaqs,
  getEventMedia,
  getEventTiers,
  getEventVideos,
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
import BankForm from './BankForm';
import DangerZone from './DangerZone';
import DesignPanel from './DesignPanel';
import EditorSection, { EditorSectionGroup } from './EditorSection';
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
      ok: Boolean(event.bankIban.trim() && event.bankAccountHolder.trim()),
      label: 'Add your bank account (holder and IBAN)',
    },
    { ok: Boolean(event.description.trim()), label: 'Write a short description' },
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
  const bankDone = Boolean(event.bankIban.trim() && event.bankAccountHolder.trim());
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
    // Otherwise this tab is pure polish and never nags — but a buyer waiting
    // for an answer is a real job, and the dot is the only way to see it from
    // the tab strip.
    {
      key: 'page',
      label: 'Page & content',
      status: openQuestions.length > 0 ? ('todo' as const) : ('neutral' as const),
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
              capacityUnlimited: event.capacityUnlimited,
              showRemaining: event.showRemaining,
              maxPerOrder: event.maxPerOrder,
              payWithinDays: event.payWithinDays,
              salesOpen: event.salesOpen,
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
              bankAccountHolder: event.bankAccountHolder,
              bankIban: event.bankIban,
              bankBic: event.bankBic,
              bankName: event.bankName,
              paypalAccount: event.paypalAccount,
            }}
          />
        </EditorSection>
      </EditorSectionGroup>
    ),
    tickets: (
      <div className="card">
        <SectionHead title="Tickets" hint="Your ticket types and prices — you need at least one to publish." />
        <TiersEditor
            eventId={event.id}
            initialTiers={tiers.map((t) => ({
              tierKey: t.tierKey,
              name: t.name,
              priceCents: t.priceCents,
              cap: t.cap,
              unlimited: t.unlimited,
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
    // Everything here is polish on top of a working event, so nothing is
    // marked as needing work and the tab opens fully collapsed — unless
    // visitors are waiting on an answer, which is the one thing in this tab
    // with someone on the other end of it.
    page: (
      <EditorSectionGroup initialOpen={openQuestions.length > 0 ? 'questions' : null}>
        <EditorSection
          id="design"
          title="Page design"
          hint="Pick colors and words that match the mood of the night."
          status="optional"
        >
          <DesignPanel eventId={event.id} aiEnabled={aiDesignerEnabled()} initial={design} />
        </EditorSection>

        {/* Sits above the FAQ section on purpose: accepted suggestions drop into
            the FAQ editor just below, where the organizer saves them. That
            section is usually collapsed, so it opens itself on the same event. */}
        <EditorSection
          id="assistant"
          title="What the assistant should know"
          hint="Tell the AI on your page the things buyers ask about — parking, food, age limits, doors."
          status="optional"
        >
          <AssistantPanel eventId={event.id} aiEnabled={aiAssistantEnabled()} initial={event.assistantContext} />
        </EditorSection>

        <EditorSection
          id="content"
          title="Updates & FAQ"
          hint="Post news and answer the questions buyers keep asking."
          status="optional"
          revealOn={FAQ_SUGGESTIONS_EVENT}
        >
          <PageContentPanel
            eventId={event.id}
            media={attachables}
            posts={posts.map((p) => ({ id: p.id, body: p.body, mediaId: p.mediaId, createdAt: p.createdAt }))}
            faqs={faqs.map((f) => ({ question: f.question, answer: f.answer }))}
            maxPhotos={MAX_PHOTOS_PER_EVENT}
            maxVideos={MAX_VIDEOS_PER_EVENT}
          />
        </EditorSection>

        {/* Deliberately right below the FAQ, because the two are easy to mix
            up: the FAQ above is what the organizer writes in advance, this is
            what buyers actually asked and nobody has answered yet. Answering
            here publishes to the same Questions section of the event page. */}
        <EditorSection
          id="questions"
          title="Visitor questions"
          hint="Questions buyers asked on your page that the assistant could not answer — your reply goes live and teaches it."
          status={openQuestions.length > 0 ? 'todo' : 'optional'}
          badge={
            openQuestions.length > 0 ? (
              <span className="badge badge-amber">{openQuestions.length} open</span>
            ) : undefined
          }
        >
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
        </EditorSection>
      </EditorSectionGroup>
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

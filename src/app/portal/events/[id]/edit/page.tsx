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
  listPublishedEvents,
  listingDetailChecks,
  listingDetailsComplete,
  mediaUrl,
  parseCropRect,
  parsePageDesign,
} from '@/lib/events';
import { getOrganizer } from '@/lib/organizers';
import {
  listStallLinksForHostEvent,
  listStallLinksForShop,
  stallVisibleOnEventPage,
} from '@/lib/stalls';
import { listAnnouncementAudience } from '@/lib/marketing';
import { MAX_PHOTOS_PER_EVENT, MAX_VIDEOS_PER_EVENT } from '@/lib/media';
import { getStats } from '@/lib/orders';
import { organizerPlanActive } from '@/lib/organizers';
import PlanExpired from '../../../PlanExpired';
import PortalNav from '../../../PortalNav';
import { requirePortalOrganizer } from '../../../guard';
import AssistantPanel from './AssistantPanel';
import { organizerTotpEnabled } from '@/lib/organizerTotp';
import { effectivePayout, queuedPayoutChange } from '@/lib/payout';
import { anyPaymentRoute, listConnections, paymentOptionsFor } from '@/lib/paymentConnections';
import BankForm from './BankForm';
import KitchenSetupPanel from './KitchenSetupPanel';
import SeatingPanel from './SeatingPanel';
import { parseSeatMap, takenSeats } from '@/lib/seats';
import { choicesToText, parseChoices, parseSlotConfig } from '@/lib/kitchen';
import DangerZone from './DangerZone';
import DesignPanel from './DesignPanel';
import EditorSection, { EditorSectionGroup } from './EditorSection';
import { vocabFor } from '@/lib/vocab';
import { cityLabel, otherShowsByAct, shortDateLabel } from '@/lib/sameAct';
import GoToTab from './GoToTab';
import EditorTabs from './EditorTabs';
import DetailsForm from './DetailsForm';
import { FAQ_SUGGESTIONS_EVENT } from './faqBridge';
import MediaPanel from './MediaPanel';
import HostStallsPanel from './HostStallsPanel';
import PageContentPanel from './PageContentPanel';
import { qualitySummary, shopQualityHints } from '@/lib/listingQuality';
import PublishPanel from './PublishPanel';
import QuestionsPanel from './QuestionsPanel';
import StallRequestsPanel from './StallRequestsPanel';
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

  // The listing's own details come from lib/events, which is also what the
  // publish route enforces — the two cannot say different things. Everything
  // after them is about the account rather than the listing.
  const checklist = [
    ...listingDetailChecks(event),
    { ok: tiers.length > 0, label: `Add at least one ${vocabFor(event.kind).unitType}` },
    {
      // EITHER route counts. Demanding an IBAN from an organizer who collects
      // by PayPal blocks a perfectly sellable event, and it was doing exactly
      // that. What publishing actually needs is one working way to be paid —
      // and a fully free listing (every tier at zero) needs none at all. Same
      // rule as the publish gate in api/portal/events/[id]; they must agree.
      ok:
        tiers.every((t) => t.priceCents === 0) ||
        Boolean(
          (event.bankIban.trim() && event.bankAccountHolder.trim()) || event.paypalAccount.trim()
        ),
      label: 'Add a way to be paid — bank account (holder and IBAN) or PayPal (not needed if everything is free)',
    },
    {
      ok: organizerTotpEnabled(organizer.id),
      label: `Set up your authenticator app (Settings) — required before you can sell ${vocabFor(event.kind).units}`,
    },
  ];

  // The words this listing is described in, and what its kind asks for. Both
  // come from one place each, so the editor and the publish gate cannot drift.
  // Shops only; shopQualityHints returns [] for an event, and the panel then
  // renders nothing at all rather than an empty heading.
  const qualityHints = shopQualityHints(event, tiers, media);
  const v = vocabFor(event.kind);
  const isShop = event.kind === 'shop';

  // ---- Vendor stalls (lib/stalls) ----
  // Which side of a stall link this editor shows depends on the kind: a shop
  // asks to stand at events, an event decides on the shops that asked. Dates
  // compare as ISO yyyy-mm-dd strings, the same arithmetic lib/stalls uses.
  const stallToday = new Date().toISOString().slice(0, 10);

  const shopStallLinks = isShop ? listStallLinksForShop(event.id) : [];
  const shopStallRows = shopStallLinks.map((link) => {
    const host = getEventById(link.hostEventId);
    return {
      id: link.id,
      status: link.status,
      stallPickupInfo: link.stallPickupInfo,
      hostName: host?.name ?? 'a removed event',
      // Only link out when the public page actually answers — an unpublished
      // host 404s for everyone but its owner.
      hostSlug: host?.status === 'published' ? host.slug : '',
      hostDate: host?.dateDisplay ?? '',
      hostPast: !host?.eventDate || host.eventDate < stallToday,
      hostOrganizerName: (host && getOrganizer(host.organizerId)?.name?.trim()) || 'the organizer',
    };
  });
  // Hosts the picker offers: published, upcoming, and not already holding a
  // live link with this shop. Declined and withdrawn hosts stay offered — the
  // state machine allows the re-ask; requested/approved would only refuse the
  // duplicate, and revoked is terminal for the shop side.
  const askedHostIds = new Set(
    shopStallLinks
      .filter((l) => l.status === 'requested' || l.status === 'approved' || l.status === 'revoked')
      .map((l) => l.hostEventId)
  );
  const stallHostOptions = isShop
    ? listPublishedEvents()
        .filter(
          (e) =>
            e.kind === 'event' && e.eventDate !== null && e.eventDate >= stallToday && !askedHostIds.has(e.id)
        )
        .map((e) => ({ id: e.id, name: e.name, dateDisplay: e.dateDisplay, city: e.city }))
    : [];

  // The host panel's two lists, joined with each shop's public identity. The
  // host sees shop metadata and one aggregate count only — never a stall's
  // buyers (the EventSalesSummary doctrine holds across the tenant line).
  const hostStallLinks = !isShop ? listStallLinksForHostEvent(event.id) : [];
  const pendingStalls = hostStallLinks
    .filter((l) => l.status === 'requested')
    .flatMap((link) => {
      const shop = getEventById(link.shopEventId);
      if (!shop) return [];
      return [
        {
          id: link.id,
          shopName: shop.name,
          // '' when the shop is unpublished: its public page 404s, and a link that
          // promises "what buyers would see" must not lead to an error page.
          shopSlug: shop.status === 'published' ? shop.slug : '',
          sellerName: getOrganizer(shop.organizerId)?.name?.trim() || 'the seller',
          message: link.message,
          requestedAt: link.requestedAt,
        },
      ];
    });
  const approvedStalls = hostStallLinks
    .filter((l) => l.status === 'approved')
    .flatMap((link) => {
      const shop = getEventById(link.shopEventId);
      if (!shop) return [];
      // The same rule the public event page reads, so the tick in this panel
      // can never disagree with what buyers actually see.
      const visible = stallVisibleOnEventPage(link, event, shop, stallToday);
      return [
        {
          id: link.id,
          shopName: shop.name,
          // '' when the shop is unpublished — its public page 404s, and the
          // panel renders a plain name instead of a dead link.
          shopSlug: shop.status === 'published' ? shop.slug : '',
          sellerName: getOrganizer(shop.organizerId)?.name?.trim() || 'the seller',
          stallPickupInfo: link.stallPickupInfo,
          // Shop-wide, because orders carry no host attribution — the panel's
          // wording says so honestly wherever the number shows.
          paidOrders: countPaidOrdersForEvent(shop.id),
          visible,
          hiddenReason: visible
            ? ''
            : event.status !== 'published'
              ? 'your event is not published'
              : shop.status !== 'published'
                ? 'the shop is unpublished right now'
                : 'the event date has passed',
        },
      ];
    });

  // Tab and section completion: what still needs doing, at a glance.
  const detailsDone = listingDetailsComplete(event);
  // What buyers are being given today, and any change still inside its waiting
  // period. The form shows the former and warns about the latter — showing the
  // queued values as if they were live would hide the very thing the delay
  // exists to make visible.
  const effective = effectivePayout(event);
  const queued = queuedPayoutChange(event);
  // Done when a buyer could actually pay: a transfer route with an account
  // behind it, or an instant route with the seller's own connection behind it.
  const bankDone = anyPaymentRoute(paymentOptionsFor(event));
  const connections = listConnections(organizer.id);
  const basicsDone = detailsDone && bankDone;
  const ticketsDone = tiers.length > 0;
  // Any visual at all counts — a video-only event still has something to show.
  const photosDone = media.length > 0 || videos.length > 0;
  const publishDone = event.status === 'published';
  const stepsDone = [basicsDone, ticketsDone, photosDone, publishDone].filter(Boolean).length;

  const tabs = [
    { key: 'basics', label: 'Basics', status: basicsDone ? ('done' as const) : ('todo' as const) },
    { key: 'tickets', label: v.Units, status: ticketsDone ? ('done' as const) : ('todo' as const) },
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
    {
      // One key, two jobs: a shop takes itself to events, an event hosts the
      // shops that asked. The stall emails link straight to ?tab=stalls on
      // either editor, so the key must be the same on both sides.
      key: 'stalls',
      label: isShop ? 'Events' : 'Stalls',
      status: 'neutral' as const,
      // Green and on the tab, like Questions: a pending request is a person
      // waiting on this organizer's decision.
      badge: !isShop && pendingStalls.length > 0 ? `${pendingStalls.length} new` : undefined,
    },
    // The restaurant pack (lib/kitchen): shops only.
    ...(isShop ? [{ key: 'kitchen', label: 'Kitchen & collection', status: 'neutral' as const }] : []),
    // Reserved seating (lib/seats): events only.
    ...(!isShop ? [{ key: 'seating', label: 'Seating', status: 'neutral' as const }] : []),
    { key: 'publish', label: 'Publish', status: publishDone ? ('done' as const) : ('todo' as const) },
  ];

  const panels = {
    seating: !isShop ? (
      <SeatingPanel
        eventId={event.id}
        initial={parseSeatMap(event.seatMap)}
        tiers={tiers.map((t) => ({ tierKey: t.tierKey, name: t.name, seatsPerUnit: t.seatsPerUnit }))}
        taken={Object.fromEntries(takenSeats(event.id))}
      />
    ) : null,
    kitchen: isShop ? (
      <KitchenSetupPanel
        eventId={event.id}
        slug={event.slug}
        initialSlots={parseSlotConfig(event.pickupSlots)}
        initialTables={event.tableCount}
        items={tiers.map((t) => ({ tierKey: t.tierKey, name: t.name, choicesText: choicesToText(parseChoices(t.choices)) }))}
      />
    ) : null,
    basics: (
      <EditorSectionGroup
        initialOpen={firstTodo([
          { id: 'details', done: detailsDone },
          { id: 'bank', done: bankDone },
        ])}
      >
        <EditorSection
          id="details"
          title={`${v.Listing} details`}
          hint={
            isShop
              ? 'The basics buyers see first — name, what you sell, and how they collect it.'
              : 'The basics buyers see first — name, date, venue, and capacity.'
          }
          status={detailsDone ? 'done' : 'todo'}
        >
          <DetailsForm
            eventId={event.id}
            isDraft={event.status === 'draft'}
            kind={event.kind}
            initial={{
              name: event.name,
              artist: event.artist,
              description: event.description,
              dateDisplay: event.dateDisplay,
              eventDate: event.eventDate ?? '',
              venueName: event.venueName,
              pickupInfo: event.pickupInfo,
              category: event.category,
              address: event.address,
              city: event.city,
              currency: event.currency,
              totalCapacity: event.totalCapacity,
              showRemaining: event.showRemaining,
              maxPerOrder: event.maxPerOrder,
              payWithinDays: event.payWithinDays,
              salesOpen: event.salesOpen,
              whatsapp: event.whatsapp,
              whatsappName: event.whatsappName,
              whatsappPhotoUrl: event.whatsappPhoto,
              whatsappFocus: event.whatsappFocus,
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
          hint="Your money goes straight to you — double-check the IBAN. Add PayPal.Me, or switch on instant payment through your own PayPal or Stripe account."
          status={bankDone ? 'done' : 'todo'}
        >
          <BankForm
            eventId={event.id}
            kind={event.kind}
            initial={{
              bankAccountHolder: effective.holder,
              bankIban: effective.iban,
              bankBic: effective.bic,
              bankName: effective.bankName,
              paypalAccount: effective.paypal,
            }}
            routes={{ transfer: event.payTransfer, paypal: event.payPaypal, stripe: event.payStripe }}
            connected={{
              paypal: connections.find((c) => c.provider === 'paypal')?.accountLabel ?? null,
              stripe: connections.find((c) => c.provider === 'stripe')?.accountLabel ?? null,
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
        <SectionHead
          title={v.Units}
          hint={`Your ${v.unitTypes} and prices — you need at least one to publish.`}
        />
        {/* Two switches produce the same words on the page — this one per ticket
            type, and the event-wide pause in Basics — and an organizer who
            unticks "Coming soon" here while the event-wide one is on sees
            nothing change and no reason why. Said plainly, where they are
            looking, with the way out attached. */}
        {!event.salesOpen && (
          <div className="notice notice-warn" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ flex: 1, minWidth: 260 }}>
              Sales are switched <strong>off</strong> for this whole {v.listing}, so your page shows{' '}
              <strong>&ldquo;Sales closed&rdquo;</strong> and nothing here can be bought, whatever each{' '}
              {v.unitType} below says.
            </span>
            <GoToTab tab="basics">Switch sales on in Basics →</GoToTab>
          </div>
        )}
        <TiersEditor
            eventId={event.id}
            kind={event.kind}
            initialTiers={tiers.map((t) => ({
              tierKey: t.tierKey,
              name: t.name,
              priceCents: t.priceCents,
              cap: t.cap,
              unlimited: t.unlimited,
              status: t.status,
              studentOnly: t.studentOnly,
              description: t.description,
              details: t.details,
              mediaId: t.mediaId,
              seatsPerUnit: t.seatsPerUnit,
            }))}
            // The listing's own photos are the ONLY pool an item picture can
            // come from — there is no second upload path, and the picker says
            // so by pointing at the Photos tab when this is empty.
            photos={media.map((m, i) => ({ id: m.id, url: mediaUrl(m.id), label: `Photo ${i + 1}` }))}
          soldByTierKey={soldByTierKey}
        />
      </div>
    ),
    media: (
      <div className="card">
        <SectionHead
          title="Photos & videos"
          hint={`A good cover sells ${v.units} — add photos and short videos, then pick the one people see first.`}
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
      <div className="card">
        <SectionHead
          title="Page design"
          hint="Pick colors and words that match the mood of the night."
        />
        <DesignPanel eventId={event.id} aiEnabled={aiDesignerEnabled()} initial={design} />
      </div>
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
    // The assistant's notes and the FAQ share this tab because they are one job
    // done in two steps: you tell it about your event, it drafts the entries,
    // you check them. Splitting them across tabs put the hand-off through a tab
    // switch, and the notes — which exist to produce this list — ended up filed
    // under Design, where nobody looking for the FAQ would find them.
    faq: (
      <EditorSectionGroup initialOpen="assistant">
        <EditorSection
          id="assistant"
          title="What the assistant should know"
          hint="Tell it the things buyers ask about — parking, food, age limits, doors — and it can draft the FAQ below from them."
          status="optional"
        >
          <AssistantPanel eventId={event.id} aiEnabled={aiAssistantEnabled()} initial={event.assistantContext} />
        </EditorSection>

        {/* Opens itself when the assistant hands over accepted suggestions, so
            an organizer is looking at the rows that just arrived rather than at
            a collapsed heading. */}
        <EditorSection
          id="faq"
          title="The FAQ on your page"
          hint="Up to 12 questions, shown as a tap-to-open section near the bottom of your event page."
          status="optional"
          revealOn={FAQ_SUGGESTIONS_EVENT}
        >
          <PageContentPanel
            show="faq"
            eventId={event.id}
            media={attachables}
            posts={posts.map((p) => ({ id: p.id, body: p.body, mediaId: p.mediaId, createdAt: p.createdAt }))}
            faqs={faqs.map((f) => ({ question: f.question, answer: f.answer }))}
            maxPhotos={MAX_PHOTOS_PER_EVENT}
            maxVideos={MAX_VIDEOS_PER_EVENT}
          />
        </EditorSection>
      </EditorSectionGroup>
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
    // Two panels behind one tab key, picked by kind — see the tabs list above.
    stalls: isShop ? (
      <div className="card">
        <SectionHead
          title="Take this shop to an event"
          hint="Ask a host for a stall — approved shops get a card on the event page that links back here."
        />
        <StallRequestsPanel
          shopId={event.id}
          hosts={stallHostOptions}
          links={shopStallRows}
          paidOrders={paidOrders}
        />
      </div>
    ) : (
      <div className="card">
        <SectionHead
          title="Stalls"
          hint="Shops asking to stand at your event. Buyers order from and pay each seller directly — never you."
        />
        <HostStallsPanel eventId={event.id} pending={pendingStalls} approved={approvedStalls} />
      </div>
    ),
    publish: (
      <EditorSectionGroup initialOpen={firstTodo([{ id: 'publish', done: publishDone }])}>
        <EditorSection
          id="publish"
          className="glow-card"
          title={event.status === 'published' ? `Your ${v.listing} is live` : 'Publish'}
          hint={
            event.status === 'published'
              ? `Buyers can find your page and reserve ${v.units}.`
              : 'One last look — the button unlocks when everything below is done.'
          }
          status={publishDone ? 'done' : 'todo'}
        >
          <PublishPanel
            eventId={event.id}
            status={event.status}
            slug={event.slug}
            kind={event.kind}
            checklist={checklist}
            // Advice about how the shop reads to a buyer, from the same rows
            // the public pages render from — so it can never point at a
            // problem the bazaar does not actually have.
            quality={qualityHints}
            qualityLine={event.kind === 'shop' ? qualitySummary(qualityHints, event) : ''}
            // The same query the announce route walks — the count promised on
            // the button is the count the route would email.
            announceAudience={listAnnouncementAudience(organizer.id, event.id).length}
            // Another live listing billing the same act in another city. The
            // organizer is the only one who can fix the root cause — a title
            // that does not say which city it is — so they are told here, in
            // the panel they are already looking at when they publish.
            sameAct={(() => {
              const others = otherShowsByAct(event);
              if (others.length === 0) return undefined;
              const city = cityLabel(event.city);
              return {
                city,
                others: others.map((other) => {
                  const when = shortDateLabel(other);
                  return `${cityLabel(other.city)}${when ? ` on ${when}` : ''}`;
                }),
                suggestTitle:
                  city.length > 0 && !event.name.toLowerCase().includes(city.toLowerCase()),
              };
            })()}
          />
        </EditorSection>

        {/* Archived events are the platform's to remove, not the organizer's. */}
        {event.status !== 'archived' && (
          <EditorSection
            id="delete"
            className="editor-section-danger"
            title={`Delete this ${v.listing}`}
            hint={`Takes the ${v.listing} and everything on it off the platform, permanently.`}
          >
            <DangerZone
              eventId={event.id}
              eventName={event.name}
              kind={event.kind}
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
        event={{ id: event.id, name: event.name, slug: event.slug, published: event.status === 'published', kind: event.kind }}
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
            <span className="badge badge-amber">Sales closed</span>
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

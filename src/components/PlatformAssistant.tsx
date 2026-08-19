import ChatWidget from './ChatWidget';

/**
 * The platform-wide floating assistant: answers "how does MartNepali
 * work?" questions against POST /api/platform/ask, which replies with
 * {kind:'answered',answer} or {kind:'unsure',message} — ChatWidget renders
 * both. Mounted on the public feed and the organizer dashboard; any other
 * page can adopt it by importing this component.
 */
/**
 * `brand` is passed in rather than read from the environment: this is a client
 * component, so PLATFORM_NAME does not exist here. Naming the platform in the
 * title is worth the one prop — "How does this work?" on a page a visitor
 * arrived at cold does not say what "this" is.
 */
export default function PlatformAssistant({ brand }: { brand: string }) {
  return (
    <ChatWidget
      title={`How does ${brand} work?`}
      subtitle="Ask anything about selling tickets here"
      placeholder="e.g. How do I get paid as an organizer?"
      endpoint="/api/platform/ask"
    />
  );
}

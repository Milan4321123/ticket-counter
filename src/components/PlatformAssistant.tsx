import ChatWidget from './ChatWidget';

/**
 * The platform-wide floating assistant: answers "how does NepaliConcert
 * work?" questions against POST /api/platform/ask, which replies with
 * {kind:'answered',answer} or {kind:'unsure',message} — ChatWidget renders
 * both. Mounted on the public feed and the organizer dashboard; any other
 * page can adopt it by importing this component.
 */
export default function PlatformAssistant() {
  return (
    <ChatWidget
      title="How does NepaliConcert work?"
      subtitle="Ask anything about selling tickets here"
      placeholder="e.g. How do I get paid as an organizer?"
      endpoint="/api/platform/ask"
    />
  );
}

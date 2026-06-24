import { RecordEventInput, RecordEventInputSchema, AgentEvent } from "./schema.js";
import { containsSecretLikeContent } from "./redaction.js";

export type RecordEventResult =
  | { ok: true; session_id: string }
  | { ok: false; error: "event_rejected"; reason: string };

export type EventSession = {
  session_id: string;
  events: AgentEvent[];
};

export type EventStore = {
  record(input: RecordEventInput): RecordEventResult;
  get(sessionId: string): EventSession;
  clear(sessionId: string): void;
};

let sessionCounter = 0;

function nextSessionId(): string {
  sessionCounter += 1;
  return `session-${sessionCounter}`;
}

function copyEvent(event: AgentEvent): AgentEvent {
  return { ...event };
}

function copySession(session: EventSession): EventSession {
  return {
    session_id: session.session_id,
    events: session.events.map(copyEvent)
  };
}

export function createInMemoryEventStore(): EventStore {
  const sessions = new Map<string, EventSession>();

  return {
    record(input: RecordEventInput): RecordEventResult {
      const parsed = RecordEventInputSchema.parse(input);

      if (containsSecretLikeContent(parsed.event)) {
        return {
          ok: false,
          error: "event_rejected",
          reason: "Event appears to include secret-like content. Store a redacted summary instead."
        };
      }

      const sessionId = parsed.session_id ?? nextSessionId();
      const existing = sessions.get(sessionId) ?? { session_id: sessionId, events: [] };
      const event = {
        ...parsed.event,
        timestamp: parsed.event.timestamp ?? new Date().toISOString()
      };
      existing.events.push(copyEvent(event));
      sessions.set(sessionId, existing);

      return { ok: true, session_id: sessionId };
    },
    get(sessionId: string): EventSession {
      const session = sessions.get(sessionId) ?? { session_id: sessionId, events: [] };
      return copySession(session);
    },
    clear(sessionId: string): void {
      sessions.delete(sessionId);
    }
  };
}

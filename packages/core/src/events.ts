import {
  AgentState,
  CommandObservationSchema,
  RecordEventInput,
  RecordEventInputSchema,
  AgentEvent
} from "./schema.js";
import { containsSecretLikeContent } from "./redaction.js";

export type RecordEventResult =
  | { ok: true; session_id: string }
  | { ok: false; error: "event_rejected"; reason: string };

export type EventSession = {
  session_id: string;
  events: AgentEvent[];
};

export type EventDerivedAgentState = Partial<
  Pick<
    AgentState,
    | "task"
    | "context_summary"
    | "files_read"
    | "commands_run"
    | "files_written"
    | "open_questions"
    | "findings"
  >
>;

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

function eventSummary(event: AgentEvent): string | undefined {
  return event.summary?.trim() || undefined;
}

function commandStatus(status: string | undefined): "passed" | "failed" | "unknown" {
  const parsed = CommandObservationSchema.shape.status.safeParse(status);
  return parsed.success ? parsed.data : "unknown";
}

export function eventSessionToAgentState(session: EventSession): EventDerivedAgentState {
  const filesRead: NonNullable<EventDerivedAgentState["files_read"]> = [];
  const commandsRun: NonNullable<EventDerivedAgentState["commands_run"]> = [];
  const filesWritten: string[] = [];
  const openQuestions: string[] = [];
  const findings: NonNullable<EventDerivedAgentState["findings"]> = [];
  const contextParts: string[] = [];
  let task: string | undefined;

  for (const event of session.events) {
    const summary = eventSummary(event);

    if (event.type === "task_started" && summary) {
      task ??= summary;
      contextParts.push(summary);
      continue;
    }

    if (event.type === "file_read" && event.path) {
      filesRead.push({
        path: event.path,
        ...(summary ? { summary } : {}),
        ...(event.tokens_estimate !== undefined ? { tokens_estimate: event.tokens_estimate } : {})
      });
      continue;
    }

    if ((event.type === "command_run" || event.type === "test_run") && event.command) {
      commandsRun.push({
        command: event.command,
        status: commandStatus(event.status),
        ...(summary ? { summary } : {}),
        ...(event.tokens_estimate !== undefined ? { tokens_estimate: event.tokens_estimate } : {})
      });
      continue;
    }

    if (event.type === "file_written" && event.path) {
      filesWritten.push(event.path);
      continue;
    }

    if (event.type === "question_identified" && summary) {
      openQuestions.push(summary);
      continue;
    }

    if (
      (event.type === "error_seen" ||
        event.type === "plan_created" ||
        event.type === "delegation_decision") &&
      summary
    ) {
      findings.push({ summary, evidence: [] });
      if (event.type !== "error_seen") {
        contextParts.push(summary);
      }
    }
  }

  return {
    ...(task ? { task } : {}),
    ...(contextParts.length > 0 ? { context_summary: contextParts.join(" ") } : {}),
    files_read: filesRead,
    commands_run: commandsRun,
    files_written: filesWritten,
    open_questions: openQuestions,
    findings
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

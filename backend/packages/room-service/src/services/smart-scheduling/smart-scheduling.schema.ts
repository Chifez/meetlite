import { z } from 'zod';

export const RecurrencePatternSchema = z.enum([
  'daily',
  'weekdays',
  'weekly',
  'monthly',
  'yearly',
]);
export type RecurrencePattern = z.infer<typeof RecurrencePatternSchema>;

export const RecurrenceEndTypeSchema = z.enum(['never', 'after', 'on']);
export type RecurrenceEndType = z.infer<typeof RecurrenceEndTypeSchema>;

export const RecurrenceSpecSchema = z.object({
  enabled: z.boolean().default(false),
  pattern: RecurrencePatternSchema.default('weekly'),
  interval: z.number().int().min(1).default(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  dayOfMonth: z.number().int().min(1).max(31).nullable().default(null),
  endType: RecurrenceEndTypeSchema.default('never'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  occurrences: z.number().int().min(1).max(365).nullable().default(null),
});
export type RecurrenceSpec = z.infer<typeof RecurrenceSpecSchema>;

export const SmartScheduleIntentSchema = z.object({
  title: z.string().min(1).max(200).default('Scheduled Meeting'),
  description: z.string().max(2000).default(''),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM in 24-hour format'),
  duration: z.number().int().min(5).max(480).default(30),
  timezone: z.string().default('UTC'),
  privacy: z.enum(['public', 'private']).default('public'),
  participants: z.array(z.string().email()).default([]),
  recurrence: RecurrenceSpecSchema.default({
    enabled: false,
    pattern: 'weekly',
    interval: 1,
    daysOfWeek: [],
    dayOfMonth: null,
    endType: 'never',
    endDate: null,
    occurrences: null,
  }),
  confidence: z.number().min(0).max(1).default(0.8),
});
export type SmartScheduleIntent = z.infer<typeof SmartScheduleIntentSchema>;

export interface TeamMemberContext {
  email: string;
  name?: string;
}

export interface TeamContext {
  id: string;
  name: string;
  members: TeamMemberContext[];
}

export interface DeterministicSignals {
  detectedTitle?: string;
  detectedDate?: string;
  detectedTime?: string;
  detectedDuration?: number;
  detectedParticipants: string[];
  detectedPrivacy?: 'public' | 'private';
  detectedRecurrence?: Partial<RecurrenceSpec>;
  hasRelativeWeekday?: boolean;
  hasRelativeOffsetDays?: number;
}

export interface AlternativeSlot {
  date: string;
  time: string;
  start: Date;
  end: Date;
  available: boolean;
  reason?: string;
  source?: 'database' | 'calendar' | 'generated';
}

export interface ConflictCheckPayload {
  isAvailable: boolean;
  conflicts: Array<{
    id: string;
    title: string;
    start: Date;
    end: Date;
    source: 'database' | 'calendar';
  }>;
  alternatives: AlternativeSlot[];
  calendarConnected: boolean;
  internalMeetings: number;
}

export interface PipelineExecutionResult {
  success: boolean;
  data: SmartScheduleIntent;
  confidence: number;
  diagnostics: {
    engine: 'ai_pipeline' | 'deterministic_pipeline' | 'repaired_pipeline';
    repairedFields?: string[];
    warnings?: string[];
    latencyMs?: number;
  };
  conflictCheck?: ConflictCheckPayload;
}

/**
 * Validates a JSON Schema object against OpenAI structured-output rules:
 * every key in `properties` must appear in `required`.
 */
export function findOpenAiSchemaViolations(schema: unknown, path = 'root'): string[] {
  if (!schema || typeof schema !== 'object') return [];

  const node = schema as Record<string, unknown>;
  const issues: string[] = [];

  if (node.type === 'object' && node.properties && typeof node.properties === 'object') {
    const properties = node.properties as Record<string, unknown>;
    const propKeys = Object.keys(properties);
    const required = Array.isArray(node.required) ? (node.required as string[]) : [];

    for (const key of propKeys) {
      if (!required.includes(key)) {
        issues.push(`${path}: missing '${key}' in required`);
      }
      issues.push(...findOpenAiSchemaViolations(properties[key], `${path}.${key}`));
    }
  }

  if (node.items) {
    issues.push(...findOpenAiSchemaViolations(node.items, `${path}[]`));
  }

  for (const branch of ['anyOf', 'oneOf', 'allOf'] as const) {
    const branches = node[branch];
    if (Array.isArray(branches)) {
      branches.forEach((sub, index) => {
        issues.push(...findOpenAiSchemaViolations(sub, `${path}.${branch}[${index}]`));
      });
    }
  }

  return issues;
}


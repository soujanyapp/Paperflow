import { SCHEMA_VERSION } from "./types";
import type { PaperflowDocument } from "./types";
import { coerceDocument } from "./schema";

type AnyRecord = Record<string, unknown>;

export interface Migration {
  from: number;
  to: number;
  describe: string;
  migrate: (doc: AnyRecord) => AnyRecord;
}

/**
 * Registered, ordered migrations. Each migration upgrades a document from one
 * schema version to the next. Add new migrations here; never edit old ones.
 */
export const MIGRATIONS: Migration[] = [
  {
    from: 0,
    to: 1,
    describe: "Establish schema v1: page regions, page numbering, layout mode.",
    migrate: (doc) => ({
      ...doc,
      schemaVersion: 1,
      layout: doc.layout ?? "flow",
      header: doc.header ?? { enabled: false, blocks: [] },
      footer: doc.footer ?? { enabled: false, blocks: [] },
      pageNumber: doc.pageNumber ?? {
        enabled: false,
        format: "n",
        align: "center",
        startAt: 1,
        hideOnFirst: false,
      },
    }),
  },
];

export function latestSchemaVersion(): number {
  return SCHEMA_VERSION;
}

/** Apply all migrations needed to bring a raw document up to the current version. */
export function migrateDocument(input: unknown): { document: PaperflowDocument; applied: number[] } {
  let raw: AnyRecord = (input && typeof input === "object" ? input : {}) as AnyRecord;
  let version = typeof raw.schemaVersion === "number" ? raw.schemaVersion : 0;
  const applied: number[] = [];

  const ordered = [...MIGRATIONS].sort((a, b) => a.from - b.from);
  for (const migration of ordered) {
    if (version === migration.from) {
      raw = migration.migrate(raw);
      version = migration.to;
      applied.push(migration.to);
    }
  }

  raw.schemaVersion = SCHEMA_VERSION;
  return { document: coerceDocument(raw), applied };
}

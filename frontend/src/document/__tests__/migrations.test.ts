import { describe, expect, it } from "vitest";
import { migrateDocument } from "../migrations";
import { SCHEMA_VERSION } from "../types";

describe("migrateDocument", () => {
  it("upgrades a v0 document and records the applied migration", () => {
    const { document, applied } = migrateDocument({
      schemaVersion: 0,
      id: "doc_legacy",
      title: "Legacy",
      blocks: [],
    });
    expect(applied).toContain(1);
    expect(document.schemaVersion).toBe(SCHEMA_VERSION);
    expect(document.header).toEqual({ enabled: false, blocks: [] });
    expect(document.pageNumber.enabled).toBe(false);
    expect(document.layout).toBe("flow");
  });

  it("leaves an up-to-date document unchanged", () => {
    const { applied } = migrateDocument({ schemaVersion: SCHEMA_VERSION, blocks: [] });
    expect(applied).toHaveLength(0);
  });
});

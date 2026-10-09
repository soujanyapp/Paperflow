import { describe, expect, it } from "vitest";
import { coerceDocument, validateDocument, validateSubmission, visibleFields } from "../schema";
import { createEmptyDocument } from "../factory";
import type { FieldDefinition } from "../types";

describe("validateDocument", () => {
  it("accepts a freshly created document", () => {
    const result = validateDocument(createEmptyDocument());
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("rejects an unknown block type with a path", () => {
    const doc = createEmptyDocument();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc.blocks as any[]).push({ id: "x", type: "wormhole" });
    const result = validateDocument(doc);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("blocks[2]"))).toBe(true);
  });

  it("flags duplicate field keys", () => {
    const doc = createEmptyDocument();
    const field: FieldDefinition = { key: "name", label: "Name", kind: "shortText", required: false };
    doc.blocks.push({ id: "f1", type: "field", field });
    doc.blocks.push({ id: "f2", type: "field", field: { ...field } });
    const result = validateDocument(doc);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("Duplicate"))).toBe(true);
  });
});

describe("coerceDocument", () => {
  it("repairs a minimal partial object", () => {
    const doc = coerceDocument({ title: "Hello" });
    expect(doc.page.size).toBe("A4");
    expect(doc.page.orientation).toBe("portrait");
    expect(doc.theme.bodyFont).toBeTruthy();
    expect(doc.blocks).toEqual([]);
  });
});

const fields: FieldDefinition[] = [
  { key: "email", label: "Email", kind: "email", required: true },
  { key: "age", label: "Age", kind: "number", required: false, validation: { min: 18, max: 120 } },
  {
    key: "plan",
    label: "Plan",
    kind: "dropdown",
    required: true,
    options: [
      { value: "basic", label: "Basic" },
      { value: "pro", label: "Pro" },
    ],
  },
  { key: "notes", label: "Notes", kind: "shortText", required: false },
];

describe("validateSubmission", () => {
  it("requires mandatory fields", () => {
    const result = validateSubmission(fields, {});
    expect(result.ok).toBe(false);
    expect(result.errors.email).toBeTruthy();
    expect(result.errors.plan).toBeTruthy();
  });

  it("validates formats and ranges", () => {
    const result = validateSubmission(fields, { email: "nope", age: 12, plan: "basic" });
    expect(result.errors.email).toBeTruthy();
    expect(result.errors.age).toBeTruthy();
  });

  it("accepts valid input and cleans values", () => {
    const result = validateSubmission(fields, { email: "a@b.co", age: "34", plan: "pro", notes: "hi" });
    expect(result.ok).toBe(true);
    expect(result.cleaned.age).toBe(34);
    expect(result.cleaned.plan).toBe("pro");
  });

  it("rejects dropdown values outside the option set", () => {
    const result = validateSubmission(fields, { email: "a@b.co", plan: "enterprise" });
    expect(result.errors.plan).toBeTruthy();
  });
});

describe("conditional visibility", () => {
  const conditional: FieldDefinition[] = [
    {
      key: "has_pet",
      label: "Do you have a pet?",
      kind: "dropdown",
      required: true,
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "pet_name",
      label: "Pet name",
      kind: "shortText",
      required: true,
      visibleWhen: { fieldKey: "has_pet", operator: "equals", value: "yes" },
    },
  ];

  it("hides and skips validation for hidden fields", () => {
    const shown = visibleFields(conditional, { has_pet: "no" });
    expect(shown.map((f) => f.key)).toEqual(["has_pet"]);
    const result = validateSubmission(conditional, { has_pet: "no" });
    expect(result.ok).toBe(true);
  });

  it("requires a visible conditional field", () => {
    const result = validateSubmission(conditional, { has_pet: "yes" });
    expect(result.errors.pet_name).toBeTruthy();
  });
});

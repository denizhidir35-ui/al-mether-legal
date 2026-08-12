const TEST_SOURCES = new Set([
  "test",
  "test_fixture",
  "dev",
  "dev_fixture",
  "simulator",
  "simulator_fixture",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isExplicitTestMetadata(value: unknown): boolean {
  const record = asRecord(value);

  if (!record) {
    return false;
  }

  const booleanFlags = [
    "isTest",
    "is_test",
    "testRecord",
    "test_record",
    "devFixture",
    "dev_fixture",
    "isSimulator",
    "is_simulator",
  ];

  if (booleanFlags.some((key) => record[key] === true)) {
    return true;
  }

  const sourceFields = [
    record.source,
    record.mode,
    record.environment,
    record.recordMode,
    record.record_mode,
  ];

  if (
    sourceFields.some(
      (field) =>
        typeof field === "string" &&
        TEST_SOURCES.has(field.trim().toLocaleLowerCase("tr-TR"))
    )
  ) {
    return true;
  }

  return isExplicitTestMetadata(record.metadata);
}

function hasStrictTestLabel(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const label = value.trim().toLocaleUpperCase("tr-TR");

  return (
    label.startsWith("TEST-") ||
    label.includes("TEST VERİSİDİR") ||
    label.includes("DEV FIXTURE") ||
    label === "SIMULATOR" ||
    label.startsWith("SIMULATOR-") ||
    label.includes("SIMULATOR FIXTURE")
  );
}

export function isTestOrDevRecord(input: {
  source?: unknown;
  title?: unknown;
  subject?: unknown;
  raw?: unknown;
  metadata?: unknown;
}): boolean {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  const source =
    typeof input.source === "string"
      ? input.source.trim().toLocaleLowerCase("tr-TR")
      : "";

  return (
    TEST_SOURCES.has(source) ||
    isExplicitTestMetadata(input.raw) ||
    isExplicitTestMetadata(input.metadata) ||
    hasStrictTestLabel(input.title) ||
    hasStrictTestLabel(input.subject)
  );
}

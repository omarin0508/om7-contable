const DEFAULT_CURRENCY = "CRC";

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isValidIntlCurrencyCode(value: string) {
  try {
    new Intl.NumberFormat("en", {
      currency: value,
      style: "currency",
    }).format(1);
    return true;
  } catch {
    return false;
  }
}

export function normalizeCurrencyCode(value: unknown, fallback = DEFAULT_CURRENCY) {
  const normalizedFallback =
    typeof fallback === "string" && /^[A-Z]{3}$/.test(fallback.toUpperCase())
      ? fallback.toUpperCase()
      : DEFAULT_CURRENCY;
  const raw = stripDiacritics(String(value ?? "").trim().toUpperCase());

  if (!raw) {
    return normalizedFallback;
  }

  if (
    raw.includes("CRC") ||
    raw.includes("COLON") ||
    raw.includes("COLONES") ||
    raw.includes("₡") ||
    raw.includes("¢")
  ) {
    return "CRC";
  }

  if (
    raw.includes("USD") ||
    raw.includes("DOLAR") ||
    raw.includes("DOLLAR") ||
    raw === "$"
  ) {
    return "USD";
  }

  if (raw.includes("EUR") || raw.includes("EURO") || raw.includes("€")) {
    return "EUR";
  }

  const compact = raw.replace(/[^A-Z]/g, "");
  const candidate = compact.slice(0, 3);

  if (/^[A-Z]{3}$/.test(candidate) && isValidIntlCurrencyCode(candidate)) {
    return candidate;
  }

  return normalizedFallback;
}

export function formatCurrencyAmount(
  value: number | null | undefined,
  currency: unknown,
  locale = "es-CR",
) {
  return new Intl.NumberFormat(locale, {
    currency: normalizeCurrencyCode(currency),
    style: "currency",
  }).format(value ?? 0);
}

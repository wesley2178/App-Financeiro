/**
 * Monetary formatting and parsing strictly in integer centavos to avoid IEEE-754 rounding issues.
 */

export function formatBRL(cents: number, hidden = false): string {
  if (hidden) return 'R$ •••••';
  const safe = Math.round(Number.isFinite(cents) ? cents : 0);
  const absVal = Math.abs(safe) / 100;
  const formatted = absVal.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return safe < 0 ? `-R$ ${formatted}` : `R$ ${formatted}`;
}

export function formatBRLCompact(cents: number, hidden = false): string {
  if (hidden) return 'R$ •••';
  const safe = Math.round(Number.isFinite(cents) ? cents : 0);
  const absReais = Math.abs(safe) / 100;
  if (absReais >= 1000) {
    const k = (absReais / 1000).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${safe < 0 ? '-' : ''}R$ ${k} mil`;
  }
  return formatBRL(safe, false);
}

/**
 * Parses Brazilian or numeric input strings ("1.250,50", "1250.50", "R$ 30") into integer centavos.
 */
export function parseBRLToCents(raw: string | number): number {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return 0;
    return Math.round(raw * 100);
  }
  const cleaned = raw.replace(/[R$\s]/g, '').trim();
  if (!cleaned) return 0;

  // Handle Brazilian comma format: "1.234,56" -> "1234.56"
  let normalized = cleaned;
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Only dots: if format is 1.234 (thousands) vs 12.50 (decimals)
    const parts = cleaned.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      normalized = cleaned.replace(/\./g, '');
    }
  }

  const num = Number.parseFloat(normalized);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function formatPercent(value: number, decimals = 1): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

export function centsToInputString(cents: number): string {
  const val = Math.round(cents) / 100;
  return val.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const fmtK = (value, suffix = '€') => {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1000000) {
    return `${(value / 1000000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M${suffix}`;
  }
  if (abs >= 10000) {
    return `${Math.round(value / 1000).toLocaleString('fr-FR')} K${suffix}`;
  }
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: abs >= 100 ? 0 : 1 })} ${suffix}`;
};

export const fmtNum = (value, decimals = 0) => {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return Number(value).toLocaleString('fr-FR', { maximumFractionDigits: decimals });
};

export const fmtPct = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return `${Number(value).toLocaleString('fr-FR', { maximumFractionDigits: decimals })}%`;
};

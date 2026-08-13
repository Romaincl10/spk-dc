export const fmtK = (value, suffix = '€') => {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1000000) {
    return `${(value / 1000000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M${suffix}`;
  }
  // Toujours en K€ dès 1 000 € (cohérence). Sous 10 K€ : 1 décimale pour garder la précision.
  if (abs >= 1000) {
    const dec = abs >= 10000 ? 0 : 1;
    return `${(value / 1000).toLocaleString('fr-FR', { maximumFractionDigits: dec })} K${suffix}`;
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

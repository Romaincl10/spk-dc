export const getFiscalYear = (refDate) => {
  const d = refDate || new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  if (m >= 6) {
    return { startDate: new Date(y, 6, 1), endDate: new Date(y + 1, 5, 30) };
  } else {
    return { startDate: new Date(y - 1, 6, 1), endDate: new Date(y, 5, 30) };
  }
};

export const getFiscalYearLabel = () => {
  const fy = getFiscalYear();
  const s = fy.startDate;
  const e = fy.endDate;
  return `${s.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} – ${e.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
};

export const parseDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val) ? null : val;
  if (typeof val === 'string') {
    const parts = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (parts) return new Date(+parts[3], +parts[2] - 1, +parts[1]);
    const d = new Date(val);
    return isNaN(d) ? null : d;
  }
  return null;
};

export const formatDate = (val) => {
  const d = parseDate(val);
  if (!d) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const formatDateShort = (val) => {
  const d = parseDate(val);
  if (!d) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

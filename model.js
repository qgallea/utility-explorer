(function (root) {
  'use strict';
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function utility(x, y, s) {
    if (x < 0 || y < 0) return NaN;
    const a = s.alpha, b = 1 - a, A = s.scale;
    switch (s.model) {
      case 'linear': return A * (a * x + b * y);
      case 'leontief': return A * Math.min(x / a, y / b);
      case 'quasi': return A * (a * Math.log1p(x) + b * y);
      case 'ces':
        if (Math.abs(s.rho) > 1e-7) {
          if (s.rho < 0 && (x === 0 || y === 0)) return 0;
          return A * Math.pow(a * Math.pow(x, s.rho) + b * Math.pow(y, s.rho), 1 / s.rho);
        }
      default: return A * Math.pow(x, a) * Math.pow(y, b);
    }
  }
  function optimum(s) {
    const {income: m, px, py, alpha: a} = s, b = 1 - a;
    let x, y, kind = 'interior';
    switch (s.model) {
      case 'linear': {
        const difference = a / px - b / py;
        if (Math.abs(difference) < 1e-10) { x = m / (2 * px); kind = 'multiple'; }
        else { x = difference > 0 ? m / px : 0; kind = 'corner'; }
        y = Math.max(0, (m - px * x) / py); break;
      }
      case 'leontief': {
        const t = m / (a * px + b * py);
        x = a * t; y = b * t; kind = 'kink'; break;
      }
      case 'quasi':
        x = clamp(a * py / (b * px) - 1, 0, m / px);
        y = Math.max(0, (m - px * x) / py);
        if (x === 0 || y < 1e-10) kind = 'corner';
        break;
      case 'ces': {
        const logRatio = Math.log(a * py / (b * px)) / (1 - s.rho);
        // Stable expenditure share, including almost-linear CES corner limits.
        const logOdds = logRatio + Math.log(px / py);
        const small = Math.exp(-Math.abs(logOdds));
        const shareX = (logOdds >= 0 ? 1 : small) / (1 + small);
        const shareY = (logOdds >= 0 ? small : 1) / (1 + small);
        x = m * shareX / px; y = m * shareY / py;
        break;
      }
      default: x = a * m / px; y = b * m / py;
    }
    return {x, y, u: utility(x, y, s), kind, cost: px * x + py * y};
  }
  function inverse(fixed, level, s, solveX) {
    const t = level / s.scale, a = solveX ? 1 - s.alpha : s.alpha, b = 1 - a;
    if (s.model === 'linear') return (t - a * fixed) / b;
    if (s.model === 'quasi') return solveX ? Math.expm1((t - (1 - s.alpha) * fixed) / s.alpha) : (t - s.alpha * Math.log1p(fixed)) / (1 - s.alpha);
    if (s.model === 'ces' && Math.abs(s.rho) > 1e-7) {
      if (s.rho < 0 && fixed === 0) return Infinity;
      const inner = (Math.pow(t, s.rho) - a * Math.pow(fixed, s.rho)) / b;
      if (inner < 0) return s.rho < 0 ? Infinity : -Infinity;
      return Math.pow(inner, 1 / s.rho);
    }
    if (fixed === 0) return Infinity;
    return Math.pow(t / Math.pow(fixed, a), 1 / b);
  }
  function contour(level, s, xmax, ymax, count = 260) {
    if (level < 0) return [];
    if (level === 0) {
      if (['cobb', 'leontief'].includes(s.model) || (s.model === 'ces' && s.rho <= 0)) return [[0, ymax], [0, 0], [xmax, 0]];
      return [[0, 0]];
    }
    if (s.model === 'leontief') {
      const x = s.alpha * level / s.scale, y = (1 - s.alpha) * level / s.scale;
      return x <= xmax && y <= ymax ? [[x, ymax], [x, y], [xmax, y]] : [];
    }
    const start = Math.max(0, inverse(ymax, level, s, true));
    const end = Math.min(xmax, inverse(0, level, s, true));
    if (!Number.isFinite(start) || end < start || start > xmax) return [];
    const points = [];
    for (let i = 0; i <= count; i++) {
      const x = start + (end - start) * i / count;
      let y = inverse(x, level, s, false);
      if (i === 0 && start > 0) y = ymax;
      if (i === count && end < xmax) y = 0;
      if (Number.isFinite(y) && y >= -1e-8 && y <= ymax + 1e-8) points.push([x, clamp(y, 0, ymax)]);
    }
    return points;
  }
  function mrs(x, y, s) {
    const a = s.alpha, b = 1 - a;
    if (s.model === 'linear') return a / b;
    if (s.model === 'leontief') return null;
    if (s.model === 'quasi') return a / (b * (1 + x));
    if (x <= 0) return Infinity;
    if (y <= 0) return 0;
    if (s.model === 'ces') return a / b * Math.pow(x / y, s.rho - 1);
    return a / b * y / x;
  }
  const api = {utility, optimum, contour, mrs};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UtilityModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

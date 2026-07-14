const NUMBER_PATTERN = '(?:\\d{1,4}|[零〇一二两三四五六七八九十]{1,4})';
const PERIOD_PATTERN = '(?:凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|今晚)';
const WEEKDAY_MAP = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 7,
  天: 7
};

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseNumber(value) {
  const text = String(value || '').trim();
  if (/^\d+$/.test(text)) return Number(text);

  const digits = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9
  };

  if (text === '十') return 10;
  if (text.includes('十')) {
    const [tensText, onesText] = text.split('十');
    const tens = tensText ? digits[tensText] : 1;
    const ones = onesText ? digits[onesText] : 0;
    if (tens === undefined || ones === undefined) return Number.NaN;
    return tens * 10 + ones;
  }

  if (text.length === 1 && digits[text] !== undefined) return digits[text];
  return Number.NaN;
}

function applyPeriod(hour, period) {
  if (!period) return hour;
  if (period === '下午' || period === '傍晚' || period === '晚上' || period === '今晚') {
    return hour < 12 ? hour + 12 : hour;
  }
  if (period === '中午') {
    return hour < 11 ? hour + 12 : hour;
  }
  if (period === '凌晨' && hour === 12) return 0;
  return hour;
}

function parseTime(text, impliedPeriod = '') {
  const source = normalizeText(text);
  const colonMatch = source.match(new RegExp(`(${PERIOD_PATTERN})?\\s*(\\d{1,2})\\s*[:：]\\s*(\\d{1,2})`, 'u'));
  if (colonMatch) {
    const period = colonMatch[1] || impliedPeriod;
    const hour = applyPeriod(Number(colonMatch[2]), period);
    const minute = Number(colonMatch[3]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
    return null;
  }

  const pointMatch = source.match(new RegExp(`(${PERIOD_PATTERN})?\\s*(${NUMBER_PATTERN})\\s*(?:点|點|时|時)(?:\\s*(半|${NUMBER_PATTERN})\\s*(?:分)?)?`, 'u'));
  if (pointMatch) {
    const period = pointMatch[1] || impliedPeriod;
    const hour = applyPeriod(parseNumber(pointMatch[2]), period);
    const minute = pointMatch[3] === '半' ? 30 : pointMatch[3] ? parseNumber(pointMatch[3]) : 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
    return null;
  }

  return null;
}

function defaultTimeForPeriod(period) {
  if (period === '凌晨') return { hour: 1, minute: 0 };
  if (period === '早上' || period === '早晨' || period === '上午') return { hour: 9, minute: 0 };
  if (period === '中午') return { hour: 12, minute: 0 };
  if (period === '下午') return { hour: 15, minute: 0 };
  if (period === '傍晚') return { hour: 18, minute: 0 };
  if (period === '晚上' || period === '今晚') return { hour: 20, minute: 0 };
  return { hour: 9, minute: 0 };
}

function makeDate(year, month, day, time) {
  const date = new Date(year, month - 1, day, time.hour, time.minute, 0, 0);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    || date.getHours() !== time.hour
    || date.getMinutes() !== time.minute
  ) {
    return null;
  }
  return date;
}

function withDayOffset(now, dayOffset, time) {
  const date = new Date(now);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(time.hour, time.minute, 0, 0);
  return date;
}

function parseRelativeDuration(text, now) {
  const halfHour = text.match(/(?:半个?|一(?:个)?半)小时后/u);
  if (halfHour) {
    const minutes = halfHour[0].startsWith('半') ? 30 : 90;
    return new Date(now.getTime() + minutes * 60 * 1000);
  }

  const hours = text.match(new RegExp(`(${NUMBER_PATTERN})\\s*(?:个)?\\s*(?:小时|小時|h)(?:\\s*(${NUMBER_PATTERN})\\s*(?:分钟|分鐘|min|m))?\\s*后`, 'iu'));
  if (hours) {
    const hourCount = parseNumber(hours[1]);
    const minuteCount = hours[2] ? parseNumber(hours[2]) : 0;
    if (Number.isFinite(hourCount) && Number.isFinite(minuteCount)) {
      return new Date(now.getTime() + (hourCount * 60 + minuteCount) * 60 * 1000);
    }
  }

  const minutes = text.match(new RegExp(`(${NUMBER_PATTERN})\\s*(?:分钟|分鐘|min|m)\\s*后`, 'iu'));
  if (minutes) {
    const count = parseNumber(minutes[1]);
    if (Number.isFinite(count)) return new Date(now.getTime() + count * 60 * 1000);
  }

  return null;
}

function parseReminder(value, referenceDate = new Date()) {
  const text = normalizeText(value);
  const now = new Date(referenceDate);
  if (!text || Number.isNaN(now.getTime())) return null;

  const durationTarget = parseRelativeDuration(text, now);
  if (durationTarget) return durationTarget.toISOString();

  const daysLater = text.match(new RegExp(`(${NUMBER_PATTERN})\\s*天后`, 'u'));
  if (daysLater) {
    const dayOffset = parseNumber(daysLater[1]);
    const time = parseTime(text) || defaultTimeForPeriod('');
    if (Number.isFinite(dayOffset)) return withDayOffset(now, dayOffset, time).toISOString();
  }

  const relativeDays = [
    { pattern: /大后天/u, offset: 3, period: '' },
    { pattern: /后天/u, offset: 2, period: '' },
    { pattern: /明早/u, offset: 1, period: '早上' },
    { pattern: /明晚/u, offset: 1, period: '晚上' },
    { pattern: /明天/u, offset: 1, period: '' },
    { pattern: /今晚/u, offset: 0, period: '今晚' },
    { pattern: /今天/u, offset: 0, period: '' }
  ];

  for (const item of relativeDays) {
    if (!item.pattern.test(text)) continue;
    const periodMatch = text.match(new RegExp(PERIOD_PATTERN, 'u'));
    const period = periodMatch ? periodMatch[0] : item.period;
    const time = parseTime(text, period) || defaultTimeForPeriod(period);
    const target = withDayOffset(now, item.offset, time);
    if (target > now) return target.toISOString();
    return null;
  }

  const weekday = text.match(/(下周|下星期|本周|这周|本星期|这星期|周|星期)([一二三四五六日天])/u);
  if (weekday) {
    const prefix = weekday[1];
    const targetWeekday = WEEKDAY_MAP[weekday[2]];
    const currentWeekday = now.getDay() === 0 ? 7 : now.getDay();
    const periodMatch = text.match(new RegExp(PERIOD_PATTERN, 'u'));
    const period = periodMatch ? periodMatch[0] : '';
    const time = parseTime(text, period) || defaultTimeForPeriod(period);
    let dayOffset;

    if (prefix === '下周' || prefix === '下星期') {
      dayOffset = 7 - currentWeekday + targetWeekday;
    } else if (prefix === '本周' || prefix === '这周' || prefix === '本星期' || prefix === '这星期') {
      dayOffset = targetWeekday - currentWeekday;
    } else {
      dayOffset = (targetWeekday - currentWeekday + 7) % 7;
    }

    let target = withDayOffset(now, dayOffset, time);
    if ((prefix === '周' || prefix === '星期') && target <= now) {
      target = withDayOffset(now, dayOffset + 7, time);
    }
    return target > now ? target.toISOString() : null;
  }

  const chineseDate = text.match(new RegExp(`(?:(\\d{4})\\s*年\\s*)?(${NUMBER_PATTERN})\\s*月\\s*(${NUMBER_PATTERN})\\s*(?:日|号|號)?`, 'u'));
  if (chineseDate) {
    const year = chineseDate[1] ? Number(chineseDate[1]) : now.getFullYear();
    const month = parseNumber(chineseDate[2]);
    const day = parseNumber(chineseDate[3]);
    const periodMatch = text.match(new RegExp(PERIOD_PATTERN, 'u'));
    const period = periodMatch ? periodMatch[0] : '';
    const time = parseTime(text, period) || defaultTimeForPeriod(period);
    let target = makeDate(year, month, day, time);
    if (!target) return null;
    if (!chineseDate[1] && target <= now) {
      target = makeDate(year + 1, month, day, time);
    }
    return target && target > now ? target.toISOString() : null;
  }

  const numericDate = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/u);
  if (numericDate) {
    const periodMatch = text.match(new RegExp(PERIOD_PATTERN, 'u'));
    const period = periodMatch ? periodMatch[0] : '';
    const time = parseTime(text, period) || defaultTimeForPeriod(period);
    const target = makeDate(Number(numericDate[1]), Number(numericDate[2]), Number(numericDate[3]), time);
    return target && target > now ? target.toISOString() : null;
  }

  const periodMatch = text.match(new RegExp(PERIOD_PATTERN, 'u'));
  const period = periodMatch ? periodMatch[0] : '';
  const time = parseTime(text, period);
  if (time) {
    let target = withDayOffset(now, 0, time);
    if (target <= now) target = withDayOffset(now, 1, time);
    return target.toISOString();
  }

  return null;
}

module.exports = {
  parseReminder
};

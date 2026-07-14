const test = require('node:test');
const assert = require('node:assert/strict');
const { parseReminder } = require('../src/main/reminderParser');

const NOW = new Date(2026, 6, 2, 14, 20, 0, 0);

function expected(dayOffset, hour, minute) {
  const date = new Date(NOW);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

test('解析相对时长和中文数字', () => {
  assert.equal(parseReminder('二十分钟后提醒我', NOW), new Date(NOW.getTime() + 20 * 60 * 1000).toISOString());
  assert.equal(parseReminder('1小时30分钟后开会', NOW), new Date(NOW.getTime() + 90 * 60 * 1000).toISOString());
  assert.equal(parseReminder('半小时后喝水', NOW), new Date(NOW.getTime() + 30 * 60 * 1000).toISOString());
  assert.equal(parseReminder('一个半小时后出门', NOW), new Date(NOW.getTime() + 90 * 60 * 1000).toISOString());
});

test('解析今天、今晚、明早、明晚和后天', () => {
  assert.equal(parseReminder('今晚八点整理周报', NOW), expected(0, 20, 0));
  assert.equal(parseReminder('明早提交材料', NOW), expected(1, 9, 0));
  assert.equal(parseReminder('明晚七点吃饭', NOW), expected(1, 19, 0));
  assert.equal(parseReminder('后天下午三点半复盘', NOW), expected(2, 15, 30));
  assert.equal(parseReminder('大后天上午十点沟通', NOW), expected(3, 10, 0));
});

test('解析几天后', () => {
  assert.equal(parseReminder('三天后下午四点跟进', NOW), expected(3, 16, 0));
  assert.equal(parseReminder('5天后处理', NOW), expected(5, 9, 0));
});

test('解析本周、下周和无前缀星期', () => {
  assert.equal(parseReminder('本周五下午三点评审', NOW), expected(1, 15, 0));
  assert.equal(parseReminder('下周一上午十点例会', NOW), expected(4, 10, 0));
  assert.equal(parseReminder('周四下午四点处理', NOW), expected(0, 16, 0));
  assert.equal(parseReminder('星期天晚上八点发布', NOW), expected(3, 20, 0));
});

test('解析中文日期和数字日期', () => {
  assert.equal(parseReminder('7月5日下午三点交付', NOW), new Date(2026, 6, 5, 15, 0, 0, 0).toISOString());
  assert.equal(parseReminder('七月六日九点验收', NOW), new Date(2026, 6, 6, 9, 0, 0, 0).toISOString());
  assert.equal(parseReminder('2026年8月1日晚上8点上线', NOW), new Date(2026, 7, 1, 20, 0, 0, 0).toISOString());
  assert.equal(parseReminder('2026-07-08 16:30开会', NOW), new Date(2026, 6, 8, 16, 30, 0, 0).toISOString());
});

test('只有时间时使用下一次出现的时间', () => {
  assert.equal(parseReminder('下午三点提醒我', NOW), expected(0, 15, 0));
  assert.equal(parseReminder('上午十点提醒我', NOW), expected(1, 10, 0));
});

test('拒绝无效或已经过去的明确时间', () => {
  assert.equal(parseReminder('本周一上午十点处理', NOW), null);
  assert.equal(parseReminder('2026年2月30日处理', NOW), null);
  assert.equal(parseReminder('没有时间的普通任务', NOW), null);
});

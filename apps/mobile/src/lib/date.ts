const shortDate = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric' });
const fullDate = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
const accessibleDate = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'long', timeStyle: 'short' });

export function formatPostDate(value: string, now = Date.now()) {
  const date = new Date(value);
  const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60000));
  let short: string;
  if (minutes < 1) {
    short = 'たった今';
  } else if (minutes < 60) {
    short = `${minutes}分前`;
  } else if (minutes < 24 * 60) {
    short = `${Math.floor(minutes / 60)}時間前`;
  } else {
    short = (date.getFullYear() === new Date(now).getFullYear() ? shortDate : fullDate).format(
      date,
    );
  }
  return { short, full: accessibleDate.format(date) };
}

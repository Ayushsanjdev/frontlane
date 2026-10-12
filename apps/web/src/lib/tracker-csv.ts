import type {Application} from './types';

export function trackerCsv(items: Application[]) {
  const cell = (value: string) => '"' + (/^\s*[=+@-]|^[\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"';
  const rows = [
    ['Company', 'Role', 'URL', 'Stage', 'Application date', 'Follow-up', 'Notes', 'Answers', 'Evidence', 'Updated'],
    ...items.map(item => [item.job.company, item.job.title, item.job.url, item.stage, item.appliedAt, item.followUp, item.notes, item.answers, item.evidence, item.updatedAt])
  ];
  return rows.map(row => row.map(cell).join(',')).join('\r\n');
}

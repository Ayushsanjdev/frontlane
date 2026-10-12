import {database} from '@frontlanejobs/database/client';

type SourceCheck = {source: string; status: string; matched: number; checked_at: Date | string};

export async function load() {
  try {
    const {rows} = await database().query('SELECT source,status,matched,checked_at FROM source_checks ORDER BY source');
    return {sources: (rows as SourceCheck[]).map(row => ({...row, checked_at: new Date(row.checked_at).toISOString()})), unavailable: false};
  } catch {
    return {sources: [] as SourceCheck[], unavailable: true};
  }
}

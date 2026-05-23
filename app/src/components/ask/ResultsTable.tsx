import type { AskCellValue, AskColumn } from '@/lib/types';

interface Props {
  columns: AskColumn[];
  rows: AskCellValue[][];
  truncated: boolean;
}

export function ResultsTable({ columns, rows, truncated }: Props) {
  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground italic">No rows returned.</div>;
  }
  return (
    <div className="overflow-x-auto border-t border-b">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-2xs uppercase tracking-wider text-muted-foreground bg-muted/30">
            {columns.map((c) => (
              <th key={c.name} scope="col" className="py-2 px-3 text-left font-medium">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-b-0">
              {r.map((v, j) => (
                <td
                  key={j}
                  className={`py-2 px-3 ${typeof v === 'number' ? 'text-right tabular' : ''}`}
                >
                  {v === null ? <span className="text-muted-foreground">—</span> : String(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {truncated ? (
        <div className="py-2 px-3 text-2xs uppercase tracking-wider text-muted-foreground">
          Showing first 1,000 rows.
        </div>
      ) : (
        <div className="py-2 px-3 text-2xs uppercase tracking-wider text-muted-foreground">
          {rows.length} {rows.length === 1 ? 'row' : 'rows'}
        </div>
      )}
    </div>
  );
}

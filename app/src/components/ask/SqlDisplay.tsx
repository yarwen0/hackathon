interface Props {
  sql: string;
}

export function SqlDisplay({ sql }: Props) {
  return (
    <pre className="bg-muted/40 border border-rule-strong p-4 text-xs font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">
      {sql}
    </pre>
  );
}

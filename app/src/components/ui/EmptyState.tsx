import type { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: Props) {
  return (
    <div className="border border-dashed py-12 px-6 text-center">
      <h3 className="font-display text-xl">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm text-muted-foreground max-w-prose mx-auto">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

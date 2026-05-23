import type { Role } from '@/lib/types';

const ROLE_LABELS: Record<Role, string> = {
  program_officer: 'Officer',
  methodology_steward: 'Steward',
  external_collaborator: 'Read-only',
};

const ROLE_TONES: Record<Role, string> = {
  program_officer: 'bg-foreground text-background',
  methodology_steward: 'bg-accent text-accent-foreground',
  external_collaborator: 'border border-rule text-muted-foreground bg-transparent',
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`px-2 py-0.5 text-2xs uppercase tracking-[0.14em] rounded-sm ${ROLE_TONES[role]}`}
      title={ROLE_LABELS[role]}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

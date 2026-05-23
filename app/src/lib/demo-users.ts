// Client-safe demo user metadata (no password hashes, no auth machinery).
// The login form imports from here so the client bundle doesn't pull in
// next/headers via the seed module.

import type { Role } from './types';

export interface DemoUserSummary {
  id: string;
  email: string;
  role: Role;
  displayName: string;
}

export const DEMO_USERS: DemoUserSummary[] = [
  {
    id: 'usr_officer',
    email: 'officer@gulfsouth.example',
    role: 'program_officer',
    displayName: 'Sarah Chen — Program Officer',
  },
  {
    id: 'usr_steward',
    email: 'steward@gulfsouth.example',
    role: 'methodology_steward',
    displayName: 'Dr. Marcus Thompson — Methodology Steward',
  },
  {
    id: 'usr_collab',
    email: 'collaborator@gulfsouth.example',
    role: 'external_collaborator',
    displayName: 'Visiting Researcher — External Collaborator',
  },
];

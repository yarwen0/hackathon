// Idempotent demo-user seeding. Runs lazily on first auth call. Three real
// roles so the role model is provable, not theatrical.

import { hashPassword, findUserByEmail, saveUser } from './auth';
import { DEMO_USERS } from './demo-users';

const DEMO_PASSWORD = 'demo';

export async function seedUsers(): Promise<void> {
  for (const u of DEMO_USERS) {
    const existing = await findUserByEmail(u.email);
    if (existing) continue;
    await saveUser({
      id: u.id,
      email: u.email,
      role: u.role,
      displayName: u.displayName,
      passwordHash: hashPassword(DEMO_PASSWORD),
    });
  }
}

export { DEMO_USERS };

// Ordered test runner ----------------------------------------------
import { describe } from 'vitest';

describe('Full protocol flow (ordered)', () => {
  describe('1️⃣  Admin', async () => { await import('./01-admin.test.ts'); });
  describe('2️⃣  User',  async () => { await import('./02-user.test.ts'); });
  describe('3️⃣  Bond',  async () => { await import('./03-bond.test.ts'); });

  // append more groups as you grow
  // e.g.  describe('🔒 Security', () => import('./security/auth.part'));
}); 
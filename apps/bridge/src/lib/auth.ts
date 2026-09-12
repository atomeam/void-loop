export interface VerifiedHuman {
  user_id: string;
  org_id: string;
  role: string;
}

export async function verifyHumanKey(
  db: D1Database,
  humanKey: string
): Promise<VerifiedHuman | null> {
  // Human keys are stored as: hk_<org_id>_<random>
  // For now, accept any key starting with "hk_" and extract org_id
  // In production, this would validate against a hashed store
  if (!humanKey.startsWith('hk_')) {
    return null;
  }

  const parts = humanKey.split('_');
  if (parts.length < 3) {
    return null;
  }

  const orgId = parts[1];
  const userId = `human_${parts[2]}`;

  // Verify org exists
  const org = await db.prepare('SELECT org_id FROM orgs WHERE org_id = ?')
    .bind(orgId).first();

  if (!org) {
    return null;
  }

  return {
    user_id: userId,
    org_id: orgId,
    role: 'human_approver'
  };
}
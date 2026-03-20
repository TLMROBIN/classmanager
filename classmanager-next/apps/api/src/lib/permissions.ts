const POINTS_WRITE_ROLE_CODES = new Set([
  "tenant_owner",
  "tenant_admin",
  "class_admin",
  "class_teacher",
  "head_teacher",
  "points_manager"
]);

const TENANT_MEMBER_READ_ROLE_CODES = new Set([
  "tenant_owner",
  "tenant_admin",
  "class_admin",
  "head_teacher"
]);

const TENANT_MEMBER_WRITE_ROLE_CODES = new Set([
  "tenant_owner",
  "tenant_admin"
]);

export type MembershipPermissionInput = {
  roles?: Array<{
    role: {
      code: string;
    };
  }>;
} | null;

export function getMembershipRoleCodes(membership: MembershipPermissionInput) {
  return (membership?.roles || []).map((item) => item.role.code);
}

export function canManagePoints(membership: MembershipPermissionInput) {
  const roleCodes = getMembershipRoleCodes(membership);
  if (!roleCodes.length) {
    return true;
  }
  return roleCodes.some((code) => POINTS_WRITE_ROLE_CODES.has(code));
}

export function canReadTenantMembers(membership: MembershipPermissionInput) {
  const roleCodes = getMembershipRoleCodes(membership);
  if (!roleCodes.length) {
    return true;
  }
  return roleCodes.some((code) => TENANT_MEMBER_READ_ROLE_CODES.has(code));
}

export function canManageTenantMembers(membership: MembershipPermissionInput) {
  const roleCodes = getMembershipRoleCodes(membership);
  if (!roleCodes.length) {
    return true;
  }
  return roleCodes.some((code) => TENANT_MEMBER_WRITE_ROLE_CODES.has(code));
}

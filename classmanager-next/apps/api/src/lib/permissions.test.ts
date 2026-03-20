import assert from "node:assert/strict";
import test from "node:test";

import { canManagePoints, canManageTenantMembers, canReadTenantMembers, getMembershipRoleCodes } from "./permissions.js";

function membershipWithRoles(...roleCodes: string[]) {
  return {
    roles: roleCodes.map((code) => ({
      role: {
        code
      }
    }))
  };
}

test("getMembershipRoleCodes returns ordered role codes", () => {
  assert.deepEqual(getMembershipRoleCodes(membershipWithRoles("tenant_owner", "class_admin")), [
    "tenant_owner",
    "class_admin"
  ]);
});

test("permission helpers allow empty-role membership during migration fallback", () => {
  assert.equal(canManagePoints({ roles: [] }), true);
  assert.equal(canReadTenantMembers({ roles: [] }), true);
  assert.equal(canManageTenantMembers({ roles: [] }), true);
});

test("canReadTenantMembers allows tenant and class admin readers", () => {
  assert.equal(canReadTenantMembers(membershipWithRoles("tenant_owner")), true);
  assert.equal(canReadTenantMembers(membershipWithRoles("tenant_admin")), true);
  assert.equal(canReadTenantMembers(membershipWithRoles("class_admin")), true);
  assert.equal(canReadTenantMembers(membershipWithRoles("head_teacher")), true);
  assert.equal(canReadTenantMembers(membershipWithRoles("points_manager")), false);
});

test("canManageTenantMembers only allows tenant owners and tenant admins", () => {
  assert.equal(canManageTenantMembers(membershipWithRoles("tenant_owner")), true);
  assert.equal(canManageTenantMembers(membershipWithRoles("tenant_admin")), true);
  assert.equal(canManageTenantMembers(membershipWithRoles("class_admin")), false);
  assert.equal(canManageTenantMembers(membershipWithRoles("head_teacher")), false);
});

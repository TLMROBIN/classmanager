function getDefaultTenantRoles() {
  return [
    { code: "tenant_owner", name: "Tenant Owner", scope: "tenant" },
    { code: "tenant_admin", name: "Tenant Admin", scope: "tenant" },
    { code: "class_admin", name: "Class Admin", scope: "class" },
    { code: "class_teacher", name: "Class Teacher", scope: "class" },
    { code: "points_manager", name: "Points Manager", scope: "class" },
    { code: "tenant_member", name: "Tenant Member", scope: "tenant" }
  ];
}

function getLegacyPrimaryRoleCode(data) {
  if (data?.user?.role === "admin") {
    return "tenant_owner";
  }
  return "tenant_owner";
}

module.exports = {
  getDefaultTenantRoles,
  getLegacyPrimaryRoleCode
};

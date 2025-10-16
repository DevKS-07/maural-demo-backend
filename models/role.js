// models/role.js

const roles = require("../config/roles.json");

class Role {
  constructor() {
    this.roles = roles.roles;
  }

  getRoleByName(name) {
    return this.roles.find((role) => role.name === name);
  }

  getRoles() {
    return this.roles;
  }

  getRoleById(id) {
    return this.roles.find((role) => role.id === id);
  }

  addRole(role) {
    this.roles.push(role);
  }
  removeRole(id) {
    this.roles = this.roles.filter((role) => role.id !== id);
  }

  getPermissionsByRoleName(name) {
    const role = this.getRoleByName(name);
    return role ? role.permissions : null;
  }

  getPermissionsByRoleId(id) {
    const role = this.getRoleById(id);
    return role ? role.permissions : null;
  }
}

module.exports = Role;

export const Roles = {
  OWNER: "owner",
  ADMIN: "admin",
  MOD: "mod",
  USER: "user",
};

export function getRole(sender, groupAdmins = [], ownerNumber) {
  const jid = sender.split("@")[0];

  if (jid === ownerNumber) return Roles.OWNER;
  if (groupAdmins.includes(sender)) return Roles.ADMIN;

  return Roles.USER;
}

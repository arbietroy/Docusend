export const ROLES = ['team_member', 'team_lead', 'admin', 'super_admin']

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  team_lead:   'Team Lead',
  team_member: 'Team Member',
}

export const ROLE_DESCRIPTIONS = {
  super_admin: 'Everything, including billing and super admin access.',
  admin:       'Directors: properties, reports, exports, team and activity log.',
  team_lead:   'Customer experience lead: also confirms payments and gives discounts.',
  team_member: 'Customer experience: clients, payments, collections and emails.',
}

export const atLeast = (role, min) => ROLES.indexOf(role) >= ROLES.indexOf(min)

// What each part of the app needs. The database enforces the same rules.
export const PERMISSIONS = {
  confirmPayments: 'team_lead',
  editPurchase:    'team_lead',
  manageProperties: 'admin',
  viewReports:     'admin',
  exportData:      'admin',
  manageTeam:      'admin',
  viewActivity:    'admin',
  companySettings: 'admin',
  deleteRecords:   'admin',
  billing:         'super_admin',
}

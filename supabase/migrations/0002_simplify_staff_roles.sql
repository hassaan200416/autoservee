-- Collapses manager/salesperson into a single "staff" role.
-- Product decision: owner = full access, staff = everything except
-- managing other staff (invite/deactivate stays owner-only).

update dealer_staff set role = 'staff' where role in ('manager', 'salesperson');
update staff_invites set role = 'staff' where role in ('manager', 'salesperson');

alter table dealer_staff drop constraint dealer_staff_role_check;
alter table dealer_staff add constraint dealer_staff_role_check check (role in ('owner', 'staff'));

alter table staff_invites drop constraint staff_invites_role_check;
alter table staff_invites add constraint staff_invites_role_check check (role in ('staff'));

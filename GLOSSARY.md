# Glossary

The words the code, the docs and the issues use. Code is in English; the French UI word follows in
brackets when there is one.

## People and access

- **User**: a family member with a row in `users`. Has a role, a name and a colour. Deactivated =
  `deleted_at` is set (soft delete); a deactivated user can't get in.
- **Role**: `admin`, `parent` or `child` [admin, parent, enfant]. Spec Q8.
- **Admin**: the role that manages members and chore types. There is always at least one **active
  admin** (spec Q10); a deactivated admin doesn't count.
- **Bootstrap admin**: while `users` is empty, the first email Cloudflare Access verifies becomes
  the admin (spec Q1).
- **Viewer**: the active user behind the current request, resolved from the Access JWT
  (`locals.viewer`). Not "current user", not "session".
- **PersonRef**: the minimum the access policy needs about a person: `{ id, role }`.
- **Access policy**: `src/lib/server/access-policy.ts`, the one place that decides who may do what.
  "Access" alone means Cloudflare Access, the login in front of the app.
- **Family profile** [Famille]: the profile option that shows the whole household, for parents and
  the admin (spec Q8). Code says `familyProfile`, not `famille`.

## Version log

- **Versioned table**: a table whose every change goes through `saveWithVersion()` and leaves one
  row in `record_versions` (spec Q7). Today `users`; `chores` and `chore_types` come with #5/#9.
- **Version**: one `record_versions` row: the full row after a change (`record_snapshot_json`),
  numbered by the row's `update_count`.
- **Change kind**: `created`, `updated` or `deleted` (the soft delete that sets `deleted_at`).

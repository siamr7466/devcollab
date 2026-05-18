# Security Specification for DevJournal

## 1. Data Invariants
- A `User` record must exist for any authenticated user to perform most actions.
- A `Project` must belong to the logged-in user (`userId` match).
- A `ProjectUpdate` must belong to a `Project` that the user has access to.
- `chat_messages` can be read and written by any authenticated user who has a profile.
- `invitations` can only be read/written by admins (initially the first user or hardcoded email).

## 2. The "Dirty Dozen" Payloads (Deny Cases)
1. **Identity Spoofing**: Creating a project with another user's `userId`.
2. **Unauthorized Update**: Modifying a project's `userId` after creation.
3. **Shadow Fields**: Adding `isAdmin: true` to a user profile during creation.
4. **ID Poisoning**: Injecting a 1MB string as a project ID.
5. **Orphaned Update**: Creating a `ProjectUpdate` for a non-existent `Project`.
6. **Malicious Status**: Setting a project status to a non-enum value like "Hacked".
7. **Bypassing Verification**: Writing to any restricted collection without `request.auth.token.email_verified == true`.
8. **PII Leak**: Reading another user's private data (though we use public profile pattern).
9. **Spam Attack**: Sending 100 messages in 1 second (Rate limiting - rules can handle some size limits).
10. **Resource Poisoning**: Uploading a 2MB string into a `description` field.
11. **State Shortcutting**: Updating a terminal status `Completed` back to `Started` (optional but good).
12. **Blanket Query**: Requesting `projects` collection without a query filter (rules must enforce `resource.data.userId == uid`).

## 3. Test Runner (Draft)
- `it('should deny identity spoofing on project creation', ...)`
- `it('should deny unauthorized update of project owner', ...)`
- ... (Detailed tests would go in `firestore.rules.test.ts`)

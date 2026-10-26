# CAL-02: Authorized Meeting Export

- Phase / track: Phase P5 — Security, Calendar, and Scheduling Closure
- Invariant: Calendar export accepts an authorized MeetLite meeting identifier (`meetingId`), validates caller authorization against database records, and creates the provider event from durable meeting title, description, scheduled time, duration, and attendees.
- Scope: `backend/packages/room-service/src/controllers/calendar.controller.ts`.
- Forbidden scope: Hard-coded sample meetings (`title: 'Sample Meeting'`); exporting meetings without validating creator or participant authorization.
- Dependencies: Phase P1 verifier, Prisma `Meeting` model, Google Calendar client.
- Risk classification: medium
- Rollback / kill switch: Revert `exportMeetingToCalendar` controller handler.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, Prisma schema.
- Pre-existing failures: `exportMeetingToCalendar` contained hard-coded static event details (`Sample Meeting`, `user1@example.com`) and did not accept or query a meeting ID from the database.

## Red evidence
Prior to this implementation:
`exportMeetingToCalendar` code inspection:
```typescript
const meeting = {
  title: 'Sample Meeting',
  description: 'Meeting description',
  start: new Date(),
  end: new Date(Date.now() + 60 * 60 * 1000),
  attendees: ['user1@example.com', 'user2@example.com'],
};
```
Hardcoded placeholder failing the execution plan's hard stop requirement.

## Green evidence
With database lookup and authorization verification:
1. `meetingId` is required; missing identifier throws `AppError.validation`.
2. Meeting is queried via Prisma (`where: { OR: [{ id: meetingId }, { meetingId: meetingId }] }`).
3. Authorization assertion: caller must be `createdBy === userId` or registered in `participants`. Unauthorized requests throw `AppError.forbidden`.
4. Event start, duration, end, and invitees are constructed directly from durable database state.
5. User tokens are verified from `getUserCalendarTokens(userId, 'google')`.

# Load tests (k6)

Run against staging with a seeded school. Each script reads `BASE_URL`, `ORIGIN` and a session cookie (`COOKIE`) for a user with the right role.

```bash
k6 run -e BASE_URL=https://api.staging.darsi.app -e ORIGIN=https://demo.staging.darsi.app -e COOKIE="__Secure-darsi.session_token=…" -e CLASS_ID=… perf/gradebook.js
k6 run -e BASE_URL=… -e ORIGIN=… -e COOKIE=… -e CLASS_ID=… perf/attendance.js
```

Targets come from the PRD's non-functional requirements: the gradebook loads in under 1.5 s at p95, and attendance saves stay under 500 ms at p95 when every class takes it at the start of a period.

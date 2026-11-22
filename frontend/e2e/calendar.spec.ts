import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./support/axe";
import { json, meFixture, signIn } from "./support/mock-api";

// Thursday 19 November 2026, 09:40 in Paris: during period 2.
const NOW = new Date("2026-11-19T08:40:00Z");

const lesson = (date: string, period: { name: string; startsAt: string; endsAt: string }, name: string, room: string | null) => ({
  date,
  cycleDay: 1,
  slotId: `${date}-${period.name}`,
  room,
  period: { id: period.name, sortOrder: 0, ...period },
  class: { id: "c1", code: "SCI7A", name, subject: { id: "s1", code: "SCI", name: "Sciences" } },
  teachers: ["Ada Lovelace"],
});
const P1 = { name: "P1", startsAt: "08:30", endsAt: "09:25" };
const P2 = { name: "P2", startsAt: "09:30", endsAt: "10:25" };

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test("shows a teacher today’s lessons and marks the current one", async ({ page }) => {
  await signIn(page, meFixture({ roles: ["teacher"] }), {
    "/api/v1/timetables/me": (route, url) =>
      json(route, url.searchParams.get("from") === "2026-11-19" ? [lesson("2026-11-19", P1, "Sciences 7A", "Lab 2"), lesson("2026-11-19", P2, "Sciences 7B", null)] : []),
  });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Today’s lessons" })).toBeVisible();
  const current = page.locator("[aria-current=time]");
  await expect(current).toContainText("Sciences 7B");
  await expect(current).toContainText("Now");
  await expectNoAccessibilityViolations(page);
});

test("shows the week’s timetable, and moves between weeks", async ({ page }) => {
  const requested: string[] = [];
  await signIn(page, meFixture({ roles: ["student"] }), {
    "/api/v1/timetables/me": (route, url) => {
      requested.push(`${url.searchParams.get("from")}..${url.searchParams.get("to")}`);
      return json(route, [lesson("2026-11-16", P1, "Sciences 7A", "Lab 2"), lesson("2026-11-19", P2, "Mathematics 7A", null)]);
    },
  });
  await page.goto("/timetable");

  await expect(page.getByRole("heading", { level: 1, name: "Timetable" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Monday, Nov 16" })).toContainText("Sciences 7A");
  await expect(page.getByRole("region", { name: "Monday, Nov 16" })).toContainText("Room Lab 2");
  await expectNoAccessibilityViolations(page);

  await page.getByRole("button", { name: "Next week" }).click();
  await expect.poll(() => requested.at(-1)).toBe("2026-11-23..2026-11-29");
});

test("lays out the month with holidays, and lets a coordinator add an event", async ({ page }) => {
  let created: unknown = null;
  await signIn(page, meFixture({ roles: ["coordinator"] }), {
    "/api/v1/calendar": (route, url) => {
      expect(url.searchParams.get("from")).toBe("2026-10-26");
      expect(url.searchParams.get("to")).toBe("2026-12-06");
      return json(route, [
        {
          id: "e1:2026-11-11",
          source: "event",
          kind: "holiday",
          title: "Armistice",
          description: null,
          startsOn: "2026-11-11",
          endsOn: "2026-11-11",
          startTime: null,
          endTime: null,
          eventId: "e1",
          recurring: true,
        },
      ]);
    },
    "POST /api/v1/calendar/events": (route) => {
      created = route.request().postDataJSON();
      return json(route, { id: "e2" }, 201);
    },
  });
  await page.goto("/calendar");

  await expect(page.getByRole("heading", { name: "November 2026" })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await page.getByRole("button", { name: "Agenda" }).click();
  await expect(page.getByText("Armistice")).toBeVisible();
  await expect(page.getByText("Holiday", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add event" }).click();
  await page.getByLabel("Title").fill("Parents’ evening");
  await page.getByRole("checkbox", { name: "All day" }).click();
  await page.getByLabel("Starts at").fill("18:00");
  await page.getByLabel("Ends at").fill("20:00");
  await page.getByRole("dialog").getByRole("button", { name: "Add event" }).click();

  await expect.poll(() => created).toMatchObject({
    title: "Parents’ evening",
    kind: "event",
    startsOn: "2026-11-19",
    endsOn: "2026-11-19",
    startTime: "18:00",
    endTime: "20:00",
    recurrence: null,
    audience: "school",
    audienceId: null,
  });
});

test("shows French month names and weekdays", async ({ page }) => {
  await signIn(page, meFixture({ roles: ["teacher"] }), { "/api/v1/calendar": (route) => json(route, []) });
  await page.goto("/fr/calendar");

  await expect(page.getByRole("heading", { name: "novembre 2026" })).toBeVisible();
  await expect(page.locator("abbr[title=lundi]")).toBeVisible();
});

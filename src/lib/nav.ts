export function projectSide(projectId: string, active: string) {
  return [
    { href: `/projects/${projectId}`, label: "Overview", active: active === "overview" },
    { href: `/projects/${projectId}/incidents`, label: "Incidents", active: active === "incidents" },
    { href: `/projects/${projectId}/alerts`, label: "Alerts", active: active === "alerts" },
    { href: `/projects/${projectId}/members`, label: "Members", active: active === "members" },
    { href: `/projects/${projectId}/plans`, label: "Plan", active: active === "plan" },
  ];
}

import { Button } from "@/components/ui/button";

const rows = [
  { name: "Amira Haddad", id: "STU-00412", att: "Present", tone: "success", grade: "6", inv: "Paid" },
  { name: "Lucas Moreau", id: "STU-00418", att: "Late", tone: "warning", grade: "5", inv: "Due 2 Dec" },
  { name: "Noah Okafor", id: "STU-00431", att: "Absent", tone: "destructive", grade: "—", inv: "Overdue" },
  { name: "Sofia Lindqvist", id: "STU-00436", att: "Excused", tone: "info", grade: "7", inv: "Paid" },
] as const;

const tone = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
};

function Panel({ dark }: { dark?: boolean }) {
  return (
    <div className={dark ? "dark" : ""}>
      <div className="bg-background text-foreground flex min-h-[640px]">
        <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border w-52 border-e p-3 text-sm">
          <div className="mb-4 px-2 text-base font-semibold tracking-tight">Darsi</div>
          {["Today", "Classes", "Gradebook", "Attendance", "Admissions", "Billing"].map((x, i) => (
            <div key={x} className={`rounded-md px-2 py-1.5 ${i === 2 ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/80"}`}>{x}</div>
          ))}
        </aside>
        <main className="flex-1 space-y-5 p-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-muted-foreground text-xs font-medium">MYP 3 · Sciences · Term 1</p>
              <h1 className="text-xl font-semibold tracking-tight">Gradebook</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Export</Button>
              <Button variant="secondary">Save draft</Button>
              <Button>Publish grades</Button>
            </div>
          </div>
          <div className="flex gap-3">
            <input placeholder="Search students" className="border-input bg-card h-8 w-64 rounded-md border px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
            <Button variant="ghost">Filters</Button>
            <Button variant="destructive">Remove</Button>
            <Button variant="link">View rubric</Button>
          </div>
          <div className="bg-card text-card-foreground overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground text-xs">
                <tr>{["Student", "ID", "Attendance", "Criterion A (0–8)", "Fees"].map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={`border-t ${i === 1 ? "bg-accent text-accent-foreground" : ""}`}>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2"><code className="text-muted-foreground">{r.id}</code></td>
                    <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone[r.tone]}`}>{r.att}</span></td>
                    <td className="px-3 py-2">{r.grade}</td>
                    <td className="px-3 py-2">{r.inv}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card rounded-lg border p-4"><p className="text-muted-foreground text-xs">Outstanding balance</p><p className="mt-1 text-2xl font-semibold" data-numeric>€48,250.00</p></div>
            <div className="bg-card rounded-lg border p-4" lang="fr"><p className="text-muted-foreground text-xs">Assiduité cette semaine</p><p className="mt-1 text-2xl font-semibold" data-numeric>94 % · Élodie Château</p></div>
            <div className="bg-card flex items-end gap-1.5 rounded-lg border p-4">
              {[1, 2, 3, 4, 5].map((c) => <div key={c} className="w-full rounded-sm" style={{ height: 20 + c * 8, background: `var(--chart-${c})` }} />)}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function Preview() {
  return (<div><Panel /><Panel dark /></div>);
}

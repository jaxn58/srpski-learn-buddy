import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface MetricsCardProps {
  studioMetrics: any;
}

export function MetricsCard({ studioMetrics }: MetricsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metrics</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <div className="rounded border p-3">
          <div className="text-xs text-muted-foreground">QC pass rate (last window)</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {typeof (studioMetrics as any)?.qc?.rate === "number"
              ? `${Math.round(Number((studioMetrics as any).qc.rate) * 100)}%`
              : "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            {String((studioMetrics as any)?.qc?.pass ?? "—")} / {String((studioMetrics as any)?.qc?.denom ?? "—")}
          </div>
        </div>

        <div className="rounded border p-3">
          <div className="text-xs text-muted-foreground">Avg revisions per draft</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {typeof (studioMetrics as any)?.revisions?.avg === "number"
              ? Number((studioMetrics as any).revisions.avg).toFixed(2)
              : "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            Based on {String((studioMetrics as any)?.revisions?.withSnapshots ?? "—")} drafts with snapshots
          </div>
        </div>

        <div className="rounded border p-3">
          <div className="text-xs text-muted-foreground">Drafts by status</div>
          <div className="mt-2 space-y-1 text-xs">
            {(["draft", "qc_failed", "qc_passed", "audit_failed", "ready_to_publish", "published"] as const).map(
              (s) => (
                <div key={s} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{s}</span>
                  <span className="font-mono tabular-nums">{String((studioMetrics as any)?.statuses?.[s] ?? 0)}</span>
                </div>
              )
            )}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Window: {String((studioMetrics as any)?.windowDrafts ?? "—")} drafts
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

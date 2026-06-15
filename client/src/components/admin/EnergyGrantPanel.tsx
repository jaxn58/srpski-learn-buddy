import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { formatDateEU } from "@/lib/utils";

type SubInfo = {
  energyQuotaMonthly?: number;
  energyUsedThisPeriod?: number;
  energyTopUpBalance?: number;
  energyPeriodResetAt?: number;
} | null;

interface Props {
  userId: Id<"users">;
  subscription: SubInfo;
  isSuperadmin: boolean;
}

/**
 * Superadmin panel to grant top-up energy or refund usage for a single user.
 * Shows the current Energy state (quota/used/top-up/reset) and provides a
 * simple form for `adminGrantEnergy`. Read-only for non-superadmins.
 */
export function EnergyGrantPanel({ userId, subscription, isSuperadmin }: Props) {
  const platformConfig = useQuery(api.platform.getPlatformConfig);
  const adminGrantEnergy = useMutation(api.energyAdmin.adminGrantEnergy);

  const [mode, setMode] = useState<"topUp" | "refund">("topUp");
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const quotaMonthly = subscription?.energyQuotaMonthly ?? platformConfig?.energyQuotaFull ?? 0;
  const used = subscription?.energyUsedThisPeriod ?? 0;
  const topUp = subscription?.energyTopUpBalance ?? 0;
  const available = Math.max(0, quotaMonthly - used) + topUp;
  const resetAt = subscription?.energyPeriodResetAt ?? null;

  const handleSubmit = async () => {
    const n = Number(amount);
    if (!Number.isInteger(n) || n <= 0) {
      toast.error("Please enter a positive whole number");
      return;
    }
    setSubmitting(true);
    try {
      await adminGrantEnergy({
        userId,
        amount: n,
        mode,
        note: note.trim() || undefined,
      });
      toast.success(
        mode === "topUp"
          ? `Added ${n} Energy to top-up balance`
          : `Refunded ${n} Energy from this period`
      );
      setAmount("");
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to grant energy");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">AI Energy</p>
      </div>

      {subscription === null ? (
        <p className="text-xs text-muted-foreground">
          No active subscription — Energy state not available.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Monthly quota</p>
              <p className="font-medium tabular-nums">{quotaMonthly}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Used this period</p>
              <p className="font-medium tabular-nums">{used}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Top-up balance</p>
              <p className="font-medium tabular-nums">{topUp}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Available</p>
              <p className="font-medium tabular-nums text-green-600">{available}</p>
            </div>
          </div>
          {resetAt && (
            <p className="text-xs text-muted-foreground mt-2">
              Next reset: {formatDateEU(resetAt)}
            </p>
          )}

          {isSuperadmin && (
            <div className="mt-4 border-t pt-3">
              <p className="text-xs text-muted-foreground mb-2">
                Grant Energy (top-up adds to balance, refund subtracts from period usage).
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label htmlFor="grant-mode" className="text-xs">Mode</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as "topUp" | "refund")}>
                    <SelectTrigger id="grant-mode" className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="topUp">Top-up</SelectItem>
                      <SelectItem value="refund">Refund usage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="grant-amount" className="text-xs">Amount</Label>
                  <Input
                    id="grant-amount"
                    type="number"
                    min={1}
                    step={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-32"
                  />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <Label htmlFor="grant-note" className="text-xs">Note (optional)</Label>
                  <Input
                    id="grant-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. support credit"
                  />
                </div>
                <Button onClick={handleSubmit} disabled={submitting || !amount}>
                  Apply
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

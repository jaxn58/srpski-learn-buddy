import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";

/**
 * Staff control for how many learning units beta testers may access.
 * Self-contained: reads/writes the platform-config singleton directly, so it can
 * be dropped anywhere in the content-creation area without prop threading.
 * Beta AI usage is limited via monthly Energy (Admin → Energy); beta phase
 * on/off is Admin → Beta Phase.
 */
export function BetaUnitsLimitCard() {
  const config = useQuery(api.platform.getPlatformConfig);
  const setBetaMaxUnits = useMutation(api.platform.setBetaMaxUnits);
  const [value, setValue] = useState<string>("");

  useEffect(() => {
    if (config) setValue(String(config.betaMaxUnits));
  }, [config?.betaMaxUnits]);

  const dirty = config !== undefined && value !== String(config.betaMaxUnits);

  const handleSave = async () => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      toast.error("Please enter a non-negative whole number");
      return;
    }
    try {
      await setBetaMaxUnits({ betaMaxUnits: n });
      toast.success("Beta unit limit updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update unit limit");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="h-4 w-4 text-muted-foreground" />
          Beta unit limit
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          How many learning units a beta user may access while the beta phase is
          active. Monthly AI Energy for beta testers is configured in Admin
          &rarr; Energy. The beta phase master switch is Admin &rarr; Beta Phase.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Label htmlFor="beta-max-units" className="sr-only">
            Beta unit limit
          </Label>
          <Input
            id="beta-max-units"
            type="number"
            min={0}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={config === undefined}
            className="w-32"
          />
          <Button onClick={handleSave} disabled={config === undefined || !dirty}>
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

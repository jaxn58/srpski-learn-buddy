import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value: string | number;
  percentage?: number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  showProgress?: boolean;
  progressValue?: number;
  progressLabel?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  percentage,
  icon,
  trend,
  description,
  showProgress = false,
  progressValue,
  progressLabel,
  className,
}: MetricCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground';

  return (
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && <div className="text-muted-foreground">{icon}</div>}
            <CardTitle className="text-base">{label}</CardTitle>
          </div>
          {trend && trend !== 'neutral' && (
            <TrendIcon className={cn("h-4 w-4", trendColor)} />
          )}
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold">{value}</div>
          {percentage !== undefined && (
            <span className="text-sm text-muted-foreground">
              ({percentage}%)
            </span>
          )}
        </div>
        {showProgress && progressValue !== undefined && (
          <div className="space-y-2">
            {progressLabel && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{progressLabel}</span>
                <span className="font-medium">{progressValue}</span>
              </div>
            )}
            <ProgressBar value={Math.min(100, Math.max(0, progressValue))} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

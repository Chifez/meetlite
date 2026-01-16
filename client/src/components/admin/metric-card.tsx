import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubscriptMetric {
  label: string;
  value: string | number;
  growth?: number;
  trend?: 'up' | 'down' | 'neutral';
}

interface MetricCardProps {
  title: string;
  value: string | number;
  growth?: number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  subscript?: SubscriptMetric;
  className?: string;
}

export function MetricCard({
  title,
  value,
  growth,
  subtitle,
  trend,
  subscript,
  className,
}: MetricCardProps) {
  const isPositive = trend === 'up' || (growth !== undefined && growth >= 0);
  const isNegative = trend === 'down' || (growth !== undefined && growth < 0);
  const subscriptIsPositive =
    subscript?.trend === 'up' ||
    (subscript?.growth !== undefined && subscript.growth >= 0);
  const subscriptIsNegative =
    subscript?.trend === 'down' ||
    (subscript?.growth !== undefined && subscript.growth < 0);

  return (
    <Card className={cn('', className)}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-2xl font-bold text-foreground">{value}</p>
              {growth !== undefined && (
                <div
                  className={cn(
                    'flex items-center gap-1 text-xs font-medium whitespace-nowrap',
                    isPositive && 'text-green-600 dark:text-green-400',
                    isNegative && 'text-red-600 dark:text-red-400'
                  )}
                >
                  {isPositive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  <span>{Math.abs(growth).toFixed(1)}%</span>
                </div>
              )}
            </div>
            {subscript && (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {subscript.label}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {subscript.value}
                  </span>
                </div>
                {subscript.growth !== undefined && (
                  <div
                    className={cn(
                      'flex items-center gap-1 text-xs font-medium whitespace-nowrap',
                      subscriptIsPositive &&
                        'text-green-600 dark:text-green-400',
                      subscriptIsNegative && 'text-red-600 dark:text-red-400'
                    )}
                  >
                    {subscriptIsPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span>{Math.abs(subscript.growth).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            )}
            {subtitle && !subscript && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}



import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  color?: 'primary' | 'green' | 'yellow' | 'blue';
}

const FeatureCard = ({
  icon: Icon,
  title,
  description,
  color = 'primary',
}: FeatureCardProps) => {
  const colorClasses = {
    primary: 'bg-primary text-primary-foreground group-hover:bg-primary/90',
    green: 'bg-green-500 text-white group-hover:bg-green-600',
    yellow: 'bg-yellow-500 text-white group-hover:bg-yellow-600',
    blue: 'bg-blue-500 text-white group-hover:bg-blue-600',
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border hover:border-primary/50 bg-card cursor-pointer hover:-translate-y-1">
      <CardContent className="p-6 sm:p-8 space-y-4">
        <div
          className={cn(
            'w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3',
            colorClasses[color]
          )}
        >
          <Icon className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default FeatureCard;

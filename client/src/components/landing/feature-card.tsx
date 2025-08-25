import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
}

const FeatureCard = ({
  icon: Icon,
  title,
  description,
  gradient,
}: FeatureCardProps) => {
  return (
    <Card className="group hover:shadow-xl transition-all duration-300 border-0 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-gray-800/80">
      <CardContent className="p-6 sm:p-8 text-center space-y-4">
        <div
          className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
        >
          <Icon className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          {description}
        </p>
      </CardContent>
    </Card>
  );
};

export default FeatureCard;

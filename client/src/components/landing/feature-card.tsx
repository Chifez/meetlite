import { Card, CardContent } from '@/components/ui/card';

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  gradient: string;
  trustIndicator?: string;
  delay?: number;
}

const FeatureCard = ({
  icon: Icon,
  title,
  description,
  gradient,
  trustIndicator,
  delay = 0,
}: FeatureCardProps) => {
  return (
    <Card
      className="group hover:shadow-xl transition-all duration-300 border border-gray-200/50 dark:border-gray-700/50 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-gray-800/80 hover-lift animate-fade-in h-fit lg:h-80"
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="p-8 text-center space-y-6 h-full flex flex-col justify-between">
        <div className="w-20 h-20 mx-auto flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
          <Icon className="w-10 h-10 text-gray-700 dark:text-gray-300" />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-heading font-semibold text-gray-900 dark:text-gray-100 leading-tight">
            {title}
          </h3>
          {trustIndicator && (
            <div className="pt-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700">
                {trustIndicator}
              </span>
            </div>
          )}
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default FeatureCard;

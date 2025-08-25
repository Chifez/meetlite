import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

interface PricingCardProps {
  title: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  buttonText: string;
  buttonVariant?: 'default' | 'outline';
  isPopular?: boolean;
}

const PricingCard = ({
  title,
  price,
  period,
  description,
  features,
  buttonText,
  buttonVariant = 'default',
  isPopular = false,
}: PricingCardProps) => {
  return (
    <Card
      className={`relative border-2 ${
        isPopular
          ? 'border-purple-300 dark:border-purple-600 hover:border-purple-400 dark:hover:border-purple-500 bg-white dark:bg-gray-800 shadow-xl scale-105'
          : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm'
      } transition-all duration-300`}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-1">
            Most Popular
          </Badge>
        </div>
      )}
      <CardContent className="p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <div className="space-y-1">
            <div className="flex items-baseline space-x-1">
              <span className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                {price}
              </span>
              {period && (
                <span className="text-gray-600 dark:text-gray-400">
                  {period}
                </span>
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-400">{description}</p>
          </div>
        </div>

        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-gray-700 dark:text-gray-300 text-sm lg:text-lg">
                {feature}
              </span>
            </li>
          ))}
        </ul>

        <Button
          className={`w-full rounded-full py-6 ${
            buttonVariant === 'outline'
              ? 'border-2 border-purple-600 dark:border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 bg-transparent'
              : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
          }`}
          variant={buttonVariant}
        >
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );
};

export default PricingCard;

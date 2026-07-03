import { Card, CardContent } from '@/components/ui/card';
import { Check, X } from 'lucide-react';

const comparisonData = [
  {
    feature: 'Video Quality',
    meetlite: true,
    competitor: true,
  },
  {
    feature: 'Smart Scheduling',
    meetlite: true,
    competitor: false,
  },
  {
    feature: 'End-to-End Encryption',
    meetlite: true,
    competitor: true,
  },
  {
    feature: 'Custom Branding',
    meetlite: true,
    competitor: false,
  },
  {
    feature: 'AI-Powered Features',
    meetlite: true,
    competitor: false,
  },
  {
    feature: 'Unlimited Meetings',
    meetlite: true,
    competitor: false,
  },
];

const ComparisonSection = () => {
  return (
    <section id="comparison" className="py-20 bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground">
            Why choose us?
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            See how we compare to other solutions.
          </p>
        </div>

        <Card className="border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-6 font-semibold text-foreground">
                      Feature
                    </th>
                    <th className="text-center p-6 font-semibold text-primary">
                      MeetLite
                    </th>
                    <th className="text-center p-6 font-semibold text-muted-foreground">
                      Others
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row, index) => (
                    <tr
                      key={index}
                      className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-6 text-foreground font-medium">
                        {row.feature}
                      </td>
                      <td className="p-6 text-center">
                        {row.meetlite ? (
                          <Check className="w-6 h-6 text-green-500 mx-auto" />
                        ) : (
                          <X className="w-6 h-6 text-muted-foreground mx-auto" />
                        )}
                      </td>
                      <td className="p-6 text-center">
                        {row.competitor ? (
                          <Check className="w-6 h-6 text-green-500 mx-auto" />
                        ) : (
                          <X className="w-6 h-6 text-muted-foreground mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default ComparisonSection;

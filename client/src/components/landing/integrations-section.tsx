import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Mail, Slack, Github, Zap, Globe } from 'lucide-react';

const integrations = [
  { name: 'Google Calendar', icon: Calendar, color: 'blue' },
  { name: 'Outlook', icon: Mail, color: 'blue' },
  { name: 'Slack', icon: Slack, color: 'purple' },
  { name: 'GitHub', icon: Github, color: 'gray' },
  { name: 'Zapier', icon: Zap, color: 'orange' },
  { name: 'Webhooks', icon: Globe, color: 'green' },
];

const IntegrationsSection = () => {
  return (
    <section className="py-20 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground">
            Seamless integrations
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Connect with the tools your team already uses.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6">
          {integrations.map((integration, index) => (
            <Card
              key={index}
              className="border-border bg-card hover:border-primary/50 hover:shadow-md transition-all duration-300 cursor-pointer group"
            >
              <CardContent className="p-6 flex flex-col items-center justify-center space-y-3 min-h-[120px]">
                <integration.icon className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="text-sm font-medium text-foreground text-center">
                  {integration.name}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default IntegrationsSection;

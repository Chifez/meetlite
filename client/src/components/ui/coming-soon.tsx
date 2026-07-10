import { ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import SEO from '@/components/seo';

interface ComingSoonProps {
  title: string;
  featureName: string;
}

export function ComingSoon({ title, featureName }: ComingSoonProps) {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <SEO title={`${title} · MeetLite`} />
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-24 h-24 mb-6 relative">
          <div className="absolute inset-0 border-2 border-dashed border-border rounded-xl"></div>
          <div className="absolute inset-2 border-2 border-border/50 rounded-lg"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <Clock className="w-6 h-6 text-ink-muted" />
          </div>
        </div>
        
        <h1 className="text-[1.25rem] font-bold text-foreground tracking-[-0.025em] mb-2">
          {title}
        </h1>
        <p className="text-[0.875rem] text-muted-foreground mb-8 max-w-sm">
          We're currently building {featureName}. Check back soon for updates.
        </p>
        
        <Button 
          variant="outline" 
          onClick={() => navigate('/dashboard')}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Go back
        </Button>
      </div>
    </DashboardLayout>
  );
}

export default ComingSoon;

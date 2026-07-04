import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SEO from '@/components/seo';
import Logo from '@/components/logo';
import { ArrowLeft } from 'lucide-react';

const NotFound = () => {
  return (
    <>
      <SEO
        title="404 — Page Not Found · MeetLite"
        description="This page could not be found. Return to your dashboard or go back home."
      />

      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        {/* Ambient cobalt radial */}
        <div
          className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative text-center space-y-5 max-w-sm w-full">
          <div className="flex justify-center mb-6">
            <Logo />
          </div>

          <div className="space-y-1">
            <p className="text-[5rem] font-black text-primary/10 leading-none tabular-nums tracking-[-0.04em]">
              404
            </p>
            <h1 className="text-[1.375rem] font-bold text-foreground tracking-[-0.025em]">
              Page not found
            </h1>
            <p className="text-[0.875rem] text-muted-foreground leading-relaxed">
              The page you're looking for doesn't exist or has been moved. Check the URL or head back to a safe place.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Link to="/">
              <Button id="not-found-home" size="sm" className="gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to home
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button id="not-found-dashboard" variant="outline" size="sm">
                Go to dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotFound;

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SEO from '@/components/seo';
import Logo from '@/components/logo';

const NotFound = () => {
  return (
    <>
      <SEO title="404 - MeetLite" description="This page could not be found" />

      <div className="min-h-screen bg-page pb-12 pt-20 px-4 flex items-center justify-center">
        <div className="w-full max-w-md text-center">
          <div className="flex justify-center mb-8">
            <Logo />
          </div>

          <h1 className="text-2xl font-semibold text-foreground mb-4">404</h1>
          <p className="text-lg text-foreground mb-2">Page not found</p>
          <p className="text-sm text-muted-foreground mb-4">
            The page you're looking for doesn't exist or has been moved.
          </p>

          <Link to="/">
            <Button size="sm">Return Home</Button>
          </Link>
        </div>
      </div>
    </>
  );
};

export default NotFound;

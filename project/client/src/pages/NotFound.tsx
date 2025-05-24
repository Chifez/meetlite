import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Video } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="container max-w-md mx-auto py-16 px-4 text-center">
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-2">
          <Video className="h-8 w-8 text-primary" />
          <span className="font-bold text-2xl">MeetLite</span>
        </div>
      </div>

      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-xl mb-8">Page not found</p>
      <p className="text-muted-foreground mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      
      <Link to="/">
        <Button>Return Home</Button>
      </Link>
    </div>
  );
};

export default NotFound;
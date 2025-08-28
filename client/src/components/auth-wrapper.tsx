import Logo from './logo';
import { Card, CardHeader, CardContent, CardFooter } from './ui/card';
import { ReactNode } from 'react';

interface AuthWrapperProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const AuthWrapper = ({
  title,
  description,
  children,
  footer,
}: AuthWrapperProps) => (
  <div className="min-h-screen bg-background pt-20 md:pt-24 flex items-center justify-center p-4">
    <div className="w-full max-w-md">
      <div className="flex justify-center mb-8">
        <Logo />
      </div>
      <Card>
        <CardHeader>
          <h2 className="text-xl text-center font-semibold text-foreground">
            {title}
          </h2>
          {description && (
            <p className="text-center text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </CardHeader>
        <CardContent>{children}</CardContent>
        {footer && (
          <CardFooter className="flex justify-center">{footer}</CardFooter>
        )}
      </Card>
    </div>
  </div>
);

export default AuthWrapper;

import Logo from './Logo';
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
  <div className="container max-w-md mx-auto py-16 px-4">
    <div className="flex justify-center mb-8">
      <Logo />
    </div>
    <Card>
      <CardHeader>
        <h2 className="text-2xl text-center font-bold">{title}</h2>
        {description && (
          <p className="text-center text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && (
        <CardFooter className="flex justify-center">{footer}</CardFooter>
      )}
    </Card>
  </div>
);

export default AuthWrapper;

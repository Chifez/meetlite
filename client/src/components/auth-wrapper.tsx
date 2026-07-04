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
  <div className="min-h-screen bg-background flex items-center justify-center p-4">
    {/* Subtle cobalt background glow */}
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/4 blur-[100px]" />
    </div>

    <div className="relative w-full max-w-[400px] z-10">
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <Logo />
      </div>

      {/* Auth Card — flat, no shadow */}
      <Card className="border border-border">
        <CardHeader className="pb-4">
          <h1 className="text-[1.25rem] font-bold text-center text-foreground tracking-[-0.025em]">
            {title}
          </h1>
          {description && (
            <p className="text-center text-sm text-muted-foreground leading-relaxed mt-1">
              {description}
            </p>
          )}
        </CardHeader>
        <CardContent className="pb-5">{children}</CardContent>
        {footer && (
          <CardFooter className="flex justify-center border-t border-border pt-4">
            {footer}
          </CardFooter>
        )}
      </Card>
    </div>
  </div>
);

export default AuthWrapper;

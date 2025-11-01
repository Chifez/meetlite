import { Button } from '@/components/ui/button';
import { env } from '@/config/env';

interface GoogleSignInButtonProps {
  mode: 'login' | 'signup';
}

export function GoogleSignInButton({ mode }: GoogleSignInButtonProps) {
  const buttonText =
    mode === 'login' ? 'Sign in with Google' : 'Sign up with Google';
  const handleGoogleAuth = () => {
    window.location.href = `${env.API_GATEWAY_URL}/api/auth/google`;
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full flex items-center justify-center gap-2"
      onClick={handleGoogleAuth}
    >
      <img src="/google.svg" alt="Google" className="w-5 h-5" />
      {buttonText}
    </Button>
  );
}

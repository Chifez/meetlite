import AuthPage from '@/components/AuthPage';
import SEO from '@/components/SEO';

const Login = () => (
  <>
    <SEO
      title="Login - MeetLite"
      description="Login to your MeetLite account to continue"
    />
    <AuthPage mode="login" />
  </>
);

export default Login;

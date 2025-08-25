import AuthPage from '@/components/auth-page';
import SEO from '@/components/seo';

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

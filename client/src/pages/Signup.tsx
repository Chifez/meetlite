import AuthPage from '@/components/auth-page';
import SEO from '@/components/seo';

const Signup = () => (
  <>
    <SEO
      title="SignUp - MeetLite"
      description="Create an account on MeetLite account to continue"
    />
    <AuthPage mode="signup" />
  </>
);

export default Signup;

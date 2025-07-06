import AuthPage from '@/components/AuthPage';
import SEO from '@/components/SEO';

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

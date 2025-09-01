import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Loader2,
  Users,
  Mail,
  Calendar,
  UserPlus,
  UserX,
  Building2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import api from '@/lib/axios';
import { env } from '@/config/env';
import Logo from '@/components/logo';

interface InvitationData {
  id: string;
  organizationName: string;
  organizationLogo?: string;
  inviterName: string;
  role: string;
  message?: string;
  expiresAt: string;
  createdAt: string;
}

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isValid, setIsValid] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load invitation details
  useEffect(() => {
    const loadInvitation = async () => {
      if (!token) {
        setError('Invalid invitation link');
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(
          `${env.AUTH_API_URL}/invitations/${token}`
        );
        setInvitation(response.data.invitation);
        setIsValid(response.data.isValid);
      } catch (error: any) {
        console.error('Failed to load invitation:', error);
        if (error.response?.status === 404) {
          setError('Invitation not found or has expired');
        } else {
          setError('Failed to load invitation details');
        }
      } finally {
        setLoading(false);
      }
    };

    loadInvitation();
  }, [token]);

  // Handle invitation acceptance
  const handleAccept = async () => {
    if (!isAuthenticated) {
      // Redirect to login with invitation token
      navigate(`/login?invitation=${token}`);
      return;
    }

    setAccepting(true);
    try {
      const response = await api.post(
        `${env.AUTH_API_URL}/invitations/${token}/accept`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      toast.success('Invitation accepted successfully!');

      // If a new token is returned, handle it
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }

      // Redirect to dashboard or organization
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Failed to accept invitation:', error);
      toast.error(
        error.response?.data?.message || 'Failed to accept invitation'
      );
    } finally {
      setAccepting(false);
    }
  };

  // Handle invitation decline
  const handleDecline = async () => {
    if (!isAuthenticated) {
      // Just show a message for anonymous users
      toast.info('Invitation declined');
      navigate('/');
      return;
    }

    setDeclining(true);
    try {
      await api.post(
        `${env.AUTH_API_URL}/invitations/${token}/decline`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      toast.success('Invitation declined');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Failed to decline invitation:', error);
      toast.error(
        error.response?.data?.message || 'Failed to decline invitation'
      );
    } finally {
      setDeclining(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Logo />
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-muted-foreground">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !invitation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Logo />
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-destructive">
              Invalid Invitation
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="w-full"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired invitation
  if (!isValid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Logo />
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle className="text-orange-600 dark:text-orange-400">
              Invitation Expired
            </CardTitle>
            <CardDescription>
              This invitation has expired. Please contact the organization
              administrator for a new invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="w-full"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid invitation
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-2 gap-4">
      <Logo />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardDescription className="text-sm">
            Join <strong>{invitation.organizationName}</strong> and start
            collaborating
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Invitation Details */}
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Organization</p>
                <p className="text-sm text-muted-foreground">
                  {invitation.organizationName}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Invited by</p>
                <p className="text-sm text-muted-foreground">
                  {invitation.inviterName}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <UserPlus className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Role</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {invitation.role}
                </p>
              </div>
            </div>

            {invitation.message && (
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Message</p>
                  <p className="text-sm text-muted-foreground">
                    {invitation.message}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Expires</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(invitation.expiresAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Authentication Notice */}
          {!isAuthenticated && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-primary">
                    Sign in required
                  </p>
                  <p className="text-xs text-primary/70">
                    You'll be redirected to sign in before joining the
                    organization.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleAccept}
              disabled={accepting || declining}
              className="flex-1"
            >
              {accepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Accept Invitation
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleDecline}
              disabled={accepting || declining}
              className="flex-1"
            >
              {declining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Declining...
                </>
              ) : (
                <>
                  <UserX className="mr-2 h-4 w-4" />
                  Decline
                </>
              )}
            </Button>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground">
            <p>
              Not interested?{' '}
              <button
                onClick={() => navigate('/')}
                className="text-primary hover:underline"
              >
                Return to home
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

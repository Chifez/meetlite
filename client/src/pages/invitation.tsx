import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/contexts/workspace-context';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Loader2,
  Users,
  Mail,
  Calendar,
  UserPlus,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import api from '@/lib/axios';
import { extractData } from '@/lib/api-response';
import Logo from '@/components/logo';
import SEO from '@/components/seo';

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
  const { isAuthenticated, handleNewToken } = useAuth();
  const { refreshOrganizations } = useWorkspace();

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
        const response = await api.get(`/api/invitations/${token}`);
        const data = extractData<{
          invitation: InvitationData;
          isValid: boolean;
        }>(response);
        if (data) {
          setInvitation(data.invitation);
          setIsValid(data.isValid);
        }
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
      const currentPath = `/invite/${token}`;
      navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    setAccepting(true);
    try {
      const response = await api.post(`/api/invitations/${token}/accept`, {});
      const data = extractData<{ organization: any; token: string }>(response);

      toast.success('Workspace invitation accepted.');

      if (data.token) {
        handleNewToken(data.token);
      }

      await refreshOrganizations();
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
      toast.info('Invitation declined');
      navigate('/');
      return;
    }

    setDeclining(true);
    try {
      await api.post(`/api/invitations/${token}/decline`, {});
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

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Ambient cobalt radial */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-primary/5 blur-[120px]" />
      </div>
      <div className="relative w-full max-w-[400px] z-10 space-y-6">
        <div className="flex justify-center mb-2">
          <Logo />
        </div>
        {children}
      </div>
    </div>
  );

  // ── LOADING STATE ──────────────────────────────────────────────
  if (loading) {
    return (
      <Wrapper>
        <SEO title="Loading invitation · MeetLite" />
        <div className="border border-border rounded-2xl bg-card p-8 text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
          <div>
            <h1 className="text-[1.125rem] font-bold text-foreground tracking-[-0.02em]">
              Loading invitation details…
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground mt-1">
              Please wait while we verify the security token.
            </p>
          </div>
        </div>
      </Wrapper>
    );
  }

  // ── ERROR STATE ────────────────────────────────────────────────
  if (error || !invitation) {
    return (
      <Wrapper>
        <SEO title="Invalid invitation · MeetLite" />
        <div className="border border-destructive/30 rounded-2xl bg-card p-8 text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-[1.125rem] font-bold text-foreground tracking-[-0.02em]">
              Invalid link
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground mt-1 leading-relaxed">
              {error || 'This invitation has already been used or deleted.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/')} className="w-full">
            Back to home
          </Button>
        </div>
      </Wrapper>
    );
  }

  // ── EXPIRED STATE ──────────────────────────────────────────────
  if (!isValid) {
    return (
      <Wrapper>
        <SEO title="Invitation expired · MeetLite" />
        <div className="border border-border rounded-2xl bg-card p-8 text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
            <Clock className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-[1.125rem] font-bold text-foreground tracking-[-0.02em]">
              Invitation expired
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground mt-1 leading-relaxed">
              This link is no longer valid. Contact the workspace administrator to request a new invitation.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/')} className="w-full">
            Back to home
          </Button>
        </div>
      </Wrapper>
    );
  }

  // ── POPULATED VALID STATE ──────────────────────────────────────
  return (
    <Wrapper>
      <SEO title={`Invite: Join ${invitation.organizationName} · MeetLite`} />
      <div className="border border-border rounded-2xl bg-card p-6 space-y-5">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-[1.125rem] font-bold text-foreground tracking-[-0.025em]">
            Workspace invitation
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground mt-1 leading-relaxed">
            You've been invited to join the team workspace at <strong>{invitation.organizationName}</strong>.
          </p>
        </div>

        {/* Details list */}
        <div className="border border-border rounded-xl bg-muted/40 p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <Users className="w-4 h-4 text-muted-foreground/80 mt-0.5" />
            <div>
              <p className="text-[0.75rem] text-label">Workspace</p>
              <p className="text-[0.8125rem] font-semibold text-foreground">{invitation.organizationName}</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Mail className="w-4 h-4 text-muted-foreground/80 mt-0.5" />
            <div>
              <p className="text-[0.75rem] text-label">Invited by</p>
              <p className="text-[0.8125rem] font-semibold text-foreground">{invitation.inviterName}</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <UserPlus className="w-4 h-4 text-muted-foreground/80 mt-0.5" />
            <div>
              <p className="text-[0.75rem] text-label">Role</p>
              <p className="text-[0.8125rem] font-semibold text-foreground capitalize">{invitation.role}</p>
            </div>
          </div>

          {invitation.message && (
            <div className="flex items-start gap-2.5 border-t border-border pt-2.5 mt-1">
              <Sparkles className="w-4 h-4 text-primary mt-0.5" />
              <div>
                <p className="text-[0.75rem] text-label">Personal message</p>
                <p className="text-[0.8125rem] italic text-muted-foreground mt-0.5 leading-relaxed">
                  "{invitation.message}"
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 border-t border-border pt-2.5 mt-1">
            <Calendar className="w-4 h-4 text-muted-foreground/80 mt-0.5" />
            <div>
              <p className="text-[0.75rem] text-label">Link expires</p>
              <p className="text-[0.8125rem] text-muted-foreground font-medium">
                {new Date(invitation.expiresAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Authentication Notice if not signed in */}
        {!isAuthenticated && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-primary/20 bg-primary/3">
            <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[0.8125rem] font-semibold text-foreground">
                Account required
              </p>
              <p className="text-[0.75rem] text-muted-foreground mt-0.5 leading-normal">
                You will be redirected to sign in or create an account before accepting this invitation.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDecline}
            disabled={accepting || declining}
            className="flex-1 rounded-xl"
          >
            {declining ? 'Declining...' : 'Decline'}
          </Button>

          <Button
            id="accept-invite-btn"
            onClick={handleAccept}
            disabled={accepting || declining}
            className="flex-1 rounded-xl font-semibold gap-1.5"
          >
            {accepting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Accept
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>

        {/* Footer Link */}
        <div className="text-center">
          <p className="text-[0.75rem] text-muted-foreground">
            Not interested?{' '}
            <button
              onClick={() => navigate('/')}
              className="text-primary font-semibold hover:underline"
            >
              Return to home
            </button>
          </p>
        </div>
      </div>
    </Wrapper>
  );
}

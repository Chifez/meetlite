// User utility functions

export function getUserInitials(
  user: { name?: string; email?: string } | undefined | null
): string {
  if (user?.name && user.name.trim().length > 0) {
    return user.name.trim().slice(0, 2).toUpperCase();
  }
  if (user?.email) {
    return user.email.split('@')[0].slice(0, 2).toUpperCase();
  }
  return 'ML';
}

export function getDisplayName(
  user:
    | { name?: string; email?: string; useNameInMeetings?: boolean }
    | undefined
    | null
): string {
  if (!user) return 'User';

  // If user has enabled "use name in meetings" and has a name, show the name
  if (user.useNameInMeetings && user.name && user.name.trim().length > 0) {
    return user.name.trim();
  }

  // Otherwise, show email (without @domain)
  if (user.email) {
    return user.email.split('@')[0];
  }

  return 'User';
}

export function createUserFromProfile(profile: any) {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    useNameInMeetings: profile.useNameInMeetings,
  };
}

export function createUserFromToken(decodedToken: any) {
  return {
    id: decodedToken.userId,
    email: decodedToken.email,
    name: decodedToken.name,
    useNameInMeetings: decodedToken.useNameInMeetings,
  };
}

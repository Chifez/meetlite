export default function WelcomeHeader({ user }: { user?: { email?: string } }) {
  return (
    <div className="text-center space-y-4">
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
        <span className="text-gray-900 dark:text-gray-100">Welcome,</span>{' '}
        <span className="bg-primary bg-clip-text text-transparent">
          {user?.email?.split('@')[0] || 'User'}
        </span>
      </h1>
      <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
        Ready to connect and collaborate? Start a meeting, join your team, or
        schedule for later.
      </p>
    </div>
  );
}

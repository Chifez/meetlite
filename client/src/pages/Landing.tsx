import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SEO from '@/components/SEO';
import { CalendarDays, Mail, Lock, Users } from 'lucide-react';

const features = [
  {
    icon: <CalendarDays className="h-8 w-8 text-blue-600" />,
    title: 'Schedule Meetings',
    description:
      'Plan ahead and organize meetings with ease. Set the time, duration, and agenda for your team or friends.',
  },
  {
    icon: <Mail className="h-8 w-8 text-blue-600" />,
    title: 'Send Invites',
    description:
      'Invite participants by email. Everyone gets a unique, secure join link and reminders.',
  },
  {
    icon: <Lock className="h-8 w-8 text-blue-600" />,
    title: 'Privacy Controls',
    description:
      'Make meetings public or private. Admit guests yourself for private sessions, or let anyone join public rooms.',
  },
  {
    icon: <Users className="h-8 w-8 text-blue-600" />,
    title: 'Real-Time Collaboration',
    description:
      'Enjoy seamless video, audio, and chat. All participants join a virtual lobby before entering the meeting.',
  },
];

const Landing = () => {
  return (
    <>
      <SEO
        title="Minimeet - Effortless Meetings"
        description="Schedule, invite, and join meetings with privacy and ease."
      />
      <main className="min-h-screen bg-page flex flex-col">
        {/* Hero Section */}
        <section className="flex-1 flex flex-col justify-center items-center text-center px-4 py-24">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-blue-700 to-blue-400 text-transparent bg-clip-text">
            Effortless Meetings, <span className="text-blue-600">Anywhere</span>
          </h1>
          <p className="text-lg md:text-2xl text-gray-600 mb-8 max-w-2xl mx-auto">
            MeetLite lets you schedule, invite, and join meetings with privacy
            and simplicity. No downloads, no hassle—just seamless collaboration.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button size="lg" className="px-8 py-4 text-lg font-semibold">
                Get Started
              </Button>
            </Link>
            <Link to="/login">
              <Button
                size="lg"
                variant="outline"
                className="px-8 py-4 text-lg font-semibold border-blue-600 text-blue-700 hover:bg-blue-50"
              >
                Login
              </Button>
            </Link>
          </div>
        </section>
        {/* Features Section */}
        <section className="py-16 bg-white border-t">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-10">
              Why MeetLite?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="bg-blue-50 rounded-xl shadow-sm p-6 flex flex-col items-center text-center"
                >
                  {feature.icon}
                  <h3 className="mt-4 text-xl font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        {/* Footer */}
        <footer className="py-8 text-center text-gray-400 text-sm">
          &copy; {new Date().getFullYear()} MeetLite. All rights reserved.
        </footer>
      </main>
    </>
  );
};

export default Landing;

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Users, GraduationCap, Briefcase, Home, Loader2, Video } from 'lucide-react';
import SEO from '@/components/seo';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/use-auth';

const onboardingSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  useCase: z.enum(['personal', 'education', 'business', 'team']),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

const Onboarding = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { validateToken } = useAuth();

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: '',
      useCase: 'personal',
    },
  });

  const onSubmit = async (data: OnboardingFormValues) => {
    setIsLoading(true);
    try {
      await api.post('/api/auth/onboarding', data);
      await validateToken();
      toast.success('Welcome to MeetLite!');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const useCaseOptions = [
    {
      value: 'personal',
      label: 'Personal use',
      icon: Home,
      description: 'Individual calls and meetings',
    },
    {
      value: 'team',
      label: 'Team collaboration',
      icon: Users,
      description: 'Project teams and workspaces',
    },
    {
      value: 'education',
      label: 'Education',
      icon: GraduationCap,
      description: 'Virtual classrooms and learning',
    },
    {
      value: 'business',
      label: 'Business',
      icon: Briefcase,
      description: 'Enterprise calls and presentations',
    },
  ];

  return (
    <>
      <SEO
        title="Welcome to MeetLite"
        description="Let's get your account set up."
      />
      
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-[-20%] left-[20%] w-[700px] h-[700px] rounded-full bg-primary/5 blur-[140px] pointer-events-none" aria-hidden="true" />
        
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary">
              <Video className="w-6 h-6" />
            </div>
            <h1 className="text-[1.5rem] font-bold tracking-tight text-foreground">
              Welcome to MeetLite
            </h1>
            <p className="text-muted-foreground mt-2 text-[0.875rem]">
              Let's personalize your experience.
            </p>
          </div>

          <div className="bg-card border border-border/50 shadow-sm rounded-2xl p-6 md:p-8">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground text-[0.875rem]">Full name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter your name" 
                          className="bg-background border-border/50 focus-visible:ring-primary/20 h-11"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="useCase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground text-[0.875rem]">Primary use case</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="grid grid-cols-2 gap-3 mt-1.5"
                        >
                          {useCaseOptions.map((option) => {
                            const Icon = option.icon;
                            const isChecked = field.value === option.value;
                            return (
                              <FormItem key={option.value}>
                                <FormControl>
                                  <RadioGroupItem
                                    value={option.value}
                                    id={option.value}
                                    className="peer sr-only"
                                  />
                                </FormControl>
                                <FormLabel
                                  htmlFor={option.value}
                                  className={`flex flex-col items-center justify-between rounded-xl border p-4 text-center cursor-pointer transition-all duration-200 ${
                                    isChecked
                                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                      : 'border-border/60 bg-card hover:border-primary/40 hover:bg-accent/30'
                                  }`}
                                >
                                  <Icon className={`mb-2.5 h-5 w-5 ${isChecked ? 'text-primary' : 'text-muted-foreground'}`} />
                                  <div>
                                    <div className="font-semibold text-[0.875rem] text-foreground tracking-[-0.01em]">{option.label}</div>
                                    <div className="text-[0.6875rem] text-muted-foreground mt-1 leading-normal">
                                      {option.description}
                                    </div>
                                  </div>
                                </FormLabel>
                              </FormItem>
                            );
                          })}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-2">
                  <Button
                    type="submit"
                    className="w-full rounded-xl h-12"
                    size="lg"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      'Get Started'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </>
  );
};

export default Onboarding;

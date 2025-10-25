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
import { Checkbox } from '@/components/ui/checkbox';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Users, GraduationCap, Briefcase, Home } from 'lucide-react';
import SEO from '@/components/seo';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/use-auth';

const onboardingSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    useCase: z.enum(['personal', 'education', 'business', 'team']),
    teamSize: z.enum(['1-5', '6-20', '21-50', '50+']).optional(),
    primaryUse: z
      .array(z.string())
      .min(1, 'Please select at least one feature'),
    experience: z.enum(['beginner', 'intermediate', 'advanced']),
  })
  .refine(
    (data) => {
      if (data.useCase === 'team') {
        return !!data.teamSize;
      }
      return true;
    },
    {
      message: 'Team size is required when using MeetLite for a team',
      path: ['teamSize'],
    }
  );

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { validateToken } = useAuth();

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    mode: 'onSubmit',
    shouldUnregister: false,
    defaultValues: {
      name: '',
      useCase: 'personal',
      teamSize: undefined,
      primaryUse: [],
      experience: 'beginner',
    },
  });

  const onSubmit = async (data: OnboardingFormValues) => {
    setIsLoading(true);
    try {
      // Post onboarding data to backend
      await api.post('/api/auth/onboarding', data);

      // Refresh profile/token-backed state
      await validateToken();

      toast.success('Welcome to MeetLite!');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    {
      id: 1,
      title: 'Tell us about yourself',
      description: 'Let us personalize your experience',
    },
    {
      id: 2,
      title: 'How will you use MeetLite?',
      description: 'Help us understand your needs',
    },
    {
      id: 3,
      title: 'Almost done!',
      description: 'Final details to get you started',
    },
  ];

  const useCaseOptions = [
    {
      value: 'personal',
      label: 'Personal Use',
      icon: Home,
      description: 'Individual meetings and calls',
    },
    {
      value: 'education',
      label: 'Education',
      icon: GraduationCap,
      description: 'Schools, universities, training',
    },
    {
      value: 'business',
      label: 'Business',
      icon: Briefcase,
      description: 'Corporate meetings and presentations',
    },
    {
      value: 'team',
      label: 'Team Collaboration',
      icon: Users,
      description: 'Project teams and departments',
    },
  ];

  const primaryUseOptions = [
    'Video Meetings',
    'Screen Sharing',
    'File Sharing',
    'Whiteboarding',
    'Chat & Messaging',
    'Recording',
    'Calendar Integration',
    'All',
  ];

  const experienceOptions = [
    {
      value: 'beginner',
      label: 'Beginner',
      description: 'New to video conferencing',
    },
    {
      value: 'intermediate',
      label: 'Intermediate',
      description: 'Some experience with online meetings',
    },
    {
      value: 'advanced',
      label: 'Advanced',
      description: 'Experienced user, want advanced features',
    },
  ];

  const nextStep = async () => {
    const stepFields: Record<number, (keyof OnboardingFormValues)[]> = {
      1: ['name', 'useCase'],
      2: ['teamSize', 'primaryUse'],
      3: ['experience'],
    };

    const isValid = await form.trigger(stepFields[currentStep]);
    if (isValid) {
      if (currentStep < steps.length) {
        setCurrentStep((p) => p + 1);
      } else {
        const formData = form.getValues();
        await onSubmit(formData);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep((p) => p - 1);
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <FormField
        key="name"
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Full Name</FormLabel>
            <FormControl>
              <Input placeholder="Enter your full name" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        key="useCase"
        control={form.control}
        name="useCase"
        render={({ field }) => (
          <FormItem>
            <FormLabel>What will you primarily use MeetLite for?</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={field.onChange}
                value={field.value ?? ''}
                className="grid grid-cols-2 gap-4 mt-2"
              >
                {useCaseOptions.map((option) => {
                  const Icon = option.icon;
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
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                      >
                        <Icon className="mb-3 h-6 w-6" />
                        <div className="text-center">
                          <div className="font-semibold">{option.label}</div>
                          <div className="text-xs text-muted-foreground">
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
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      {form.watch('useCase') === 'team' && (
        <FormField
          key="teamSize"
          control={form.control}
          name="teamSize"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team Size</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value ?? ''}
                  className="grid grid-cols-2 gap-4"
                >
                  {['1-5', '6-20', '21-50', '50+'].map((size) => (
                    <FormItem key={size}>
                      <FormControl>
                        <RadioGroupItem
                          value={size}
                          id={size}
                          className="peer sr-only"
                        />
                      </FormControl>
                      <FormLabel
                        htmlFor={size}
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                      >
                        <div className="text-center">
                          <div className="font-semibold">{size} people</div>
                        </div>
                      </FormLabel>
                    </FormItem>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Single FormField for primaryUse (do NOT create a FormField per checkbox) */}
      <FormField
        key="primaryUse"
        control={form.control}
        name="primaryUse"
        render={({ field }) => (
          <FormItem>
            <FormLabel>What features are most important to you?</FormLabel>
            <FormControl>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {primaryUseOptions.map((option) => {
                  const checked = (field.value ?? []).includes(option);
                  return (
                    <div
                      key={option}
                      className="flex flex-row items-start space-x-3 space-y-0"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(checked) => {
                          const isChecked = checked === true;
                          const current = Array.isArray(field.value)
                            ? field.value
                            : [];
                          if (isChecked) {
                            field.onChange([...current, option]);
                          } else {
                            field.onChange(current.filter((v) => v !== option));
                          }
                        }}
                      />
                      <FormLabel className="text-sm font-normal">
                        {option}
                      </FormLabel>
                    </div>
                  );
                })}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <FormField
        key="experience"
        control={form.control}
        name="experience"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              What's your experience level with video conferencing?
            </FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={field.onChange}
                value={field.value ?? ''}
                className="space-y-3"
              >
                {experienceOptions.map((option) => (
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
                      className="flex flex-col items-start space-y-1 rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <div className="font-semibold">{option.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {option.description}
                      </div>
                    </FormLabel>
                  </FormItem>
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return renderStep1();
    }
  };

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <SEO
        title="Welcome to MeetLite"
        description="Complete your profile setup"
      />
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              Step {currentStep} of {steps.length}
            </span>
            <span className="text-xs font-medium">
              {Math.round((currentStep / steps.length) * 100)}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
          <div className="text-center mb-4">
            <h1 className="text-xl font-semibold text-foreground">
              {steps[currentStep - 1].title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {steps[currentStep - 1].description}
            </p>
          </div>

          <Form {...form}>
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              {renderCurrentStep()}

              <div className="flex gap-3">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={prevStep}
                    className="flex-1"
                  >
                    Previous
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={nextStep}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading
                    ? 'Setting up...'
                    : currentStep === steps.length
                    ? 'Complete Setup'
                    : 'Next'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;

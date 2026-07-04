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
import { Users, GraduationCap, Briefcase, Home, Loader2, ArrowLeft } from 'lucide-react';
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
      .min(1, 'Select at least one feature'),
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

  const steps = [
    {
      id: 1,
      title: 'Tell us about yourself',
      description: 'Let us personalize your meeting experience.',
    },
    {
      id: 2,
      title: 'How will you use MeetLite?',
      description: 'Help us understand your video collaboration needs.',
    },
    {
      id: 3,
      title: 'Almost done!',
      description: 'A few final details to get you started.',
    },
  ];

  const useCaseOptions = [
    {
      value: 'personal',
      label: 'Personal use',
      icon: Home,
      description: 'Individual calls and meetings',
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
    {
      value: 'team',
      label: 'Team collaboration',
      icon: Users,
      description: 'Project teams and workspaces',
    },
  ];

  const primaryUseOptions = [
    'Video meetings',
    'Screen sharing',
    'File sharing',
    'Whiteboarding',
    'Chat & messaging',
    'Recordings',
    'Calendar integrations',
    'AI transcripts',
  ];

  const experienceOptions = [
    {
      value: 'beginner',
      label: 'Beginner',
      description: 'New to professional video conferencing tools.',
    },
    {
      value: 'intermediate',
      label: 'Intermediate',
      description: 'Comfortable with standard web conferencing apps.',
    },
    {
      value: 'advanced',
      label: 'Advanced',
      description: 'Require advanced sharing, control, and sync features.',
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
            <FormLabel>Full name</FormLabel>
            <FormControl>
              <Input placeholder="Enter your name" {...field} />
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
            <FormLabel>Primary use case</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={field.onChange}
                value={field.value ?? ''}
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
                        className={`flex flex-col items-center justify-between rounded-xl border p-4 text-center cursor-pointer transition-colors duration-150 ${
                          isChecked
                            ? 'border-primary bg-primary/3'
                            : 'border-border bg-card hover:border-primary/45 hover:bg-accent/40'
                        }`}
                      >
                        <Icon className={`mb-2.5 h-5 w-5 ${isChecked ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div>
                          <div className="font-semibold text-sm text-foreground tracking-[-0.01em]">{option.label}</div>
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
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      {form.watch('useCase') === 'team' && (
        <FormField
          key="teamSize"
          control={form.control}
          name="teamSize"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team size</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value ?? ''}
                  className="grid grid-cols-2 gap-3 mt-1.5"
                >
                  {['1-5', '6-20', '21-50', '50+'].map((size) => {
                    const isChecked = field.value === size;
                    return (
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
                          className={`flex flex-col items-center justify-center rounded-xl border p-3.5 text-center cursor-pointer transition-colors duration-150 ${
                            isChecked
                              ? 'border-primary bg-primary/3'
                              : 'border-border bg-card hover:border-primary/45 hover:bg-accent/40'
                          }`}
                        >
                          <div className="font-semibold text-sm text-foreground tracking-[-0.01em]">{size} people</div>
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
      )}

      <FormField
        key="primaryUse"
        control={form.control}
        name="primaryUse"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Which features are most important?</FormLabel>
            <FormControl>
              <div className="grid grid-cols-2 gap-3 mt-1.5">
                {primaryUseOptions.map((option) => {
                  const checked = (field.value ?? []).includes(option);
                  return (
                    <div
                      key={option}
                      className="flex items-center space-x-2.5 rounded-xl border border-border bg-card p-3 hover:border-primary/30 transition-colors"
                    >
                      <Checkbox
                        id={`use-${option}`}
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
                      <FormLabel
                        htmlFor={`use-${option}`}
                        className="text-[0.8125rem] text-foreground font-medium cursor-pointer"
                      >
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
              What is your experience level?
            </FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={field.onChange}
                value={field.value ?? ''}
                className="space-y-2.5 mt-1.5"
              >
                {experienceOptions.map((option) => {
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
                        className={`flex flex-col items-start rounded-xl border p-4 cursor-pointer transition-colors duration-150 ${
                          isChecked
                            ? 'border-primary bg-primary/3'
                            : 'border-border bg-card hover:border-primary/45 hover:bg-accent/40'
                        }`}
                      >
                        <div className="font-semibold text-sm text-foreground tracking-[-0.01em]">{option.label}</div>
                        <div className="text-[0.75rem] text-muted-foreground mt-0.5 leading-normal">
                          {option.description}
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <SEO
        title="Welcome to MeetLite"
        description="Configure your meeting preferences"
      />
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-[440px] z-10 space-y-6">
        {/* Step indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[0.75rem] font-semibold text-muted-foreground tracking-wide uppercase">
            <span>Step {currentStep} of {steps.length}</span>
            <span>{Math.round((currentStep / steps.length) * 100)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1">
            <div
              className="bg-primary h-1 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="text-center mb-5">
            <h1 className="text-[1.125rem] font-bold text-foreground tracking-[-0.02em]">
              {steps[currentStep - 1].title}
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground leading-relaxed mt-1">
              {steps[currentStep - 1].description}
            </p>
          </div>

          <Form {...form}>
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              {renderCurrentStep()}

              <div className="flex gap-2">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    className="flex-1 rounded-xl"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                )}
                <Button
                  id="onboarding-next-btn"
                  type="button"
                  onClick={nextStep}
                  disabled={isLoading}
                  className="flex-1 rounded-xl font-semibold"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : currentStep === steps.length ? (
                    'Complete setup'
                  ) : (
                    'Continue'
                  )}
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

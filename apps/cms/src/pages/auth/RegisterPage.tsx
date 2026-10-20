import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router';
import { registerSchema, type AuthResponseDto, type RegisterInput } from '@qr-menu/shared';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { api, ApiError, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AuthLayout, FormError } from './AuthLayout';

export function RegisterPage() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', restaurantName: '' },
  });

  if (status === 'authenticated' && !form.formState.isSubmitSuccessful) return <Navigate to="/" replace />;

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const session = await api<AuthResponseDto>('/api/auth/register', { method: 'POST', body: values, auth: false });
      signIn(session, true);
      const restaurantId = session.memberships[0]?.restaurant.id;
      navigate(restaurantId ? `/r/${restaurantId}/menu` : '/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') {
        form.setError('email', { message: 'An account with this email already exists' });
        return;
      }
      setError(errorMessage(err, 'Could not create the account'));
    }
  });

  const controlSize = isMobile ? 'lg' : 'md';
  const errors = form.formState.errors;

  return (
    <AuthLayout
      title="Create a restaurant"
      subtitle="Your menu, QR codes and analytics in one place. 14-day free trial."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium no-underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError message={error} />
        <Field label="Your name" htmlFor="reg-name" error={errors.name?.message}>
          <Input id="reg-name" autoComplete="name" controlSize={controlSize} invalid={Boolean(errors.name)} data-autofocus {...form.register('name')} />
        </Field>
        <Field label="Email" htmlFor="reg-email" error={errors.email?.message}>
          <Input id="reg-email" type="email" autoComplete="email" inputMode="email" controlSize={controlSize} invalid={Boolean(errors.email)} {...form.register('email')} />
        </Field>
        <Field label="Password" htmlFor="reg-password" hint="At least 8 characters" error={errors.password?.message}>
          <Input id="reg-password" type="password" autoComplete="new-password" controlSize={controlSize} invalid={Boolean(errors.password)} {...form.register('password')} />
        </Field>
        <Field label="Restaurant name" htmlFor="reg-restaurant" hint="Becomes your menu address, e.g. kafeterija.salveta.menu" error={errors.restaurantName?.message}>
          <Input id="reg-restaurant" autoComplete="organization" controlSize={controlSize} invalid={Boolean(errors.restaurantName)} {...form.register('restaurantName')} />
        </Field>
        <Button type="submit" variant="primary" size={isMobile ? 'mobile' : 'lg'} loading={form.formState.isSubmitting} block className="mt-1">
          Create restaurant
        </Button>
      </form>
    </AuthLayout>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@qr-menu/shared';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { api, errorMessage } from '../../lib/api';
import { AuthLayout, FormError } from './AuthLayout';

export function ForgotPasswordPage() {
  const isMobile = useIsMobile();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api('/api/auth/forgot-password', { method: 'POST', body: values, auth: false });
      setSentTo(values.email);
    } catch (err) {
      setError(errorMessage(err, 'Could not send the email'));
    }
  });

  if (sentTo) {
    return (
      <AuthLayout
        title="Check your inbox"
        subtitle={<>If an account exists for <strong className="text-ink">{sentTo}</strong>, we sent a link to reset your password. It expires in one hour.</>}
      >
        <Link to="/login" className="font-medium no-underline">
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we will send you a reset link."
      footer={
        <Link to="/login" className="font-medium no-underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError message={error} />
        <Field label="Email" htmlFor="forgot-email" error={form.formState.errors.email?.message}>
          <Input id="forgot-email" type="email" autoComplete="email" inputMode="email" controlSize={isMobile ? 'lg' : 'md'} invalid={Boolean(form.formState.errors.email)} data-autofocus {...form.register('email')} />
        </Field>
        <Button type="submit" variant="primary" size={isMobile ? 'mobile' : 'lg'} loading={form.formState.isSubmitting} block>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}

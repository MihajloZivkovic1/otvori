import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { passwordSchema, type AuthResponseDto } from '@qr-menu/shared';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AuthLayout, FormError } from './AuthLayout';

const formSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });
type FormValues = z.infer<typeof formSchema>;

/** /auth/reset?token=… */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { status, signIn } = useAuth();
  const isMobile = useIsMobile();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { password: '', confirm: '' } });

  if (status === 'authenticated') return <Navigate to="/" replace />;

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const session = await api<AuthResponseDto>('/api/auth/reset-password', {
        method: 'POST',
        body: { token, password: values.password },
        auth: false,
      });
      signIn(session, true);
    } catch (err) {
      setError(errorMessage(err, 'This link is invalid or has expired.'));
    }
  });

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="This signs you out of every other device."
      footer={
        <Link to="/login" className="font-medium no-underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError message={!token ? 'This link is missing its token.' : error} />
        <Field label="New password" htmlFor="reset-password" hint="At least 8 characters" error={form.formState.errors.password?.message}>
          <Input id="reset-password" type="password" autoComplete="new-password" controlSize={isMobile ? 'lg' : 'md'} invalid={Boolean(form.formState.errors.password)} data-autofocus {...form.register('password')} />
        </Field>
        <Field label="Repeat password" htmlFor="reset-confirm" error={form.formState.errors.confirm?.message}>
          <Input id="reset-confirm" type="password" autoComplete="new-password" controlSize={isMobile ? 'lg' : 'md'} invalid={Boolean(form.formState.errors.confirm)} {...form.register('confirm')} />
        </Field>
        <Button type="submit" variant="primary" size={isMobile ? 'mobile' : 'lg'} loading={form.formState.isSubmitting} disabled={!token} block>
          Set password
        </Button>
      </form>
    </AuthLayout>
  );
}

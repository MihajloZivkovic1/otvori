import { describe, expect, it, vi } from 'vitest';
import { resendProvider } from '../src/utils/mailer.js';

describe('resend mail provider', () => {
  it('posts the message to the Resend API with the bearer key', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 }));
    const provider = resendProvider('re_test_key', 'otvori <zdravo@otvori.menu>', fetchMock as unknown as typeof fetch);
    await provider.send({ to: 'ana@example.com', subject: 'Hi', text: 'Hello' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_key');
    expect(JSON.parse(String(init.body))).toEqual({
      from: 'otvori <zdravo@otvori.menu>',
      to: ['ana@example.com'],
      subject: 'Hi',
      text: 'Hello',
    });
  });

  it('throws when Resend rejects the message', async () => {
    const fetchMock = vi.fn(async () => new Response('{"message":"invalid api key"}', { status: 401 }));
    const provider = resendProvider('bad', 'x <x@x.x>', fetchMock as unknown as typeof fetch);
    await expect(provider.send({ to: 'a@b.c', subject: 's', text: 't' })).rejects.toThrow(/401/);
  });
});

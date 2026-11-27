import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  isTransientSessionError,
  queryClient,
  request,
  sessionQuery,
} from '../apps/web/src/shared/lib/api';

afterEach(() => {
  queryClient.clear();
  vi.unstubAllGlobals();
});

describe('Session refresh recovery', () => {
  it('keeps a forecast-specific timeout when retrying a refreshed session', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    try {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(new Response('{}', { status: 401 }))
          .mockResolvedValueOnce(new Response('{}', { status: 200 }))
          .mockResolvedValueOnce(new Response('{"products":[]}', { status: 200 })),
      );
      await expect(
        request('/sellers/shop/ai/seasonal-forecast', {}, true, 'POST', undefined, 'json', 30_000),
      ).resolves.toEqual({ products: [] });
      expect(timeout.mock.calls).toEqual([[30_000], [15_000], [30_000]]);
    } finally {
      timeout.mockRestore();
    }
  });

  it.each([500, 502, 503, 504])(
    'preserves refresh HTTP %i instead of reporting 401',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(new Response('{}', { status: 401 }))
          .mockResolvedValueOnce(new Response('{}', { status })),
      );
      await expect(request('/auth/me')).rejects.toMatchObject({
        status,
        code: 'refresh_unavailable',
      });
    },
  );

  it.each([new TypeError('Failed to fetch'), new DOMException('Timeout', 'TimeoutError')])(
    'preserves a temporary refresh failure and allows the next request to recover',
    async (error) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response('{}', { status: 401 }))
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(new Response('{}', { status: 401 }))
        .mockResolvedValueOnce(new Response('{}', { status: 200 }))
        .mockResolvedValueOnce(new Response('{"role":"ADMIN"}', { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);
      await expect(request('/auth/me')).rejects.toBe(error);
      expect(isTransientSessionError(error)).toBe(true);
      await expect(request('/auth/me')).resolves.toEqual({ role: 'ADMIN' });
      expect(fetchMock).toHaveBeenCalledTimes(5);
    },
  );

  it('keeps a rejected refresh as an authentication failure without retrying', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response('{}', { status: 401 })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(queryClient.fetchQuery(sessionQuery)).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(isTransientSessionError(new ApiError(401, 'expired'))).toBe(false);
    expect(isTransientSessionError(new ApiError(403, 'forbidden'))).toBe(false);
  });

  it('limits transient retries while keeping the last verified session', async () => {
    queryClient.setQueryData(['session'], { role: 'SELLER' });
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response('{}', { status: 503 })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      queryClient.fetchQuery({ ...sessionQuery, retryDelay: 0, staleTime: 0 }),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const result = queryClient.getQueryState(['session']);
    expect(result?.status).toBe('error');
    expect(result?.data).toMatchObject({ role: 'SELLER' });
    expect(isTransientSessionError(result?.error)).toBe(true);
  });

  it('shares one refresh across concurrent requests', async () => {
    let meCalls = 0;
    let completeRefresh!: (response: Response) => void;
    const refreshed = new Promise<Response>((resolve) => {
      completeRefresh = resolve;
    });
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/auth/refresh') return refreshed;
      meCalls++;
      return Promise.resolve(
        new Response(meCalls <= 2 ? '{}' : '{"role":"ADMIN"}', {
          status: meCalls <= 2 ? 401 : 200,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const requests = [request('/auth/me'), request('/auth/me')];
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    completeRefresh(new Response('{}', { status: 200 }));
    await expect(Promise.all(requests)).resolves.toEqual([{ role: 'ADMIN' }, { role: 'ADMIN' }]);
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/auth/refresh')).toHaveLength(1);
  });
});

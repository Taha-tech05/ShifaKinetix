import { ApiClient } from '../src/storage/apiClient';
import { OrderedSyncEvent } from '../src/storage/intakeStore';
import { CONTENT_VERSION } from '../src/gate/evaluate';

const event: OrderedSyncEvent = { kind: 'answer', intakeId: 'demo', idempotencyKey: 'demo:1', contentVersion: CONTENT_VERSION,
  answer: { questionId: 'injury', type: 'yesno', value: false, state: 'answered' } };
const ack = { status: 'stored', intakeId: 'demo', idempotencyKey: 'demo:1', contentVersion: CONTENT_VERSION,
  eventSeq: 1, answerValid: true, gate: { verdict: 'SAFE', firedRules: [] } };
function client(body: unknown, status = 200) {
  const request = jest.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  return { api: new ApiClient('https://demo.example', 'test-token', request), request };
}
test('sends bearer credentials without redirects and only accepts the matching durable acknowledgement', async () => {
  const { api, request } = client(ack); await api.send(event);
  expect(request.mock.calls[0][0]).toBe('https://demo.example/sync/answers');
  expect(request.mock.calls[0][1]).toMatchObject({ redirect: 'error', method: 'POST', headers: { Authorization: 'Bearer test-token' } });
  expect(JSON.parse(request.mock.calls[0][1].body)).not.toHaveProperty('kind');
});
test.each([{ intakeId: 'other' }, { idempotencyKey: 'other' }, { contentVersion: 'old' }, { eventSeq: 0 },
  { answerValid: false }, { gate: { verdict: 'SAFE', firedRules: [{}] } }, { status: 'pending' }])('invalid acknowledgement retains event: %p', async (change) => {
  await expect(client({ ...ack, ...change }).api.send(event)).rejects.toThrow('did not confirm');
});
test.each([[401, 'expired'], [403, 'not allowed'], [409, 'version or key'], [503, '503']] as const)('HTTP %i is an actionable failure', async (status, message) => {
  await expect(client({ detail: 'secret server internals' }, status).api.send(event)).rejects.toThrow(message);
});
test('patient identity cannot load a doctor report', async () => {
  const { api, request } = client({ id: 'patient', role: 'patient' });
  await expect(api.doctorReport('demo')).rejects.toThrow('Doctor access');
  expect(request).toHaveBeenCalledTimes(1);
});
test.each(['http://public.example', 'http://192.168.evil.example', 'https://user:password@demo.example',
  'https://demo.example?token=secret', 'https://demo.example#secret'])('rejects unsafe API address %s', (url) => {
  expect(() => new ApiClient(url, 'token', fetch, true)).toThrow();
});
test('local HTTP needs an explicit development opt-in', () => {
  expect(() => new ApiClient('http://127.0.0.1:8000', 'token')).toThrow();
  expect(new ApiClient('http://127.0.0.1:8000', 'token', fetch, true).baseUrl).toBe('http://127.0.0.1:8000');
});
test('deadline aborts a stalled request', async () => {
  const request = jest.fn((_url, options) => new Promise<Response>((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  await expect(new ApiClient('https://demo.example', 'token', request, false, 5).identity()).rejects.toThrow('aborted');
});

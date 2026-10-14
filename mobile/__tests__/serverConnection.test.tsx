import { act, create } from 'react-test-renderer';
import ServerConnection from '../src/app/server';
import { useServer } from '../src/server/connection';
import { useSettings } from '../src/store/settings';
import { ApiClient } from '../src/storage/apiClient';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
let request: jest.SpyInstance;
let tree: ReturnType<typeof create>;
const text = () => JSON.stringify(tree.toJSON());
async function press(label: string) {
  const b = tree.root.findAll((n) => (n.type as unknown) === 'Pressable' && n.props.accessibilityLabel === label)[0];
  expect(b).toBeDefined();
  await act(async () => { b.props.onPress(); });
}
async function enter(label: string, value: string) {
  const i = tree.root.findAll((n) => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === label)[0];
  await act(async () => { i.props.onChangeText(value); });
}
/** Answers like the real server: /health, /auth/dev-login (role as requested) and /auth/me (role fixed per account). */
function server(accountRole: 'patient' | 'doctor' = 'patient', devLogin = 200) {
  request.mockImplementation(async (url: string) => {
    if (url.endsWith('/health')) return json({ status: 'ok' });
    if (url.endsWith('/auth/dev-login')) return devLogin === 200
      ? json({ token: 't-1', tokenType: 'Bearer', user: { id: 'demo', role: accountRole } }) : json({ detail: {} }, devLogin);
    if (url.endsWith('/auth/me')) return json({ id: 'demo', role: accountRole });
    return json({}, 404);
  });
}
beforeEach(async () => {
  request = jest.spyOn(globalThis, 'fetch');
  useServer.getState().disconnect();
  useServer.setState({ baseUrl: '' });
  await act(async () => { tree = create(<ServerConnection />); });
  await enter('API address', 'https://demo.example');
});
afterEach(() => { act(() => tree.unmount()); request.mockRestore(); useServer.getState().disconnect(); });

test('shows the demo notice and starts disconnected', () => {
  expect(text()).toContain('Demo only, not for real patients.');
  expect(text()).toContain('Not connected');
  expect(text()).not.toContain('Connected as');
});
test('patient sign-in shows the identity the server confirmed', async () => {
  server('patient');
  await press('Sign in as Patient');
  expect(text()).toContain('demo (patient), confirmed by the server');
  expect(text()).toContain('Server report');
  expect(text()).not.toContain('Latest cases');
});
test('asking for the doctor role does not make a patient account a doctor', async () => {
  server('patient'); // the account is a patient whatever the button asked for
  await press('Sign in as Doctor');
  expect(useServer.getState().identity?.role).toBe('patient');
  expect(text()).not.toContain('Latest cases');
});
test('the app role setting has no effect on the role', async () => {
  useSettings.setState({ signedIn: true });
  server('patient');
  await press('Sign in as Patient');
  expect(useServer.getState().identity?.role).toBe('patient');
});
test('a doctor account gets the doctor entry only', async () => {
  server('doctor');
  await press('Sign in as Doctor');
  expect(text()).toContain('Latest cases');
  expect(text()).not.toContain('Server report');
});
test.each([[404, 'switched off'], [409, 'different role'], [500, 'failed (500)']] as const)('dev sign-in HTTP %i is shown as a failure, not a connection', async (status, words) => {
  server('patient', status);
  await press('Sign in as Patient');
  expect(text()).toContain(words);
  expect(useServer.getState().status).toBe('disconnected');
  expect(text()).not.toContain('Connected');
});
test('an unreachable server is a failure', async () => {
  request.mockRejectedValue(new Error('Network request failed'));
  await press('Sign in as Patient');
  expect(useServer.getState().status).toBe('disconnected');
  expect(text()).toContain('Network request failed');
});
test('not a ShifaKinetix server: the health check fails', async () => {
  request.mockResolvedValue(json({ status: 'nope' }));
  await press('Sign in as Patient');
  expect(text()).toContain('No ShifaKinetix server');
});
test('a token for an unknown account is rejected by the server', async () => {
  request.mockImplementation(async (url: string) => url.endsWith('/health') ? json({ status: 'ok' }) : json({}, 401));
  await press('Use an access token instead');
  await enter('Access token', 'bad'); await press('Connect with token');
  expect(text()).toContain('expired');
  expect(useServer.getState().identity).toBeNull();
});
test('disconnect clears the connection, and a late answer cannot reconnect', async () => {
  let release!: (r: Response) => void;
  request.mockImplementation(async (url: string) => url.endsWith('/health') ? new Promise<Response>((r) => { release = r; }) : json({}, 404));
  await act(async () => { void useServer.getState().signInDev('https://demo.example', 'demo', 'patient'); });
  act(() => useServer.getState().disconnect());
  server('patient');
  await act(async () => { release(json({ status: 'ok' })); });
  expect(useServer.getState().status).toBe('disconnected');
});

describe('ApiClient sign-in helpers', () => {
  test('devLogin rejects a malformed response', async () => {
    const bad = jest.fn().mockResolvedValue(json({ token: '', user: { id: 'x', role: 'admin' } }));
    await expect(ApiClient.devLogin('https://demo.example', 'x', 'patient', bad)).rejects.toThrow('not valid');
  });
  test('devLogin refuses an unsafe address before any request', async () => {
    const never = jest.fn();
    await expect(ApiClient.devLogin('http://public.example', 'x', 'patient', never, true)).rejects.toThrow('HTTPS');
    expect(never).not.toHaveBeenCalled();
  });
  test('devLogin and health time out', async () => {
    const stall = jest.fn((_u, o) => new Promise<Response>((_r, rej) => o.signal.addEventListener('abort', () => rej(new Error('aborted')))));
    await expect(ApiClient.devLogin('https://demo.example', 'x', 'patient', stall, false, 5)).rejects.toThrow('aborted');
    await expect(ApiClient.health('https://demo.example', stall, false, 5)).rejects.toThrow('aborted');
  });
});

describe('one-tap demo sign-in', () => {
  test('the fixed demo accounts are used for the one-tap sign-in', async () => {
    useServer.setState({ baseUrl: 'https://demo.example' });
    server('patient');
    await act(async () => { await useServer.getState().signInDemo('patient'); });
    const login = request.mock.calls.find((c) => String(c[0]).endsWith('/auth/dev-login'))!;
    expect(JSON.parse(login[1].body)).toEqual({ userId: 'demo-patient', role: 'patient' });
    useServer.getState().disconnect();
    server('doctor');
    await act(async () => { await useServer.getState().signInDemo('doctor'); });
    const second = request.mock.calls.filter((c) => String(c[0]).endsWith('/auth/dev-login')).at(-1)!;
    expect(JSON.parse(second[1].body)).toEqual({ userId: 'demo-doctor', role: 'doctor' });
    expect(useServer.getState().identity).toEqual({ id: 'demo', role: 'doctor' });
  });
  test('the default address is the emulator host unless the environment says otherwise', () => {
    jest.isolateModules(() => {
      delete process.env.EXPO_PUBLIC_API_URL;
      expect(require('../src/server/defaults').DEFAULT_API_URL).toBe('http://10.0.2.2:8000');
      process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.20:8000';
    });
    jest.isolateModules(() => {
      expect(require('../src/server/defaults').DEFAULT_API_URL).toBe('http://192.168.1.20:8000');
      delete process.env.EXPO_PUBLIC_API_URL;
    });
  });
  test('there is no user name field any more', () => {
    expect(tree.root.findAll((n) => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === 'User name')).toHaveLength(0);
  });
  test('the server still decides the role of a demo account', async () => {
    useServer.setState({ baseUrl: 'https://demo.example' });
    server('patient');
    await act(async () => { await useServer.getState().signInDemo('doctor'); });
    expect(useServer.getState().identity?.role).toBe('patient');
  });
});

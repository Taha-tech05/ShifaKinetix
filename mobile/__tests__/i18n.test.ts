import { getLanguage, isRTL, setLanguage, t } from '../src/i18n';

afterAll(() => setLanguage('en'));

describe('i18n', () => {
  it('translates per language', () => {
    setLanguage('en');
    expect(t('answer.notSure')).toBe('Not sure');
    setLanguage('roman');
    expect(t('answer.notSure')).toBe('Yaqeen nahi');
    setLanguage('ur');
    expect(t('answer.notSure')).toBe('یقین نہیں');
    expect(getLanguage()).toBe('ur');
  });

  it('fills params', () => {
    setLanguage('en');
    expect(t('home.hello', { name: 'Patient A' })).toBe('Assalam o Alaikum, Patient A');
  });

  it('only Urdu is right-to-left', () => {
    expect(isRTL('ur')).toBe(true);
    expect(isRTL('en')).toBe(false);
    expect(isRTL('roman')).toBe(false);
  });

  it('keeps the safety line in every language', () => {
    for (const lang of ['en', 'ur', 'roman'] as const) {
      setLanguage(lang);
      expect(t('moveSafely').length).toBeGreaterThan(10);
    }
    setLanguage('en');
    expect(t('moveSafely')).toBe('Move only as far as comfortable. Stop if pain is sharp or severe.');
  });
});

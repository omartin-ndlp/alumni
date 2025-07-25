const request = require('supertest');
const initApp = require('../../server');

describe('Localization Middleware (Default Language)', () => {
  let app;
  let server;

  beforeAll((done) => {
    // Ensure SITE_LANGUAGE is not set, so it uses the default 'fr'
    delete process.env.SITE_LANGUAGE;
    app = initApp();
    server = app.listen(done);
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should use the default language (fr) when no language is specified', async () => {
    const res = await request(server).get('/login');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Connectez-vous à votre compte');
  });
});

describe('Localization Middleware (Environment Variable)', () => {
  let app;
  let server;
  const originalSiteLanguage = process.env.SITE_LANGUAGE;

  beforeAll((done) => {
    // Set the environment variable BEFORE initializing the app
    process.env.SITE_LANGUAGE = 'en';
    app = initApp();
    server = app.listen(done);
  });

  afterAll((done) => {
    // Clean up and restore the original environment variable
    if (originalSiteLanguage) {
      process.env.SITE_LANGUAGE = originalSiteLanguage;
    } else {
      delete process.env.SITE_LANGUAGE;
    }
    server.close(done);
  });

  it('should use the language specified in the SITE_LANGUAGE environment variable', async () => {
    const res = await request(server).get('/login');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Log in to your account');
  });
});

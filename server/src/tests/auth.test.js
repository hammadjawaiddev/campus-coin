const { api, auth, registerStudent, uniqueEmail } = require('./helpers');

describe('Authentication and account security', () => {
  it('registers a student, hashes the password and issues a token', async () => {
    const { user, token } = await registerStudent({ name: 'Ayesha Khan' });

    expect(token).toEqual(expect.any(String));
    expect(user.email).toBeTruthy();
    expect(user.role).toBe('student');
    expect(user.password).toBeUndefined();

    const me = await api().get('/api/users/me').set(auth(token)).expect(200);
    expect(me.body.data.user.name).toBe('Ayesha Khan');
    expect(me.body.data.user.preferences.currency).toBe('USD');
  });

  it('rejects duplicate emails and weak passwords', async () => {
    const { email } = await registerStudent();

    const duplicate = await api()
      .post('/api/auth/register')
      .send({ name: 'Copy Cat', email, password: 'CampusCoin123' });
    expect(duplicate.status).toBe(409);

    const weak = await api()
      .post('/api/auth/register')
      .send({ name: 'Weak Pass', email: uniqueEmail('weak'), password: 'short' });
    expect(weak.status).toBe(422);

    const noDigit = await api()
      .post('/api/auth/register')
      .send({ name: 'No Digit', email: uniqueEmail('nodigit'), password: 'passwordonly' });
    expect(noDigit.status).toBe(422);
  });

  it('never returns the password hash over the API', async () => {
    const { token, email } = await registerStudent();
    const login = await api().post('/api/auth/login').send({ email, password: 'CampusCoin123' }).expect(200);

    expect(login.body.data.user.password).toBeUndefined();
    const raw = JSON.stringify(login.body);
    expect(raw).not.toMatch(/\$2[aby]\$/); // no bcrypt hash anywhere in the payload

    const me = await api().get('/api/users/me').set(auth(token)).expect(200);
    expect(JSON.stringify(me.body)).not.toMatch(/\$2[aby]\$/);
  });

  it('refuses bad credentials without revealing which field was wrong', async () => {
    const { email } = await registerStudent();

    const wrongPassword = await api().post('/api/auth/login').send({ email, password: 'WrongPassword1' });
    const unknownUser = await api().post('/api/auth/login').send({ email: uniqueEmail('ghost'), password: 'CampusCoin123' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownUser.body.message);
  });

  it('protects every private route without a token', async () => {
    const routes = [
      ['get', '/api/users/me'],
      ['get', '/api/transactions'],
      ['get', '/api/budgets'],
      ['get', '/api/goals'],
      ['get', '/api/insights'],
      ['get', '/api/notifications'],
      ['get', '/api/reports'],
      ['get', '/api/categories'],
    ];

    for (const [method, url] of routes) {
      // eslint-disable-next-line no-await-in-loop
      const response = await api()[method](url);
      expect(response.status).toBe(401);
    }
  });

  it('lets a student change their password and invalidates the old token', async () => {
    const { token, email } = await registerStudent();

    await api()
      .put('/api/auth/password')
      .set(auth(token))
      .send({ currentPassword: 'CampusCoin123', newPassword: 'BrandNewPass9' })
      .expect(200);

    const stale = await api().get('/api/users/me').set(auth(token));
    expect(stale.status).toBe(401);

    await api().post('/api/auth/login').send({ email, password: 'CampusCoin123' }).expect(401);
    await api().post('/api/auth/login').send({ email, password: 'BrandNewPass9' }).expect(200);
  });

  it('completes the forgot-password → reset-password flow', async () => {
    const { email } = await registerStudent();

    const forgot = await api().post('/api/auth/forgot-password').send({ email }).expect(200);
    expect(forgot.body.data.delivered).toBe(false); // no SMTP in tests

    // Without SMTP the API returns the link it would have emailed, so the flow
    // stays demoable — the token is pulled out of that URL.
    const devResetUrl = forgot.body.data.devResetUrl;
    expect(devResetUrl).toContain('/reset-password?token=');
    const resetToken = new URL(devResetUrl).searchParams.get('token');
    expect(resetToken).toEqual(expect.any(String));

    // The token is checked before the form is shown in the client.
    await api().get(`/api/auth/reset-password/${resetToken}`).expect(200);

    const reset = await api()
      .post('/api/auth/reset-password')
      .send({ token: resetToken, password: 'ResetPassword7' })
      .expect(200);
    expect(reset.body.data.token).toEqual(expect.any(String));

    await api().post('/api/auth/login').send({ email, password: 'ResetPassword7' }).expect(200);
    await api().post('/api/auth/login').send({ email, password: 'CampusCoin123' }).expect(401);
  });

  it('does not leak whether an unknown email exists on forgot-password', async () => {
    const response = await api().post('/api/auth/forgot-password').send({ email: uniqueEmail('nobody') }).expect(200);
    expect(response.body.message).toMatch(/if that email is registered/i);
    expect(response.body.data.devResetUrl).toBeUndefined();
  });
});

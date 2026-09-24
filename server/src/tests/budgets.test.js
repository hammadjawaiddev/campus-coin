const { api, auth, registerStudent, pickCategory, createTransaction } = require('./helpers');

const currentMonth = () => new Date().toISOString().slice(0, 7);

describe('Budgets: limits, consumption tracking and alerts', () => {
  it('creates a monthly budget and reports consumption', async () => {
    const { token } = await registerStudent({ monthlyAllowance: 500 });
    const category = await pickCategory(token, { name: 'Food & Dining' });

    const created = await api()
      .post('/api/budgets')
      .set(auth(token))
      .send({ categoryId: category.id, limitAmount: 200, month: currentMonth(), alertThreshold: 80 })
      .expect(201);

    expect(Number(created.body.data.budget.limitAmount)).toBe(200);

    await createTransaction(token, { amount: 60, description: 'Groceries', categoryId: category.id });
    await createTransaction(token, { amount: 40, description: 'Lunch out', categoryId: category.id });

    const list = await api().get(`/api/budgets?month=${currentMonth()}`).set(auth(token)).expect(200);
    const budget = list.body.data.budgets.find((row) => String(row.categoryId) === String(category.id));

    expect(budget).toBeTruthy();
    expect(Number(budget.spent)).toBeCloseTo(100);
    expect(Number(budget.percentUsed)).toBeCloseTo(50);
    expect(budget.status).toBe('on_track');
    expect(Number(list.body.data.summary.totalLimit)).toBeCloseTo(200);
  });

  it('flags a budget that goes over its limit and raises an alert', async () => {
    const { token } = await registerStudent({ monthlyAllowance: 500 });
    const category = await pickCategory(token, { name: 'Food & Dining' });

    await api()
      .post('/api/budgets')
      .set(auth(token))
      .send({ categoryId: category.id, limitAmount: 50, month: currentMonth(), alertThreshold: 80 })
      .expect(201);

    const before = await api().get('/api/notifications/unread-count').set(auth(token)).expect(200);

    await createTransaction(token, { amount: 75, description: 'Weekend feast', categoryId: category.id });

    const list = await api().get(`/api/budgets?month=${currentMonth()}`).set(auth(token)).expect(200);
    const budget = list.body.data.budgets.find((row) => String(row.categoryId) === String(category.id));
    expect(Number(budget.spent)).toBeCloseTo(75);
    expect(Number(budget.percentUsed)).toBeGreaterThan(100);
    expect(budget.status).toBe('over');

    const alerts = await api().get('/api/budgets/alerts').set(auth(token)).expect(200);
    expect(alerts.body.data.rows.length).toBeGreaterThan(0);

    const after = await api().get('/api/notifications/unread-count').set(auth(token)).expect(200);
    expect(after.body.data.unread).toBeGreaterThan(before.body.data.unread);
  });

  it('updates and deletes a budget', async () => {
    const { token } = await registerStudent();
    const category = await pickCategory(token);

    const created = await api()
      .post('/api/budgets')
      .set(auth(token))
      .send({ categoryId: category.id, limitAmount: 100, month: currentMonth() })
      .expect(201);
    const id = created.body.data.budget._id || created.body.data.budget.id;

    const updated = await api().put(`/api/budgets/${id}`).set(auth(token)).send({ limitAmount: 150 }).expect(200);
    expect(Number(updated.body.data.budget.limitAmount)).toBe(150);

    await api().delete(`/api/budgets/${id}`).set(auth(token)).expect(200);

    const list = await api().get(`/api/budgets?month=${currentMonth()}`).set(auth(token)).expect(200);
    expect(list.body.data.budgets.filter((row) => String(row._id) === String(id))).toHaveLength(0);
  });

  it('keeps budgets private to their owner', async () => {
    const alice = await registerStudent();
    const bob = await registerStudent();
    const category = await pickCategory(alice.token);

    const created = await api()
      .post('/api/budgets')
      .set(auth(alice.token))
      .send({ categoryId: category.id, limitAmount: 80, month: currentMonth() })
      .expect(201);
    const id = created.body.data.budget._id || created.body.data.budget.id;

    const bobRead = await api().get(`/api/budgets/usage/${category.id}`).set(auth(bob.token));
    expect([403, 404]).toContain(bobRead.status);

    const bobUpdate = await api().put(`/api/budgets/${id}`).set(auth(bob.token)).send({ limitAmount: 1 });
    expect([403, 404]).toContain(bobUpdate.status);

    const bobDelete = await api().delete(`/api/budgets/${id}`).set(auth(bob.token));
    expect([403, 404]).toContain(bobDelete.status);
  });

  it('rejects an invalid limit and unknown categories', async () => {
    const { token } = await registerStudent();

    const zero = await api()
      .post('/api/budgets')
      .set(auth(token))
      .send({ categoryId: '65f000000000000000000000', limitAmount: 0, month: currentMonth() });
    expect(zero.status).toBe(422);

    const foreign = await api()
      .post('/api/budgets')
      .set(auth(token))
      .send({ categoryId: '65f000000000000000000000', limitAmount: 50, month: currentMonth() });
    expect([400, 403, 404, 422]).toContain(foreign.status);
  });
});

describe('Savings goals', () => {
  it('creates a goal, adds contributions and tracks milestones', async () => {
    const { token } = await registerStudent({ savingsGoal: 1000 });

    const created = await api()
      .post('/api/goals')
      .set(auth(token))
      .send({ name: 'New laptop', targetAmount: 600, savedAmount: 100, targetDate: '2027-03-01' })
      .expect(201);
    const id = created.body.data.goal._id || created.body.data.goal.id;

    const contributed = await api()
      .post(`/api/goals/${id}/contribute`)
      .set(auth(token))
      .send({ amount: 200, note: 'Weekend job' })
      .expect(200);

    const goal = contributed.body.data.goal || contributed.body.data;
    expect(Number(goal.savedAmount)).toBeCloseTo(300);

    const withdrawn = await api()
      .post(`/api/goals/${id}/contribute`)
      .set(auth(token))
      .send({ amount: -50, note: 'Unexpected expense' })
      .expect(200);
    const afterWithdrawal = withdrawn.body.data.goal || withdrawn.body.data;
    expect(Number(afterWithdrawal.savedAmount)).toBeCloseTo(250);

    const list = await api().get('/api/goals').set(auth(token)).expect(200);
    expect(list.body.data.summary.totalSaved).toBeCloseTo(250);
    expect(list.body.data.summary.overallProgress).toBeGreaterThan(0);
  });

  it('refuses contributions that would push a goal below zero', async () => {
    const { token } = await registerStudent();

    const created = await api()
      .post('/api/goals')
      .set(auth(token))
      .send({ name: 'Trip', targetAmount: 300, savedAmount: 50 })
      .expect(201);
    const id = created.body.data.goal._id || created.body.data.goal.id;

    const overdrawn = await api().post(`/api/goals/${id}/contribute`).set(auth(token)).send({ amount: -500 });
    expect([400, 422]).toContain(overdrawn.status);
  });

  it('keeps goals private to their owner', async () => {
    const alice = await registerStudent();
    const bob = await registerStudent();

    const created = await api()
      .post('/api/goals')
      .set(auth(alice.token))
      .send({ name: 'Camera', targetAmount: 400, savedAmount: 20 })
      .expect(201);
    const id = created.body.data.goal._id || created.body.data.goal.id;

    const stolen = await api().post(`/api/goals/${id}/contribute`).set(auth(bob.token)).send({ amount: 10 });
    expect([403, 404]).toContain(stolen.status);

    const bobGoals = await api().get('/api/goals').set(auth(bob.token)).expect(200);
    expect(bobGoals.body.data.goals).toHaveLength(0);
  });
});

const { api, auth, registerStudent, pickCategory, createTransaction } = require('./helpers');

describe('Transactions: CRUD, filtering, isolation and assistance', () => {
  it('creates, reads, updates and deletes a transaction', async () => {
    const { token } = await registerStudent();
    const category = await pickCategory(token);

    const created = await api()
      .post('/api/transactions')
      .set(auth(token))
      .send({ type: 'expense', amount: 24.5, description: 'Canteen lunch', categoryId: category.id, date: new Date().toISOString() })
      .expect(201);

    const id = created.body.data.transaction?._id || created.body.data.transaction?.id;
    expect(id).toBeTruthy();

    const fetched = await api().get(`/api/transactions/${id}`).set(auth(token)).expect(200);
    expect(Number(fetched.body.data.transaction.amount)).toBeCloseTo(24.5);
    expect(fetched.body.data.transaction.description).toBe('Canteen lunch');

    const updated = await api()
      .put(`/api/transactions/${id}`)
      .set(auth(token))
      .send({ type: 'expense', amount: 30, description: 'Canteen lunch (updated)', categoryId: category.id })
      .expect(200);
    expect(Number(updated.body.data.transaction.amount)).toBeCloseTo(30);

    await api().delete(`/api/transactions/${id}`).set(auth(token)).expect(200);
    await api().get(`/api/transactions/${id}`).set(auth(token)).expect(404);
  });

  it('validates the payload before writing anything', async () => {
    const { token } = await registerStudent();

    const negative = await api()
      .post('/api/transactions')
      .set(auth(token))
      .send({ type: 'expense', amount: -5, description: 'Nope', date: new Date().toISOString() });
    expect(negative.status).toBe(422);

    const noDescription = await api()
      .post('/api/transactions')
      .set(auth(token))
      .send({ type: 'expense', amount: 5, date: new Date().toISOString() });
    expect(noDescription.status).toBe(422);
  });

  it('filters, searches, sorts and paginates the list', async () => {
    const { token } = await registerStudent();
    const expense = await pickCategory(token, { type: 'expense' });
    const income = await pickCategory(token, { type: 'income' });

    await createTransaction(token, { amount: 12, description: 'Coffee with Sara', categoryId: expense.id, date: '2026-09-05T09:00:00.000Z' });
    await createTransaction(token, { amount: 40, description: 'Textbook', categoryId: expense.id, date: '2026-09-10T09:00:00.000Z' });
    await createTransaction(token, { amount: 300, description: 'Monthly allowance', type: 'income', categoryId: income.id, date: '2026-09-01T09:00:00.000Z' });

    const searched = await api().get('/api/transactions?search=coffee').set(auth(token)).expect(200);
    expect(searched.body.data.transactions).toHaveLength(1);
    expect(searched.body.data.transactions[0].description).toMatch(/Coffee/i);

    const incomeOnly = await api().get('/api/transactions?type=income').set(auth(token)).expect(200);
    expect(incomeOnly.body.data.transactions.every((row) => row.type === 'income')).toBe(true);
    expect(Number(incomeOnly.body.data.summary.income)).toBeCloseTo(300);

    const ranged = await api()
      .get('/api/transactions?from=2026-09-09&to=2026-09-12')
      .set(auth(token))
      .expect(200);
    expect(ranged.body.data.transactions).toHaveLength(1);
    expect(ranged.body.data.transactions[0].description).toBe('Textbook');

    const paged = await api().get('/api/transactions?limit=2&page=1').set(auth(token)).expect(200);
    expect(paged.body.data.transactions).toHaveLength(2);
    expect(paged.body.meta.pagination.total).toBe(3);
    expect(paged.body.meta.pagination.hasNextPage).toBe(true);
    expect(paged.body.meta.pagination.totalPages).toBe(2);

    const summary = paged.body.data.summary;
    expect(Number(summary.count)).toBe(3);
    expect(Number(summary.expense)).toBeCloseTo(52);
    expect(Number(summary.net)).toBeCloseTo(248);
  });

  it('keeps one student out of another student’s transactions', async () => {
    const alice = await registerStudent({ name: 'Alice' });
    const bob = await registerStudent({ name: 'Bob' });

    const aliceTx = await createTransaction(alice.token, { description: 'Alice private spend' });

    // Guessing an id must not be enough — the owner filter is part of the query.
    const stolen = await api().get(`/api/transactions/${aliceTx._id}`).set(auth(bob.token));
    expect(stolen.status).toBe(404);

    const stolenUpdate = await api()
      .put(`/api/transactions/${aliceTx._id}`)
      .set(auth(bob.token))
      .send({ type: 'expense', amount: 1, description: 'hijacked' });
    expect([403, 404]).toContain(stolenUpdate.status);

    const stolenDelete = await api().delete(`/api/transactions/${aliceTx._id}`).set(auth(bob.token));
    expect([403, 404]).toContain(stolenDelete.status);

    const bobList = await api().get('/api/transactions').set(auth(bob.token)).expect(200);
    expect(bobList.body.data.transactions).toHaveLength(0);

    // Alice's data is untouched.
    const aliceList = await api().get('/api/transactions').set(auth(alice.token)).expect(200);
    expect(aliceList.body.data.transactions).toHaveLength(1);
  });

  it('exposes meta options that drive the filters in the UI', async () => {
    const { token } = await registerStudent();
    const meta = await api().get('/api/transactions/meta').set(auth(token)).expect(200);

    expect(Array.isArray(meta.body.data.categories)).toBe(true);
    expect(meta.body.data.categories.length).toBeGreaterThan(0);
    expect(Array.isArray(meta.body.data.sortOptions)).toBe(true);
    expect(meta.body.data.currency).toEqual(expect.any(String));
  });

  it('warns about duplicates and unusual amounts before saving (precheck)', async () => {
    const { token } = await registerStudent();
    const category = await pickCategory(token);
    const date = '2026-09-12T10:00:00.000Z';

    await createTransaction(token, { amount: 18.75, description: 'Campus cafe', categoryId: category.id, date });

    const duplicate = await api()
      .post('/api/transactions/precheck')
      .set(auth(token))
      .send({ type: 'expense', amount: 18.75, description: 'Campus cafe again', categoryId: category.id, date })
      .expect(200);
    expect(duplicate.body.data.duplicate.isDuplicate).toBe(true);

    const first = await api()
      .post('/api/transactions/precheck')
      .set(auth(token))
      .send({ type: 'expense', amount: 12, description: 'Something small', categoryId: category.id, date: '2026-09-13T10:00:00.000Z' })
      .expect(200);
    expect(first.body.data.duplicate.isDuplicate).toBe(false);
  });

  it('suggests a category even when no AI key is configured', async () => {
    const { token } = await registerStudent();

    const suggestion = await api()
      .post('/api/transactions/ai-suggest')
      .set(auth(token))
      .send({ description: 'Uber ride to campus', type: 'expense', amount: 6.4 })
      .expect(200);

    const { suggested, source, aiUsed, aiConfigured } = suggestion.body.data;
    expect(suggested).toBeTruthy();
    expect(suggested.categoryId).toBeTruthy();
    expect(['rules', 'ai', 'history', 'manual', 'none']).toContain(source);
    // With no AI key present the rule-based engine answers instead of failing.
    if (!aiConfigured) {
      expect(aiUsed).toBe(false);
    }
  });

  it('stores both the AI suggestion and the category the student confirmed', async () => {
    const { token } = await registerStudent();
    const transport = await pickCategory(token, { name: 'Transport' });
    const food = await pickCategory(token, { name: 'Food & Dining' });

    const created = await api()
      .post('/api/transactions')
      .set(auth(token))
      .send({
        type: 'expense',
        amount: 9.25,
        description: 'Bus card top-up',
        categoryId: food.id,
        date: new Date().toISOString(),
        aiSuggestedCategory: transport.id,
        aiConfidence: 0.62,
        aiSource: 'rules',
        aiSuggestionAccepted: false,
      })
      .expect(201);

    const transaction = created.body.data.transaction;
    expect(String(transaction.category?._id || transaction.category)).toBe(String(food.id));
    expect(String(transaction.userConfirmedCategory)).toBe(String(food.id));
    expect(String(transaction.aiSuggestedCategory)).toBe(String(transport.id));
    expect(transaction.aiSuggestionAccepted).toBe(false);
  });

  it('handles recurring templates end to end', async () => {
    const { token } = await registerStudent();
    const category = await pickCategory(token, { name: 'Rent & Hostel' });

    await api()
      .post('/api/transactions')
      .set(auth(token))
      .send({
        type: 'expense',
        amount: 120,
        description: 'Hostel rent',
        categoryId: category.id,
        date: '2026-09-03T08:00:00.000Z',
        recurring: true,
        recurringFrequency: 'monthly',
      })
      .expect(201);

    const templates = await api().get('/api/transactions/recurring').set(auth(token)).expect(200);
    expect(templates.body.data.templates).toHaveLength(1);
    expect(templates.body.data.templates[0].nextOccurrence).toBeTruthy();

    const run = await api().post('/api/transactions/recurring/run').set(auth(token)).expect(200);
    expect(run.body.data).toHaveProperty('created');
  });
});

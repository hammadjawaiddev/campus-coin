const { api, auth, registerStudent, uniqueEmail } = require('./helpers');

const csv = (rows) => rows.join('\n');

const SAMPLE = csv([
  'date,description,amount,type,category,notes',
  '2026-09-02,Coffee with Sara,4.50,expense,Coffee,',
  '2026-09-03,Bus card top-up,12.00,expense,Transport,',
  '2026-09-04,Weekend job pay,150.00,income,Allowance,Shift pay',
]);

describe('CSV import: preview → confirm → undo', () => {
  it('serves a downloadable template', async () => {
    const { token } = await registerStudent();
    const response = await api().get('/api/import/template').set(auth(token)).expect(200);

    expect(response.headers['content-type']).toMatch(/csv|text/);
    expect(response.text).toMatch(/date.*description.*amount/i);
  });

  it('previews a file with validation, duplicate and AI suggestion data', async () => {
    const { token } = await registerStudent();
    const response = await api()
      .post('/api/import/preview')
      .set(auth(token))
      .attach('file', Buffer.from(SAMPLE), 'september.csv')
      .expect(200);

    const { rows, summary, columns, categories } = response.body.data;

    expect(columns.detected).toEqual(expect.arrayContaining(['date', 'description', 'amount']));
    expect(summary.total).toBe(3);
    expect(summary.valid).toBe(3);
    expect(summary.invalid).toBe(0);
    expect(rows).toHaveLength(3);
    expect(categories.length).toBeGreaterThan(0);

    const coffee = rows.find((row) => row.description === 'Coffee with Sara');
    expect(Number(coffee.amount)).toBeCloseTo(4.5);
    expect(coffee.valid).toBe(true);
    // The engine suggests a category for each row even without an AI key.
    expect(coffee.suggestedCategory || coffee.matchedCategoryId).toBeTruthy();
  });

  it('marks unparseable rows instead of importing them', async () => {
    const { token } = await registerStudent();
    const messy = csv([
      'date,description,amount,type',
      '2026-09-02,Fine row,5.00,expense',
      'not-a-date,Broken row,10.00,expense',
      ',Missing date,7.00,expense',
    ]);

    const response = await api()
      .post('/api/import/preview')
      .set(auth(token))
      .attach('file', Buffer.from(messy), 'messy.csv')
      .expect(200);

    expect(response.body.data.summary.valid).toBe(1);
    expect(response.body.data.summary.invalid).toBe(2);
    expect(response.body.data.errors.length).toBeGreaterThan(0);
  });

  it('imports confirmed rows, records the batch and can undo it', async () => {
    const { token } = await registerStudent();

    const preview = await api()
      .post('/api/import/preview')
      .set(auth(token))
      .attach('file', Buffer.from(SAMPLE), 'september.csv')
      .expect(200);

    const { batchId, rows } = preview.body.data;
    const confirmed = rows.map((row) => ({
      ...row,
      categoryId: row.suggestedCategory?._id || row.suggestedCategory?.id || row.matchedCategoryId,
      skip: false,
    }));

    const commit = await api()
      .post('/api/import/commit')
      .set(auth(token))
      .send({ rows: confirmed, skipDuplicates: true })
      .expect(200);

    expect(commit.body.data.imported).toBe(3);

    const list = await api().get('/api/transactions?limit=50').set(auth(token)).expect(200);
    expect(list.body.data.transactions).toHaveLength(3);
    expect(list.body.data.transactions.every((row) => row.source === 'csv')).toBe(true);

    const history = await api().get('/api/import/history').set(auth(token)).expect(200);
    expect(history.body.data.batches.length).toBeGreaterThan(0);

    const undo = await api().post(`/api/import/undo/${batchId}`).set(auth(token)).expect(200);
    expect(undo.body.data.deleted).toBe(3);

    const afterUndo = await api().get('/api/transactions').set(auth(token)).expect(200);
    expect(afterUndo.body.data.transactions).toHaveLength(0);
  });

  it('skips duplicate rows when the student asks it to', async () => {
    const { token } = await registerStudent();

    const first = await api()
      .post('/api/import/preview')
      .set(auth(token))
      .attach('file', Buffer.from(SAMPLE), 'september.csv')
      .expect(200);

    const rows = first.body.data.rows.map((row) => ({
      ...row,
      categoryId: row.suggestedCategory?._id || row.suggestedCategory?.id || row.matchedCategoryId,
      skip: false,
    }));

    await api().post('/api/import/commit').set(auth(token)).send({ rows, skipDuplicates: true }).expect(200);

    // Importing the exact same file again must not double the data.
    const second = await api()
      .post('/api/import/preview')
      .set(auth(token))
      .attach('file', Buffer.from(SAMPLE), 'september.csv')
      .expect(200);
    expect(second.body.data.summary.duplicates).toBe(3);

    const secondCommit = await api()
      .post('/api/import/commit')
      .set(auth(token))
      .send({
        rows: second.body.data.rows.map((row) => ({
          ...row,
          categoryId: row.suggestedCategory?._id || row.suggestedCategory?.id || row.matchedCategoryId,
          skip: false,
        })),
        skipDuplicates: true,
      })
      .expect(200);

    expect(secondCommit.body.data.imported).toBe(0);
    expect(secondCommit.body.data.skipped).toBe(3);

    const list = await api().get('/api/transactions?limit=50').set(auth(token)).expect(200);
    expect(list.body.data.transactions).toHaveLength(3);
  });

  it('rejects a preview from an unauthenticated caller', async () => {
    const response = await api().post('/api/import/preview').attach('file', Buffer.from(SAMPLE), 'x.csv');
    expect(response.status).toBe(401);
    expect(uniqueEmail('never')).toBeTruthy();
  });
});

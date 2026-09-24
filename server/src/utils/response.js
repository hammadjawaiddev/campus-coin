/**
 * Consistent API envelope. The client `api` service unwraps `data` and throws
 * `error.message` from a failed response, which keeps front-end code small.
 */
const ok = (res, data = null, message = 'OK', meta = null, statusCode = 200) =>
  res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });

const created = (res, data = null, message = 'Created') => ok(res, data, message, null, 201);

const paginated = (res, items, { page, limit, total }, message = 'OK') =>
  res.status(200).json({
    success: true,
    message,
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });

module.exports = { ok, created, paginated };

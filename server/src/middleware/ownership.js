const ApiError = require('../utils/ApiError');
const mongoose = require('mongoose');

/**
 * Guarantees the :id in the URL is a valid ObjectId and that the document
 * belongs to the signed-in user. A student can never read another student's
 * record by swapping an id — ownership is enforced in the query itself, not in
 * a post-fetch comparison that could be forgotten.
 */
const loadOwned = (Model, { param = 'id', field = 'user', populate = null, select = null } = {}) => async (req, _res, next) => {
  try {
    const id = req.params[param];
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid record id');

    const query = { _id: id };
    // Admins acting on their own resources still go through the ownership check.
    query[field] = req.user._id;

    let dbQuery = Model.findOne(query);
    if (populate) dbQuery = dbQuery.populate(populate);
    if (select) dbQuery = dbQuery.select(select);

    const doc = await dbQuery;
    if (!doc) throw ApiError.notFound(`${Model.modelName} not found`);
    req.owned = doc;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { loadOwned };

const User = require('./schemas/users')

const getUser = async (body) => await User.findOne(body)

module.exports = { getUser }
const bcrypt = require('bcryptjs');
const SALT_ROUNDS = 10;

const hashPassword = (password) => {
    return bcrypt.hashSync(password, SALT_ROUNDS);
};

const verifyPassword = (password, hash) => {
    return bcrypt.compareSync(password, hash);
};

module.exports = { hashPassword, verifyPassword };
const bcrypt = require('bcryptjs');
const password = 'Wincster@194060le';
bcrypt.hash(password, 10).then(hash => {
    console.log('Hash for CleversonS:', hash);
});

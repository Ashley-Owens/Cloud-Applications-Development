const PORT = process.env.PORT || 8080;
const express = require('express');
const app = express();
app.set('trust proxy', true);
app.use('/', require('./index'));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});

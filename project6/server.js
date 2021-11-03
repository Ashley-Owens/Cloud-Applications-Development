const PORT = process.env.PORT || 8080;
const express = require('express');
const app = express();
const credentials = require('./credentials.js');

app.set('trust proxy', true);
app.use(express.static('views'));
app.use(express.urlencoded({ extended: true }));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});

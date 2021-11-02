const PORT = process.env.PORT || 8080;
const express = require('express');
const app = express();
app.set('trust proxy', true);
// app.use('/', require('./index'));
app.use(express.static('views'));
app.use(express.urlencoded({ extended: true }));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});

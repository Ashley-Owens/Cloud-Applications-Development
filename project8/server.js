const PORT = process.env.PORT || 8000;
const express = require('express');
const app = express();
app.set('trust proxy', true);
app.use('/', require('./index'));

app.get('/', (req, res) => {
  res.status(200).send("container is running");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});

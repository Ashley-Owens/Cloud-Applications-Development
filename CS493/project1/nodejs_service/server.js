const PORT = process.env.PORT || 8080;
const express = require('express');
const app = express();
app.use(express.static('views'));
app.use(express.urlencoded({ extended: true }));
const path = require(`path`);

// app.get('/submit', (req, res) => {
//   res.sendFile(path.join(__dirname, '/views/index.html'));
// });

app.post('/submit', (req, res) => {
  let payload = {
    name: req.body.name,
    message: req.body.message
  };
  console.log(payload);
  res.status(200).send(`Hi ${payload.name}, thanks for your message: ${payload.message}`);
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
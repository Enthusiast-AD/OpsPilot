import express from 'express';

const app = express();
const PORT: number = Number(process.env.PORT) || 3000;

app.get('/', (req, res) => {
  res.send('Hello, OpsPilot API is running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
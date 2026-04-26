// ============================================================
// Launchmen Task API
// Developer Candidate Test — Trial 2
// ============================================================
// Instructions:
//   Run with: npm install && node server.js
//   Server starts on: http://localhost:3000
// ============================================================

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = path.join(__dirname, 'tasks.json');

function loadTasks() {
  if (!fs.existsSync(DB_FILE)) return [];
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(raw);
}

function saveTasks(tasks) {
  fs.writeFileSync(DB_FILE, JSON.stringify(tasks, null, 2));
}

// GET /tasks
// Returns all tasks. Supports optional status filter.
// Bug fix: repeated status query params arrive as an array, so calling trim() on them throws.
// Decision: treat repeated status values as an OR filter and ignore blank values.
app.get('/tasks', (req, res) => {
  const tasks = loadTasks();
  const { status } = req.query;

  if (Array.isArray(status)) {
    const statuses = status.map(value => value.trim()).filter(Boolean);

    if (statuses.length === 0) {
      return res.json(tasks);
    }

    const filtered = tasks.filter(task => statuses.includes(task.status));
    return res.json(filtered);
  }

  if (typeof status === 'string' && status.trim() !== '') {
    const filtered = tasks.filter(task => task.status === status.trim());
    return res.json(filtered);
  }

  res.json(tasks);
});

// POST /tasks
// Bug fix: title was not validated and status could be saved as undefined, which broke the required field and default status behavior.
app.post('/tasks', (req, res) => {
  const { title, status } = req.body;

  if (!title || title.trim() === '') {
    return res.status(400).json({ success: false, message: 'Title is required' });
  }

  const tasks = loadTasks();
  const newTask = {
    id: Date.now(),
    title: title.trim(),
    status: status || 'pending',
  };

  tasks.push(newTask);
  saveTasks(tasks);
  res.status(201).json(newTask);
});

// PATCH /tasks/:id
// Bug fix: route params are strings, so the original numeric ID comparison never matched existing tasks.
app.patch('/tasks/:id', (req, res) => {
  const tasks = loadTasks();
  const { status } = req.body;
  const id = parseInt(req.params.id, 10);
  const task = tasks.find(t => t.id === id);

  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  task.status = status;
  saveTasks(tasks);
  res.json(task);
});

// DELETE /tasks/:id
// Bug fix: the original code compared a string ID to numeric task IDs and replaced the whole tasks array with splice()'s removed items.
app.delete('/tasks/:id', (req, res) => {
  const tasks = loadTasks();
  const id = parseInt(req.params.id, 10);
  const index = tasks.findIndex(t => t.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  tasks.splice(index, 1);
  saveTasks(tasks);
  res.json({ success: true, message: 'Task deleted' });
});

app.listen(3000, () => {
  console.log('Launchmen Task API running on http://localhost:3000');
});

// ============================================================
// Task 3 - SQL Performance Review
// ============================================================
// Q1: Identify the issue
// This code has an N+1 query problem. It first loads 50 posts, then runs one
// additional author query per post inside the loop. That turns one page load
// into 51 database queries, which adds unnecessary network round trips and
// grows linearly as more rows are loaded.
//
// Q2: How to fix it
// Fetch the posts and their authors in one joined query instead of querying
// authors row-by-row:
//
// const rows = await db.query(
//   `SELECT
//      p.id,
//      p.author_id,
//      p.title,
//      p.created_at,
//      a.id AS joined_author_id,
//      a.name AS author_name,
//      a.email AS author_email
//    FROM posts p
//    JOIN authors a ON a.id = p.author_id
//    ORDER BY p.created_at DESC
//    LIMIT 50`
// );
//
// return rows.map(row => ({
//   id: row.id,
//   author_id: row.author_id,
//   title: row.title,
//   created_at: row.created_at,
//   author: {
//     id: row.joined_author_id,
//     name: row.author_name,
//     email: row.author_email,
//   },
// }));
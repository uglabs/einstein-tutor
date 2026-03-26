const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
}

export const api = {
  findOrCreateUser: (name) => request('POST', '/users', { name }),
  getProgress: (userId) => request('GET', `/users/${userId}/progress`),
  startSession: (userId, lessonNumber) =>
    request('POST', '/sessions', { user_id: userId, lesson_number: lessonNumber }),
  endSession: (sessionId, transcript, messageCount) =>
    request('PATCH', `/sessions/${sessionId}`, { transcript, message_count: messageCount }),
  saveQuiz: (sessionId, isPre, answers, correctAnswers) =>
    request('POST', `/sessions/${sessionId}/quiz`, { is_pre: isPre, answers, correct_answers: correctAnswers }),
  getResults: (sessionId) => request('GET', `/sessions/${sessionId}/results`),
};

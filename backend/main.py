import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB_PATH = os.environ.get("DB_PATH", "einstein.db")
ADMIN_KEY = os.environ.get("ADMIN_KEY", "einstein-admin-2026")

app = FastAPI(title="Einstein Tutor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Database ──────────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id         TEXT PRIMARY KEY,
                name       TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id             TEXT PRIMARY KEY,
                user_id        TEXT NOT NULL REFERENCES users(id),
                lesson_number  INTEGER NOT NULL,
                started_at     TEXT NOT NULL,
                ended_at       TEXT,
                duration_secs  INTEGER,
                message_count  INTEGER DEFAULT 0,
                transcript     TEXT DEFAULT '[]'
            );

            CREATE TABLE IF NOT EXISTS quiz_attempts (
                id          TEXT PRIMARY KEY,
                session_id  TEXT NOT NULL REFERENCES sessions(id),
                is_pre      INTEGER NOT NULL,
                answers     TEXT NOT NULL,
                score       INTEGER NOT NULL,
                total       INTEGER NOT NULL,
                answered_at TEXT NOT NULL
            );
        """)


init_db()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    import uuid
    return str(uuid.uuid4())


# ── Models ────────────────────────────────────────────────────────────────────

class CreateUserRequest(BaseModel):
    name: str


class StartSessionRequest(BaseModel):
    user_id: str
    lesson_number: int


class EndSessionRequest(BaseModel):
    transcript: list
    message_count: int


class SaveQuizRequest(BaseModel):
    is_pre: bool
    answers: list[int]          # index of selected option for each question
    correct_answers: list[int]  # expected correct indices (sent from client)


# ── Helpers ───────────────────────────────────────────────────────────────────

def score_quiz(answers: list[int], correct: list[int]) -> int:
    return sum(1 for a, c in zip(answers, correct) if a == c)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/users")
def find_or_create_user(body: CreateUserRequest):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name is required")

    # Deterministic ID from name (same logic as frontend user.js)
    import hashlib
    uid = str(__import__("uuid").UUID(
        hashlib.md5(name.lower().encode()).hexdigest()
    ))

    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
        if row:
            return dict(row)
        conn.execute(
            "INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)",
            (uid, name, now_iso()),
        )
    return {"id": uid, "name": name, "created_at": now_iso()}


@app.get("/users/{user_id}/progress")
def get_progress(user_id: str):
    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise HTTPException(404, "User not found")

        lessons = []
        for n in range(1, 4):
            # Latest completed session for this lesson
            session = conn.execute("""
                SELECT s.id, s.ended_at, s.duration_secs, s.message_count
                FROM sessions s
                WHERE s.user_id = ? AND s.lesson_number = ? AND s.ended_at IS NOT NULL
                ORDER BY s.started_at DESC LIMIT 1
            """, (user_id, n)).fetchone()

            if not session:
                lessons.append({"lesson_number": n, "status": "locked" if n > 1 else "available"})
                continue

            pre = conn.execute("""
                SELECT score, total FROM quiz_attempts
                WHERE session_id = ? AND is_pre = 1
                ORDER BY answered_at DESC LIMIT 1
            """, (session["id"],)).fetchone()
            post = conn.execute("""
                SELECT score, total FROM quiz_attempts
                WHERE session_id = ? AND is_pre = 0
                ORDER BY answered_at DESC LIMIT 1
            """, (session["id"],)).fetchone()

            lessons.append({
                "lesson_number": n,
                "status": "complete",
                "session_id": session["id"],
                "duration_secs": session["duration_secs"],
                "message_count": session["message_count"],
                "pre_score": pre["score"] if pre else None,
                "pre_total": pre["total"] if pre else None,
                "post_score": post["score"] if post else None,
                "post_total": post["total"] if post else None,
            })

        # Unlock next lesson after previous is complete
        completed = {l["lesson_number"] for l in lessons if l["status"] == "complete"}
        for l in lessons:
            if l["status"] == "locked" and (l["lesson_number"] - 1) in completed:
                l["status"] = "available"

        return {"user": dict(user), "lessons": lessons}


@app.post("/sessions")
def start_session(body: StartSessionRequest):
    sid = new_id()
    with get_db() as conn:
        user = conn.execute("SELECT id FROM users WHERE id = ?", (body.user_id,)).fetchone()
        if not user:
            raise HTTPException(404, "User not found")
        conn.execute(
            "INSERT INTO sessions (id, user_id, lesson_number, started_at) VALUES (?, ?, ?, ?)",
            (sid, body.user_id, body.lesson_number, now_iso()),
        )
    return {"session_id": sid}


@app.patch("/sessions/{session_id}")
def end_session(session_id: str, body: EndSessionRequest):
    with get_db() as conn:
        row = conn.execute("SELECT started_at FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Session not found")

        started = datetime.fromisoformat(row["started_at"])
        ended = datetime.now(timezone.utc)
        duration = int((ended - started).total_seconds())

        conn.execute("""
            UPDATE sessions
            SET ended_at = ?, duration_secs = ?, message_count = ?, transcript = ?
            WHERE id = ?
        """, (ended.isoformat(), duration, body.message_count, json.dumps(body.transcript), session_id))

    return {"ok": True, "duration_secs": duration}


@app.post("/sessions/{session_id}/quiz")
def save_quiz(session_id: str, body: SaveQuizRequest):
    with get_db() as conn:
        row = conn.execute("SELECT id FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Session not found")

        score = score_quiz(body.answers, body.correct_answers)
        conn.execute("""
            INSERT INTO quiz_attempts (id, session_id, is_pre, answers, score, total, answered_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            new_id(), session_id, int(body.is_pre),
            json.dumps(body.answers), score, len(body.correct_answers), now_iso(),
        ))

    return {"score": score, "total": len(body.correct_answers)}


@app.get("/sessions/{session_id}/results")
def get_results(session_id: str):
    with get_db() as conn:
        session = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if not session:
            raise HTTPException(404, "Session not found")

        pre = conn.execute("""
            SELECT score, total, answers FROM quiz_attempts
            WHERE session_id = ? AND is_pre = 1
            ORDER BY answered_at DESC LIMIT 1
        """, (session_id,)).fetchone()
        post = conn.execute("""
            SELECT score, total, answers FROM quiz_attempts
            WHERE session_id = ? AND is_pre = 0
            ORDER BY answered_at DESC LIMIT 1
        """, (session_id,)).fetchone()

    return {
        "session": dict(session),
        "pre":  {"score": pre["score"],  "total": pre["total"]}  if pre  else None,
        "post": {"score": post["score"], "total": post["total"]} if post else None,
        "improvement": (
            (post["score"] - pre["score"]) if pre and post else None
        ),
    }


# ── Admin endpoints ────────────────────────────────────────────────────────────

def check_admin(key: str):
    if key != ADMIN_KEY:
        raise HTTPException(403, "Forbidden")


@app.get("/admin/users")
def admin_users(key: str = Query(...)):
    check_admin(key)
    with get_db() as conn:
        rows = conn.execute("""
            SELECT u.id, u.name, u.created_at,
                   COUNT(DISTINCT s.id) as total_sessions,
                   COUNT(DISTINCT CASE WHEN s.ended_at IS NOT NULL THEN s.id END) as completed_sessions,
                   MAX(s.started_at) as last_active
            FROM users u
            LEFT JOIN sessions s ON s.user_id = u.id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        """).fetchall()
    return [dict(r) for r in rows]


@app.get("/admin/sessions")
def admin_sessions(key: str = Query(...)):
    check_admin(key)
    with get_db() as conn:
        rows = conn.execute("""
            SELECT s.id, u.name as user_name, s.lesson_number,
                   s.started_at, s.ended_at, s.duration_secs, s.message_count,
                   pre.score as pre_score, pre.total as pre_total,
                   post.score as post_score, post.total as post_total
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            LEFT JOIN (
                SELECT session_id, score, total FROM quiz_attempts WHERE is_pre = 1
            ) pre ON pre.session_id = s.id
            LEFT JOIN (
                SELECT session_id, score, total FROM quiz_attempts WHERE is_pre = 0
            ) post ON post.session_id = s.id
            ORDER BY s.started_at DESC
        """).fetchall()
    return [dict(r) for r in rows]


@app.get("/admin/sessions/{session_id}/transcript")
def admin_transcript(session_id: str, key: str = Query(...)):
    check_admin(key)
    with get_db() as conn:
        row = conn.execute("SELECT transcript FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Session not found")
    return {"transcript": json.loads(row["transcript"] or "[]")}

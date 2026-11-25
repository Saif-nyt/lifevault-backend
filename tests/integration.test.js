process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/lifevault_test";
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-validation-123456";
process.env.FRONTEND_URL = "http://localhost:3000";

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const { connectDatabase, disconnectDatabase } = require("../src/config/db");

let mongo;
let agentA;
let agentB;
let archiveId;
let categoryId;
let collectionId;
let reminderId;

const userA = { name: "Ada Lovelace", email: "ada@example.com", password: "analytical1" };
const userB = { name: "Grace Hopper", email: "grace@example.com", password: "compiler2" };

test.before(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDatabase(mongo.getUri("lifevault_test"));
  agentA = request.agent(app);
  agentB = request.agent(app);
});

test.after(async () => {
  await disconnectDatabase();
  if (mongo) await mongo.stop();
});

test("registration returns a safe user and sets an httpOnly cookie", async () => {
  const res = await agentA.post("/api/v1/auth/register").send(userA).expect(201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.email, userA.email);
  assert.equal(res.body.data.user.passwordHash, undefined);
  const cookie = res.headers["set-cookie"].join(";");
  assert.match(cookie, /lifevault_token=/);
  assert.match(cookie, /HttpOnly/i);
});

test("duplicate registration is rejected", async () => {
  await agentA.post("/api/v1/auth/register").send(userA).expect(409);
});

test("second user registers", async () => {
  await agentB.post("/api/v1/auth/register").send(userB).expect(201);
});

test("login rejects bad credentials and accepts valid ones", async () => {
  await request(app)
    .post("/api/v1/auth/login")
    .send({ email: userA.email, password: "wrong-password1" })
    .expect(401);

  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: userA.email, password: userA.password })
    .expect(200);
  assert.equal(res.body.data.user.name, userA.name);
});

let accessToken;
let refreshToken;

test("login issues a short-lived access token and a rotating refresh token", async () => {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: userA.email, password: userA.password })
    .expect(200);

  accessToken = res.body.data.accessToken;
  refreshToken = res.body.data.refreshToken;
  assert.match(accessToken, /^ey/);
  assert.ok(refreshToken.length >= 40);
  assert.equal(res.body.data.token, accessToken);

  const me = await request(app)
    .get("/api/v1/auth/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .expect(200);
  assert.equal(me.body.data.user.email, userA.email);
});

test("refresh rotates the token and rejects the previous token", async () => {
  const refreshed = await request(app)
    .post("/api/v1/auth/refresh")
    .send({ refreshToken })
    .expect(200);

  const nextRefresh = refreshed.body.data.refreshToken;
  assert.notEqual(nextRefresh, refreshToken);
  assert.match(refreshed.body.data.accessToken, /^ey/);

  await request(app).post("/api/v1/auth/refresh").send({ refreshToken }).expect(401);

  const me = await request(app)
    .get("/api/v1/auth/me")
    .set("Authorization", `Bearer ${refreshed.body.data.accessToken}`)
    .expect(200);
  assert.equal(me.body.data.user.email, userA.email);

  refreshToken = nextRefresh;
});

test("invalid refresh tokens are rejected", async () => {
  await request(app).post("/api/v1/auth/refresh").send({ refreshToken: "x".repeat(64) }).expect(401);
});

test("protected endpoints require authentication", async () => {
  await request(app).get("/api/v1/archives").expect(401);
  await request(app).get("/api/v1/auth/me").expect(401);
});

test("current user is returned from the session cookie", async () => {
  const res = await agentA.get("/api/v1/auth/me").expect(200);
  assert.equal(res.body.data.user.email, userA.email);
});

test("default categories are created for a new user", async () => {
  const res = await agentA.get("/api/v1/categories").expect(200);
  assert.equal(res.body.data.categories.length, 10);
});

test("custom category can be created and renamed", async () => {
  const created = await agentA.post("/api/v1/categories").send({ name: "Recipes", color: "#C08552" }).expect(201);
  categoryId = created.body.data.category._id;

  const updated = await agentA
    .patch(`/api/v1/categories/${categoryId}`)
    .send({ name: "Family Recipes" })
    .expect(200);
  assert.equal(updated.body.data.category.name, "Family Recipes");
});

test("archive items can be created with tags and validated metadata", async () => {
  const res = await agentA
    .post("/api/v1/archives")
    .send({
      title: "How to read more effectively",
      description: "Notes from a learning session",
      content: "Spaced repetition and active recall.",
      type: "note",
      category: categoryId,
      tags: ["learning", "habits"],
      metadata: {},
    })
    .expect(201);

  archiveId = res.body.data.archive.id;
  assert.equal(res.body.data.archive.tags.length, 2);
  assert.equal(res.body.data.archive.tags[0].name, "learning");
});

test("invalid specialized metadata is rejected", async () => {
  await agentA
    .post("/api/v1/archives")
    .send({ title: "Bad book", type: "book", metadata: { status: "partially-read" } })
    .expect(400);
});

test("archive list supports search and filters", async () => {
  const search = await agentA.get("/api/v1/archives?q=effectively").expect(200);
  assert.equal(search.body.meta.total, 1);
  assert.equal(search.body.data.items[0].title, "How to read more effectively");

  const filtered = await agentA.get("/api/v1/archives?type=note&tag=learning").expect(200);
  assert.equal(filtered.body.meta.total, 1);

  const empty = await agentA.get("/api/v1/archives?type=movie").expect(200);
  assert.equal(empty.body.meta.total, 0);
});

test("archive detail and update work", async () => {
  const detail = await agentA.get(`/api/v1/archives/${archiveId}`).expect(200);
  assert.equal(detail.body.data.archive.id, archiveId);

  const updated = await agentA
    .patch(`/api/v1/archives/${archiveId}`)
    .send({ title: "How to read more effectively (v2)", isFavorite: true })
    .expect(200);
  assert.equal(updated.body.data.archive.isFavorite, true);
});

test("another user cannot access, update or delete the archive", async () => {
  await agentB.get(`/api/v1/archives/${archiveId}`).expect(404);
  await agentB.patch(`/api/v1/archives/${archiveId}`).send({ title: "Hijacked" }).expect(404);
  await agentB.delete(`/api/v1/archives/${archiveId}`).expect(404);
  await agentB.delete(`/api/v1/categories/${categoryId}`).expect(404);
});

test("collections can be created and populated", async () => {
  const created = await agentA
    .post("/api/v1/collections")
    .send({ name: "Learning Resources", description: "Things to revisit" })
    .expect(201);
  collectionId = created.body.data.collection._id;

  await agentA.post(`/api/v1/collections/${collectionId}/items`).send({ archiveId }).expect(200);

  const detail = await agentA.get(`/api/v1/collections/${collectionId}`).expect(200);
  assert.equal(detail.body.data.collection.items.length, 1);
  assert.equal(detail.body.data.collection.items[0].id, archiveId);
});

test("reminders can be created and completed", async () => {
  const created = await agentA
    .post("/api/v1/reminders")
    .send({ title: "Review reading notes", remindAt: new Date(Date.now() + 86400000).toISOString() })
    .expect(201);
  reminderId = created.body.data.reminder._id;

  const completed = await agentA
    .patch(`/api/v1/reminders/${reminderId}`)
    .send({ completed: true })
    .expect(200);
  assert.equal(completed.body.data.reminder.completed, true);
  assert.ok(completed.body.data.reminder.completedAt);
});

test("dashboard endpoints return real aggregate data", async () => {
  const stats = await agentA.get("/api/v1/dashboard/stats").expect(200);
  assert.equal(stats.body.data.totalItems, 1);
  assert.equal(stats.body.data.favorites, 1);

  const recent = await agentA.get("/api/v1/dashboard/recent").expect(200);
  assert.equal(recent.body.data.items.length, 1);
});

test("timeline groups real items", async () => {
  const res = await agentA.get(`/api/v1/archives/timeline?year=${new Date().getFullYear()}`).expect(200);
  assert.ok(res.body.data.items.some((item) => item.id === archiveId));
  assert.ok(res.body.data.availableYears.includes(new Date().getFullYear()));
});

test("upload validation rejects unsupported types", async () => {
  await agentA
    .post("/api/v1/uploads")
    .attach("file", Buffer.from("hello"), { filename: "a.exe", contentType: "application/x-msdownload" })
    .expect(400);
});

test("upload without Cloudinary configuration returns a clear 503", async () => {
  const res = await agentA
    .post("/api/v1/uploads")
    .attach("file", Buffer.from("%PDF-1.4"), { filename: "notes.pdf", contentType: "application/pdf" })
    .expect(503);
  assert.match(res.body.message, /not configured/i);
});

test("archive can be deleted and is removed from collections", async () => {
  await agentA.delete(`/api/v1/archives/${archiveId}`).expect(200);
  await agentA.get(`/api/v1/archives/${archiveId}`).expect(404);

  const detail = await agentA.get(`/api/v1/collections/${collectionId}`).expect(200);
  assert.equal(detail.body.data.collection.items.length, 0);
});

test("logout clears the session", async () => {
  await agentA.post("/api/v1/auth/logout").expect(200);
  await agentA.get("/api/v1/auth/me").expect(401);
});

test("mobile logout revokes the refresh token", async () => {
  await request(app)
    .post("/api/v1/auth/logout")
    .send({ refreshToken })
    .expect(200);
  await request(app).post("/api/v1/auth/refresh").send({ refreshToken }).expect(401);
});

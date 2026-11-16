# EasyBook API: Frontend Guide

> **Status:** sections 1–7 are written (Step 2). Endpoint sections are added as each module ships.
> Anything marked _(coming in Step N)_ is not built yet, so don't code against it until it appears in the [Changelog](#12-changelog).

---

## 1. Overview

EasyBook is a mobile app for booking local services, such as a haircut, a massage or a home cleaning.
This API handles accounts, the service catalogue, available time slots, appointments, and an AI assistant that recommends services.

---

## 2. Base URLs

| Environment | Base URL |
|---|---|
| Local (iOS simulator / desktop) | `http://localhost:4000/api/v1` |
| Local (Android emulator) | `http://10.0.2.2:4000/api/v1` (`10.0.2.2` is the emulator's alias for your computer) |
| Production (Render) | `https://<render-service-name>.onrender.com/api/v1` _(filled in after deploy, Step 4)_ |

**Cold starts:** the production server runs on Render's free tier, which sleeps when it is idle. The **first request after a quiet period can take 30–50 seconds**. Use a generous timeout (60s) for the first call, or call `GET /health` on the splash screen to wake the server.

---

## 3. Quick start

**1. Create an account** _(endpoint lands in Step 5)_

```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ayesha Rahman","email":"ayesha@example.com","password":"Secret123"}'
```

The response contains `data.token`. Save it securely (for example with `flutter_secure_storage`).

**2. Send the token on protected requests**

```bash
curl http://localhost:4000/api/v1/users/me \
  -H "Authorization: Bearer <token>"
```

**3. Fetch services** (public, no token needed) _(endpoint lands in Step 6)_

```bash
curl "http://localhost:4000/api/v1/services?featured=true"
```

You can check the server is up right now:

```bash
curl http://localhost:4000/api/v1/health
```

```json
{ "success": true, "data": { "status": "ok", "uptime": 2 } }
```

---

## 4. Authentication

- Log in or register to get a **JWT token**. Send it on every protected request:
  ```
  Authorization: Bearer <token>
  ```
- **Lifetime:** 7 days. There is no refresh token. When it expires, the user logs in again.
- **401 Unauthorized** means the token is missing, malformed or expired. **The app should clear the stored token and send the user to the login screen.**

The three 401 messages you can get (real responses):

```json
{ "success": false, "message": "Authentication required. Please log in." }
```
```json
{ "success": false, "message": "Invalid token. Please log in again." }
```
```json
{ "success": false, "message": "Your session has expired. Please log in again." }
```

You can show `message` to the user as is.

---

## 5. Conventions

### Response shape

Every response is JSON with a `success` flag.

**Success**

```json
{
  "success": true,
  "data": { },
  "message": "optional, human readable",
  "meta": { }
}
```

`message` and `meta` appear only when they apply. `meta` is used for pagination.

**Error**

```json
{
  "success": false,
  "message": "Human readable message you can show to the user",
  "errors": [{ "field": "email", "message": "Invalid email address" }]
}
```

`errors` appears only on **422 validation** errors. Each item names the `field` it belongs to, so you can show the message under that form field. Nested fields use dots (for example `history.0.content`).

Real 422 example:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "name", "message": "Invalid input: expected string, received undefined" },
    { "field": "qty", "message": "Too small: expected number to be >0" }
  ]
}
```

### Pagination _(used by `GET /services`, Step 6)_

Send `?page=1&limit=20`. The default is page 1 with 20 items, and `limit` can be at most 50. List responses include:

```json
"meta": { "page": 1, "limit": 20, "total": 9, "totalPages": 1 }
```

### Dates and times: always UTC

- **Always send and receive UTC**, in ISO 8601 format: `2026-11-20T03:00:00.000Z`.
- **Convert to local time only for display**: `DateTime.parse(value).toLocal()`.
- When sending a time, use `dateTime.toUtc().toIso8601String()`.
- The one exception is the `date` query parameter on availability, which is a plain calendar date (`YYYY-MM-DD`) in the business's time zone (**Asia/Dhaka, UTC+6**).
- Business hours are **09:00–18:00 Dhaka time**, every day. Slots start every **30 minutes**.

### Prices

`price` is returned as a **string** with two decimals, in **Bangladeshi Taka (BDT, ৳)**, for example `"500.00"`. This keeps the exact value (no floating-point rounding). In Dart, use `double.parse(json['price'])` for display or `Decimal.parse` if you do any money maths.

### Enums

`AppointmentStatus`:

| Value | Meaning |
|---|---|
| `PENDING` | Just booked. **The only status the user can cancel.** All new bookings start here. |
| `CONFIRMED` | Confirmed by the business. |
| `CANCELLED` | Cancelled. The time slot is free again. |
| `COMPLETED` | The appointment took place. |

---

## 6. Status codes and errors

| Code | When it happens | What the app should do |
|---|---|---|
| 200 | Request succeeded | Use `data` |
| 201 | Something was created (account, booking) | Use `data`, show a success state |
| 400 | The request body is not valid JSON | Bug in the app; show a generic error |
| 401 | Token missing, invalid or expired; or wrong login details | On protected routes: clear the token and go to login. On login: show `message` |
| 403 | Not allowed | Show `message` |
| 404 | Route, record or id not found (including someone else's booking) | Show "not found" and go back |
| 409 | Conflict: email already registered, slot already booked, booking can't be cancelled | Show `message` and refresh the data (e.g. reload availability) |
| 413 | Request body over 10 KB | Shorten the input |
| 422 | Validation failed | Show each `errors[].message` under its `field` |
| 429 | Too many requests | Show `message` and ask the user to wait |
| 500 | Unexpected server error | Show "Something went wrong" and offer a retry |
| 502 / 503 | AI assistant unavailable or timed out _(Step 8)_ | Show `message` and offer a retry |

Real examples:

```json
// 400
{ "success": false, "message": "Malformed JSON in request body" }
```
```json
// 404 (unknown route)
{ "success": false, "message": "Route not found: GET /api/v1/does-not-exist" }
```
```json
// 413
{ "success": false, "message": "Request body is too large" }
```
```json
// 500
{ "success": false, "message": "Something went wrong. Please try again." }
```

**Rate limits** (per device IP):

| Routes | Limit |
|---|---|
| All routes | 300 requests / 15 minutes |
| `/auth/*` | 20 requests / 15 minutes |
| `/ai/*` | 10 requests / minute |

---

## 7. Booking flow guide

The screens and calls, in order. _(Endpoints land in Steps 6 and 7.)_

1. **Home / service list:** `GET /services` (with `search`, `category`, `featured`, `minPrice`, `maxPrice`, `page`). Use `GET /services/categories` for filter chips.
2. **Service detail:** `GET /services/:id`.
3. **Pick a date:** the user picks a calendar day.
4. **Show time slots:** `GET /services/:id/availability?date=YYYY-MM-DD`. Show every slot and **disable the ones with `available: false`** (already booked, in the past, or too late to finish before closing).
5. **Book:** `POST /appointments` with `{ serviceId, startTime, notes? }`. Send `startTime` exactly as it came from the availability response.
   - `201` means it's booked. The status will be `PENDING`.
   - `409` means someone else just took the slot. Show the message and reload availability (step 4).
6. **Confirmation screen:** show the returned appointment (convert times to local).
7. **My Bookings:** `GET /appointments?type=upcoming` and `GET /appointments?type=past` (two tabs). Use `GET /appointments/:id` for detail.
8. **Cancel:** `PATCH /appointments/:id/cancel`. **Only `PENDING` bookings can be cancelled.** Show the Cancel button only when `status == "PENDING"`. Other statuses return `409`.

---

## 8. Endpoints

### GET /health

Checks the server is running. Also useful for waking the server on the splash screen.

**Auth required:** No

**Request:** no parameters.

**Success: 200**

```json
{ "success": true, "data": { "status": "ok", "uptime": 2 } }
```

`uptime` is the number of seconds since the server started.

**Tested scenarios**
- [x] returns 200 with status ok and the uptime in seconds
- [x] sets security headers from helmet and hides x-powered-by
- [x] unknown routes return 404 in the standard error shape
- [x] malformed JSON returns 400 in the standard error shape
- [x] a body larger than 10kb returns 413 in the standard error shape

**Frontend notes:** call this with a long timeout (60s) on app start to wake the production server.

_Other endpoints are added in Steps 5–9._

---

## 9. Data models

_(Added in Step 10.)_

## 10. Demo credentials

After `npm run seed`, this account exists with sample data:

| Email | Password |
|---|---|
| `demo@example.com` | `Demo1234` |

The demo user has four bookings, so every My Bookings state can be seen right away:

| Status | When |
|---|---|
| `COMPLETED` | 7 days ago (Past tab) |
| `CONFIRMED` | in 2 days (Upcoming tab) |
| `CANCELLED` | in 3 days (Past tab) |
| `PENDING` | in 5 days (Upcoming tab, can be cancelled) |

The seed also creates **10 services in 4 categories** (Hair & Beauty, Wellness, Home Services, Health). **4 of them are featured.** Rerunning the seed resets the demo user's bookings.

## 11. Test coverage summary

| Area | Tests | Status |
|---|---|---|
| Health, unknown routes, body errors | 5 | ✅ passing |
| Shared middleware (validation, auth token, rate limit) | 8 | ✅ passing |
| Time-zone helpers | 6 | ✅ passing |
| Database double-booking constraint | 5 | ✅ passing |

## 12. Changelog

- **2026-11-16:** Database and demo data. The seed adds 10 services and a demo user (see Demo credentials). Prices are in BDT. No endpoint changes.
- **2026-11-16:** First version. `GET /health`, response and error conventions, and the booking flow outline.

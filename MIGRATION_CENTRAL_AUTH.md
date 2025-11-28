# Migration to Centralized Authentication

This document describes the changes made to integrate with the centralized authentication system running on port 3000.

## Changes Made

### 1. Authentication Service
- **File**: `apps/backend/src/services/auth.service.ts`
- Teacher authentication now uses centralized auth API (`http://localhost:3000/verify`)
- JWT tokens now store central user ID instead of local teacher ID

### 2. Database Schema
- **File**: `apps/backend/prisma/schema.prisma`
- `Session` model now has `centralUserId` field (required)
- `teacherId` field is now optional (deprecated, kept for backward compatibility)
- Teacher model is deprecated but kept for migration purposes

### 3. Services Updated
- `session.service.ts`: Uses `centralUserId` instead of `teacherId`
- `workshop.service.ts`: Updated to work with central user IDs
- All teacher controllers updated to check `centralUserId` instead of `teacherId`

### 4. Configuration
- **File**: `apps/backend/src/config/env.ts`
- Added `CENTRAL_AUTH_URL` environment variable (defaults to `http://localhost:3000`)

### 5. New Files
- `apps/backend/src/lib/centralAuth.ts`: Central authentication client

## Required Steps

### 1. Install Dependencies
```bash
cd apps/backend
npm install
```

### 2. Update Environment Variables
Add to `apps/backend/.env`:
```env
CENTRAL_AUTH_URL=http://localhost:3000
```

### 3. Run Database Migration
```bash
cd apps/backend
npx prisma migrate dev --name add_central_user_id
```

This will:
- Add `centralUserId` column to `Session` table
- Make `teacherId` nullable
- Add index on `centralUserId`

### 4. Migrate Existing Data (if any)
If you have existing sessions, you'll need to migrate the `teacherId` values to `centralUserId`. You can do this with a SQL script or Prisma script.

Example SQL:
```sql
-- Update existing sessions to use centralUserId
-- Note: You'll need to map old teacherId to central user IDs
UPDATE "Session" SET "centralUserId" = "teacherId" WHERE "centralUserId" IS NULL;
```

### 5. Ensure Central Auth Server is Running
Make sure the centralized authentication server (nexusindex) is running on port 3000:
```bash
cd /Users/ylong/Projects/nexusindex
npm start
```

## API Changes

### Teacher Login
- **Endpoint**: `POST /api/teacher/login`
- **Request**: `{ username: string, password: string }`
- **Response**: `{ token: string, teacher: { id: number, username: string } }`
- The `id` in the response is now the central user ID

### Session Creation
- Sessions are now associated with central user IDs
- All session ownership checks use `centralUserId`

## Breaking Changes

1. **Teacher IDs**: Teacher IDs in JWT tokens are now central user IDs, not local database IDs
2. **Session Ownership**: Sessions are now owned by central user IDs
3. **Teacher Model**: The local Teacher model is deprecated (but still exists for backward compatibility)

## Notes

- Student authentication remains unchanged (still uses local student accounts)
- The frontend doesn't need changes - the API contract is the same
- Old teacher accounts in the local database are no longer used for authentication
- Teachers must exist in the centralized authentication system

## Testing

1. Ensure central auth server is running on port 3000
2. Create a teacher account in the central system (nexusindex)
3. Start the backend server
4. Test teacher login - should authenticate against central server
5. Create a session - should be associated with central user ID
6. Verify session ownership checks work correctly


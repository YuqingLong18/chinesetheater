# Local Testing Guide - Chinese Theater Platform

This guide will walk you through setting up and testing the project locally.

## Prerequisites

Before starting, ensure you have:
- **Node.js 18+** installed (check with `node --version`)
- **npm 9+** installed (check with `npm --version`)
- **PostgreSQL** installed and running (or SQLite for simpler setup)
- **OpenRouter API Key** (get one from https://openrouter.ai/keys)

## Step-by-Step Setup

### Step 1: Install Node.js and npm (if not already installed)

If you see `zsh: command not found: npm`, you need to install Node.js first:

**On macOS:**
```bash
# Using Homebrew (recommended)
brew install node

# Or download from https://nodejs.org/
```

**Verify installation:**
```bash
node --version  # Should show v18.x or higher
npm --version   # Should show 9.x or higher
```

### Step 2: Install Project Dependencies

From the project root directory (`/Users/ylong/Projects/chinesetheater`):

```bash
# Install root dependencies
npm install

# Install backend dependencies
npm install --workspace backend

# Install frontend dependencies
npm install --workspace frontend
```

### Step 3: Set Up Database

#### Option A: PostgreSQL (Recommended for production-like testing)

1. **Install PostgreSQL** (if not already installed):
   ```bash
   # macOS with Homebrew
   brew install postgresql@14
   brew services start postgresql@14
   ```

2. **Create the database:**
   ```bash
   # Connect to PostgreSQL
   psql postgres

   # In PostgreSQL prompt, create database and user:
   CREATE DATABASE chinesetheater;
   CREATE USER chinesetheater WITH PASSWORD 'your_password_here';
   GRANT ALL PRIVILEGES ON DATABASE chinesetheater TO chinesetheater;
   \q
   ```

#### Option B: SQLite (Simpler, no server needed)

For SQLite, you just need to set the `DATABASE_URL` in `.env` to use a file path.

### Step 4: Configure Environment Variables

1. **Copy the example environment file:**
   ```bash
   cd apps/backend
   cp .env.example .env
   ```

2. **Edit `.env` file** with your actual values:
   ```bash
   # Open in your preferred editor
   nano .env
   # or
   code .env
   ```

3. **Required values to set:**

   **For PostgreSQL:**
   ```env
   DATABASE_URL=postgresql://chinesetheater:your_password@localhost:5432/chinesetheater
   DATABASE_PROVIDER=postgresql
   ```

   **For SQLite:**
   ```env
   DATABASE_URL=file:./dev.db
   DATABASE_PROVIDER=sqlite
   ```

   **Other required values:**
   ```env
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   # Generate a secure secret with: openssl rand -base64 32
   
   OPENROUTER_API_KEY=sk-or-v1-your-actual-api-key-here
   ```

   **Optional (with defaults):**
   ```env
   NODE_ENV=development
   PORT=4000
   OPENROUTER_CHAT_MODEL=anthropic/claude-3.5-sonnet
   OPENROUTER_IMAGE_MODEL=openai/dall-e-3
   ```

### Step 5: Update Prisma Schema (if using PostgreSQL)

The schema file has a hardcoded connection string. Update it to use environment variable:

**File: `apps/backend/prisma/schema.prisma`**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Step 6: Run Database Migrations

**Option A: Keep Migration History (Recommended for team projects)**

```bash
cd apps/backend
npx prisma migrate dev
```

This will:
- Create all database tables
- Apply all migrations
- Generate Prisma Client

**Option B: Start Fresh - Reset All Migrations**

If you want to erase all migration history and create a fresh database from the current schema:

```bash
cd apps/backend

# 1. Delete all existing migrations (⚠️ This removes migration history)
rm -rf prisma/migrations

# 2. Reset the database (drops all tables and data)
npx prisma migrate reset

# 3. Create a new initial migration from current schema
npx prisma migrate dev --name init

# This will:
# - Create a fresh database matching your current schema
# - Generate a single new migration file
# - Generate Prisma Client
```

**⚠️ Important Notes:**
- **Option B will DELETE all existing data** in your database
- **Option B removes migration history** - only use if you're starting fresh or don't need to track migration history
- Use **Option A** if you're working with a team or want to preserve migration history
- Use **Option B** if you're setting up locally and want a clean slate

**When to use Option B:**
- Setting up a fresh local development environment
- You don't care about migration history
- You want the database to exactly match your current schema
- You're okay with losing all existing data

### Step 7: Create a Teacher Account

You need at least one teacher account to log in:

```bash
# From project root
npm run create:teacher -- <username> <password>

# Example:
npm run create:teacher -- teacher1 mypassword123
```

### Step 8: Start the Backend Server

**Terminal 1 - Backend:**
```bash
# From project root
npm run dev:backend
```

The backend should start on `http://localhost:4000` (or your configured PORT).

### Step 9: Start the Frontend Development Server

**Terminal 2 - Frontend:**
```bash
# From project root
npm run dev:frontend
```

The frontend should start on `http://localhost:5173`.

### Step 10: Test the Application

1. **Open browser:** Navigate to `http://localhost:5173`

2. **Teacher Login:**
   - Click on "Teacher Login" or navigate to `/teacher/login`
   - Use the username/password you created in Step 7

3. **Create a Session:**
   - After logging in, create a new classroom session
   - Note the session PIN

4. **Generate Student Accounts:**
   - Generate student accounts for the session
   - Note the student usernames and passwords

5. **Student Login:**
   - Log out or open an incognito window
   - Navigate to `/student/login`
   - Use one of the student credentials

6. **Test Features:**
   - Chat with the AI author
   - Generate images
   - View gallery
   - Test other features

## Troubleshooting

### Database Connection Issues

**Error: "Can't reach database server"**
- Ensure PostgreSQL is running: `brew services list` (macOS) or `sudo systemctl status postgresql` (Linux)
- Check connection string in `.env` matches your database setup
- Verify database exists: `psql -l` should list `chinesetheater`

**Error: "Migration failed"**
- Ensure database is empty or use `npx prisma migrate reset` (⚠️ deletes all data)
- Check Prisma schema matches migrations

### Port Already in Use

**Error: "Port 4000 already in use"**
- Change `PORT` in `.env` to another port (e.g., `4001`)
- Or kill the process using port 4000:
  ```bash
  lsof -ti:4000 | xargs kill -9
  ```

### Missing Dependencies

**Error: "Cannot find module"**
- Run `npm install` from project root
- Run `npm install --workspace backend` and `npm install --workspace frontend`
- Delete `node_modules` and reinstall if issues persist

### Prisma Client Not Generated

```bash
cd apps/backend
npx prisma generate
```

## Data Recovery - Can You Access Old Data?

### Understanding Your Situation

When you cloned the repository from GitHub, you got:
- ✅ **Code** - All source files
- ✅ **Database schema** - Prisma migrations
- ❌ **Database data** - NOT included (databases are never in git)

### Can You Recover Your Old Data?

**YES, if:**
1. Your old database still exists on your local machine
2. You're using the same database connection string
3. The database wasn't deleted or reset

**To check if your old database exists:**

1. **Check PostgreSQL databases:**
   ```bash
   psql -l
   ```
   Look for a database that might contain your old data (could be named `chinesetheater` or something else).

2. **If you find it, connect and inspect:**
   ```bash
   psql -d <database_name>
   \dt  # List tables
   SELECT * FROM "Teacher";  # Check if data exists
   \q
   ```

3. **To use your old database:**
   - Update `DATABASE_URL` in `.env` to point to your old database
   - Run migrations: `npx prisma migrate deploy` (instead of `dev`) to apply any new migrations without resetting
   - Or use `npx prisma migrate resolve` if there are conflicts

**NO, if:**
- You deleted the old database
- You're on a different machine
- The database was reset/recreated
- You were using a cloud database that's no longer accessible

### Recommended Approach

1. **First, check for old database** (see above)
2. **If found:** Point `.env` to it and use `migrate deploy`
3. **If not found:** Start fresh with new database (follow steps above)

### Backup Strategy for Future

To avoid losing data:
- **Regular backups:** Use `pg_dump` for PostgreSQL
- **Database dumps:** Export data periodically
- **Version control:** Keep migration files in git (already done)
- **Documentation:** Note your database connection details securely

## Quick Reference Commands

```bash
# Install dependencies
npm install
npm install --workspace backend
npm install --workspace frontend

# Database operations
cd apps/backend
npx prisma migrate dev          # Run migrations (development)
npx prisma migrate deploy       # Apply migrations (production)
npx prisma generate             # Generate Prisma Client
npx prisma studio               # Open database GUI

# Create teacher account
npm run create:teacher -- <username> <password>

# Start servers
npm run dev:backend             # Terminal 1
npm run dev:frontend            # Terminal 2

# Build for production
npm run build
```

## Next Steps

After setup:
- Explore the teacher dashboard
- Create test sessions
- Test student features
- Review API endpoints in `apps/backend/src/routes/`
- Check frontend components in `apps/frontend/src/components/`


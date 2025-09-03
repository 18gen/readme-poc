# Build & Preview MVP Setup Guide

## Environment Variables

Create a `.env.local` file in the frontend directory with the following variables:

```bash
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here

# GitHub OAuth (already configured)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Environment Variable Encryption Key (32 bytes base64)
# Generate with: openssl rand -base64 32
ENV_ENC_KEY=your-32-byte-base64-encryption-key-here
```

## Generate Encryption Key

Run this command to generate a secure encryption key:

```bash
openssl rand -base64 32
```

## Database Setup

The SQLite database will be automatically created when you first run the application. The Prisma schema is already configured.

## Running the Application

1. Install dependencies:
   ```bash
   npm install
   ```

2. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

3. Push database schema:
   ```bash
   npx prisma db push
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Features

- **Repository Selection**: Browse and search your GitHub repositories
- **Environment Variables**: Securely manage environment variables with encryption
- **Build & Deploy**: Build and run Node.js applications locally
- **Real-time Logs**: Stream build logs with Server-Sent Events
- **Preview**: View running applications in iframe with proxy support
- **Process Management**: Start and stop deployments

## Security Notes

- Environment variables are encrypted using AES-GCM
- Local development only - no isolation between applications
- Uses local child processes (no Docker)
- GitHub OAuth for authentication

## Architecture

- Next.js 15 with App Router
- Prisma + SQLite for data persistence
- Server-Sent Events for real-time updates
- Local process management with child_process
- Reverse proxy for preview functionality

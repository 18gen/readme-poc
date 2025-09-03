import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { runner } from '@/lib/runner';

interface SessionWithToken {
  accessToken?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !(session as SessionWithToken).accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { owner, repo, branch, projectId } = body;
    
    if (!owner || !repo || !branch || !projectId) {
      return NextResponse.json(
        { error: 'Owner, repo, branch, and projectId are required' }, 
        { status: 400 }
      );
    }
    
    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { envs: true }
    });
    
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' }, 
        { status: 404 }
      );
    }
    
    // Create build record
    const build = await prisma.build.create({
      data: {
        projectId,
        branch,
        status: 'QUEUED'
      }
    });
    
    // Create deployment record
    const deployment = await prisma.deployment.create({
      data: {
        projectId,
        buildId: build.id,
        status: 'PENDING'
      }
    });
    
    // Start build process asynchronously
    startBuildProcess(build.id, deployment.id, owner, repo, branch, projectId);
    
    return NextResponse.json({ 
      success: true, 
      buildId: build.id, 
      deploymentId: deployment.id 
    });
  } catch (error) {
    console.error('Failed to start build:', error);
    return NextResponse.json(
      { error: 'Failed to start build' }, 
      { status: 500 }
    );
  }
}

async function startBuildProcess(
  buildId: string, 
  deploymentId: string, 
  owner: string, 
  repo: string, 
  branch: string, 
  projectId: string
) {
  try {
    // Update build status to RUNNING
    await prisma.build.update({
      where: { id: buildId },
      data: { status: 'RUNNING' }
    });
    
    // Get environment variables
    const envVars = await prisma.environmentVariable.findMany({
      where: { projectId }
    });
    
    // Convert to environment object
    const env: Record<string, string> = {};
    for (const envVar of envVars) {
      // Decrypt value for runtime
      const { decrypt } = await import('@/lib/crypto');
      env[envVar.key] = decrypt(envVar.encryptedValue);
    }
    
    // Checkout repository and build
    const workdir = await runner.ensureRepoCheckedOut(owner, repo, branch);
    
    // Build and run the application
    const result = await runner.buildAndRunNodeApp(workdir, env, async (log) => {
      // Update build logs
      await prisma.build.update({
        where: { id: buildId },
        data: { 
          logs: (await prisma.build.findUnique({ where: { id: buildId } }))?.logs + '\n' + log || log
        }
      });
    });
    
    // Update build and deployment status
    await prisma.build.update({
      where: { id: buildId },
      data: { status: 'SUCCEEDED' }
    });
    
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { 
        status: 'RUNNING',
        pid: result.pid,
        hostPort: result.hostPort
      }
    });
    
  } catch (error) {
    console.error('Build process failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Update status to FAILED
    await prisma.build.update({
      where: { id: buildId },
      data: { 
        status: 'FAILED',
        logs: (await prisma.build.findUnique({ where: { id: buildId } }))?.logs + '\n[ERROR] ' + errorMessage || '[ERROR] ' + errorMessage
      }
    });
    
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'FAILED' }
    });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { runner } from '@/lib/runner';

interface SessionWithToken {
  accessToken?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !(session as SessionWithToken).accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;
    
    // Get deployment
    const deployment = await prisma.deployment.findUnique({
      where: { id },
      include: { project: true }
    });
    
    if (!deployment) {
      return NextResponse.json(
        { error: 'Deployment not found' }, 
        { status: 404 }
      );
    }
    
    if (deployment.status !== 'RUNNING') {
      return NextResponse.json(
        { error: 'Deployment is not running' }, 
        { status: 400 }
      );
    }
    
    if (!deployment.pid) {
      return NextResponse.json(
        { error: 'No process ID found' }, 
        { status: 400 }
      );
    }
    
    // Stop the process
    await runner.stopProcess(deployment.pid);
    
    // Update deployment status
    await prisma.deployment.update({
      where: { id },
      data: { status: 'STOPPED' }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to stop deployment:', error);
    return NextResponse.json(
      { error: 'Failed to stop deployment' }, 
      { status: 500 }
    );
  }
}

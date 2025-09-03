import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';

interface SessionWithToken {
  accessToken?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deploymentId: string; path: string[] }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !(session as SessionWithToken).accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { deploymentId, path } = await params;
    
    // Get deployment
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
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
    
    if (!deployment.hostPort) {
      return NextResponse.json(
        { error: 'No port assigned to deployment' }, 
        { status: 400 }
      );
    }
    
    // Construct the target URL
    const targetPath = path.join('/');
    const targetUrl = `http://localhost:${deployment.hostPort}/${targetPath}`;
    
    // Forward the request
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Content-Type': request.headers.get('content-type') || 'text/plain',
        'User-Agent': request.headers.get('user-agent') || 'readme-mvp-proxy'
      }
    });
    
    // Get response body
    const body = await response.text();
    
    // Create response with minimal headers
    const headers = new Headers();
    if (response.headers.get('content-type')) {
      headers.set('Content-Type', response.headers.get('content-type')!);
    }
    if (response.headers.get('content-length')) {
      headers.set('Content-Length', response.headers.get('content-length')!);
    }
    
    return new NextResponse(body, {
      status: response.status,
      headers
    });
  } catch (error) {
    console.error('Proxy request failed:', error);
    return NextResponse.json(
      { error: 'Proxy request failed' }, 
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deploymentId: string; path: string[] }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !(session as SessionWithToken).accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { deploymentId, path } = await params;
    
    // Get deployment
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
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
    
    if (!deployment.hostPort) {
      return NextResponse.json(
        { error: 'No port assigned to deployment' }, 
        { status: 400 }
      );
    }
    
    // Construct the target URL
    const targetPath = path.join('/');
    const targetUrl = `http://localhost:${deployment.hostPort}/${targetPath}`;
    
    // Get request body
    const body = await request.text();
    
    // Forward the request
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('content-type') || 'application/json',
        'User-Agent': request.headers.get('user-agent') || 'readme-mvp-proxy'
      },
      body
    });
    
    // Get response body
    const responseBody = await response.text();
    
    // Create response with minimal headers
    const headers = new Headers();
    if (response.headers.get('content-type')) {
      headers.set('Content-Type', response.headers.get('content-type')!);
    }
    if (response.headers.get('content-length')) {
      headers.set('Content-Length', response.headers.get('content-length')!);
    }
    
    return new NextResponse(responseBody, {
      status: response.status,
      headers
    });
  } catch (error) {
    console.error('Proxy request failed:', error);
    return NextResponse.json(
      { error: 'Proxy request failed' }, 
      { status: 500 }
    );
  }
}

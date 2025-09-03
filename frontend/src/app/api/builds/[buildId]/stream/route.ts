import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';

interface SessionWithToken {
  accessToken?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ buildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !(session as SessionWithToken).accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { buildId } = await params;
    
    // Verify build exists
    const build = await prisma.build.findUnique({
      where: { id: buildId }
    });
    
    if (!build) {
      return NextResponse.json(
        { error: 'Build not found' }, 
        { status: 404 }
      );
    }
    
    // Set up SSE headers
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    };
    
    const stream = new ReadableStream({
      start(controller) {
        const keepAliveInterval = setInterval(() => {
          controller.enqueue(new TextEncoder().encode(':\n\n'));
        }, 15000);
        
        const sendEvent = (event: string, data: Record<string, unknown>) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(message));
        };
        
        // Send initial status
        sendEvent('status', { 
          status: build.status,
          logs: build.logs 
        });
        
        // Poll for updates
        const pollInterval = setInterval(async () => {
          try {
            const updatedBuild = await prisma.build.findUnique({
              where: { id: buildId },
              include: { deployment: true }
            });
            
            if (updatedBuild) {
              // Send status update
              sendEvent('status', {
                status: updatedBuild.status,
                logs: updatedBuild.logs,
                deployment: updatedBuild.deployment
              });
              
              // If build is complete, stop polling
              if (['SUCCEEDED', 'FAILED'].includes(updatedBuild.status)) {
                clearInterval(pollInterval);
                clearInterval(keepAliveInterval);
                controller.close();
              }
            }
          } catch (error) {
            console.error('Error polling build status:', error);
          }
        }, 1000);
        
        // Cleanup on close
        request.signal.addEventListener('abort', () => {
          clearInterval(pollInterval);
          clearInterval(keepAliveInterval);
          controller.close();
        });
      }
    });
    
    return new Response(stream, { headers });
  } catch (error) {
    console.error('Failed to stream build:', error);
    return NextResponse.json(
      { error: 'Failed to stream build' }, 
      { status: 500 }
    );
  }
}

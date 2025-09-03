import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/crypto';

interface SessionWithToken {
  accessToken?: string;
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !(session as SessionWithToken).accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { projectId, items } = body;
    
    if (!projectId || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Invalid request body' }, 
        { status: 400 }
      );
    }
    
    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });
    
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' }, 
        { status: 404 }
      );
    }
    
    const results = [];
    
    for (const item of items) {
      const { key, value } = item;
      
      if (!key) {
        continue;
      }
      
      if (value === null || value === '') {
        // Delete environment variable
        await prisma.environmentVariable.deleteMany({
          where: {
            projectId,
            key
          }
        });
        results.push({ key, action: 'deleted' });
      } else {
        // Encrypt and upsert
        const encryptedValue = encrypt(value);
        
        await prisma.environmentVariable.upsert({
          where: {
            projectId_key: { projectId, key }
          },
          update: {
            encryptedValue,
            updatedAt: new Date()
          },
          create: {
            projectId,
            key,
            encryptedValue
          }
        });
        
        results.push({ key, action: 'updated' });
      }
    }
    
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Failed to update environment variables:', error);
    return NextResponse.json(
      { error: 'Failed to update environment variables' }, 
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !(session as SessionWithToken).accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const key = searchParams.get('key');
    
    if (!projectId || !key) {
      return NextResponse.json(
        { error: 'Project ID and key are required' }, 
        { status: 400 }
      );
    }
    
    // Get environment variable
    const envVar = await prisma.environmentVariable.findUnique({
      where: {
        projectId_key: { projectId, key }
      }
    });
    
    if (!envVar) {
      return NextResponse.json(
        { error: 'Environment variable not found' }, 
        { status: 404 }
      );
    }
    
    // Decrypt and return value
    const decryptedValue = decrypt(envVar.encryptedValue);
    
    return NextResponse.json({ value: decryptedValue });
  } catch (error) {
    console.error('Failed to get environment variable:', error);
    return NextResponse.json(
      { error: 'Failed to get environment variable' }, 
      { status: 500 }
    );
  }
}

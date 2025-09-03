import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';

interface SessionWithToken {
  accessToken?: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !(session as SessionWithToken).accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    
    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Owner and repo parameters are required' }, 
        { status: 400 }
      );
    }
    
    // Get or create project
    let project = await prisma.project.findUnique({
      where: { owner_repo: { owner, repo } },
      include: {
        envs: {
          select: {
            id: true,
            key: true,
            createdAt: true,
            updatedAt: true
          }
        },
        builds: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            deployment: true
          }
        },
        deployments: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });
    
    if (!project) {
      // Create new project
      project = await prisma.project.create({
        data: {
          owner,
          repo,
          defaultBranch: 'main' // Will be updated with actual default branch
        },
        include: {
          envs: {
            select: {
              id: true,
              key: true,
              createdAt: true,
              updatedAt: true
            }
          },
          builds: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              deployment: true
            }
          },
          deployments: {
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      });
    }
    
    return NextResponse.json(project);
  } catch (error) {
    console.error('Failed to fetch project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' }, 
      { status: 500 }
    );
  }
}

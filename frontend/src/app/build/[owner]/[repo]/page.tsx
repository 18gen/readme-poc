"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BuildPanel } from '@/components/build/build-panel';
import { EnvEditor } from '@/components/build/env-editor';
import { PreviewFrame } from '@/components/build/preview-frame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, GitBranch, Calendar, User, Globe, Lock } from 'lucide-react';
import Link from 'next/link';

interface Project {
  id: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
  envs: Array<{
    id: string;
    key: string;
    createdAt: string;
    updatedAt: string;
  }>;
  builds: Array<{
    id: string;
    branch: string;
    status: string;
    createdAt: string;
    deployment?: {
      id: string;
      status: string;
      pid?: number;
      hostPort?: number;
    };
  }>;
  deployments: Array<{
    id: string;
    status: string;
    pid?: number;
    hostPort?: number;
    createdAt: string;
  }>;
}

export default function RepoDetailPage() {
  const params = useParams();
  const owner = params.owner as string;
  const repo = params.repo as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchProject();
  }, [owner, repo]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/project?owner=${owner}&repo=${repo}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch project');
      }
      
      const data = await response.json();
      setProject(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'プロジェクトの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleEnvUpdate = () => {
    fetchProject();
  };

  const getCurrentDeployment = () => {
    if (!project) return undefined;
    return project.deployments.find(d => d.status === 'RUNNING') || undefined;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return <Badge variant="secondary">キュー中</Badge>;
      case 'RUNNING':
        return <Badge variant="default">実行中</Badge>;
      case 'SUCCEEDED':
        return <Badge variant="default" className="bg-green-500">成功</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">失敗</Badge>;
      case 'PENDING':
        return <Badge variant="outline">待機中</Badge>;
      case 'STOPPED':
        return <Badge variant="outline">停止</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">プロジェクトを読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || 'プロジェクトが見つかりません'}</p>
          <Button onClick={fetchProject} variant="outline">
            再試行
          </Button>
        </div>
      </div>
    );
  }

  const currentDeployment = getCurrentDeployment();

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/build">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              戻る
            </Button>
          </Link>
          
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{project.repo}</h1>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>@{project.owner}</span>
          </div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            <span>デフォルトブランチ: {project.defaultBranch}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>更新: {formatDate(project.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="environment">環境変数</TabsTrigger>
          <TabsTrigger value="build">ビルド</TabsTrigger>
          <TabsTrigger value="preview">プレビュー</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Recent Builds */}
          <div className="p-6 border rounded-lg bg-card">
            <h3 className="text-lg font-medium mb-4">最近のビルド</h3>
            {project.builds.length > 0 ? (
              <div className="space-y-3">
                {project.builds.map((build) => (
                  <div key={build.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{build.branch}</span>
                      </div>
                      {getStatusBadge(build.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(build.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>まだビルドが実行されていません</p>
                <p className="text-sm">「ビルド」タブで最初のビルドを開始してください</p>
              </div>
            )}
          </div>

          {/* Recent Deployments */}
          <div className="p-6 border rounded-lg bg-card">
            <h3 className="text-lg font-medium mb-4">最近のデプロイメント</h3>
            {project.deployments.length > 0 ? (
              <div className="space-y-3">
                {project.deployments.map((deployment) => (
                  <div key={deployment.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusBadge(deployment.status)}
                      {deployment.hostPort && (
                        <span className="text-sm font-mono">ポート: {deployment.hostPort}</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(deployment.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>まだデプロイメントが実行されていません</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="environment" className="space-y-6">
          <EnvEditor
            projectId={project.id}
            envs={project.envs}
            onEnvUpdate={handleEnvUpdate}
          />
        </TabsContent>

        <TabsContent value="build" className="space-y-6">
          <BuildPanel
            projectId={project.id}
            owner={project.owner}
            repo={project.repo}
            defaultBranch={project.defaultBranch}
            currentDeployment={currentDeployment}
          />
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          {currentDeployment ? (
            <PreviewFrame
              deploymentId={currentDeployment.id}
              status={currentDeployment.status}
              hostPort={currentDeployment.hostPort}
            />
          ) : (
            <div className="p-8 text-center border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground">
                実行中のデプロイメントがありません。
                「ビルド」タブでアプリケーションをビルドしてデプロイしてください。
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
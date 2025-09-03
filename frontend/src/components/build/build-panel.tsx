"use client";

import { useState, useEffect } from 'react';
import { Play, Square, GitBranch, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogViewer } from './log-viewer';

interface BuildPanelProps {
  projectId: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  currentDeployment?: {
    id: string;
    status: string;
    pid?: number;
    hostPort?: number;
  };
}

interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
  };
}

export function BuildPanel({ projectId, owner, repo, defaultBranch, currentDeployment }: BuildPanelProps) {
  const [selectedBranch, setSelectedBranch] = useState(defaultBranch);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [buildId, setBuildId] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [buildStatus, setBuildStatus] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBranches();
  }, [owner, repo]);

  useEffect(() => {
    if (currentDeployment) {
      setDeploymentId(currentDeployment.id);
      setBuildStatus(currentDeployment.status);
    }
  }, [currentDeployment]);

  const fetchBranches = async () => {
    try {
      const response = await fetch(`/api/github/branches?owner=${owner}&repo=${repo}`);
      if (response.ok) {
        const data = await response.json();
        setBranches(data);
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    }
  };

  const startBuild = async () => {
    try {
      setLoading(true);
      setError(null);
      setBuildStatus('queued');

      const response = await fetch('/api/builds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          owner,
          repo,
          branch: selectedBranch,
          projectId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start build');
      }

      const { buildId: newBuildId, deploymentId: newDeploymentId } = await response.json();
      setBuildId(newBuildId);
      setDeploymentId(newDeploymentId);
      setBuildStatus('running');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ビルドの開始に失敗しました');
      setBuildStatus('idle');
    } finally {
      setLoading(false);
    }
  };

  const stopDeployment = async () => {
    if (!deploymentId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/deployments/${deploymentId}/stop`, {
        method: 'POST'
      });

      if (response.ok) {
        setBuildStatus('stopped');
      }
    } catch (error) {
      console.error('Failed to stop deployment:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'idle':
        return <Badge variant="outline">待機中</Badge>;
      case 'queued':
        return <Badge variant="secondary">キュー中</Badge>;
      case 'running':
        return <Badge variant="default">実行中</Badge>;
      case 'succeeded':
        return <Badge variant="default" className="bg-green-500">成功</Badge>;
      case 'failed':
        return <Badge variant="destructive">失敗</Badge>;
      case 'stopped':
        return <Badge variant="outline">停止</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'succeeded':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'stopped':
        return <Square className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const canStartBuild = () => {
    return !loading && buildStatus === 'idle' && selectedBranch;
  };

  const canStopDeployment = () => {
    return !loading && buildStatus === 'running' && deploymentId;
  };

  return (
    <div className="space-y-6">
      {/* Build Controls */}
      <div className="p-6 border rounded-lg bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium">ビルド & デプロイ</h3>
            <p className="text-sm text-muted-foreground">
              選択したブランチでアプリケーションをビルドしてデプロイします
            </p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(buildStatus)}
            {getStatusBadge(buildStatus)}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">ブランチ</label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.name} value={branch.name}>
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      {branch.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md mb-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={startBuild}
            disabled={!canStartBuild()}
            className="flex-1"
          >
            <Play className="h-4 w-4 mr-2" />
            {loading ? 'ビルド中...' : 'Build & Run'}
          </Button>

          {canStopDeployment() && (
            <Button
              onClick={stopDeployment}
              variant="outline"
              disabled={loading}
            >
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
          )}
        </div>
      </div>

      {/* Build Logs */}
      {buildId && (
        <div className="p-6 border rounded-lg bg-card">
          <h3 className="text-lg font-medium mb-4">ビルドログ</h3>
          <LogViewer buildId={buildId} />
        </div>
      )}

      {/* Deployment Info */}
      {currentDeployment && currentDeployment.status === 'RUNNING' && (
        <div className="p-6 border rounded-lg bg-green-50 border-green-200">
          <h3 className="text-lg font-medium text-green-800 mb-2">デプロイメント情報</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">ステータス:</span>
              <Badge variant="default" className="ml-2 bg-green-500">実行中</Badge>
            </div>
            <div>
              <span className="font-medium">ポート:</span>
              <span className="ml-2 font-mono">{currentDeployment.hostPort}</span>
            </div>
            <div>
              <span className="font-medium">プロセスID:</span>
              <span className="ml-2 font-mono">{currentDeployment.pid}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

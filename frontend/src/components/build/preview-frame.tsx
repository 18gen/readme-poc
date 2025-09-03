"use client";

import { useState } from 'react';
import { ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PreviewFrameProps {
  deploymentId: string;
  status: string;
  hostPort?: number;
}

export function PreviewFrame({ deploymentId, status, hostPort }: PreviewFrameProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeError, setIframeError] = useState(false);
  const [loading, setLoading] = useState(true);

  const isRunning = status === 'RUNNING';
  const proxyUrl = `/api/proxy/${deploymentId}/`;

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
    setIframeError(false);
    setLoading(true);
  };

  const handleIframeLoad = () => {
    setLoading(false);
    setIframeError(false);
  };

  const handleIframeError = () => {
    setIframeError(true);
    setLoading(false);
  };

  const openInNewTab = () => {
    window.open(proxyUrl, '_blank');
  };

  if (!isRunning) {
    return (
      <div className="p-8 text-center border-2 border-dashed rounded-lg">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">
          プレビューは利用できません
        </h3>
        <p className="text-sm text-muted-foreground">
          デプロイメントが実行中でないため、プレビューを表示できません。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Preview Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">プレビュー</h3>
          <Badge variant="default" className="bg-green-500">
            実行中
          </Badge>
          {hostPort && (
            <Badge variant="outline" className="font-mono">
              ポート: {hostPort}
            </Badge>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            更新
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={openInNewTab}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            新しいタブで開く
          </Button>
        </div>
      </div>

      {/* Preview Frame */}
      <div className="relative border rounded-lg overflow-hidden bg-white">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">プレビューを読み込み中...</p>
            </div>
          </div>
        )}
        
        {iframeError && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-10">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-700 mb-2">プレビューの読み込みに失敗しました</p>
              <Button onClick={handleRefresh} size="sm">
                再試行
              </Button>
            </div>
          </div>
        )}
        
        <iframe
          key={iframeKey}
          src={proxyUrl}
          className="w-full h-[800px] border-0"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title="Application Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      </div>

      {/* Preview Info */}
      <div className="text-xs text-muted-foreground text-center">
        <p>プレビューは /api/proxy/{deploymentId}/ を通じて表示されています</p>
        <p>アプリケーションが正常に動作していない場合は、ビルドログを確認してください</p>
      </div>
    </div>
  );
}
